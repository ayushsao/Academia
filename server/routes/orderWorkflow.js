import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Order, User, Writer } from '../db.js';
import { authenticateUser, authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore } from '../permissions.js';
import { EXT_MIMES, sniffOrderFileKind, kindMatchesExtension } from '../services/orderFiles.js';
import { recordAudit } from '../services/audit.js';
import { notify } from '../services/notifications.js';
import { streamOrderFile } from '../services/orderFiles.js';
import { validateInput, biddingSchema, bidSchema, bidRatesSchema } from '../validation.js';
import { bidRatesView, saveBidRates, budgetFor, getBidRates } from '../services/bidLimits.js';
import { getRateCard } from '../services/orderPricing.js';
import { issueReceipt } from '../services/receipts.js';
import { BiddingError, setBidding, listForWriter, placeBid, withdrawBid, bidsForOrder, acceptBid } from '../services/orderBidding.js';
import { releaseOrder, getOrderSettings, saveOrderSettings, canTakeOrders, clientOrderView, isCompleted, OPEN_ORDER, WRITER_HIDDEN_FIELDS } from '../services/orderRelease.js';

const require = createRequire(import.meta.url);
const multer = require('multer');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Delivery file storage — modular: swap this for S3/GCS later without touching routes.
const DELIVERY_DIR = path.resolve(process.env.DELIVERY_STORAGE_DIR || path.join(__dirname, '..', 'private_uploads', 'deliveries'));
fs.mkdirSync(DELIVERY_DIR, { recursive: true });

const MB = 1024 * 1024;
const MAX_DELIVERY_SIZE = 100 * MB;

const deliveryUpload = multer({
    storage: multer.diskStorage({
        destination: DELIVERY_DIR,
        filename: (_req, _file, cb) => cb(null, `.tmp-${crypto.randomBytes(16).toString('hex')}`),
    }),
    limits: { fileSize: MAX_DELIVERY_SIZE, files: 5 },
});

const ALLOWED_DELIVERY_EXTS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.zip'];

const safeName = (name) => path.basename(String(name)).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(-80) || 'file';

const router = Router();

// Normalise old/new status values for display
const normaliseStatus = (s) => {
    const map = { 'Pending': 'pending', 'In Progress': 'in_progress', 'Completed': 'completed', 'Cancelled': 'cancelled' };
    return map[s] || s;
};

// Validates uploaded delivery files (extension + real content) and stores them as
// the order's next version. Returns { files } or { error } (temp files removed).
async function storeDeliveryFiles(uploads, order, uploaderId) {
    const discard = () => Promise.all((uploads || []).map(f => fs.promises.unlink(f.path).catch(() => {})));
    if (!uploads || uploads.length === 0) return { error: 'Please upload at least one file.' };
    for (const f of uploads) {
        const ext = path.extname(f.originalname).toLowerCase();
        if (!ALLOWED_DELIVERY_EXTS.includes(ext)) {
            await discard();
            return { error: `"${safeName(f.originalname)}" is not supported. Allowed: PDF, DOC, DOCX, PPT, PPTX, ZIP.` };
        }
        const head = Buffer.alloc(64);
        const fh = await fs.promises.open(f.path, 'r');
        const { bytesRead } = await fh.read(head, 0, 64, 0);
        await fh.close();
        if (!kindMatchesExtension(sniffOrderFileKind(head.subarray(0, bytesRead)), ext)) {
            await discard();
            return { error: `"${safeName(f.originalname)}" doesn't appear to be a valid file.` };
        }
    }
    const version = (order.deliveryFiles.length ? Math.max(...order.deliveryFiles.map(f => f.version || 1)) : 0) + 1;
    const files = [];
    for (const f of uploads) {
        const ext = path.extname(f.originalname).toLowerCase();
        const storedName = `${crypto.randomBytes(16).toString('hex')}-${safeName(f.originalname)}`;
        const storedPath = path.join(DELIVERY_DIR, storedName);
        await fs.promises.rename(f.path, storedPath);
        files.push({
            originalName: f.originalname.slice(0, 200), fileName: storedName, filePath: storedPath,
            mimeType: EXT_MIMES[ext] || 'application/octet-stream', size: f.size,
            uploadedBy: uploaderId, uploadedAt: new Date(), version,
        });
    }
    return { files };
}

