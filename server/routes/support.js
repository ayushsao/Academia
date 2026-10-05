import { Router } from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { SupportMessage, Order, User } from '../db.js';
import { authenticateUser, authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore, can } from '../permissions.js';
import { validateInput, supportMessageSchema } from '../validation.js';
import { openStream, publish } from '../services/liveEvents.js';

// Live support chat with the admin team, stored in MongoDB and pushed over SSE
// (services/liveEvents.js). Thread keys:
//   "g:<userId>"   a customer's general chat
//   "o:<orderId>"  a customer's chat about one order
//   "w:<userId>"   a writer's chat
// readByCustomerAt records when the customer or writer read a support reply.
//
// Admins see customer chats with orders.read (reply: orders.write) and writer
// chats with writers.read (reply: writers.review). Live events go to separate
// channels so each admin only receives the conversations they may see.

const generalKey = (userId) => `g:${userId}`;
const orderKey = (orderId) => `o:${orderId}`;
const writerKey = (userId) => `w:${userId}`;
const kindOf = (key) => (String(key).startsWith('w:') ? 'WRITER' : 'CUSTOMER');
const ADMIN_CHANNEL = { CUSTOMER: 'admins:customers', WRITER: 'admins:writers' };
const ACCESS = {
    CUSTOMER: { read: 'orders.read', reply: 'orders.write' },
    WRITER: { read: 'writers.read', reply: 'writers.review' },
};

const toView = (m) => ({
    id: String(m._id), thread: m.threadKey, orderId: m.orderId, sender: m.sender, senderName: m.senderName,
    body: m.body, createdAt: m.createdAt, readByAdminAt: m.readByAdminAt, readByCustomerAt: m.readByCustomerAt,
});
// A conversation shows its newest messages (older ones stay stored).
const MESSAGES_SHOWN = 200;
const sendLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'You’re sending messages too quickly. Please wait a moment.' } });
const fail = (res, err, fallback) => {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.error('[Support]', err?.message);
    res.status(500).json({ error: fallback });
};
const httpError = (status, message) => Object.assign(new Error(message), { status });

// Summaries (last message, unread count) for a set of threads. `unreadFor`
// is the side reading: 'USER' counts support replies, 'ADMIN' counts the rest.
async function summaries(match, unreadFor) {
    const unread = unreadFor === 'USER'
        ? { $and: [{ $eq: ['$sender', 'ADMIN'] }, { $eq: ['$readByCustomerAt', null] }] }
        : { $and: [{ $ne: ['$sender', 'ADMIN'] }, { $eq: ['$readByAdminAt', null] }] };
    return SupportMessage.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $group: {
            _id: '$threadKey',
            userId: { $first: '$userId' }, orderId: { $first: '$orderId' },
            lastBody: { $first: '$body' }, lastSender: { $first: '$sender' }, lastAt: { $first: '$createdAt' },
            unread: { $sum: { $cond: [unread, 1, 0] } },
        } },
        { $sort: { lastAt: -1 } },
        { $limit: 300 },
    ]);
}

// Marks support replies in a thread as read by the customer/writer and tells the admins.
async function markReadByUser(key, userId) {
    const r = await SupportMessage.updateMany({ threadKey: key, userId, sender: 'ADMIN', readByCustomerAt: null }, { $set: { readByCustomerAt: new Date() } });
    if (r.modifiedCount) publish(ADMIN_CHANNEL[kindOf(key)], 'read', { thread: key, by: 'USER' });
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
            summaries({ userId, threadKey: { $not: /^w:/ } }, 'USER'),
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
        const messages = await SupportMessage.find({ threadKey: key, userId: req.user.id }).sort({ createdAt: -1 }).limit(MESSAGES_SHOWN).lean().then(rows => rows.reverse());
        await markReadByUser(key, req.user.id);
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
        publish(ADMIN_CHANNEL.CUSTOMER, 'message', { ...view, customerName: user?.name || 'Customer' });
        publish(`customer:${req.user.id}`, 'message', view);
        res.status(201).json({ message: view });
    } catch (err) { fail(res, err, 'Could not send your message.'); }
});

