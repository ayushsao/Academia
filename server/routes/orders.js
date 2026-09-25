import { Router } from 'express';
import { clientOrderView } from '../services/orderRelease.js';
import { Order, CatalogSubject, CatalogService, CatalogProject } from '../db.js';
import { authenticateUser } from '../middleware.js';
import { rateLimit } from 'express-rate-limit';
import { validateInput, orderSchema, orderQuoteSchema, orderCheckoutSchema, razorpayVerifySchema } from '../validation.js';
import { quoteOrder, getRateCard, publicRateCard, quoteMatches, OrderPricingError } from '../services/orderPricing.js';
import { ownedFileNames, streamOrderFile, customerCanAccess, receiveOrderFiles, storeOrderUploads } from '../services/orderFiles.js';
import { quote, isLiveSelection, PricingError } from '../services/pricing.js';
import { fromMinor, toMinor } from '../services/money.js';
import { razorpayEnabled, razorpayKeyId, verifyRazorpaySignature, PaymentProviderError } from '../services/paymentProviders.js';
import { createOrderRecord, startCheckout, completeCheckout } from '../services/orderCheckout.js';

const router = Router();

// GET /api/orders — user's own orders
router.get('/', authenticateUser, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
        res.json({ orders: orders.map(clientOrderView) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders.' });
    }
});

// ── Quotation (never creates an order) ─────────────────────────────────────────
const quoteLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, message: { error: 'Too many price requests. Please slow down.' } });

// GET /api/orders/pricing — per-page rates, currencies, levels and add-ons for display.
router.get('/pricing', async (_req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-cache');
        res.json({ pricing: publicRateCard(await getRateCard()) });
    } catch { res.status(500).json({ error: 'Could not load pricing.' }); }
});

// POST /api/orders/quote — the complete quotation for a standard order.
router.post('/quote', quoteLimiter, validateInput(orderQuoteSchema), async (req, res) => {
    try {
        res.json({ quote: await quoteOrder(req.body) });
    } catch (err) {
        if (err instanceof OrderPricingError) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Could not calculate a price.' });
    }
});

// Orders from a catalogue page: names, billable pages and price all come from
// the database (the admin's pricing rules), never from the request.
async function priceCatalogOrder(sel, pages) {
    if (!await isLiveSelection(sel)) throw new PricingError('That selection is no longer available.', 404);
    const q = await quote({ subjectId: sel.subjectId, serviceId: sel.serviceId, projectId: sel.projectId, words: sel.words, pages: sel.words ? undefined : pages, spacing: sel.spacing, currency: sel.currency });
    if (sel.quotedTotalMinor !== undefined && (sel.quotedTotalMinor !== q.totalMinor || (sel.currency && sel.currency !== q.currency)))
        throw Object.assign(new PricingError('The price has changed since your quote. Please review the new price.', 409), { quote: (({ ruleId, ...pub }) => pub)(q) });
    const project = sel.projectId ? await CatalogProject.findById(sel.projectId).select('title serviceId').lean() : null;
    const serviceId = sel.serviceId || project?.serviceId || null;
    const [subject, service] = await Promise.all([
        CatalogSubject.findById(sel.subjectId).select('name').lean(),
        serviceId ? CatalogService.findById(serviceId).select('name').lean() : null,
    ]);
    return {
        subject: subject.name,
        service: service?.name || subject.name,
        pages: q.pages,
        currency: q.currency,
        totalAmount: fromMinor(q.totalMinor, q.currency),
        catalog: {
            subjectId: sel.subjectId, serviceId, projectId: sel.projectId || null, projectTitle: project?.title || '',
            words: q.words, spacing: q.spacing, wordsPerPage: q.wordsPerPage,
            unitPriceMinor: q.unitPriceMinor, totalMinor: q.totalMinor, pricingRuleId: q.ruleId,
        },
    };
}

/**
 * Everything an order stores, built on the server from the request: names,
 * billable pages and the price are computed here, never taken from the client.
 * Throws a 409 (with the current quote) when the customer's quote is stale.
 * Returns { fields, currency, totalMinor }.
 */
async function prepareOrder(body, userId) {
    const {
        service, subject, academicLevel, pages, deadline,
        topicTitle, instructions, description, wordCount, files,
        turnitinReport, topExpert, abstractPage,
    } = body;

    // Catalogue orders are priced by the admin's rules only (no legacy rates or add-ons).
    const catalogPrice = body.catalog ? await priceCatalogOrder(body.catalog, pages) : null;
    // Standard orders: the same quotation function the website used for the price shown.
    const q = catalogPrice ? null : await quoteOrder({ service, pages: pages || 1, academicLevel, currency: body.quote?.currency, topExpert, abstractPage });
    if (q && body.quote && !quoteMatches(q, body.quote))
        throw Object.assign(new OrderPricingError('The price has changed since your quote. Please review the new price.', 409), { quote: q });
    const calcPages = q ? q.pages : pages || 1;
    const calcWords = Number(wordCount) || (q ? q.words : calcPages * 250);
    const orderDesc = description || instructions || '';
    const orderInst = instructions || description || '';
    const serverComputedAmount = q ? q.total : 0;

    const fields = {
            userId,
            service, subject,
            academicLevel: academicLevel || 'Undergraduate',
            pages: calcPages,
            wordCount: calcWords,
            deadline, topicTitle,
            description: orderDesc,
            instructions: orderInst,
            status: 'pending',
            paymentStatus: 'pending',
            files: await ownedFileNames(files || [], userId),   // only the caller's own uploads
            turnitinReport: Boolean(turnitinReport),
            topExpert: Boolean(topExpert),
            abstractPage: Boolean(abstractPage),
            totalAmount: serverComputedAmount,
            ...(q && {
                currency: q.currency,
                pricing: {
                    words: q.words, pages: q.pages, wordsPerPage: q.wordsPerPage,
                    baseCurrency: q.baseCurrency, basePrice: q.basePrice, exchangeRate: q.exchangeRate, levelMultiplier: q.levelMultiplier,
                    subtotal: q.subtotal, addOns: q.addOns, addOnsTotal: q.addOnsTotal,
                    discountPercent: q.discountPercent, discount: q.discount, total: q.total, currency: q.currency,
                },
            }),
            ...(catalogPrice && { ...catalogPrice, topExpert: false, abstractPage: false }),
    };
    const currency = fields.currency || 'GBP';
    const totalMinor = catalogPrice ? catalogPrice.catalog.totalMinor : toMinor(serverComputedAmount, currency);
    return { fields, currency, totalMinor };
}

