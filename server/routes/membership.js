import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { User, Writer, WriterProfile, MembershipPlan, WriterSubscription, SubscriptionPayment } from '../db.js';
import { authenticateUser, identifyPrincipal } from '../middleware.js';
import {
    validateInput, membershipSelectionSchema, paymentStartSchema, razorpayVerifySchema, manualPaymentSchema, autoRenewSchema,
} from '../validation.js';
import {
    MembershipError, listPublicPlans, suggestedCurrency, previewCheckout, serializePreview, checkout, cancelScheduledChange,
    setAutoRenew, ensureRenewalPayment, markPaymentPaid, getOpenSubscription, syncWriter,
} from '../services/membershipService.js';
import { getMembershipSettings, manualPaymentAvailable, MEMBERSHIP_DISCLAIMER } from '../services/membershipSettings.js';
import {
    PaymentProviderError, razorpayEnabled, razorpayKeyId, createRazorpayOrder, verifyRazorpaySignature,
    verifyRazorpayWebhook, confirmRazorpayPayment, RAZORPAY_MIN_MINOR,
} from '../services/paymentProviders.js';
import { membershipEligibility } from '../services/writerService.js';
import { notify as sendNotification } from '../services/notifications.js';
import { AbuseError, assertReferenceUnused, afterCheckout } from '../services/abuse.js';
import { settleCheckoutFromWebhook } from '../services/orderCheckout.js';

const router = Router();
const payLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, message: { error: 'Too many payment attempts. Please try again later.' } });

function handleError(res, err, fallback) {
    if (err instanceof MembershipError || err instanceof PaymentProviderError || err instanceof AbuseError) return res.status(err.status).json({ error: err.message });
    console.error(`[Membership] ${fallback}:`, err);
    res.status(500).json({ error: fallback });
}

async function requireWriter(req, res, next) {
    try {
        if (req.user.role !== 'WRITER') return res.status(403).json({ error: 'Memberships are for writer accounts.' });
        const writer = await Writer.findOne({ userId: req.user.id });
        if (!writer) return res.status(404).json({ error: 'Writer account not found.' });
        req.writer = writer;
        next();
    } catch (err) { handleError(res, err, 'Failed to load writer account.'); }
}

// Loads one of the caller's own payments by its public reference.
async function loadOwnPayment(req, res, next) {
    try {
        const payment = await SubscriptionPayment.findOne({ paymentRef: String(req.params.ref), writerId: req.writer._id });
        if (!payment) return res.status(404).json({ error: 'Payment not found.' });
        req.payment = payment;
        next();
    } catch (err) { handleError(res, err, 'Failed to load payment.'); }
}

export const subscriptionView = async (sub) => sub && ({
    subscriptionId: sub.subscriptionId, planCode: sub.planCode, planName: sub.planName, tier: sub.tier,
    billingPeriod: sub.billingPeriod, currency: sub.currency, amountMinor: sub.amountMinor, listAmountMinor: sub.listAmountMinor,
    discountPercent: sub.discountPercent, status: sub.status, autoRenew: sub.autoRenew, startDate: sub.startDate,
    currentPeriodStart: sub.currentPeriodStart, currentPeriodEnd: sub.currentPeriodEnd, graceEndsAt: sub.graceEndsAt,
    cancelledAt: sub.cancelledAt, endedAt: sub.endedAt, endReason: sub.endReason, createdAt: sub.createdAt,
    scheduledChange: sub.scheduledChange?.planId ? {
        planCode: sub.scheduledChange.planCode,
        planName: (await MembershipPlan.findById(sub.scheduledChange.planId).select('name'))?.name || sub.scheduledChange.planCode,
        billingPeriod: sub.scheduledChange.billingPeriod, effectiveAt: sub.scheduledChange.effectiveAt,
    } : null,
});

export const paymentView = (p) => ({
    paymentRef: p.paymentRef, kind: p.kind, planCode: p.planCode, planName: p.planName, billingPeriod: p.billingPeriod,
    currency: p.currency, amountMinor: p.amountMinor, listAmountMinor: p.listAmountMinor, discountPercent: p.discountPercent,
    creditMinor: p.creditMinor, periodStart: p.periodStart, status: p.status, provider: p.provider,
    manual: p.manual?.reference ? { method: p.manual.method, reference: p.manual.reference, submittedAt: p.manual.submittedAt } : null,
    reviewNote: p.status === 'REJECTED' ? p.reviewNote : '', failureReason: p.failureReason,
    paidAt: p.paidAt, expiresAt: p.expiresAt, createdAt: p.createdAt,
});

