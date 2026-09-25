import crypto from 'crypto';
import { Writer, WriterProfile, MembershipPlan, WriterSubscription, SubscriptionPayment } from '../db.js';
import { applyDiscount, formatMoney } from './money.js';
import { getMembershipSettings, activeCurrencyCodes, GRACE_DAYS, RENEWAL_NOTICE_DAYS } from './membershipSettings.js';
import { membershipEligibility } from './writerService.js';
import { notify as sendNotification } from './notifications.js';
import { RAZORPAY_MIN_MINOR } from './paymentProviders.js';
import { remember, cacheDelPattern } from './cache.js';

const DAY = 24 * 60 * 60 * 1000;
const CHECKOUT_TTL_MS = DAY;
const PERIOD_RANK = { MONTHLY: 1, ANNUAL: 2 };
const LIVE_STATUSES = ['ACTIVE', 'PAST_DUE'];

export class MembershipError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

const genRef = (prefix) => `${prefix}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

// Adds one billing period, clamping to month end (31 Jan + 1 month = 28/29 Feb).
export function addPeriod(date, billingPeriod) {
    const d = new Date(date);
    const months = billingPeriod === 'ANNUAL' ? 12 : 1;
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, lastDay));
    return d;
}

const event = (type, actorType, note = '', actorId) => ({ type, actorType, note, actorId, at: new Date() });

// In-app + preferred channels via the shared notification service.
const notify = (writerId, title, message, { category = 'SUBSCRIPTION', type = 'MEMBERSHIP', link = '/writer/membership' } = {}) =>
    sendNotification({ writerId, category, type, title, message, link }).catch(err => console.error('[Membership] notify failed:', err.message));
export { notify as notifyMembership };

// ── Pricing (the only source of truth for amounts) ──────────────────────────────

// Loads the plan and price from the database. Nothing about price, currency or
// discount is ever taken from the client.
export async function priceFor({ planCode, planId, billingPeriod, currency }, { allowInactive = false } = {}) {
    const plan = planId ? await MembershipPlan.findById(planId) : await MembershipPlan.findOne({ code: planCode });
    if (!plan || (!plan.isActive && !allowInactive)) throw new MembershipError('That plan is not available.', 404);
    const settings = await getMembershipSettings();
    if (!allowInactive && !activeCurrencyCodes(settings).includes(currency))
        throw new MembershipError('That currency is not currently supported.');
    const price = plan.prices.find(p => p.currency === currency && p.billingPeriod === billingPeriod && (p.isActive || allowInactive));
    if (!price) throw new MembershipError(`The ${plan.name} plan is not offered ${billingPeriod.toLowerCase()} in ${currency}.`, 404);
    return {
        plan,
        listAmountMinor: price.amountMinor,
        discountPercent: price.discountPercent || 0,
        amountMinor: applyDiscount(price.amountMinor, price.discountPercent || 0),
    };
}

// Public catalogue: active plans with their active prices in active currencies.
export async function listPublicPlans() {
    return remember('membership:public_plans', 900, async () => {
        const settings = await getMembershipSettings();
        const currencies = activeCurrencyCodes(settings);
        const plans = await MembershipPlan.find({ isActive: true }).sort({ sortOrder: 1, tier: 1 }).lean();
        return {
            currencies,
            plans: plans.map(p => ({
                code: p.code, name: p.name, description: p.description, features: p.features, tier: p.tier, highlight: p.highlight,
                prices: p.prices.filter(pr => pr.isActive && currencies.includes(pr.currency)).map(pr => ({
                    currency: pr.currency, billingPeriod: pr.billingPeriod, listAmountMinor: pr.amountMinor,
                    discountPercent: pr.discountPercent, amountMinor: applyDiscount(pr.amountMinor, pr.discountPercent),
                })),
            })).filter(p => p.prices.length),
        };
    });
}

export async function suggestedCurrency(writerCountry) {
    const settings = await getMembershipSettings();
    const active = activeCurrencyCodes(settings);
    const byCountry = settings.countryCurrency[writerCountry];
    if (byCountry && active.includes(byCountry)) return byCountry;
    return active.includes(settings.defaultCurrency) ? settings.defaultCurrency : active[0] || 'USD';
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const getOpenSubscription = (writerId) => WriterSubscription.findOne({ writerId, isOpen: true });

const OPEN_PAYMENT = ['CREATED', 'PENDING_VERIFICATION'];

function classifyChange(sub, plan, billingPeriod) {
    if (plan.tier === sub.tier && billingPeriod === sub.billingPeriod) return 'SAME';
    if (plan.tier > sub.tier) return PERIOD_RANK[billingPeriod] >= PERIOD_RANK[sub.billingPeriod] ? 'UPGRADE' : 'INVALID';
    if (plan.tier === sub.tier) return PERIOD_RANK[billingPeriod] > PERIOD_RANK[sub.billingPeriod] ? 'UPGRADE' : 'DOWNGRADE';
    return 'DOWNGRADE';
}

// Unused value of the current period, credited against an upgrade.
function prorationCredit(sub, now = new Date()) {
    const total = sub.currentPeriodEnd - sub.currentPeriodStart;
    const remaining = Math.max(0, sub.currentPeriodEnd - now);
    return total > 0 ? Math.floor((sub.amountMinor * remaining) / total) : 0;
}

// Works out exactly what a checkout would do and cost. Used for the review step
// and re-run inside checkout() so the charged amount always matches.
export async function previewCheckout(writer, { planCode, billingPeriod, currency }) {
    const open = await getOpenSubscription(writer._id);
    const live = open && LIVE_STATUSES.includes(open.status);

    if (!live) {
        const eligibility = membershipEligibility(writer);
        if (!eligibility.eligible) throw new MembershipError(eligibility.reason, 403);
        if (open?.status === 'SUSPENDED') throw new MembershipError('Your membership is suspended. Please contact support.', 409);
        const q = await priceFor({ planCode, billingPeriod, currency });
        const start = new Date();
        return {
            type: 'NEW', plan: q.plan, billingPeriod, currency,
            listAmountMinor: q.listAmountMinor, discountPercent: q.discountPercent, periodAmountMinor: q.amountMinor,
            creditMinor: 0, amountDueMinor: q.amountMinor, effectiveAt: start, renewsAt: addPeriod(start, billingPeriod),
        };
    }

    if (open.status === 'PAST_DUE') throw new MembershipError('Please pay your outstanding renewal before changing plans.', 409);
    if (currency !== open.currency) throw new MembershipError(`Plan changes are billed in your subscription currency (${open.currency}).`);
    const q = await priceFor({ planCode, billingPeriod, currency });
    const type = classifyChange(open, q.plan, billingPeriod);
    if (type === 'SAME') throw new MembershipError('You are already on this plan.', 409);
    if (type === 'INVALID') throw new MembershipError('To upgrade from annual billing, choose an annual plan. You can switch to monthly at renewal.', 400);

    if (type === 'DOWNGRADE') {
        return {
            type, plan: q.plan, billingPeriod, currency, listAmountMinor: q.listAmountMinor, discountPercent: q.discountPercent,
            periodAmountMinor: q.amountMinor, creditMinor: 0, amountDueMinor: 0,
            effectiveAt: open.currentPeriodEnd, renewsAt: open.currentPeriodEnd,
        };
    }
    const creditMinor = prorationCredit(open);
    const now = new Date();
    return {
        type, plan: q.plan, billingPeriod, currency, listAmountMinor: q.listAmountMinor, discountPercent: q.discountPercent,
        periodAmountMinor: q.amountMinor, creditMinor, amountDueMinor: Math.max(0, q.amountMinor - creditMinor),
        effectiveAt: now, renewsAt: addPeriod(now, billingPeriod),
    };
}

export const serializePreview = (p) => ({
    type: p.type, planCode: p.plan.code, planName: p.plan.name, billingPeriod: p.billingPeriod, currency: p.currency,
    listAmountMinor: p.listAmountMinor, discountPercent: p.discountPercent, periodAmountMinor: p.periodAmountMinor,
    creditMinor: p.creditMinor, amountDueMinor: p.amountDueMinor, effectiveAt: p.effectiveAt, renewsAt: p.renewsAt,
});

// ── Writer membership snapshot ─────────────────────────────────────────────────

// Keeps Writer.status and Writer.membership consistent with the subscription.
// A live membership (ACTIVE / PAST_DUE grace) makes an approved writer ACTIVE.
export async function syncWriter(sub) {
    const writer = await Writer.findById(sub.writerId);
    if (!writer) return;
    const live = LIVE_STATUSES.includes(sub.status);
    writer.membership = {
        plan: sub.planName, tier: live ? sub.tier : 0, subscriptionId: sub._id, status: sub.status,
        activatedAt: sub.startDate, expiresAt: sub.currentPeriodEnd,
    };
    if (live) {
        if (writer.status === 'APPROVED') writer.status = 'ACTIVE';
        if (writer.statusBeforeSuspension === 'APPROVED') writer.statusBeforeSuspension = 'ACTIVE';
    } else {
        if (writer.status === 'ACTIVE') writer.status = 'APPROVED';
        if (writer.statusBeforeSuspension === 'ACTIVE') writer.statusBeforeSuspension = 'APPROVED';
    }
    await writer.save();
}

async function cancelOpenPayments(subId, kinds, reason) {
    await SubscriptionPayment.updateMany(
        { subscriptionId: subId, status: 'CREATED', ...(kinds ? { kind: { $in: kinds } } : {}) },
        { $set: { status: 'CANCELLED', failureReason: reason } },
    );
}

// ── Checkout ──────────────────────────────────────────────────────────────────

const paymentFields = (p, extra = {}) => ({
    planId: p.plan._id, planCode: p.plan.code, planName: p.plan.name, billingPeriod: p.billingPeriod, currency: p.currency,
    listAmountMinor: p.listAmountMinor, discountPercent: p.discountPercent, ...extra,
});

export async function checkout(writer, input) {
    const preview = await previewCheckout(writer, input);
    const profile = await WriterProfile.findOne({ writerId: writer._id }).select('country');
    const country = profile?.country || '';

    if (preview.type === 'NEW') {
        // Replace an abandoned pending checkout, unless a payment is already awaiting verification.
        const open = await getOpenSubscription(writer._id);
        if (open?.status === 'PENDING') {
            if (await SubscriptionPayment.exists({ subscriptionId: open._id, status: 'PENDING_VERIFICATION' }))
                throw new MembershipError('Your previous payment is still being verified. We’ll notify you as soon as it’s confirmed.', 409);
            await cancelOpenPayments(open._id, null, 'Replaced by a new checkout');
            open.status = 'EXPIRED'; open.endedAt = new Date(); open.endReason = 'CHECKOUT_REPLACED';
            await open.save();
        }
        const sub = await WriterSubscription.create({
            subscriptionId: genRef('SUB'), writerId: writer._id, userId: writer.userId,
            planId: preview.plan._id, planCode: preview.plan.code, planName: preview.plan.name, tier: preview.plan.tier,
            billingPeriod: preview.billingPeriod, currency: preview.currency, amountMinor: preview.periodAmountMinor,
            listAmountMinor: preview.listAmountMinor, discountPercent: preview.discountPercent, country, status: 'PENDING',
            history: [event('CHECKOUT_STARTED', 'WRITER', `${preview.plan.name} · ${preview.billingPeriod}`, writer.userId)],
        });
        const payment = await SubscriptionPayment.create({
            paymentRef: genRef('PAY'), subscriptionId: sub._id, writerId: writer._id, kind: 'NEW', country,
            amountMinor: preview.amountDueMinor, expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS), ...paymentFields(preview),
        });
        await syncWriter(sub);
        return { preview, subscription: sub, payment };
    }

    const sub = await getOpenSubscription(writer._id);

    if (preview.type === 'DOWNGRADE') {
        if (await SubscriptionPayment.exists({ subscriptionId: sub._id, kind: 'RENEWAL', status: 'PENDING_VERIFICATION' }))
            throw new MembershipError('Your renewal payment is being verified. You can change plans after it’s confirmed.', 409);
        // Any renewal invoice already issued was for the old plan; it will be reissued at the new price.
        await cancelOpenPayments(sub._id, ['RENEWAL', 'UPGRADE'], 'Plan change scheduled');
        sub.scheduledChange = { planId: preview.plan._id, planCode: preview.plan.code, billingPeriod: preview.billingPeriod, effectiveAt: sub.currentPeriodEnd };
        sub.history.push(event('DOWNGRADE_SCHEDULED', 'WRITER', `${preview.plan.name} · ${preview.billingPeriod} from ${sub.currentPeriodEnd.toISOString().slice(0, 10)}`, writer.userId));
        await sub.save();
        return { preview, subscription: sub, payment: null };
    }

    // UPGRADE
    if (await SubscriptionPayment.exists({ subscriptionId: sub._id, kind: 'UPGRADE', status: 'PENDING_VERIFICATION' }))
        throw new MembershipError('A previous upgrade payment is still being verified.', 409);
    await cancelOpenPayments(sub._id, ['UPGRADE'], 'Replaced by a new upgrade');
    const payment = await SubscriptionPayment.create({
        paymentRef: genRef('PAY'), subscriptionId: sub._id, writerId: writer._id, kind: 'UPGRADE', country,
        amountMinor: preview.amountDueMinor, creditMinor: preview.creditMinor, expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
        ...paymentFields(preview),
    });
    // Tiny balances (below the online minimum) are waived and applied immediately.
    if (preview.amountDueMinor < RAZORPAY_MIN_MINOR) {
        payment.provider = 'NONE';
        payment.reviewNote = preview.amountDueMinor === 0 ? 'Fully covered by proration credit' : 'Balance below minimum charge — waived';
        payment.amountMinor = 0;
        await payment.save();
        await markPaymentPaid(payment._id, { from: ['CREATED'], actor: 'SYSTEM' });
        return { preview, subscription: await WriterSubscription.findById(sub._id), payment: await SubscriptionPayment.findById(payment._id) };
    }
    sub.history.push(event('UPGRADE_STARTED', 'WRITER', `${preview.plan.name} · ${preview.billingPeriod}`, writer.userId));
    await sub.save();
    return { preview, subscription: sub, payment };
}

export async function cancelScheduledChange(writer) {
    const sub = await getOpenSubscription(writer._id);
    if (!sub?.scheduledChange?.planId) throw new MembershipError('There is no scheduled plan change.', 404);
    if (await SubscriptionPayment.exists({ subscriptionId: sub._id, kind: 'RENEWAL', status: 'PENDING_VERIFICATION' }))
        throw new MembershipError('Your renewal payment is being verified; the change can’t be undone now.', 409);
    await cancelOpenPayments(sub._id, ['RENEWAL'], 'Scheduled change cancelled');
    sub.scheduledChange = undefined;
    sub.history.push(event('DOWNGRADE_CANCELLED', 'WRITER', '', writer.userId));
    await sub.save();
    return sub;
}

// Writer turns auto-renewal off (cancel at period end) or back on.
export async function setAutoRenew(writer, enabled) {
    const sub = await getOpenSubscription(writer._id);
    if (!sub || !LIVE_STATUSES.includes(sub.status)) throw new MembershipError('You don’t have an active membership.', 404);
    if (sub.autoRenew === enabled) return sub;
    sub.autoRenew = enabled;
    if (enabled) {
        sub.cancelledAt = undefined;
        sub.history.push(event('AUTO_RENEW_RESUMED', 'WRITER', '', writer.userId));
    } else {
        sub.cancelledAt = new Date();
        sub.history.push(event('AUTO_RENEW_CANCELLED', 'WRITER', '', writer.userId));
        await cancelOpenPayments(sub._id, ['RENEWAL'], 'Auto-renewal cancelled');
        // Already past the renewal date: end now rather than wait out the grace period.
        if (sub.status === 'PAST_DUE') { sub.status = 'CANCELLED'; sub.endedAt = new Date(); sub.endReason = 'AUTO_RENEW_OFF'; }
    }
    await sub.save();
    await syncWriter(sub);
    return sub;
}

// ── Renewals ──────────────────────────────────────────────────────────────────

// Returns the open renewal invoice for the upcoming period, creating it if needed.
export async function ensureRenewalPayment(sub, { notifyWriter = true } = {}) {
    if (!LIVE_STATUSES.includes(sub.status) || !sub.autoRenew) return null;
    const periodStart = sub.currentPeriodEnd;
    const existing = await SubscriptionPayment.findOne({ subscriptionId: sub._id, kind: 'RENEWAL', periodStart, status: { $in: [...OPEN_PAYMENT, 'PAID'] } });
    if (existing) return existing;

    const target = sub.scheduledChange?.planId
        ? { planId: sub.scheduledChange.planId, billingPeriod: sub.scheduledChange.billingPeriod }
        : { planId: sub.planId, billingPeriod: sub.billingPeriod };
    let q;
    try {
        q = await priceFor({ ...target, currency: sub.currency }, { allowInactive: true });
    } catch (err) {
        console.error(`[Membership] cannot price renewal for ${sub.subscriptionId}:`, err.message);
        return null;
    }
    const payment = await SubscriptionPayment.create({
        paymentRef: genRef('PAY'), subscriptionId: sub._id, writerId: sub.writerId, kind: 'RENEWAL', country: sub.country,
        planId: q.plan._id, planCode: q.plan.code, planName: q.plan.name, billingPeriod: target.billingPeriod, currency: sub.currency,
        listAmountMinor: q.listAmountMinor, discountPercent: q.discountPercent, amountMinor: q.amountMinor,
        periodStart, expiresAt: new Date(periodStart.getTime() + GRACE_DAYS * DAY),
    });
    if (notifyWriter) {
        await notify(sub.writerId, 'Membership renewal due',
            `Your ${q.plan.name} membership renews on ${periodStart.toDateString()}. Amount due: ${formatMoney(q.amountMinor, sub.currency)}. Pay from the Membership page in your writer dashboard to keep your membership active.`, { type: 'RENEWAL_DUE' });
    }
    return payment;
}

// ── Applying payments ─────────────────────────────────────────────────────────

// Moves a payment to PAID exactly once, then applies it to the subscription.
// `from` lists the statuses the transition is allowed from.
export async function markPaymentPaid(paymentId, { from, actor = 'SYSTEM', adminId, provider, providerPaymentId, note } = {}) {
    const set = { status: 'PAID', paidAt: new Date() };
    if (provider) set.provider = provider;
    if (providerPaymentId) set.providerPaymentId = providerPaymentId;
    if (adminId) set.reviewedBy = adminId;
    if (note) set.reviewNote = note;
    const payment = await SubscriptionPayment.findOneAndUpdate({ _id: paymentId, status: { $in: from } }, { $set: set }, { new: true });
    if (!payment) return { payment: await SubscriptionPayment.findById(paymentId), applied: false };
    await applyPayment(payment, actor, adminId);
    return { payment: await SubscriptionPayment.findById(paymentId), applied: true };
}

// Idempotent: guarded by payment.appliedAt.
export async function applyPayment(payment, actorType = 'SYSTEM', actorId) {
    if (payment.appliedAt) return;
    const sub = await WriterSubscription.findById(payment.subscriptionId);
    const now = new Date();
    const flag = async (reason) => {
        await SubscriptionPayment.updateOne({ _id: payment._id }, { $set: { needsAttention: reason, appliedAt: now } });
        console.error(`[Membership] payment ${payment.paymentRef} needs attention: ${reason}`);
    };
    if (!sub) return flag('Subscription not found');

    const setPlanFromPayment = () => {
        sub.planId = payment.planId; sub.planCode = payment.planCode; sub.planName = payment.planName;
        sub.billingPeriod = payment.billingPeriod; sub.listAmountMinor = payment.listAmountMinor; sub.discountPercent = payment.discountPercent;
        sub.amountMinor = applyDiscount(payment.listAmountMinor, payment.discountPercent);
    };
    const planTier = async () => (await MembershipPlan.findById(payment.planId).select('tier'))?.tier ?? sub.tier;

    // A terminal subscription can be revived only if the writer has no other open one.
    if (!sub.isOpen) {
        const other = await getOpenSubscription(sub.writerId);
        if (other) return flag(`Paid after the subscription ended (${sub.status}); writer already has ${other.subscriptionId}. Refund or credit manually.`);
        if (payment.kind === 'UPGRADE') return flag('Upgrade paid after the subscription ended. Refund or credit manually.');
        setPlanFromPayment();
        sub.tier = await planTier();
        sub.startDate = sub.startDate || now;
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = addPeriod(now, payment.billingPeriod);
        sub.endedAt = undefined; sub.endReason = ''; sub.graceEndsAt = undefined; sub.cancelledAt = undefined; sub.autoRenew = true;
        sub.status = 'ACTIVE';
        sub.history.push(event('REACTIVATED_BY_PAYMENT', actorType, payment.paymentRef, actorId));
    } else if (payment.kind === 'NEW') {
        sub.status = 'ACTIVE';
        sub.startDate = now;
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = addPeriod(now, sub.billingPeriod);
        sub.history.push(event('ACTIVATED', actorType, payment.paymentRef, actorId));
    } else if (payment.kind === 'UPGRADE') {
        setPlanFromPayment();
        sub.tier = await planTier();
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = addPeriod(now, payment.billingPeriod);
        sub.scheduledChange = undefined;
        await cancelOpenPayments(sub._id, ['RENEWAL'], 'Superseded by upgrade');
        sub.history.push(event('UPGRADED', actorType, `${payment.planName} · ${payment.billingPeriod} (${payment.paymentRef})`, actorId));
    } else { // RENEWAL
        if (sub.status === 'SUSPENDED') return flag('Renewal paid while the subscription is suspended. Apply manually when reinstating.');
        setPlanFromPayment();
        sub.tier = await planTier();
        const start = payment.periodStart || sub.currentPeriodEnd || now;
        sub.currentPeriodStart = start;
        sub.currentPeriodEnd = addPeriod(start, payment.billingPeriod);
        if (sub.currentPeriodEnd <= now) { sub.currentPeriodStart = now; sub.currentPeriodEnd = addPeriod(now, payment.billingPeriod); }
        sub.scheduledChange = undefined;
        sub.graceEndsAt = undefined;
        sub.status = 'ACTIVE';
        sub.history.push(event('RENEWED', actorType, payment.paymentRef, actorId));
    }

    try {
        await sub.save();
    } catch (err) {
        if (err?.code === 11000) return flag('Could not reopen subscription: another open subscription exists.');
        throw err;
    }
    await SubscriptionPayment.updateOne({ _id: payment._id }, { $set: { appliedAt: now } });
    await syncWriter(sub);
    const verb = { NEW: 'is now active', UPGRADE: 'has been upgraded', RENEWAL: 'has been renewed' }[payment.kind];
    await notify(sub.writerId, `Membership ${payment.kind === 'NEW' ? 'activated' : payment.kind === 'UPGRADE' ? 'upgraded' : 'renewed'}`,
        `Your ${sub.planName} membership ${verb}. Next renewal date: ${sub.currentPeriodEnd.toDateString()}.`, { category: 'PAYMENT', type: 'PAYMENT_CONFIRMED' });
}

// ── Admin actions ─────────────────────────────────────────────────────────────

export async function adminSubscriptionAction(sub, action, reason, admin) {
    const now = new Date();
    if (action === 'suspend') {
        if (!LIVE_STATUSES.includes(sub.status)) throw new MembershipError(`Cannot suspend a ${sub.status.toLowerCase()} subscription.`, 409);
        sub.status = 'SUSPENDED';
    } else if (action === 'reinstate') {
        if (sub.status !== 'SUSPENDED') throw new MembershipError('Only suspended subscriptions can be reinstated.', 409);
        sub.status = sub.currentPeriodEnd > now ? 'ACTIVE' : 'EXPIRED';
        if (sub.status === 'EXPIRED') { sub.endedAt = now; sub.endReason = 'EXPIRED_WHILE_SUSPENDED'; }
    } else if (action === 'cancel') {
        if (!sub.isOpen) throw new MembershipError('This subscription has already ended.', 409);
        sub.status = 'CANCELLED'; sub.autoRenew = false; sub.cancelledAt = now; sub.endedAt = now; sub.endReason = 'CANCELLED_BY_ADMIN';
        await cancelOpenPayments(sub._id, null, 'Subscription cancelled by admin');
    } else {
        throw new MembershipError('Unknown action.');
    }
    sub.history.push(event(`ADMIN_${action.toUpperCase()}`, 'ADMIN', reason, admin.id));
    await sub.save();
    await syncWriter(sub);
    const titles = { suspend: 'Membership suspended', reinstate: 'Membership reinstated', cancel: 'Membership cancelled' };
    await notify(sub.writerId, titles[action], reason ? `${titles[action]}. Note from our team: ${reason}` : `${titles[action]}.`);
    return sub;
}

// ── Scheduled lifecycle ───────────────────────────────────────────────────────

// Idempotent housekeeping, safe to run repeatedly (every few minutes and on boot).
export async function runLifecycle(now = new Date()) {
    const summary = { expiredCheckouts: 0, renewalInvoices: 0, pastDue: 0, cancelled: 0, expired: 0, reapplied: 0 };

    // 1. Paid-but-unapplied payments (e.g. a crash mid-activation) are retried.
    for (const p of await SubscriptionPayment.find({ status: 'PAID', appliedAt: null }).limit(100)) {
        await applyPayment(p); summary.reapplied++;
    }

    // 2. Abandoned checkouts expire; their pending subscriptions close.
    const stale = await SubscriptionPayment.find({ status: 'CREATED', expiresAt: { $lte: now } }).limit(500);
    for (const p of stale) {
        const res = await SubscriptionPayment.updateOne({ _id: p._id, status: 'CREATED' }, { $set: { status: 'EXPIRED', failureReason: 'Not paid in time' } });
        if (!res.modifiedCount) continue;
        summary.expiredCheckouts++;
        if (p.kind === 'NEW') {
            const sub = await WriterSubscription.findById(p.subscriptionId);
            if (sub?.status === 'PENDING' && !(await SubscriptionPayment.exists({ subscriptionId: sub._id, status: { $in: OPEN_PAYMENT } }))) {
                sub.status = 'EXPIRED'; sub.endedAt = now; sub.endReason = 'CHECKOUT_ABANDONED';
                await sub.save(); await syncWriter(sub);
            }
        }
    }

    // 3. Renewal invoices go out ahead of the renewal date.
    const dueSoon = await WriterSubscription.find({ status: 'ACTIVE', autoRenew: true, currentPeriodEnd: { $lte: new Date(now.getTime() + RENEWAL_NOTICE_DAYS * DAY) } }).limit(500);
    for (const sub of dueSoon) {
        const before = await SubscriptionPayment.countDocuments({ subscriptionId: sub._id, kind: 'RENEWAL' });
        await ensureRenewalPayment(sub);
        if ((await SubscriptionPayment.countDocuments({ subscriptionId: sub._id, kind: 'RENEWAL' })) > before) summary.renewalInvoices++;
    }

    // 4. Renewal date passed without a paid renewal.
    for (const sub of await WriterSubscription.find({ status: 'ACTIVE', currentPeriodEnd: { $lte: now } }).limit(500)) {
        if (!sub.autoRenew) {
            sub.status = 'CANCELLED'; sub.endedAt = sub.currentPeriodEnd; sub.endReason = 'AUTO_RENEW_OFF';
            sub.history.push(event('ENDED_AT_PERIOD_END', 'SYSTEM'));
            summary.cancelled++;
            await sub.save(); await syncWriter(sub);
            await notify(sub.writerId, 'Membership ended', `Your ${sub.planName} membership has ended as requested. You can rejoin any time from your dashboard.`);
        } else {
            sub.status = 'PAST_DUE'; sub.graceEndsAt = new Date(sub.currentPeriodEnd.getTime() + GRACE_DAYS * DAY);
            sub.history.push(event('PAST_DUE', 'SYSTEM'));
            summary.pastDue++;
            await sub.save(); await syncWriter(sub);
            await ensureRenewalPayment(sub, { notifyWriter: false });
            await notify(sub.writerId, 'Membership payment overdue',
                `We haven’t received your renewal payment. Pay by ${sub.graceEndsAt.toDateString()} to keep your ${sub.planName} membership.`, { category: 'PAYMENT', type: 'PAYMENT_OVERDUE' });
        }
    }

    // 5. Grace period over → expired (unless a manual payment is awaiting verification).
    for (const sub of await WriterSubscription.find({ status: 'PAST_DUE', graceEndsAt: { $lte: now } }).limit(500)) {
        if (await SubscriptionPayment.exists({ subscriptionId: sub._id, kind: 'RENEWAL', status: 'PENDING_VERIFICATION' })) continue;
        await cancelOpenPayments(sub._id, ['RENEWAL'], 'Grace period ended');
        sub.status = 'EXPIRED'; sub.endedAt = now; sub.endReason = 'PAYMENT_NOT_RECEIVED';
        sub.history.push(event('EXPIRED', 'SYSTEM'));
        summary.expired++;
        await sub.save(); await syncWriter(sub);
        await notify(sub.writerId, 'Membership expired', `Your ${sub.planName} membership expired because the renewal wasn’t paid. You can rejoin any time from your dashboard.`);
    }
    return summary;
}

let timer = null;
export function startMembershipScheduler(intervalMs = 10 * 60 * 1000) {
    if (timer) return;
    const tick = () => runLifecycle().then(s => {
        if (Object.values(s).some(Boolean)) console.log('[Membership] lifecycle:', s);
    }).catch(err => console.error('[Membership] lifecycle failed:', err));
    tick();
    timer = setInterval(tick, intervalMs);
    timer.unref?.();
}