const orderError = (res, err, fallback) => {
    if (err instanceof PricingError || err instanceof OrderPricingError || err instanceof PaymentProviderError)
        return res.status(err.status).json({ error: err.message, ...(err.quote && { quote: err.quote }) });
    console.error('[Orders]', err?.message);
    res.status(500).json({ error: fallback });
};

// POST /api/orders — place an order paid manually (UPI / PayPal / bank reference).
// The reference is recorded for the team to verify; it is never treated as proof of payment.
router.post('/', authenticateUser, validateInput(orderSchema), async (req, res) => {
    try {
        const { fields } = await prepareOrder(req.body, req.user.id);
        const reference = (req.body.transactionId || '').trim();
        const order = await createOrderRecord({
            ...fields,
            transactionId: reference,
            payment: { provider: 'MANUAL', status: 'PENDING_VERIFICATION' },
        });
        res.status(201).json({ order });
    } catch (err) { orderError(res, err, 'Failed to create order.'); }
});

// ── Online payment (Razorpay) ──────────────────────────────────────────────────
const checkoutLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Too many payment attempts. Please try again later.' } });

// POST /api/orders/checkout — prices the order on the server and opens a
// Razorpay order for exactly that amount. Nothing is charged or created yet.
router.post('/checkout', checkoutLimiter, authenticateUser, validateInput(orderCheckoutSchema), async (req, res) => {
    try {
        if (!razorpayEnabled()) return res.status(503).json({ error: 'Online payment is not available right now. Please use UPI or PayPal.' });
        const { fields, currency, totalMinor } = await prepareOrder(req.body, req.user.id);
        const checkout = await startCheckout({ userId: req.user.id, fields, amountMinor: totalMinor, currency });
        res.json({ keyId: razorpayKeyId(), orderId: checkout.providerOrderId, amountMinor: totalMinor, currency });
    } catch (err) { orderError(res, err, 'Could not start the payment.'); }
});

// POST /api/orders/checkout/confirm — Razorpay's callback. The signature is
// checked, then the payment is re-fetched from Razorpay and must be captured
// for exactly the checkout's amount and currency before the order is created.
router.post('/checkout/confirm', checkoutLimiter, authenticateUser, validateInput(razorpayVerifySchema), async (req, res) => {
    try {
        const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
        if (!verifyRazorpaySignature({ orderId, paymentId, signature }))
            return res.status(400).json({ error: 'Payment could not be verified.' });
        const order = await completeCheckout({ providerOrderId: orderId, paymentId, userId: req.user.id });
        res.status(201).json({ order });
    } catch (err) { orderError(res, err, 'Could not confirm the payment. If you were charged, contact support with your payment ID.'); }
});

// GET /api/orders/:id — single order
// GET /api/orders/files/:name — download one of the caller's own order files.
router.get('/files/:name', authenticateUser, async (req, res) => {
    try {
        if (!await customerCanAccess(req.user.id, req.params.name)) return res.status(404).json({ error: 'File not found.' });
        await streamOrderFile(res, req.params.name);
    } catch { if (!res.headersSent) res.status(500).json({ error: 'Could not load file.' }); }
});

// POST /api/orders/:id/files — customer attaching additional files to their order
router.post('/:id/files', authenticateUser, receiveOrderFiles, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.id, userId: req.user.id });
        if (!order) return res.status(404).json({ error: 'Order not found.' });

        if (order.status === 'Completed' || order.status === 'Cancelled') {
            return res.status(400).json({ error: 'Cannot attach files to a closed order.' });
        }

        const currentFilesCount = (order.files || []).length;
        const newFiles = req.files || [];
        if (!newFiles.length) {
            return res.status(400).json({ error: 'No files provided.' });
        }
        if (currentFilesCount + newFiles.length > 5) {
            return res.status(400).json({ error: 'Maximum 5 files allowed per order.' });
        }

        const storedNames = await storeOrderUploads(newFiles, req.user.id);
        order.files = [...(order.files || []), ...storedNames];
        await order.save();

        res.json({ order, files: order.files });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to attach files.' });
    }
});

router.get('/:id', authenticateUser, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.id, userId: req.user.id }).lean();
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        res.json({ order: clientOrderView(order) });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

export default router;
