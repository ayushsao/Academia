import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { ToolPurchase } from '../db.js';
import { validateInput } from '../validation.js';
import { razorpayEnabled, razorpayKeyId, createRazorpayOrder, confirmRazorpayPayment, verifyRazorpaySignature, PaymentProviderError } from '../services/paymentProviders.js';

const router = Router();

const toolsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 requests per 15 minutes per IP
    message: { error: 'Too many requests. Please try again later.' }
});

const INCEPTION_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';
// The provider's content filter sometimes flags ordinary academic requests at
// random, so a flagged request is retried, then tried on the second model.
const ATTEMPTS = [
    { model: 'mercury-2.5' },
    { model: 'mercury-2.5' },
    { model: 'mercury-2' },
];
const DEFAULT_SYSTEM = 'You are a helpful academic writing assistant.';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// One request; retries temporary errors (429/502/503/504). Returns { content } or { filtered } or { error }.
async function askInception(apiKey, model, system, prompt) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch(INCEPTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
        });
        if (res.ok) {
            const content = (await res.json())?.choices?.[0]?.message?.content;
            return content ? { content } : { error: 'empty response' };
        }
        const text = await res.text();
        if ([429, 502, 503, 504].includes(res.status) && attempt < 3) { await sleep(attempt * 1500); continue; }
        if (/content_filter/.test(text)) return { filtered: true };
        return { error: `${res.status} ${text.slice(0, 300)}` };
    }
    return { error: 'no response' };
}

router.post('/process', toolsLimiter, async (req, res) => {
    try {
        const { prompt, instructions } = req.body;
        if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Prompt is required.' });
        if (prompt.length > 20000) return res.status(413).json({ error: 'That text is too long. Please shorten it and try again.' });
        if (instructions !== undefined && (typeof instructions !== 'string' || instructions.length > 4000)) return res.status(400).json({ error: 'Invalid tool settings.' });

        const apiKey = process.env.INCEPTION_API_KEY || process.env.VITE_INCEPTION_API_KEY;
        if (!apiKey) {
            console.error('Inception AI failed: INCEPTION_API_KEY is missing.');
            return res.status(502).json({ error: 'This tool is unavailable right now. Please try again shortly.' });
        }

        // The tool's instructions go in the system message; the user message is only the user's input.
        const system = instructions?.trim() ? `${DEFAULT_SYSTEM}\n\n${instructions.trim()}` : DEFAULT_SYSTEM;
        let filtered = 0, lastError = '';
        for (const { model } of ATTEMPTS) {
            try {
                const r = await askInception(apiKey, model, system, prompt);
                if (r.content) return res.json({ result: r.content });
                if (r.filtered) { filtered++; continue; }
                lastError = r.error;
            } catch (err) { lastError = err.message; }
        }

        // Upstream details stay in the server log, never in the response.
        if (filtered === ATTEMPTS.length)
            return res.status(422).json({ error: 'We couldn’t generate a response for this topic. Please rephrase it (for example, add more detail about what the essay should cover) and try again.' });
        console.error('Inception AI failed:', lastError, filtered ? `(${filtered} filtered)` : '');
        return res.status(502).json({ error: 'This tool is unavailable right now. Please try again shortly.' });
    } catch (err) {
        console.error('Tools error:', err);
        res.status(500).json({ error: 'Could not process your request.' });
    }
});

// ── Paid: AI Originality & Similarity Check (₹100) ─────────────────────────────
// The buyer gives their email and phone and pays with Razorpay; the report is
// generated on the server only after the payment is confirmed with Razorpay.
// It is an AI estimate, not a Turnitin report, and says so.
const ORIGINALITY_PRICE_MINOR = 10000;   // ₹100
const ORIGINALITY_INSTRUCTIONS = `You are the AI Originality & Similarity Check on an academic support website.
Review the user's text and give an estimate of:
1. How original the writing reads, and which passages look copied, heavily paraphrased or boilerplate.
2. How likely each part is to be AI-generated, with the reasons.
3. Citation and referencing issues.
4. Concrete suggestions to improve originality.

Format with ### headings: Summary, Estimated Originality, Estimated AI-Writing Likelihood, Passages to Review, Referencing, Suggestions.
Give percentages as estimates (e.g. "about 80% original (estimate)").
Start with this line exactly: "This is an AI estimate by AssignmentMinds. It is not a Turnitin report and was not checked against Turnitin or any university database."
Respond only with the report.`;

const purchaseLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { error: 'Too many attempts. Please try again later.' } });
const purchaseSchema = z.object({
    email: z.string().trim().email('Enter a valid email address.').max(200),
    phone: z.string().trim().regex(/^\+?[\d\s()-]{6,20}$/, 'Enter a valid phone number.'),
    text: z.string().trim().min(50, 'Paste at least 50 characters of text to check.').max(20000, 'That text is too long. Please shorten it to 20,000 characters.'),
}).strict();
const confirmSchema = z.object({
    razorpay_order_id: z.string().trim().regex(/^order_[A-Za-z0-9]{6,40}$/),
    razorpay_payment_id: z.string().trim().regex(/^pay_[A-Za-z0-9]{6,40}$/),
    razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/),
}).strict();

async function generateOriginalityReport(purchase) {
    const apiKey = process.env.INCEPTION_API_KEY || process.env.VITE_INCEPTION_API_KEY;
    if (!apiKey) throw new Error('INCEPTION_API_KEY is missing');
    let lastError = '';
    for (const { model } of ATTEMPTS) {
        try {
            const r = await askInception(apiKey, model, `${DEFAULT_SYSTEM}\n\n${ORIGINALITY_INSTRUCTIONS}`, purchase.text);
            if (r.content) return r.content;
            lastError = r.filtered ? 'filtered' : r.error;
        } catch (err) { lastError = err.message; }
    }
    throw new Error(lastError || 'no report');
}

