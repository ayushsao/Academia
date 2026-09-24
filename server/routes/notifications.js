import { Router } from 'express';
import mongoose from 'mongoose';
import { Notification, NOTIFICATION_CATEGORIES } from '../db.js';
import { authenticateUser } from '../middleware.js';
import { noStore } from '../permissions.js';
import { getPreferences, setPreferences } from '../services/notifications.js';

// The signed-in user's notifications (any role) and their channel preferences.
// Notifications are created only by services/notifications.js.
const router = Router();
router.use(noStore, authenticateUser);

const view = (n) => ({ id: n._id, type: n.type, category: n.category || 'ACCOUNT', title: n.title, message: n.message, link: n.link || '', read: n.read, createdAt: n.createdAt });

router.get('/', async (req, res) => {
    try {
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
        const category = NOTIFICATION_CATEGORIES.includes(req.query.category) ? req.query.category : null;
        const filter = { userId: req.user.id, ...(req.query.unread === '1' ? { read: false } : {}), ...(category ? { category } : {}) };
        const before = req.query.before && !Number.isNaN(Date.parse(String(req.query.before))) ? new Date(String(req.query.before)) : null;
        if (before) filter.createdAt = { $lt: before };
        const userId = new mongoose.Types.ObjectId(String(req.user.id));
        const [items, unread, byCategory] = await Promise.all([
            Notification.find(filter).sort({ createdAt: -1 }).limit(limit).select('-deliveries -dedupeKey').lean(),
            Notification.countDocuments({ userId: req.user.id, read: false }),
            Notification.aggregate([{ $match: { userId, read: false } }, { $group: { _id: { $ifNull: ['$category', 'ACCOUNT'] }, n: { $sum: 1 } } }]),
        ]);
        res.json({ unread, unreadByCategory: Object.fromEntries(byCategory.map(c => [c._id, c.n])), notifications: items.map(view) });
    } catch { res.status(500).json({ error: 'Could not load notifications.' }); }
});

// Lightweight poll for badges.
router.get('/unread-count', async (req, res) => {
    try { res.json({ unread: await Notification.countDocuments({ userId: req.user.id, read: false }) }); }
    catch { res.status(500).json({ error: 'Could not load notifications.' }); }
});

router.get('/preferences', async (req, res) => {
    try { res.json({ categories: await getPreferences(req.user.id) }); }
    catch { res.status(500).json({ error: 'Could not load notification settings.' }); }
});

// Body: { channels: { CATEGORY: { EMAIL?: bool, SMS?: bool, WHATSAPP?: bool } } }
router.put('/preferences', async (req, res) => {
    try {
        const channels = req.body?.channels;
        if (!channels || typeof channels !== 'object' || Array.isArray(channels)) return res.status(400).json({ error: 'Invalid notification settings.' });
        res.json({ categories: await setPreferences(req.user.id, channels) });
    } catch { res.status(500).json({ error: 'Could not save notification settings.' }); }
});

router.post('/read-all', async (req, res) => {
    try {
        const category = NOTIFICATION_CATEGORIES.includes(req.body?.category) ? req.body.category : null;
        await Notification.updateMany({ userId: req.user.id, read: false, ...(category ? { category } : {}) }, { $set: { read: true, readAt: new Date() } });
        res.json({ unread: await Notification.countDocuments({ userId: req.user.id, read: false }) });
    } catch { res.status(500).json({ error: 'Could not update notifications.' }); }
});

router.post('/:id/read', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Notification not found.' });
        const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { $set: { read: true, readAt: new Date() } });
        if (!n) return res.status(404).json({ error: 'Notification not found.' });
        res.json({ unread: await Notification.countDocuments({ userId: req.user.id, read: false }) });
    } catch { res.status(500).json({ error: 'Could not update notification.' }); }
});

export default router;
