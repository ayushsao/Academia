import { Router } from 'express';
import { Order, CatalogSubject, CatalogService, CatalogProject } from '../db.js';
import { authenticateUser } from '../middleware.js';
import { rateLimit } from 'express-rate-limit';
import { validateInput, orderSchema, orderQuoteSchema } from '../validation.js';
import { quoteOrder, getRateCard, publicRateCard, quoteMatches, OrderPricingError } from '../services/orderPricing.js';
import { ownedFileNames, streamOrderFile, customerCanAccess, receiveOrderFiles, storeOrderUploads } from '../services/orderFiles.js';
import { quote, isLiveSelection, PricingError } from '../services/pricing.js';
import { fromMinor } from '../services/money.js';

const router = Router();

function genOrderId() {
    return 'ACAD-' + Math.floor(100000 + Math.random() * 900000);
}

// GET /api/orders — user's own orders
router.get('/', authenticateUser, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json({ orders });
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

// POST /api/orders — place new order
router.post('/', authenticateUser, validateInput(orderSchema), async (req, res) => {
    try {
        const {
            service, subject, academicLevel, pages, deadline,
            topicTitle, instructions, files,
            turnitinReport, topExpert, abstractPage, transactionId
        } = req.body;

        // Catalogue orders are priced by the admin's rules only (no legacy rates or add-ons).
        const catalogPrice = req.body.catalog ? await priceCatalogOrder(req.body.catalog, pages) : null;
        // Standard orders: the same quotation function the website used for the price shown.
        const q = catalogPrice ? null : await quoteOrder({ service, pages: pages || 1, academicLevel, currency: req.body.quote?.currency, topExpert, abstractPage });
        if (q && req.body.quote && !quoteMatches(q, req.body.quote))
            return res.status(409).json({ error: 'The price has changed since your quote. Please review the new price.', quote: q });
        const calcPages = q ? q.pages : pages || 1;
        const serverComputedAmount = q ? q.total : 0;

        const order = await Order.create({
            orderId: genOrderId(),
            userId: req.user.id,
            service, subject,
            academicLevel: academicLevel || 'Undergraduate',
            pages: calcPages,
            deadline, topicTitle,
            instructions: instructions || '',
            files: await ownedFileNames(files || [], req.user.id),   // only the caller's own uploads
            turnitinReport: Boolean(turnitinReport),
            topExpert: Boolean(topExpert),
            abstractPage: Boolean(abstractPage),
            totalAmount: serverComputedAmount,
            transactionId: transactionId || '',
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
        });

        res.status(201).json({ order });
    } catch (err) {
        if (err instanceof PricingError || err instanceof OrderPricingError) return res.status(err.status).json({ error: err.message, ...(err.quote && { quote: err.quote }) });
        res.status(500).json({ error: 'Failed to create order.' });
    }
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
        const order = await Order.findOne({ orderId: req.params.id, userId: req.user.id });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        res.json({ order });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

export default router;