// ── Middleware: Require writer role ────────────────────────────────────────
function requireWriter(req, res, next) {
    if (!req.user || req.user.role !== 'WRITER') {
        return res.status(403).json({ error: 'Only writers can access this endpoint.' });
    }
    next();
}

// ── Middleware: Require customer role ──────────────────────────────────────
function requireCustomer(req, res, next) {
    if (!req.user || (req.user.role !== 'CUSTOMER' && req.user.role !== 'student')) {
        return res.status(403).json({ error: 'Only clients can access this endpoint.' });
    }
    next();
}

// ═══════════════════════════════════════════════════════════════════════════
// WRITER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/order-workflow/writer/available — admin-approved orders available for writers with active membership
router.get('/writer/available', authenticateUser, requireWriter, async (req, res) => {
    try {
        // 1. Any approved writer with a live membership plan sees every released order, whatever the subject.
        const writer = await Writer.findOne({ userId: req.user.id }).select('status membership').lean();

        if (!canTakeOrders(writer)) {
            return res.json({
                orders: [],
                requiresMembership: true,
                membershipStatus: writer?.membership?.status || 'NONE',
                message: 'An active membership plan is required to view and accept client orders.',
            });
        }

        // 2. Only show orders that ADMIN HAS APPROVED (jab admin approve karega tabhi show hoga)
        const orders = await Order.find(OPEN_ORDER)
            .select(`${WRITER_HIDDEN_FIELDS} -deliveryFiles`)
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            orders: orders.map(o => ({ ...o, status: normaliseStatus(o.status) })),
            requiresMembership: false,
            membershipPlan: writer?.membership?.plan || 'Active Plan',
        });
    } catch (err) {
        console.error('[OrderWorkflow] available orders error:', err.message);
        res.status(500).json({ error: 'Could not load available orders.' });
    }
});

// GET /api/order-workflow/writer/my-orders — orders assigned to this writer
router.get('/writer/my-orders', authenticateUser, requireWriter, async (req, res) => {
    try {
        // The client's name only — never their email or other contact details.
        const orders = await Order.find({ writerId: req.user.id })
            .select('-transactionId -payment -pricing -catalog -adminNotes -deliveryFiles.filePath -totalAmount -paymentStatus -bidding')
            .populate('userId', 'name')
            .sort({ createdAt: -1 })
            .lean();

        res.json({ orders: orders.map(o => ({ ...o, status: normaliseStatus(o.status) })) });
    } catch (err) {
        console.error('[OrderWorkflow] my orders error:', err.message);
        res.status(500).json({ error: 'Could not load your orders.' });
    }
});

// GET /api/order-workflow/writer/orders/:orderId — single order detail for writer
router.get('/writer/orders/:orderId', authenticateUser, requireWriter, async (req, res) => {
    try {
        const writer = await Writer.findOne({ userId: req.user.id }).select('status membership').lean();
        const order = await Order.findOne({
            orderId: req.params.orderId,
            $or: [{ writerId: req.user.id }, ...(canTakeOrders(writer) ? [OPEN_ORDER] : [])],
        })
            .select('-transactionId -payment -pricing -catalog -adminNotes -deliveryFiles.filePath -totalAmount -paymentStatus -bidding')
            .populate('userId', 'name')
            .lean();

        if (!order) return res.status(404).json({ error: 'Order not found.' });
        res.json({ order: { ...order, status: normaliseStatus(order.status) } });
    } catch (err) {
        res.status(500).json({ error: 'Could not load order.' });
    }
});

