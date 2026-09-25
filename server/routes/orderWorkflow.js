import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Order, User, Writer } from '../db.js';
import { authenticateUser, authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore } from '../permissions.js';
import { EXT_MIMES, sniffOrderFileKind } from '../services/orderFiles.js';
import { recordAudit } from '../services/audit.js';
import { notify } from '../services/notifications.js';

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
        // 1. Check if writer has an ACTIVE membership plan (plan purchase ke baad)
        const writer = await Writer.findOne({ userId: req.user.id });
        const hasActivePlan = writer && writer.membership?.status === 'ACTIVE';

        if (!hasActivePlan) {
            return res.json({
                orders: [],
                requiresMembership: true,
                membershipStatus: writer?.membership?.status || 'NONE',
                message: 'An active membership plan is required to view and accept client orders.',
            });
        }

        // 2. Only show orders that ADMIN HAS APPROVED (jab admin approve karega tabhi show hoga)
        const orders = await Order.find({
            adminApproved: true,
            writerId: null,
            status: { $in: ['available', 'pending', 'Pending'] },
        })
            .select('-deliveryFiles -feedback -payment -pricing -catalog -adminNotes')
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
        const orders = await Order.find({ writerId: req.user.id })
            .select('-payment -pricing -catalog')
            .populate('userId', 'name email')
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
        const order = await Order.findOne({
            orderId: req.params.orderId,
            $or: [
                { writerId: req.user.id },
                { adminApproved: true, writerId: null, status: { $in: ['available', 'pending', 'Pending'] } },
            ],
        })
            .populate('userId', 'name email')
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
        const writer = await Writer.findOne({ userId: req.user.id });
        if (!writer || writer.membership?.status !== 'ACTIVE') {
            return res.status(403).json({ error: 'An active membership plan is required to accept client orders.' });
        }

        // 2. Find order (must be admin-approved and not yet assigned)
        const order = await Order.findOne({
            orderId: req.params.orderId,
            adminApproved: true,
            writerId: null,
            status: { $in: ['available', 'pending', 'Pending'] },
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found, not yet approved by admin, or already assigned.' });
        }

        order.writerId = req.user.id;
        order.status = 'in_progress';
        order.assignedTo = req.user.name || req.user.email || 'Writer';
        await order.save();

        res.json({
            message: 'Order accepted successfully.',
            order: { ...order.toObject(), status: normaliseStatus(order.status) },
        });
    } catch (err) {
        console.error('[OrderWorkflow] accept error:', err.message);
        res.status(500).json({ error: 'Could not accept order.' });
    }
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

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Please upload at least one file.' });
        }

        // Validate and store files
        const currentVersion = order.deliveryFiles.length > 0
            ? Math.max(...order.deliveryFiles.map(f => f.version))
            : 0;
        const newVersion = currentVersion + 1;

        const storedFiles = [];
        for (const f of req.files) {
            const ext = path.extname(f.originalname).toLowerCase();
            if (!ALLOWED_DELIVERY_EXTS.includes(ext)) {
                await discard();
                return res.status(400).json({
                    error: `"${safeName(f.originalname)}" is not supported. Allowed: PDF, DOC, DOCX, PPT, PPTX, ZIP.`
                });
            }

            // Content sniffing validation
            const head = Buffer.alloc(64);
            const fh = await fs.promises.open(f.path, 'r');
            const { bytesRead } = await fh.read(head, 0, 64, 0);
            await fh.close();
            const kind = sniffOrderFileKind(head.subarray(0, bytesRead));
            if (!kind) {
                await discard();
                return res.status(400).json({ error: `"${safeName(f.originalname)}" doesn't appear to be a valid file.` });
            }

            const storedName = `${crypto.randomBytes(16).toString('hex')}-${safeName(f.originalname)}`;
            const storedPath = path.join(DELIVERY_DIR, storedName);
            await fs.promises.rename(f.path, storedPath);

            const mimeType = EXT_MIMES[ext] || 'application/octet-stream';
            storedFiles.push({
                originalName: f.originalname.slice(0, 200),
                fileName: storedName,
                filePath: storedPath,
                mimeType,
                size: f.size,
                uploadedBy: req.user.id,
                uploadedAt: new Date(),
                version: newVersion,
            });
        }

        order.deliveryFiles.push(...storedFiles);
        order.status = 'submitted';
        order.submittedAt = new Date();
        await order.save();

        // Notify client that files were delivered
        notify({
            userId: order.userId,
            category: 'ASSIGNMENT',
            type: 'WORK_SUBMITTED',
            title: `Work Delivered: ${order.orderId}`,
            message: `Your writer has uploaded the completed work for "${order.topicTitle}". You can review the files in your dashboard.`,
            link: '/dashboard',
        }).catch(err => console.error('[OrderWorkflow] client notify error:', err.message));

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
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found.' });

        order.adminApproved = true;
        order.adminApprovedAt = new Date();
        order.status = 'available';
        await order.save();

        await recordAudit(req, 'ORDER_RELEASED_TO_WRITERS', { targetType: 'ORDER', targetId: order.orderId });

        // Notify writers with active membership plan
        const activeWriters = await Writer.find({
            status: { $in: ['APPROVED', 'ACTIVE'] },
            'membership.status': 'ACTIVE',
        }).select('userId').limit(20).lean();

        for (const w of activeWriters) {
            notify({
                userId: w.userId,
                category: 'OPPORTUNITY',
                type: 'ORDER_AVAILABLE',
                title: `New Order Available: ${order.orderId}`,
                message: `New order in "${order.subject}": "${order.topicTitle}". Login to accept!`,
                link: '/writer/orders',
            }).catch(() => {});
        }

        res.json({
            message: 'Order approved and released to writers with active memberships.',
            order: { ...order.toObject(), status: normaliseStatus(order.status) },
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not release order.' });
    }
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
        const { note } = req.body || {};
        const order = await Order.findOne({ orderId: req.params.orderId, status: 'submitted' });
        if (!order) return res.status(404).json({ error: 'Order not found or not in submitted state.' });

        order.status = 'revision_required';
        if (note) order.adminNotes = `${order.adminNotes ? order.adminNotes + '\n' : ''}[Revision] ${note}`;
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
                message: `Revision requested for "${order.topicTitle}": ${note || 'Please check guidelines and resubmit updated files.'}`,
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
                ...o,
                status: normaliseStatus(o.status),
                // Include delivery files for submitted or completed orders
                deliveryFiles: ['submitted', 'completed'].includes(normaliseStatus(o.status)) ? o.deliveryFiles : [],
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
                ...order,
                status: normaliseStatus(order.status),
                deliveryFiles: ['submitted', 'completed'].includes(normaliseStatus(order.status)) ? order.deliveryFiles : [],
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

        // Verify submitted or completed status
        const status = normaliseStatus(order.status);
        if (!['submitted', 'completed'].includes(status)) {
            return res.status(403).json({ error: 'File download is only available for submitted or completed orders.' });
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

// POST /api/order-workflow/client/approve/:orderId — client accepts delivery and completes order
router.post('/client/approve/:orderId', authenticateUser, async (req, res) => {
    try {
        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.user.id,
            status: 'submitted',
        });

        if (!order) return res.status(404).json({ error: 'Order not found or not in submitted state.' });

        order.status = 'completed';
        order.completedAt = new Date();
        await order.save();

        if (order.writerId) {
            notify({
                userId: order.writerId,
                category: 'APPROVAL',
                type: 'CLIENT_APPROVED',
                title: `Order Accepted: ${order.orderId}`,
                message: `The client has accepted your delivery for "${order.topicTitle}" and marked the order completed!`,
                link: '/writer/orders',
            }).catch(err => console.error('[OrderWorkflow] writer notify error:', err.message));
        }

        res.json({
            message: 'Order accepted and marked as completed.',
            order: { ...order.toObject(), status: normaliseStatus(order.status) },
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not accept order.' });
    }
});

// POST /api/order-workflow/client/revision/:orderId — client requests revision
router.post('/client/revision/:orderId', authenticateUser, async (req, res) => {
    try {
        const { note } = req.body || {};
        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.user.id,
            status: 'submitted',
        });

        if (!order) return res.status(404).json({ error: 'Order not found or not in submitted state.' });

        order.status = 'revision_required';
        const revisionNote = note ? String(note).slice(0, 2000) : 'Client requested revision';
        order.adminNotes = `${order.adminNotes ? order.adminNotes + '\n' : ''}[Client Revision] ${revisionNote}`;
        await order.save();

        if (order.writerId) {
            notify({
                userId: order.writerId,
                category: 'REVISION',
                type: 'CLIENT_REVISION',
                title: `Revision Requested: ${order.orderId}`,
                message: `Client requested revision on "${order.topicTitle}": ${revisionNote}`,
                link: '/writer/orders',
            }).catch(err => console.error('[OrderWorkflow] writer notify error:', err.message));
        }

        res.json({
            message: 'Revision requested. Your writer has been notified.',
            order: { ...order.toObject(), status: normaliseStatus(order.status) },
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not request revision.' });
    }
});

// POST /api/order-workflow/client/feedback/:orderId — client submits feedback
router.post('/client/feedback/:orderId', authenticateUser, async (req, res) => {
    try {
        const { rating, comment } = req.body;

        if (!rating || rating < 1 || rating > 5) {
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
            rating: Math.round(rating),
            comment: (comment || '').slice(0, 2000),
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

        res.json({ message: 'Thank you for your feedback!', order: { ...order.toObject(), status: normaliseStatus(order.status) } });
    } catch (err) {
        res.status(500).json({ error: 'Could not submit feedback.' });
    }
});

export default router;