// GET /api/support/stream — live messages for this customer.
supportRouter.get('/stream', (req, res) => openStream(req, res, `customer:${req.user.id}`));

// ── Writer ────────────────────────────────────────────────────────────────────
// Mounted at /api/writers/support (the writer area, so the writer session is used).
export const writerSupportRouter = Router();
writerSupportRouter.use(noStore, authenticateUser, (req, res, next) =>
    (req.user.role === 'WRITER' ? next() : res.status(403).json({ error: 'This area is for writer accounts.' })));

// GET /api/writers/support/messages — the writer's chat with the admin team.
writerSupportRouter.get('/messages', async (req, res) => {
    try {
        const key = writerKey(req.user.id);
        const messages = await SupportMessage.find({ threadKey: key, userId: req.user.id }).sort({ createdAt: -1 }).limit(MESSAGES_SHOWN).lean().then(rows => rows.reverse());
        await markReadByUser(key, req.user.id);
        res.json({ messages: messages.map(toView) });
    } catch (err) { fail(res, err, 'Could not load messages.'); }
});

// GET /api/writers/support/unread — unread support replies (for the sidebar badge).
writerSupportRouter.get('/unread', async (req, res) => {
    try {
        const unread = await SupportMessage.countDocuments({ threadKey: writerKey(req.user.id), sender: 'ADMIN', readByCustomerAt: null });
        res.json({ unread });
    } catch (err) { fail(res, err, 'Could not load messages.'); }
});

// POST /api/writers/support/messages { body }
writerSupportRouter.post('/messages', sendLimiter, validateInput(supportMessageSchema), async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('name').lean();
        const message = await SupportMessage.create({
            threadKey: writerKey(req.user.id), userId: req.user.id, orderId: null, sender: 'WRITER', senderName: user?.name || 'Writer', body: req.body.body,
        });
        const view = toView(message);
        publish(ADMIN_CHANNEL.WRITER, 'message', { ...view, customerName: user?.name || 'Writer' });
        publish(`writer:${req.user.id}`, 'message', view);
        res.status(201).json({ message: view });
    } catch (err) { fail(res, err, 'Could not send your message.'); }
});

// GET /api/writers/support/stream — live replies for this writer.
writerSupportRouter.get('/stream', (req, res) => openStream(req, res, `writer:${req.user.id}`));

// ── Admin ─────────────────────────────────────────────────────────────────────
// Mounted at /api/admin/support (before the generic /api/admin router).
export const supportAdminRouter = Router();
supportAdminRouter.use(noStore, authenticateAdmin, requirePermission(ACCESS.CUSTOMER.read, ACCESS.WRITER.read));

const allowed = (req, kind, action) => can(req.admin.adminRole, ACCESS[kind][action]);

// A thread key the admin may open, checked against their role.
async function adminThread(req, key) {
    const k = String(key || '');
    const kind = kindOf(k);
    if (!allowed(req, kind, 'read')) throw httpError(403, 'Your admin role does not permit this conversation.');
    if ((k.startsWith('g:') || k.startsWith('w:')) && mongoose.isValidObjectId(k.slice(2))) {
        const user = await User.findById(k.slice(2)).select('name email role').lean();
        if (!user || (kind === 'WRITER') !== (user.role === 'WRITER')) throw httpError(404, 'Conversation not found.');
        return { key: k, kind, userId: user._id, orderId: null, user };
    }
    if (k.startsWith('o:')) {
        const order = await Order.findOne({ orderId: k.slice(2, 42) }).select('orderId userId').lean();
        if (!order) throw httpError(404, 'Order not found.');
        const user = await User.findById(order.userId).select('name email').lean();
        return { key: orderKey(order.orderId), kind, userId: order.userId, orderId: order.orderId, user };
    }
    throw httpError(400, 'Unknown conversation.');
}

