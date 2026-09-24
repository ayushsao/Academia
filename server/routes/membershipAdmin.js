import { Router } from 'express';
import mongoose from 'mongoose';
import { User, Writer, MembershipPlan, WriterSubscription, SubscriptionPayment, SUBSCRIPTION_STATUSES } from '../db.js';
import { authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore } from '../permissions.js';
import { recordAudit } from '../services/audit.js';
import {
    validateInput, planUpsertSchema, planStatusSchema, membershipSettingsSchema, subscriptionAdminActionSchema, paymentReviewSchema,
} from '../validation.js';
import { isIsoCurrency, toMinor } from '../services/money.js';
import { getMembershipSettings, saveMembershipSettings } from '../services/membershipSettings.js';
import { MembershipError, adminSubscriptionAction, markPaymentPaid, runLifecycle, syncWriter, notifyMembership } from '../services/membershipService.js';
import { membershipAnalytics } from '../services/membershipAnalytics.js';
import { razorpayEnabled } from '../services/paymentProviders.js';
import { subscriptionView, paymentView } from './membership.js';
import { prefixTerms } from '../services/writerDirectory.js';

// Mounted at /api/admin/membership. Billing is restricted to full admins.
const router = Router();
router.use(noStore, authenticateAdmin);

// Finance area. [method or '*', path regex, permissions (any of)]
const RULES = [
    ['GET', /^\/plans$/, ['memberships.manage', 'subscriptions.read']],
    ['*', /^\/(plans|settings|lifecycle)/, ['memberships.manage']],
    ['GET', /^\/(subscriptions|analytics)/, ['subscriptions.read']],
    ['POST', /^\/subscriptions\//, ['subscriptions.manage']],
    ['GET', /^\/payments/, ['payments.read']],
    ['POST', /^\/payments\//, ['payments.review']],
];
router.use((req, res, next) => {
    const rule = RULES.find(([m, rx]) => (m === '*' || m === req.method) && rx.test(req.path));
    if (!rule) return res.status(403).json({ error: 'Your admin role does not permit this action.' });
    return requirePermission(...rule[2])(req, res, next);
});

function handleError(res, err, fallback) {
    if (err instanceof MembershipError) return res.status(err.status).json({ error: err.message });
    console.error(`[MembershipAdmin] ${fallback}:`, err);
    res.status(500).json({ error: fallback });
}

const audit = (req, action, reason, writerUserId) =>
    recordAudit(req, action, { reason, writerUserId, targetType: /PAYMENT/.test(action) ? 'PAYMENT' : /SUBSCRIPTION/.test(action) ? 'SUBSCRIPTION' : 'MEMBERSHIP' });

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageParams = (q) => {
    const page = Math.max(1, Number.parseInt(q.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(q.limit, 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
};

// ── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', async (_req, res) => {
    try { res.json({ settings: await getMembershipSettings(), razorpayEnabled: razorpayEnabled() }); }
    catch (err) { handleError(res, err, 'Failed to load settings.'); }
});

router.put('/settings', validateInput(membershipSettingsSchema), async (req, res) => {
    try {
        const body = req.body;
        const bad = [...body.currencies.map(c => c.code), body.defaultCurrency, body.reporting.currency, ...Object.keys(body.reporting.ratesToReporting)]
            .filter(c => !isIsoCurrency(c));
        if (bad.length) return res.status(400).json({ error: `Unknown currency code: ${[...new Set(bad)].join(', ')}` });
        if (new Set(body.currencies.map(c => c.code)).size !== body.currencies.length) return res.status(400).json({ error: 'Each currency can only be listed once.' });
        if (!body.currencies.some(c => c.code === body.defaultCurrency && c.isActive)) return res.status(400).json({ error: 'The default currency must be an active currency.' });
        const current = await getMembershipSettings();
        const saved = await saveMembershipSettings({ ...body, countryCurrency: body.countryCurrency || current.countryCurrency });
        await audit(req, 'MEMBERSHIP_SETTINGS_UPDATED', `Currencies: ${body.currencies.filter(c => c.isActive).map(c => c.code).join(', ')}`);
        res.json({ settings: saved, razorpayEnabled: razorpayEnabled() });
    } catch (err) { handleError(res, err, 'Failed to save settings.'); }
});

// ── Plans ────────────────────────────────────────────────────────────────────

const planView = (p, subscriberCounts = {}) => ({
    id: p._id, code: p.code, name: p.name, description: p.description, features: p.features, tier: p.tier,
    sortOrder: p.sortOrder, highlight: p.highlight, isActive: p.isActive, prices: p.prices,
    activeSubscribers: subscriberCounts[p.code] || 0, updatedAt: p.updatedAt,
});

async function normalisePlan(body) {
    const settings = await getMembershipSettings();
    const known = new Set(settings.currencies.map(c => c.code));
    const seen = new Set();
    const prices = body.prices.map(p => {
        if (!known.has(p.currency)) throw new MembershipError(`${p.currency} is not in your currency list. Add it under Settings first.`);
        const key = `${p.currency}-${p.billingPeriod}`;
        if (seen.has(key)) throw new MembershipError(`Duplicate ${p.billingPeriod.toLowerCase()} price for ${p.currency}.`);
        seen.add(key);
        return { currency: p.currency, billingPeriod: p.billingPeriod, amountMinor: toMinor(p.amount, p.currency), discountPercent: p.discountPercent, isActive: p.isActive };
    });
    if (body.isActive && !prices.some(p => p.isActive && p.amountMinor > 0)) throw new MembershipError('An active plan needs at least one active price.');
    return { ...body, prices };
}

router.get('/plans', async (_req, res) => {
    try {
        const [plans, counts] = await Promise.all([
            MembershipPlan.find().sort({ sortOrder: 1, tier: 1 }),
            WriterSubscription.aggregate([{ $match: { status: { $in: ['ACTIVE', 'PAST_DUE'] } } }, { $group: { _id: '$planCode', n: { $sum: 1 } } }]),
        ]);
        const byCode = Object.fromEntries(counts.map(c => [c._id, c.n]));
        res.json({ plans: plans.map(p => planView(p, byCode)) });
    } catch (err) { handleError(res, err, 'Failed to load plans.'); }
});

router.post('/plans', validateInput(planUpsertSchema), async (req, res) => {
    try {
        if (await MembershipPlan.exists({ code: req.body.code })) return res.status(409).json({ error: 'A plan with this code already exists.' });
        const plan = await MembershipPlan.create(await normalisePlan(req.body));
        await audit(req, 'MEMBERSHIP_PLAN_CREATED', `${plan.code} (${plan.isActive ? 'active' : 'inactive'})`);
        res.status(201).json({ plan: planView(plan) });
    } catch (err) { handleError(res, err, 'Failed to create plan.'); }
});

// Price edits apply to new checkouts and future renewals; existing periods are unaffected.
router.put('/plans/:id', validateInput(planUpsertSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Plan not found.' });
        const plan = await MembershipPlan.findById(req.params.id);
        if (!plan) return res.status(404).json({ error: 'Plan not found.' });
        if (req.body.code !== plan.code) return res.status(400).json({ error: 'A plan’s code can’t be changed.' });
        if (req.body.tier !== plan.tier && await WriterSubscription.exists({ planId: plan._id, isOpen: true }))
            return res.status(409).json({ error: 'Tier can’t change while writers are subscribed to this plan.' });
        Object.assign(plan, await normalisePlan(req.body));
        await plan.save();
        await audit(req, 'MEMBERSHIP_PLAN_UPDATED', `${plan.code}: ${plan.prices.length} prices, ${plan.isActive ? 'active' : 'inactive'}`);
        res.json({ plan: planView(plan) });
    } catch (err) { handleError(res, err, 'Failed to update plan.'); }
});

// Deactivating hides a plan from new checkouts; current subscribers keep renewing.
router.patch('/plans/:id/status', validateInput(planStatusSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Plan not found.' });
        const plan = await MembershipPlan.findById(req.params.id);
        if (!plan) return res.status(404).json({ error: 'Plan not found.' });
        if (req.body.isActive && !plan.prices.some(p => p.isActive && p.amountMinor > 0))
            return res.status(400).json({ error: 'Add at least one active price before activating this plan.' });
        plan.isActive = req.body.isActive;
        await plan.save();
        await audit(req, req.body.isActive ? 'MEMBERSHIP_PLAN_ACTIVATED' : 'MEMBERSHIP_PLAN_DEACTIVATED', plan.code);
        res.json({ plan: planView(plan) });
    } catch (err) { handleError(res, err, 'Failed to update plan.'); }
});

// ── Subscriptions ────────────────────────────────────────────────────────────

router.get('/subscriptions', async (req, res) => {
    try {
        const { page, limit, skip } = pageParams(req.query);
        // Never-activated checkouts are excluded unless explicitly asking for PENDING ones.
        const status = SUBSCRIPTION_STATUSES.includes(req.query.status) ? req.query.status : '';
        const filter = status === 'PENDING' ? { status } : { startDate: { $ne: null }, ...(status ? { status } : {}) };
        if (typeof req.query.plan === 'string' && req.query.plan) filter.planCode = req.query.plan;
        if (typeof req.query.search === 'string' && req.query.search.trim()) {
            // Indexed prefix search on the writers' admin search keys (name words, email).
            const q = req.query.search.trim().slice(0, 80);
            const keys = q.includes('@') ? [{ searchKeys: new RegExp(`^${escapeRegex(q.toLowerCase())}`) }] : [];
            const terms = prefixTerms(q);
            if (terms.length) keys.push({ searchKeys: { $all: terms } });
            const writers = keys.length ? await Writer.find({ $or: keys }).select('_id').limit(1000).lean() : [];
            filter.$or = [{ writerId: { $in: writers.map(w => w._id) } }, { subscriptionId: new RegExp(`^${escapeRegex(q.toUpperCase())}`) }];
        }
        const [total, subs] = await Promise.all([
            WriterSubscription.countDocuments(filter),
            WriterSubscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        ]);
        const users = await User.find({ _id: { $in: subs.map(s => s.userId) } }).select('name email');
        const userMap = new Map(users.map(u => [String(u._id), u]));
        res.json({
            total, page, limit,
            subscriptions: await Promise.all(subs.map(async s => ({
                ...(await subscriptionView(s)), id: s._id, writerId: s.writerId, country: s.country,
                writerName: userMap.get(String(s.userId))?.name, writerEmail: userMap.get(String(s.userId))?.email,
            }))),
        });
    } catch (err) { handleError(res, err, 'Failed to load subscriptions.'); }
});

router.get('/subscriptions/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Subscription not found.' });
        const sub = await WriterSubscription.findById(req.params.id);
        if (!sub) return res.status(404).json({ error: 'Subscription not found.' });
        const [user, payments] = await Promise.all([
            User.findById(sub.userId).select('name email'),
            SubscriptionPayment.find({ subscriptionId: sub._id }).sort({ createdAt: -1 }),
        ]);
        res.json({
            subscription: { ...(await subscriptionView(sub)), id: sub._id, writerId: sub.writerId, country: sub.country, history: sub.history, writerName: user?.name, writerEmail: user?.email },
            payments: payments.map(p => ({ ...paymentView(p), id: p._id, needsAttention: p.needsAttention, providerOrderId: p.providerOrderId, providerPaymentId: p.providerPaymentId })),
        });
    } catch (err) { handleError(res, err, 'Failed to load subscription.'); }
});