// POST /api/order-workflow/writer/accept/:orderId — no longer used: approved orders
// are open for bids, and an admin assigns each one from its bids.
router.post('/writer/accept/:orderId', authenticateUser, requireWriter, (_req, res) =>
    res.status(409).json({ error: 'Place a bid on this project — the admin assigns it from the bids.' }));

// GET /api/order-workflow/writer/files/:orderId/:name — the client's reference files,
// only for the writer the order is assigned to.
router.get('/writer/files/:orderId/:name', authenticateUser, requireWriter, async (req, res) => {
    try {
        const name = path.basename(String(req.params.name));
        const visible = await Order.exists({ orderId: req.params.orderId, files: name, writerId: req.user.id });
        if (!visible) return res.status(404).json({ error: 'File not found.' });
        await streamOrderFile(res, name);
    } catch { if (!res.headersSent) res.status(500).json({ error: 'Could not load file.' }); }
});

// POST /api/order-workflow/writer/upload/:orderId — writer uploads completed work
router.post('/writer/upload/:orderId', authenticateUser, requireWriter, deliveryUpload.array('files', 5), async (req, res) => {
    const discard = () => Promise.all((req.files || []).map(f => fs.promises.unlink(f.path).catch(() => {})));

    try {
        const order = await Order.findOne({
            orderId: req.params.orderId,
            writerId: req.user.id,
            status: { $in: ['in_progress', 'revision_required'] },
        });

        if (!order) {
            await discard();
            return res.status(404).json({ error: 'Order not found or not in a submittable state.' });
        }

        const stored = await storeDeliveryFiles(req.files, order, req.user.id);
        if (stored.error) return res.status(400).json({ error: stored.error });

        order.deliveryFiles.push(...stored.files);
        order.status = 'submitted';
        order.submittedAt = new Date();
        await order.save();

        res.json({
            message: 'Work submitted successfully.',
            order: { ...order.toObject(), status: normaliseStatus(order.status) },
        });
    } catch (err) {
        await discard();
        console.error('[OrderWorkflow] upload error:', err.message);
        res.status(500).json({ error: 'Could not upload files.' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/order-workflow/admin/release/:orderId — admin approves order and releases to writers
router.post('/admin/release/:orderId', authenticateAdmin, requirePermission('orders.write'), async (req, res) => {
    try {
        // Releases it and notifies every writer with a live plan (any subject).
        const order = await releaseOrder(req.params.orderId);
        if (!order) {
            const existing = await Order.findOne({ orderId: req.params.orderId }).select('adminApproved writerId status').lean();
            if (!existing) return res.status(404).json({ error: 'Order not found.' });
            return res.status(409).json({ error: existing.adminApproved ? 'This order is already approved and released to writers.' : 'Only new orders that no writer has taken can be released.' });
        }

        await recordAudit(req, 'ORDER_RELEASED_TO_WRITERS', { targetType: 'ORDER', targetId: order.orderId });

        res.json({
            message: 'Order approved and released to writers with active memberships.',
            order: { ...order.toObject(), status: normaliseStatus(order.status) },
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not release order.' });
    }
});

// POST /api/order-workflow/admin/upload/:orderId — the admin uploads the final work.
// On an order already marked completed the file reaches the customer at once;
// otherwise it waits as "Submitted" for the admin's approval, like a writer's upload.
router.post('/admin/upload/:orderId', authenticateAdmin, requirePermission('orders.write'), deliveryUpload.array('files', 5), async (req, res) => {
    const discard = () => Promise.all((req.files || []).map(f => fs.promises.unlink(f.path).catch(() => {})));
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) { await discard(); return res.status(404).json({ error: 'Order not found.' }); }
        if (['cancelled', 'Cancelled'].includes(order.status)) { await discard(); return res.status(409).json({ error: 'This order is cancelled.' }); }

        const stored = await storeDeliveryFiles(req.files, order, req.admin.id);
        if (stored.error) return res.status(400).json({ error: stored.error });
        order.deliveryFiles.push(...stored.files);

        const alreadyCompleted = isCompleted(order.status);
        if (alreadyCompleted) {
            order.status = 'completed';
            order.completedAt = order.completedAt || new Date();
        } else {
            order.status = 'submitted';
            order.submittedAt = new Date();
        }
        await order.save();
        await recordAudit(req, 'ORDER_FINAL_FILE_UPLOADED', { targetType: 'ORDER', targetId: order.orderId, reason: stored.files.map(f => f.originalName).join(', ') });

        if (alreadyCompleted) {
            notify({
                userId: order.userId, category: 'APPROVAL', type: 'ORDER_COMPLETED',
                title: `Your completed work is ready: ${order.orderId}`,
                message: `The final file for "${order.topicTitle}" is ready to download from your dashboard.`,
                link: '/dashboard',
            }).catch(() => {});
        }
        res.json({ order: { ...order.toObject(), status: normaliseStatus(order.status) } });
    } catch (err) {
        await discard();
        console.error('[OrderWorkflow] admin upload error:', err.message);
        res.status(500).json({ error: 'Could not upload files.' });
    }
});

// ── Writer bidding ─────────────────────────────────────────────────────────
const biddingFail = (res, err, fallback) => {
    if (err instanceof BiddingError) return res.status(err.status).json({ error: err.message });
    console.error('[Bidding]', err?.message);
    res.status(500).json({ error: fallback });
};

// Admin/HR: orders that can be (or are) open for bidding, with bid counts.
router.get('/admin/bidding', noStore, authenticateAdmin, requirePermission('bidding.manage', 'orders.write'), async (req, res) => {
    try {
        const orders = await Order.find({ writerId: null, status: { $in: ['available', 'pending', 'Pending'] } })
            .select('orderId service subject academicLevel topicTitle pages wordCount deadline totalAmount currency pricing.exchangeRate bidding adminApproved createdAt')
            .sort({ createdAt: -1 }).limit(200).lean();
        const [rates, card] = await Promise.all([getBidRates(), getRateCard()]);
        for (const o of orders) { const b = await budgetFor(o, rates, card); o.suggestedBudget = b ? { min: b.minBid, max: b.maxBid, currency: b.currency, words: b.words } : null; delete o.pricing; }
        const { OrderBid } = await import('../db.js');
        const counts = await OrderBid.aggregate([{ $match: { order: { $in: orders.map(o => o._id) }, status: 'PENDING' } }, { $group: { _id: '$order', n: { $sum: 1 } } }]);
        const byOrder = new Map(counts.map(c => [String(c._id), c.n]));
        res.json({ orders: orders.map(o => ({ ...o, _id: undefined, openBids: byOrder.get(String(o._id)) || 0 })) });
    } catch (err) { biddingFail(res, err, 'Could not load bidding projects.'); }
});

// Bid limits by work: per 1,000 words, default and per service (base currency).
router.get('/admin/bid-rates', noStore, authenticateAdmin, requirePermission('bidding.manage', 'orders.write'), async (req, res) => {
    try { res.json(await bidRatesView()); }
    catch (err) { biddingFail(res, err, 'Could not load bid limits.'); }
});

router.put('/admin/bid-rates', authenticateAdmin, requirePermission('bidding.manage', 'orders.write'), validateInput(bidRatesSchema), async (req, res) => {
    try {
        const rates = await saveBidRates(req.body);
        await recordAudit(req, 'BID_RATES_UPDATED', { targetType: 'SETTINGS', reason: `default ${rates.min ?? '-'}-${rates.max ?? '-'} per 1000 words, ${Object.keys(rates.services || {}).length} service rate(s)` });
        res.json({ rates });
    } catch (err) { biddingFail(res, err, 'Could not save bid limits.'); }
});

router.get('/admin/bidding/:orderId', noStore, authenticateAdmin, requirePermission('bidding.manage', 'orders.write'), async (req, res) => {
    try { res.json(await bidsForOrder(req.params.orderId)); }
    catch (err) { biddingFail(res, err, 'Could not load bids.'); }
});

// Open/close bidding and set the writer budget (can be changed any time).
router.put('/admin/bidding/:orderId', authenticateAdmin, requirePermission('bidding.manage', 'orders.write'), validateInput(biddingSchema), async (req, res) => {
    try {
        const order = await setBidding(req.params.orderId, req.body);
        await recordAudit(req, 'ORDER_BIDDING_UPDATED', { targetType: 'ORDER', targetId: order.orderId, reason: `${order.bidding.open ? 'open' : 'closed'}${order.bidding.minBid != null ? ` ${order.bidding.currency} ${order.bidding.minBid}-${order.bidding.maxBid}` : ' (no budget)'}` });
        res.json({ bidding: order.bidding, status: order.status });
    } catch (err) { biddingFail(res, err, 'Could not update bidding.'); }
});

router.post('/admin/bids/:bidId/accept', authenticateAdmin, requirePermission('bidding.manage', 'orders.write'), async (req, res) => {
    try {
        const order = await acceptBid(req.params.bidId);
        await recordAudit(req, 'ORDER_BID_ACCEPTED', { targetType: 'ORDER', targetId: order.orderId, reason: `${order.writerPayout.currency} ${order.writerPayout.amount} → ${order.assignedTo}` });
        res.json({ order: { orderId: order.orderId, status: order.status, assignedTo: order.assignedTo, writerPayout: order.writerPayout } });
    } catch (err) { biddingFail(res, err, 'Could not accept the bid.'); }
});

// Writer: projects open for bids (budget only — never the customer's price).
router.get('/writer/bidding', noStore, authenticateUser, requireWriter, async (req, res) => {
    try { res.json(await listForWriter(req.user.id)); }
    catch (err) { biddingFail(res, err, 'Could not load projects.'); }
});

router.post('/writer/bidding/:orderId/bid', authenticateUser, requireWriter, validateInput(bidSchema), async (req, res) => {
    try { res.json({ bid: await placeBid(req.user.id, req.params.orderId, req.body) }); }
    catch (err) { biddingFail(res, err, 'Could not place the bid.'); }
});

router.delete('/writer/bidding/:orderId/bid', authenticateUser, requireWriter, async (req, res) => {
    try { res.json({ bid: await withdrawBid(req.user.id, req.params.orderId) }); }
    catch (err) { biddingFail(res, err, 'Could not withdraw the bid.'); }
});

// POST /api/order-workflow/admin/payment/:orderId/received — the admin checked a
// manual payment (UPI / PayPal / bank reference) and confirms it; the customer's
// receipt is issued.
router.post('/admin/payment/:orderId/received', authenticateAdmin, requirePermission('orders.write'), async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        if (order.payment?.status === 'PAID') return res.status(409).json({ error: 'This payment is already confirmed.' });
        const currency = order.pricing?.currency || order.currency || 'GBP';
        const amountMinor = order.catalog?.totalMinor ?? Math.round(Number(order.totalAmount || 0) * 100);
        order.payment = { provider: 'MANUAL', status: 'PAID', amountMinor, currency, paidAt: new Date() };
        order.paymentStatus = 'paid';
        await order.save();
        const withReceipt = await issueReceipt(order._id);
        await recordAudit(req, 'ORDER_PAYMENT_CONFIRMED', { targetType: 'ORDER', targetId: order.orderId, reason: `manual ${currency} ${amountMinor / 100} · receipt ${withReceipt?.receipt?.number}` });
        res.json({ payment: withReceipt.payment, paymentStatus: withReceipt.paymentStatus, receipt: withReceipt.receipt });
    } catch (err) {
        console.error('[OrderWorkflow] confirm payment error:', err.message);
        res.status(500).json({ error: 'Could not confirm the payment.' });
    }
});

// GET/PUT /api/order-workflow/admin/settings — auto-approve new (paid) orders.
router.get('/admin/settings', noStore, authenticateAdmin, requirePermission('orders.read'), async (req, res) => {
    try { res.json({ settings: await getOrderSettings() }); }
    catch { res.status(500).json({ error: 'Could not load order settings.' }); }
});

router.put('/admin/settings', authenticateAdmin, requirePermission('orders.write'), async (req, res) => {
    try {
        const autoRelease = req.body?.autoRelease;
        if (typeof autoRelease !== 'boolean') return res.status(400).json({ error: 'autoRelease must be true or false.' });
        const settings = await saveOrderSettings({ autoRelease });
        await recordAudit(req, 'ORDER_SETTINGS_UPDATED', { targetType: 'SETTINGS', reason: `autoRelease=${autoRelease}` });
        res.json({ settings });
    } catch { res.status(500).json({ error: 'Could not save order settings.' }); }
});

// GET /api/order-workflow/admin/submitted — orders awaiting admin review
router.get('/admin/submitted', authenticateAdmin, requirePermission('orders.read'), async (req, res) => {
    try {
        const orders = await Order.find({ status: 'submitted' })
            .populate('userId', 'name email')
            .populate('writerId', 'name email')
            .sort({ submittedAt: -1 })
            .lean();

        res.json({ orders: orders.map(o => ({ ...o, status: normaliseStatus(o.status) })) });
    } catch (err) {
        res.status(500).json({ error: 'Could not load submitted orders.' });
    }
});

// POST /api/order-workflow/admin/approve/:orderId — admin approves submission
router.post('/admin/approve/:orderId', authenticateAdmin, requirePermission('orders.write'), async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId, status: 'submitted' });
        if (!order) return res.status(404).json({ error: 'Order not found or not in submitted state.' });

        order.status = 'completed';
        order.completedAt = new Date();
        await order.save();

        await recordAudit(req, 'ORDER_APPROVED', { targetType: 'ORDER', targetId: order.orderId });

        // Notify client of completed order
        notify({
            userId: order.userId,
            category: 'APPROVAL',
            type: 'ORDER_COMPLETED',
            title: `Order Completed: ${order.orderId}`,
            message: `Your order "${order.topicTitle}" has been approved and completed. You can now download the delivery files and leave a review.`,
            link: '/dashboard',
        }).catch(err => console.error('[OrderWorkflow] client notify error:', err.message));

        // Notify writer of approval
        if (order.writerId) {
            notify({
                userId: order.writerId,
                category: 'APPROVAL',
                type: 'ORDER_APPROVED',
                title: `Submission Approved: ${order.orderId}`,
                message: `Your submission for order "${order.topicTitle}" has been approved!`,
                link: '/writer/orders',
            }).catch(err => console.error('[OrderWorkflow] writer notify error:', err.message));
        }

        res.json({
            message: 'Order approved and marked as completed.',
            order: { ...order.toObject(), status: normaliseStatus(order.status) },
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not approve order.' });
    }
});

// POST /api/order-workflow/admin/revision/:orderId — admin requests revision
router.post('/admin/revision/:orderId', authenticateAdmin, requirePermission('orders.write'), async (req, res) => {
    try {
        const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 2000) : '';
        if (!note) return res.status(400).json({ error: 'Tell the writer what needs to change.' });
        const order = await Order.findOne({ orderId: req.params.orderId, status: 'submitted' });
        if (!order) return res.status(404).json({ error: 'Order not found or not in submitted state.' });

        order.status = 'revision_required';
        order.revisionNote = note;
        await order.save();

        await recordAudit(req, 'ORDER_REVISION_REQUESTED', {
            targetType: 'ORDER', targetId: order.orderId,
            reason: note || 'Revision requested',
        });

        // Notify writer of revision request
        if (order.writerId) {
            notify({
                userId: order.writerId,
                category: 'REVISION',
                type: 'REVISION_REQUESTED',
                title: `Revision Requested: ${order.orderId}`,
                message: `Revision requested for "${order.topicTitle}": ${note}`,
                link: '/writer/orders',
            }).catch(err => console.error('[OrderWorkflow] writer notify error:', err.message));
        }

        res.json({
            message: 'Revision requested.',
            order: { ...order.toObject(), status: normaliseStatus(order.status) },
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not request revision.' });
    }
});

// GET /api/order-workflow/admin/delivery-file/:orderId/:fileId — download delivery file
router.get('/admin/delivery-file/:orderId/:fileId', authenticateAdmin, requirePermission('orders.read'), async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found.' });

        const file = order.deliveryFiles.id(req.params.fileId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const fullPath = path.join(DELIVERY_DIR, path.basename(file.fileName));
        try { await fs.promises.access(fullPath); } catch { return res.status(404).json({ error: 'File not found on disk.' }); }

        res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
        const downloadName = (file.originalName || file.fileName).replace(/["\r\n]/g, '');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        fs.createReadStream(fullPath).pipe(res);
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: 'Could not download file.' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/order-workflow/client/orders — client's orders with status tracking
router.get('/client/orders', authenticateUser, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.id })
            .select('-adminNotes -payment -pricing -catalog')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            orders: orders.map(o => ({
                ...clientOrderView(o),
                status: normaliseStatus(o.status),
            })),
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not load orders.' });
    }
});

// GET /api/order-workflow/client/orders/:orderId — single order with full details
router.get('/client/orders/:orderId', authenticateUser, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId, userId: req.user.id }).lean();
        if (!order) return res.status(404).json({ error: 'Order not found.' });

        res.json({
            order: {
                ...clientOrderView(order),
                status: normaliseStatus(order.status),
            },
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not load order.' });
    }
});