const providerInfo = (settings) => ({
    razorpay: { enabled: razorpayEnabled(), minAmountMinor: RAZORPAY_MIN_MINOR },
    manual: manualPaymentAvailable(settings) ? {
        enabled: true, upiId: settings.manualPayment.upiId, paypalUrl: settings.manualPayment.paypalUrl,
        bankDetails: settings.manualPayment.bankDetails, instructions: settings.manualPayment.instructions,
    } : { enabled: false },
});

// ============================================
// PUBLIC CATALOGUE
// ============================================

router.get('/plans', identifyPrincipal, async (req, res) => {
    try {
        const catalogue = await listPublicPlans();
        let country = '';
        if (req.user?.role === 'WRITER') {
            const profile = await WriterProfile.findOne({ userId: req.user.id }).select('country');
            country = profile?.country || '';
        }
        res.json({ ...catalogue, suggestedCurrency: await suggestedCurrency(country), disclaimer: MEMBERSHIP_DISCLAIMER });
    } catch (err) { handleError(res, err, 'Could not load plans.'); }
});

// ============================================
// WRITER MEMBERSHIP
// ============================================

router.get('/me', authenticateUser, requireWriter, async (req, res) => {
    try {
        const writer = req.writer;
        const sub = (await getOpenSubscription(writer._id)) || (await WriterSubscription.findOne({ writerId: writer._id }).sort({ createdAt: -1 }));
        const openPayments = sub ? await SubscriptionPayment.find({ subscriptionId: sub._id, status: { $in: ['CREATED', 'PENDING_VERIFICATION'] } }).sort({ createdAt: -1 }) : [];
        const settings = await getMembershipSettings();
        res.json({
            writerStatus: writer.status,
            eligibility: membershipEligibility(writer),
            subscription: await subscriptionView(sub),
            openPayments: openPayments.map(paymentView),
            providers: providerInfo(settings),
            disclaimer: MEMBERSHIP_DISCLAIMER,
        });
    } catch (err) { handleError(res, err, 'Could not load membership.'); }
});

// Review step: the exact server-computed amount for a selection. No side effects.
router.post('/quote', authenticateUser, requireWriter, validateInput(membershipSelectionSchema), async (req, res) => {
    try {
        res.json({ quote: serializePreview(await previewCheckout(req.writer, req.body)), disclaimer: MEMBERSHIP_DISCLAIMER });
    } catch (err) { handleError(res, err, 'Could not prepare quote.'); }
});

router.post('/checkout', payLimiter, authenticateUser, requireWriter, validateInput(membershipSelectionSchema), async (req, res) => {
    try {
        const result = await checkout(req.writer, req.body);
        afterCheckout(req.writer).catch(err => console.error('[Membership] churn check failed:', err.message));
        res.status(201).json({
            quote: serializePreview(result.preview),
            subscription: await subscriptionView(result.subscription),
            payment: result.payment ? paymentView(result.payment) : null,
        });
    } catch (err) { handleError(res, err, 'Could not start checkout.'); }
});

router.delete('/scheduled-change', authenticateUser, requireWriter, async (req, res) => {
    try { res.json({ subscription: await subscriptionView(await cancelScheduledChange(req.writer)) }); }
    catch (err) { handleError(res, err, 'Could not cancel the plan change.'); }
});

router.post('/auto-renew', authenticateUser, requireWriter, validateInput(autoRenewSchema), async (req, res) => {
    try { res.json({ subscription: await subscriptionView(await setAutoRenew(req.writer, req.body.enabled)) }); }
    catch (err) { handleError(res, err, 'Could not update auto-renewal.'); }
});

// Returns (creating if needed) the renewal invoice when it's due or overdue.
router.post('/renewal', authenticateUser, requireWriter, async (req, res) => {
    try {
        const sub = await getOpenSubscription(req.writer._id);
        if (!sub || !['ACTIVE', 'PAST_DUE'].includes(sub.status)) throw new MembershipError('You don’t have a membership to renew.', 404);
        if (!sub.autoRenew) throw new MembershipError('Auto-renewal is off. Turn it back on to renew.', 409);
        if (sub.status === 'ACTIVE' && sub.currentPeriodEnd - Date.now() > 7 * 24 * 60 * 60 * 1000)
            throw new MembershipError('Your renewal invoice will be available 7 days before your renewal date.', 409);
        const payment = await ensureRenewalPayment(sub, { notifyWriter: false });
        if (!payment) throw new MembershipError('Your plan can’t be renewed at the moment. Please contact support.', 409);
        res.json({ payment: paymentView(payment) });
    } catch (err) { handleError(res, err, 'Could not prepare renewal.'); }
});