// Makes sure a paid purchase has its report (generates it once). Returns the purchase.
async function ensureReport(purchase) {
    if (purchase.report) return purchase;
    try {
        purchase.report = await generateOriginalityReport(purchase);
        purchase.reportError = '';
        purchase.text = '';   // not kept once the report is made
    } catch (err) {
        purchase.reportError = String(err.message).slice(0, 300);
        console.error('[Originality] report failed:', purchase.reportError);
    }
    await purchase.save();
    return purchase;
}
const reportResponse = (p) => (p.report
    ? { purchaseId: String(p._id), token: p.accessToken, report: p.report }
    : { purchaseId: String(p._id), token: p.accessToken, pending: true, error: 'Your payment is confirmed, but the report couldn’t be generated just now. Open this page again in a minute; you won’t be charged again.' });

// POST /api/tools/originality/checkout — opens a ₹100 Razorpay order for the check.
router.post('/originality/checkout', purchaseLimiter, validateInput(purchaseSchema), async (req, res) => {
    try {
        if (!razorpayEnabled()) return res.status(503).json({ error: 'Online payment is not available right now. Please try again later.' });
        const purchase = await ToolPurchase.create({
            tool: 'ORIGINALITY', email: req.body.email, phone: req.body.phone, text: req.body.text,
            amountMinor: ORIGINALITY_PRICE_MINOR, currency: 'INR', accessToken: crypto.randomBytes(24).toString('hex'),
        });
        try {
            const order = await createRazorpayOrder({ amountMinor: purchase.amountMinor, currency: purchase.currency, receipt: `tool_${purchase._id}`, notes: { toolPurchaseId: String(purchase._id) } });
            purchase.providerOrderId = order.id;
            await purchase.save();
        } catch (err) {
            await ToolPurchase.deleteOne({ _id: purchase._id }).catch(() => {});
            throw err;
        }
        // The id and token are kept by the browser, so the report can be opened
        // even if the page is closed right after paying (the webhook marks it paid).
        res.json({ keyId: razorpayKeyId(), orderId: purchase.providerOrderId, amountMinor: purchase.amountMinor, currency: purchase.currency, purchaseId: String(purchase._id), token: purchase.accessToken });
    } catch (err) {
        if (err instanceof PaymentProviderError) return res.status(err.status).json({ error: err.message });
        console.error('[Originality] checkout error:', err.message);
        res.status(500).json({ error: 'Could not start the payment.' });
    }
});

// POST /api/tools/originality/confirm — Razorpay's callback. The signature is
// checked and the payment re-fetched from Razorpay (captured, ₹100) before the
// report is generated.
router.post('/originality/confirm', purchaseLimiter, validateInput(confirmSchema), async (req, res) => {
    try {
        const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
        if (!verifyRazorpaySignature({ orderId, paymentId, signature })) return res.status(400).json({ error: 'Payment could not be verified.' });
        const purchase = await ToolPurchase.findOne({ providerOrderId: orderId });
        if (!purchase) return res.status(404).json({ error: 'This payment was not found.' });
        if (purchase.status !== 'PAID') {
            const payment = await confirmRazorpayPayment({ paymentId, orderId, amountMinor: purchase.amountMinor, currency: purchase.currency });
            purchase.status = 'PAID';
            purchase.providerPaymentId = payment.id;
            purchase.paidAt = new Date();
            await purchase.save();
        }
        res.json(reportResponse(await ensureReport(purchase)));
    } catch (err) {
        if (err instanceof PaymentProviderError) return res.status(err.status).json({ error: err.message });
        console.error('[Originality] confirm error:', err.message);
        res.status(500).json({ error: 'Could not confirm the payment. If you were charged, contact support with your payment ID.' });
    }
});

// GET /api/tools/originality/:id?token= — the paid report again (generated now if it failed before).
router.get('/originality/:id', purchaseLimiter, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'private, no-store');
        if (!mongoose.isValidObjectId(req.params.id) || typeof req.query.token !== 'string') return res.status(404).json({ error: 'Report not found.' });
        const purchase = await ToolPurchase.findById(req.params.id);
        const ok = purchase && purchase.status === 'PAID' && purchase.accessToken.length === req.query.token.length
            && crypto.timingSafeEqual(Buffer.from(purchase.accessToken), Buffer.from(req.query.token));
        if (!ok) return res.status(404).json({ error: 'Report not found.' });
        res.json(reportResponse(await ensureReport(purchase)));
    } catch (err) {
        res.status(500).json({ error: 'Could not load the report.' });
    }
});

// Webhook path (payment.captured / order.paid): marks a tool purchase paid when
// the buyer's browser closed before the callback. Returns true when it was one.
export async function settleToolPurchaseFromWebhook(entity) {
    if (!entity?.order_id) return false;
    const purchase = await ToolPurchase.findOne({ providerOrderId: entity.order_id });
    if (!purchase) return false;
    if (purchase.status === 'CREATED' && entity.status === 'captured' && entity.amount === purchase.amountMinor && entity.currency === purchase.currency) {
        purchase.status = 'PAID';
        purchase.providerPaymentId = entity.id;
        purchase.paidAt = new Date();
        await purchase.save();
    }
    return true;
}

export default router;