// GET /api/admin/support/threads — conversations this admin may see, newest first.
supportAdminRouter.get('/threads', async (req, res) => {
    try {
        const scopes = [];
        if (allowed(req, 'CUSTOMER', 'read')) scopes.push({ threadKey: { $regex: /^[go]:/ } });
        if (allowed(req, 'WRITER', 'read')) scopes.push({ threadKey: { $regex: /^w:/ } });
        const rows = await summaries({ $or: scopes }, 'ADMIN');
        const users = await User.find({ _id: { $in: [...new Set(rows.map(r => String(r.userId)))] } }).select('name email').lean();
        const userMap = new Map(users.map(u => [String(u._id), u]));
        res.json({ threads: rows.map(r => {
            const u = userMap.get(String(r.userId));
            const kind = kindOf(r._id);
            return {
                thread: r._id, kind, orderId: r.orderId, customerId: String(r.userId),
                customerName: u?.name || (kind === 'WRITER' ? 'Writer' : 'Customer'), customerEmail: u?.email || '',
                lastBody: r.lastBody, lastSender: r.lastSender, lastAt: r.lastAt, unread: r.unread,
            };
        }) });
    } catch (err) { fail(res, err, 'Could not load conversations.'); }
});

// GET /api/admin/support/threads/:key/messages — marks incoming messages as read.
supportAdminRouter.get('/threads/:key/messages', async (req, res) => {
    try {
        const t = await adminThread(req, req.params.key);
        const messages = await SupportMessage.find({ threadKey: t.key }).sort({ createdAt: -1 }).limit(MESSAGES_SHOWN).lean().then(rows => rows.reverse());
        const unread = await SupportMessage.updateMany({ threadKey: t.key, sender: { $ne: 'ADMIN' }, readByAdminAt: null }, { $set: { readByAdminAt: new Date() } });
        if (unread.modifiedCount) {
            publish(ADMIN_CHANNEL[t.kind], 'read', { thread: t.key, by: 'ADMIN' });
            const userChannel = t.kind === 'WRITER' ? `writer:${t.userId}` : `customer:${t.userId}`;
            publish(userChannel, 'read', { thread: t.kind === 'WRITER' ? 'support' : (t.orderId || 'general'), by: 'ADMIN' });
        }
        res.json({
            thread: t.key, kind: t.kind, orderId: t.orderId, canReply: allowed(req, t.kind, 'reply'),
            customer: { id: String(t.userId), name: t.user?.name || (t.kind === 'WRITER' ? 'Writer' : 'Customer'), email: t.user?.email || '' },
            messages: messages.map(toView),
        });
    } catch (err) { fail(res, err, 'Could not load messages.'); }
});

// POST /api/admin/support/threads/:key/messages { body }
supportAdminRouter.post('/threads/:key/messages', validateInput(supportMessageSchema), async (req, res) => {
    try {
        const t = await adminThread(req, req.params.key);
        if (!allowed(req, t.kind, 'reply')) throw httpError(403, 'Your admin role can read this conversation but not reply.');
        const message = await SupportMessage.create({
            threadKey: t.key, userId: t.userId, orderId: t.orderId, sender: 'ADMIN', senderName: 'AssignmentMinds Support', body: req.body.body,
            readByAdminAt: new Date(),
        });
        const view = toView(message);
        publish(t.kind === 'WRITER' ? `writer:${t.userId}` : `customer:${t.userId}`, 'message', view);
        publish(ADMIN_CHANNEL[t.kind], 'message', { ...view, customerName: t.user?.name || '' });
        res.status(201).json({ message: view });
    } catch (err) { fail(res, err, 'Could not send the message.'); }
});

// GET /api/admin/support/stream — live messages for the conversations this admin may see.
supportAdminRouter.get('/stream', (req, res) => {
    const channels = [];
    if (allowed(req, 'CUSTOMER', 'read')) channels.push(ADMIN_CHANNEL.CUSTOMER);
    if (allowed(req, 'WRITER', 'read')) channels.push(ADMIN_CHANNEL.WRITER);
    openStream(req, res, channels);
});
