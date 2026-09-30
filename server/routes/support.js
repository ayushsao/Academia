import { Router } from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { SupportMessage, Order, User } from '../db.js';
import { authenticateUser, authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore } from '../permissions.js';
import { validateInput, supportMessageSchema } from '../validation.js';
import { openStream, publish } from '../services/liveEvents.js';

// Live support chat between customers and the admin team. Each customer has a
// general thread ("g:<userId>") and one thread per order ("o:<orderId>").
// Messages are stored in MongoDB and pushed live over SSE (services/liveEvents.js).

const generalKey = (userId) => `g:${userId}`;
const orderKey = (orderId) => `o:${orderId}`;
const toView = (m) => ({
    id: String(m._id), thread: m.threadKey, orderId: m.orderId, sender: m.sender, senderName: m.senderName,
    body: m.body, createdAt: m.createdAt, readByAdminAt: m.readByAdminAt, readByCustomerAt: m.readByCustomerAt,
});
const sendLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'You’re sending messages too quickly. Please wait a moment.' } });
const fail = (res, err, fallback) => {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.error('[Support]', err?.message);
    res.status(500).json({ error: fallback });
};
const httpError = (status, message) => Object.assign(new Error(message), { status });

// Summaries (last message, unread count) for a set of threads.
async function summaries(match, unreadFor) {
    const unreadMatch = unreadFor === 'CUSTOMER'
        ? { sender: 'ADMIN', readByCustomerAt: null }
        : { sender: 'CUSTOMER', readByAdminAt: null };
    return SupportMessage.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $group: {
            _id: '$threadKey',
            userId: { $first: '$userId' }, orderId: { $first: '$orderId' },
            lastBody: { $first: '$body' }, lastSender: { $first: '$sender' }, lastAt: { $first: '$createdAt' },
            unread: { $sum: { $cond: [{ $and: Object.entries(unreadMatch).map(([k, v]) => ({ $eq: [`$${k}`, v] })) }, 1, 0] } },
        } },
        { $sort: { lastAt: -1 } },
        { $limit: 200 },
    ]);
}

// ── Customer ──────────────────────────────────────────────────────────────────
export const supportRouter = Router();
supportRouter.use(noStore, authenticateUser);

// Resolves "general" or an order ID to a thread the signed-in customer owns.
async function customerThread(userId, thread) {
    if (!thread || thread === 'general') return { key: generalKey(userId), orderId: null };
    const order = await Order.findOne({ orderId: String(thread).slice(0, 40), userId }).select('orderId').lean();
    if (!order) throw httpError(404, 'Order not found.');
    return { key: orderKey(order.orderId), orderId: order.orderId };
}

// GET /api/support/threads — the general chat plus one per order, with unread counts.
supportRouter.get('/threads', async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const [orders, rows] = await Promise.all([
            Order.find({ userId }).sort({ createdAt: -1 }).limit(50).select('orderId topicTitle status createdAt').lean(),
            summaries({ userId }, 'CUSTOMER'),
        ]);
        const byKey = new Map(rows.map(r => [r._id, r]));
        const summary = (key) => {
            const r = byKey.get(key);
            return r ? { lastBody: r.lastBody, lastSender: r.lastSender, lastAt: r.lastAt, unread: r.unread } : { lastBody: '', lastSender: null, lastAt: null, unread: 0 };
        };
        res.json({ threads: [
            { thread: 'general', title: 'Support team', orderId: null, ...summary(generalKey(req.user.id)) },
            ...orders.map(o => ({ thread: o.orderId, title: o.topicTitle || o.orderId, orderId: o.orderId, status: o.status, ...summary(orderKey(o.orderId)) })),
        ] });
    } catch (err) { fail(res, err, 'Could not load your messages.'); }
});

// GET /api/support/messages?thread=general|<orderId> — marks support replies as read.
supportRouter.get('/messages', async (req, res) => {
    try {
        const { key } = await customerThread(req.user.id, req.query.thread);
        const messages = await SupportMessage.find({ threadKey: key, userId: req.user.id }).sort({ createdAt: 1 }).limit(500).lean();
        const unread = await SupportMessage.updateMany({ threadKey: key, userId: req.user.id, sender: 'ADMIN', readByCustomerAt: null }, { $set: { readByCustomerAt: new Date() } });
        if (unread.modifiedCount) publish('admins', 'read', { thread: key, by: 'CUSTOMER' });
        res.json({ messages: messages.map(toView) });
    } catch (err) { fail(res, err, 'Could not load messages.'); }
});

