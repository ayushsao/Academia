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
            .select('-transactionId -payment -pricing -catalog -adminNotes -deliveryFiles.filePath')
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
            .select('-transactionId -payment -pricing -catalog -adminNotes -deliveryFiles.filePath')
            .populate('userId', 'name')
            .lean();

        if (!order) return res.status(404).json({ error: 'Order not found.' });
        res.json({ order: { ...order, status: normaliseStatus(order.status) } });
    } catch (err) {
        res.status(500).json({ error: 'Could not load order.' });
    }
});

// POST /api/order-workflow/writer/accept/:orderId — writer accepts an order (requires active membership)
router.post('/writer/accept/:orderId', authenticateUser, requireWriter, async (req, res) => {
    try {
        // 1. Check writer membership (plan purchase ke baad)
        const writer = await Writer.findOne({ userId: req.user.id }).select('status membership').lean();
        if (!canTakeOrders(writer)) {
            return res.status(403).json({ error: 'An active membership plan is required to accept client orders.' });
        }

        // 2. Claim the order atomically: when two writers accept at once, only the first gets it.
        const order = await Order.findOneAndUpdate(
            { ...OPEN_ORDER, orderId: req.params.orderId },
            { $set: { writerId: req.user.id, status: 'in_progress', assignedTo: req.user.name || 'Writer' } },
            { new: true },
        ).select(WRITER_HIDDEN_FIELDS);

        if (!order) {
            return res.status(409).json({ error: 'This order was just taken by another writer, or is no longer available.' });
        }

        res.json({
            message: 'Order accepted successfully.',
            order: { ...order.toObject(), status: normaliseStatus(order.status) },
        });
    } catch (err) {
        console.error('[OrderWorkflow] accept error:', err.message);
        res.status(500).json({ error: 'Could not accept order.' });
    }
});

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