router.get('/payments', authenticateUser, requireWriter, async (req, res) => {
    try {
        const payments = await SubscriptionPayment.find({ writerId: req.writer._id, status: { $ne: 'CANCELLED' } }).sort({ createdAt: -1 }).limit(100);
        res.json({ payments: payments.map(paymentView) });
    } catch (err) { handleError(res, err, 'Could not load payment history.'); }
});

router.get('/payments/:ref', authenticateUser, requireWriter, loadOwnPayment, (req, res) => {
    res.json({ payment: paymentView(req.payment) });
});

// ── Payment step ──────────────────────────────────────────────────────────────

const assertPayable = (payment) => {
    if (payment.status !== 'CREATED') throw new MembershipError(`This invoice is ${payment.status.toLowerCase().replace('_', ' ')}.`, 409);
    if (payment.expiresAt && payment.expiresAt < new Date()) throw new MembershipError('This checkout has expired. Please start again.', 410);
};

router.post('/payments/:ref/start', payLimiter, authenticateUser, requireWriter, loadOwnPayment, validateInput(paymentStartSchema), async (req, res) => {
    try {
        const payment = req.payment;
        assertPayable(payment);
        const settings = await getMembershipSettings();

        if (req.body.provider === 'RAZORPAY') {
            if (!razorpayEnabled()) throw new MembershipError('Online payment is not available right now.', 503);
            // The provider order is created from the stored invoice amount — never from client input.
            if (!(payment.provider === 'RAZORPAY' && payment.providerOrderId)) {
                const order = await createRazorpayOrder({
                    amountMinor: payment.amountMinor, currency: payment.currency, receipt: payment.paymentRef,
                    notes: { paymentRef: payment.paymentRef, kind: payment.kind },
                });
                payment.provider = 'RAZORPAY';
                payment.providerOrderId = order.id;
                await payment.save();
            }
            const user = await User.findById(req.writer.userId).select('name email');
            return res.json({
                provider: 'RAZORPAY',
                checkout: {
                    key: razorpayKeyId(), orderId: payment.providerOrderId, amountMinor: payment.amountMinor, currency: payment.currency,
                    name: 'AssignmentMinds', description: `${payment.planName} membership · ${payment.billingPeriod.toLowerCase()}`,
                    prefill: { name: user?.name, email: user?.email },
                },
            });
        }

        if (!manualPaymentAvailable(settings)) throw new MembershipError('Manual payment is not available right now.', 503);
        payment.provider = 'MANUAL';
        await payment.save();
        res.json({ provider: 'MANUAL', instructions: providerInfo(settings).manual, amountMinor: payment.amountMinor, currency: payment.currency, paymentRef: payment.paymentRef });
    } catch (err) { handleError(res, err, 'Could not start payment.'); }
});

// Razorpay checkout callback: signature check, then re-confirm with Razorpay.
router.post('/payments/:ref/razorpay/verify', payLimiter, authenticateUser, requireWriter, loadOwnPayment, validateInput(razorpayVerifySchema), async (req, res) => {
    try {
        const payment = req.payment;
        if (payment.status === 'PAID') return res.json({ payment: paymentView(payment), subscription: await subscriptionView(await WriterSubscription.findById(payment.subscriptionId)) });
        const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
        if (payment.provider !== 'RAZORPAY' || payment.providerOrderId !== orderId)
            throw new MembershipError('Payment does not match this invoice.', 400);
        if (!verifyRazorpaySignature({ orderId, paymentId, signature }))
            throw new MembershipError('Payment verification failed.', 400);
        await confirmRazorpayPayment({ paymentId, orderId, amountMinor: payment.amountMinor, currency: payment.currency });
        // Money has been captured, so accept even if the checkout window lapsed meanwhile.
        const { payment: updated } = await markPaymentPaid(payment._id, {
            from: ['CREATED', 'EXPIRED', 'CANCELLED'], provider: 'RAZORPAY', providerPaymentId: paymentId, actor: 'WRITER',
        });
        res.json({ payment: paymentView(updated), subscription: await subscriptionView(await WriterSubscription.findById(updated.subscriptionId)) });
    } catch (err) { handleError(res, err, 'Could not verify payment.'); }
});