router.post('/subscriptions/:id/actions', validateInput(subscriptionAdminActionSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Subscription not found.' });
        const sub = await WriterSubscription.findById(req.params.id);
        if (!sub) return res.status(404).json({ error: 'Subscription not found.' });
        await adminSubscriptionAction(sub, req.body.action, req.body.reason, req.admin);
        await audit(req, `SUBSCRIPTION_${req.body.action.toUpperCase()}`, `${sub.subscriptionId}${req.body.reason ? ` — ${req.body.reason}` : ''}`, sub.userId);
        res.json({ subscription: await subscriptionView(sub) });
    } catch (err) { handleError(res, err, 'Failed to update subscription.'); }
});

// ── Payments & manual verification ────────────────────────────────────────────

router.get('/payments', async (req, res) => {
    try {
        const { page, limit, skip } = pageParams(req.query);
        const filter = {};
        if (req.query.status === 'ATTENTION') filter.needsAttention = { $nin: ['', null] };
        else if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
        else filter.status = { $ne: 'CANCELLED' };
        const [total, payments] = await Promise.all([
            SubscriptionPayment.countDocuments(filter),
            SubscriptionPayment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        ]);
        const subs = await WriterSubscription.find({ _id: { $in: payments.map(p => p.subscriptionId) } }).select('subscriptionId userId');
        const subMap = new Map(subs.map(s => [String(s._id), s]));
        const users = await User.find({ _id: { $in: subs.map(s => s.userId) } }).select('name email');
        const userMap = new Map(users.map(u => [String(u._id), u]));
        res.json({
            total, page, limit,
            payments: payments.map(p => {
                const sub = subMap.get(String(p.subscriptionId));
                const user = sub && userMap.get(String(sub.userId));
                return {
                    ...paymentView(p), id: p._id, subscriptionRef: sub?.subscriptionId, subscriptionDbId: sub?._id, country: p.country,
                    writerName: user?.name, writerEmail: user?.email, needsAttention: p.needsAttention, reviewNote: p.reviewNote,
                    providerOrderId: p.providerOrderId, providerPaymentId: p.providerPaymentId,
                };
            }),
        });
    } catch (err) { handleError(res, err, 'Failed to load payments.'); }
});