// GET /api/order-workflow/client/download/:orderId/:fileId — secure file download
router.get('/client/download/:orderId/:fileId', authenticateUser, async (req, res) => {
    try {
        // Verify ownership
        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.user.id,
        });

        if (!order) return res.status(404).json({ error: 'Order not found.' });

        // The work is released to the customer once an admin has approved it.
        if (!isCompleted(order.status)) {
            return res.status(403).json({ error: 'You can download the work once your order is completed.' });
        }

        // Find file
        const file = order.deliveryFiles.id(req.params.fileId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const fullPath = path.join(DELIVERY_DIR, path.basename(file.fileName));
        try { await fs.promises.access(fullPath); } catch { return res.status(404).json({ error: 'File not found on disk.' }); }

        res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
        const downloadName = (file.originalName || file.fileName).replace(/["\r\n]/g, '');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        fs.createReadStream(fullPath).pipe(res);
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: 'Could not download file.' });
    }
});

// POST /api/order-workflow/client/feedback/:orderId — client submits feedback
router.post('/client/feedback/:orderId', authenticateUser, async (req, res) => {
    try {
        const rating = Number(req.body?.rating);
        const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
        }

        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.user.id,
        });

        if (!order) return res.status(404).json({ error: 'Order not found.' });

        const status = normaliseStatus(order.status);
        if (status !== 'completed') {
            return res.status(400).json({ error: 'Feedback can only be given on completed orders.' });
        }

        if (order.feedback) {
            return res.status(409).json({ error: 'You have already submitted feedback for this order.' });
        }

        order.feedback = {
            rating,
            comment: comment.slice(0, 2000),
            writerId: order.writerId || undefined,
            createdAt: new Date(),
        };
        await order.save();

        // Notify writer of client review
        if (order.writerId) {
            notify({
                userId: order.writerId,
                category: 'APPROVAL',
                type: 'CLIENT_FEEDBACK',
                title: `New Review for ${order.orderId}`,
                message: `The client gave a ${order.feedback.rating}-star review for "${order.topicTitle}".`,
                link: '/writer/orders',
            }).catch(err => console.error('[OrderWorkflow] writer notify error:', err.message));
        }

        res.json({ message: 'Thank you for your feedback!', order: { ...clientOrderView(order), status: normaliseStatus(order.status) } });
    } catch (err) {
        res.status(500).json({ error: 'Could not submit feedback.' });
    }
});

export default router;