// POST /api/support/messages { thread, body }
supportRouter.post('/messages', sendLimiter, validateInput(supportMessageSchema), async (req, res) => {
    try {
        const { key, orderId } = await customerThread(req.user.id, req.body.thread);
        const user = await User.findById(req.user.id).select('name').lean();
        const message = await SupportMessage.create({
            threadKey: key, userId: req.user.id, orderId, sender: 'CUSTOMER', senderName: user?.name || 'Customer', body: req.body.body,
        });
        const view = toView(message);
        publish('admins', 'message', { ...view, customerName: user?.name || 'Customer' });
        publish(`customer:${req.user.id}`, 'message', view);
        res.status(201).json({ message: view });
    } catch (err) { fail(res, err, 'Could not send your message.'); }
});

// GET /api/support/stream — live messages for this customer.
supportRouter.get('/stream', (req, res) => openStream(req, res, `customer:${req.user.id}`));

// ── Admin ─────────────────────────────────────────────────────────────────────
// Mounted at /api/admin/support (before the generic /api/admin router).
export const supportAdminRouter = Router();
supportAdminRouter.use(noStore, authenticateAdmin);

// A thread key the admin may open: the customer's general chat or an existing order's chat.
async function adminThread(key) {
    const k = String(key || '');
    if (k.startsWith('g:') && mongoose.isValidObjectId(k.slice(2))) {
        const user = await User.findById(k.slice(2)).select('name email').lean();
        if (!user) throw httpError(404, 'Customer not found.');
        return { key: k, userId: user._id, orderId: null, user };
    }
    if (k.startsWith('o:')) {
        const order = await Order.findOne({ orderId: k.slice(2, 42) }).select('orderId userId').lean();
        if (!order) throw httpError(404, 'Order not found.');
        const user = await User.findById(order.userId).select('name email').lean();
        return { key: orderKey(order.orderId), userId: order.userId, orderId: order.orderId, user };
    }
    throw httpError(400, 'Unknown conversation.');
}

// GET /api/admin/support/threads — every conversation, newest first, with unread counts.
supportAdminRouter.get('/threads', requirePermission('orders.read'), async (req, res) => {
    try {
        const rows = await summaries({}, 'ADMIN');
        const users = await User.find({ _id: { $in: [...new Set(rows.map(r => String(r.userId)))] } }).select('name email').lean();
        const userMap = new Map(users.map(u => [String(u._id), u]));
        res.json({ threads: rows.map(r => {
            const u = userMap.get(String(r.userId));
            return {
                thread: r._id, orderId: r.orderId, customerId: String(r.userId), customerName: u?.name || 'Customer', customerEmail: u?.email || '',
                lastBody: r.lastBody, lastSender: r.lastSender, lastAt: r.lastAt, unread: r.unread,
            };
        }) });
    } catch (err) { fail(res, err, 'Could not load conversations.'); }
});

// GET /api/admin/support/threads/:key/messages — marks customer messages as read.
supportAdminRouter.get('/threads/:key/messages', requirePermission('orders.read'), async (req, res) => {
    try {
        const t = await adminThread(req.params.key);
        const messages = await SupportMessage.find({ threadKey: t.key }).sort({ createdAt: 1 }).limit(500).lean();
        const unread = await SupportMessage.updateMany({ threadKey: t.key, sender: 'CUSTOMER', readByAdminAt: null }, { $set: { readByAdminAt: new Date() } });
        if (unread.modifiedCount) {
            publish('admins', 'read', { thread: t.key, by: 'ADMIN' });
            publish(`customer:${t.userId}`, 'read', { thread: t.orderId || 'general', by: 'ADMIN' });
        }
        res.json({ thread: t.key, orderId: t.orderId, customer: { id: String(t.userId), name: t.user?.name || 'Customer', email: t.user?.email || '' }, messages: messages.map(toView) });
    } catch (err) { fail(res, err, 'Could not load messages.'); }
});

// POST /api/admin/support/threads/:key/messages { body }
supportAdminRouter.post('/threads/:key/messages', requirePermission('orders.write'), validateInput(supportMessageSchema), async (req, res) => {
    try {
        const t = await adminThread(req.params.key);
        const message = await SupportMessage.create({
            threadKey: t.key, userId: t.userId, orderId: t.orderId, sender: 'ADMIN', senderName: 'AssignmentMinds Support', body: req.body.body,
            readByAdminAt: new Date(),
        });
        const view = toView(message);
        publish(`customer:${t.userId}`, 'message', view);
        publish('admins', 'message', { ...view, customerName: t.user?.name || 'Customer' });
        res.status(201).json({ message: view });
    } catch (err) { fail(res, err, 'Could not send the message.'); }
});

// GET /api/admin/support/stream — live messages for the admin console.
supportAdminRouter.get('/stream', requirePermission('orders.read'), (req, res) => openStream(req, res, 'admins'));