router.post('/payments/:id/review', validateInput(paymentReviewSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Payment not found.' });
        const payment = await SubscriptionPayment.findById(req.params.id);
        if (!payment) return res.status(404).json({ error: 'Payment not found.' });
        if (payment.status !== 'PENDING_VERIFICATION') return res.status(409).json({ error: `This payment is ${payment.status.toLowerCase().replace('_', ' ')}.` });
        const sub = await WriterSubscription.findById(payment.subscriptionId);

        if (req.body.decision === 'approve') {
            const { applied } = await markPaymentPaid(payment._id, { from: ['PENDING_VERIFICATION'], actor: 'ADMIN', adminId: req.admin.id, note: req.body.note });
            if (!applied) return res.status(409).json({ error: 'This payment was already processed.' });
        } else {
            const updated = await SubscriptionPayment.findOneAndUpdate({ _id: payment._id, status: 'PENDING_VERIFICATION' },
                { $set: { status: 'REJECTED', reviewedBy: req.admin.id, reviewNote: req.body.note } }, { new: true });
            if (!updated) return res.status(409).json({ error: 'This payment was already processed.' });
            // A rejected first payment closes the pending subscription so the writer can check out again.
            if (payment.kind === 'NEW' && sub?.status === 'PENDING') {
                sub.status = 'EXPIRED'; sub.endedAt = new Date(); sub.endReason = 'PAYMENT_REJECTED';
                await sub.save(); await syncWriter(sub);
            }
            await notifyMembership(payment.writerId, 'Payment could not be verified',
                `We couldn’t verify your payment ${payment.paymentRef} for the ${payment.planName} plan.${req.body.note ? `\n\nNote from our team: ${req.body.note}` : ''}\n\nIf you’ve been charged, reply with your payment receipt or contact support. You can also start a new payment from the Membership page.`,
                { category: 'PAYMENT', type: 'PAYMENT_REJECTED' });
        }
        await audit(req, `MEMBERSHIP_PAYMENT_${req.body.decision === 'approve' ? 'APPROVED' : 'REJECTED'}`,
            `${payment.paymentRef} · ${payment.manual?.method || ''} ${payment.manual?.reference || ''}${req.body.note ? ` — ${req.body.note}` : ''}`, sub?.userId);
        res.json({ payment: paymentView(await SubscriptionPayment.findById(payment._id)) });
    } catch (err) { handleError(res, err, 'Failed to review payment.'); }
});

router.post('/payments/:id/resolve', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Payment not found.' });
        const payment = await SubscriptionPayment.findByIdAndUpdate(req.params.id, { $set: { needsAttention: '' } }, { new: true });
        if (!payment) return res.status(404).json({ error: 'Payment not found.' });
        await audit(req, 'MEMBERSHIP_PAYMENT_RESOLVED', payment.paymentRef);
        res.json({ payment: paymentView(payment) });
    } catch (err) { handleError(res, err, 'Failed to resolve payment.'); }
});

// ── Analytics & operations ───────────────────────────────────────────────────

router.get('/analytics', async (req, res) => {
    try {
        const to = req.query.to ? new Date(String(req.query.to)) : new Date();
        const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return res.status(400).json({ error: 'Invalid date range.' });
        res.json(await membershipAnalytics({ from, to }));
    } catch (err) { handleError(res, err, 'Failed to load analytics.'); }
});

router.post('/lifecycle/run', async (req, res) => {
    try {
        const summary = await runLifecycle();
        await audit(req, 'MEMBERSHIP_LIFECYCLE_RUN', JSON.stringify(summary));
        res.json({ summary });
    } catch (err) { handleError(res, err, 'Lifecycle run failed.'); }
});

export default router;