// Existing site practice: writer pays by UPI/PayPal/bank and submits the reference for admin verification.
router.post('/payments/:ref/manual', payLimiter, authenticateUser, requireWriter, loadOwnPayment, validateInput(manualPaymentSchema), async (req, res) => {
    try {
        const payment = req.payment;
        assertPayable(payment);
        if (!manualPaymentAvailable(await getMembershipSettings())) throw new MembershipError('Manual payment is not available right now.', 503);
        const reference = req.body.reference;
        // Normalised, indexed check (catches "UTR 1234" vs "utr-1234") that also records a risk signal.
        const referenceKey = await assertReferenceUnused(payment, reference);
        // Legacy rows saved before referenceKey existed.
        const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (await SubscriptionPayment.exists({ 'manual.reference': new RegExp(`^${escaped}$`, 'i'), status: { $in: ['PENDING_VERIFICATION', 'PAID'] } }))
            throw new MembershipError('This payment reference has already been submitted.', 409);
        payment.provider = 'MANUAL';
        payment.status = 'PENDING_VERIFICATION';
        payment.manual = { method: req.body.method, reference, referenceKey, submittedAt: new Date() };
        await payment.save();
        res.json({ payment: paymentView(payment) });
    } catch (err) { handleError(res, err, 'Could not submit payment reference.'); }
});

router.post('/payments/:ref/cancel', authenticateUser, requireWriter, loadOwnPayment, async (req, res) => {
    try {
        const payment = req.payment;
        if (payment.status !== 'CREATED') throw new MembershipError('Only unpaid checkouts can be cancelled.', 409);
        if (payment.kind === 'RENEWAL') throw new MembershipError('Renewal invoices can’t be cancelled. Turn off auto-renewal instead.', 409);
        payment.status = 'CANCELLED';
        payment.failureReason = 'Cancelled by writer';
        await payment.save();
        if (payment.kind === 'NEW') {
            const sub = await WriterSubscription.findById(payment.subscriptionId);
            if (sub?.status === 'PENDING') {
                sub.status = 'EXPIRED'; sub.endedAt = new Date(); sub.endReason = 'CHECKOUT_CANCELLED';
                await sub.save(); await syncWriter(sub);
            }
        }
        res.json({ payment: paymentView(payment) });
    } catch (err) { handleError(res, err, 'Could not cancel checkout.'); }
});

// ============================================
// RAZORPAY WEBHOOK (raw body — see server/index.js)
// ============================================

router.post('/webhooks/razorpay', async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    if (!verifyRazorpayWebhook(raw, req.get('X-Razorpay-Signature'))) return res.status(400).json({ error: 'Invalid signature.' });
    try {
        const event = JSON.parse(raw.toString('utf8'));
        const entity = event?.payload?.payment?.entity;
        if (!entity?.order_id) return res.json({ ok: true });
        const payment = await SubscriptionPayment.findOne({ provider: 'RAZORPAY', providerOrderId: entity.order_id });
        if (!payment) {
            // Not a membership payment: it may be a customer order whose browser
            // closed before the checkout callback — settle it from here.
            if (['payment.captured', 'order.paid'].includes(event.event)) await settleCheckoutFromWebhook(entity);
            return res.json({ ok: true });
        }

        if (['payment.captured', 'order.paid'].includes(event.event) && entity.status === 'captured') {
            if (entity.amount !== payment.amountMinor || entity.currency !== payment.currency) {
                await SubscriptionPayment.updateOne({ _id: payment._id }, { $set: { needsAttention: `Webhook amount mismatch: ${entity.amount} ${entity.currency}` } });
                console.error(`[Membership] webhook amount mismatch for ${payment.paymentRef}`);
            } else {
                await markPaymentPaid(payment._id, { from: ['CREATED', 'EXPIRED', 'CANCELLED'], provider: 'RAZORPAY', providerPaymentId: entity.id });
            }
        } else if (event.event === 'payment.failed' && payment.status === 'CREATED') {
            // Leave the invoice open so the writer can retry.
            await SubscriptionPayment.updateOne({ _id: payment._id }, { $set: { failureReason: entity.error_description || 'Payment failed' } });
            // One notice per failed provider payment (webhooks can be redelivered).
            await sendNotification({
                writerId: payment.writerId, category: 'PAYMENT', type: 'PAYMENT_FAILED', link: '/writer/membership',
                title: 'Payment failed', message: `Your payment ${payment.paymentRef} for the ${payment.planName} plan didn’t go through${entity.error_description ? ` (${entity.error_description})` : ''}. No membership change was made — you can try again from the Membership page.`,
                dedupeKey: `payment-failed:${payment._id}:${entity.id || 'unknown'}`,
            });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('[Membership] webhook error:', err);
        res.status(500).json({ error: 'Webhook processing failed.' });
    }
});

export default router;
