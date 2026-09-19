import { Router } from 'express';
import { createRequire } from 'module';
import { User, Order, Contact, Admin, SiteSettings, PageView } from '../db.js';
import { authenticateAdmin, ADMIN_SECRET } from '../middleware.js';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = Router();

// ── Seed default admin on first use ───────────────────────────────────────────
async function ensureDefaultAdmin() {
    const count = await Admin.countDocuments();
    if (count === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        await Admin.create({ username: 'admin', password: hash });
        console.log('[Admin] Default admin created → username: admin | password: admin123');
    }
}
ensureDefaultAdmin().catch(console.error);

// POST /api/admin/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: 'Username and password are required.' });

        const admin = await Admin.findOne({ username });
        if (!admin) return res.status(401).json({ error: 'Invalid credentials.' });

        const match = await bcrypt.compare(password, admin.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

        const token = jwt.sign({ id: admin._id, username: admin.username, role: 'admin' }, ADMIN_SECRET, { expiresIn: '12h' });
        res.json({ token, admin: { id: admin._id, username: admin.username } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/stats
router.get('/stats', authenticateAdmin, async (req, res) => {
    try {
        const [
            totalOrders, totalUsers, unreadContacts,
            pendingOrders, inProgressOrders, completedOrders, cancelledOrders,
            revenueResult
        ] = await Promise.all([
            Order.countDocuments(),
            User.countDocuments(),
            Contact.countDocuments({ status: 'unread' }),
            Order.countDocuments({ status: 'Pending' }),
            Order.countDocuments({ status: 'In Progress' }),
            Order.countDocuments({ status: 'Completed' }),
            Order.countDocuments({ status: 'Cancelled' }),
            Order.aggregate([
                { $match: { status: { $ne: 'Cancelled' } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
        ]);

        const totalRevenue = revenueResult[0]?.total || 0;

        // Revenue per day for the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentRevenue = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    revenue: { $sum: '$totalAmount' }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { day: '$_id', revenue: 1, _id: 0 } }
        ]);

        res.json({
            totalOrders, totalUsers, totalRevenue,
            pendingOrders, inProgressOrders, completedOrders, cancelledOrders,
            unreadContacts, recentRevenue
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/orders
router.get('/orders', authenticateAdmin, async (req, res) => {
    try {
        const { status, search, page = 1, limit = 15 } = req.query;
        const filter = {};
        if (status && status !== 'all') filter.status = status;

        let query = Order.find(filter).populate('userId', 'name email').sort({ createdAt: -1 });

        if (search) {
            const rgx = new RegExp(search, 'i');
            filter.$or = [
                { orderId: rgx }, { topicTitle: rgx }, { service: rgx }
            ];
        }

        const total = await Order.countDocuments(filter);
        const orders = await Order.find(filter)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const formatted = orders.map(o => ({
            ...o.toObject(),
            user_name: o.userId?.name,
            user_email: o.userId?.email,
        }));

        res.json({ orders: formatted, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin/orders/:id
router.patch('/orders/:id', authenticateAdmin, async (req, res) => {
    try {
        const { status, adminNotes, assignedTo } = req.body;
        const update = {};
        if (status !== undefined) update.status = status;
        if (adminNotes !== undefined) update.adminNotes = adminNotes;
        if (assignedTo !== undefined) update.assignedTo = assignedTo;

        const order = await Order.findOneAndUpdate(
            { orderId: req.params.id },
            update,
            { new: true }
        ).populate('userId', 'name email');

        if (!order) return res.status(404).json({ error: 'Order not found.' });

        res.json({
            order: { ...order.toObject(), user_name: order.userId?.name, user_email: order.userId?.email }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/orders/:id
router.delete('/orders/:id', authenticateAdmin, async (req, res) => {
    try {
        const order = await Order.findOneAndDelete({ orderId: req.params.id });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        res.json({ message: 'Order deleted.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/users
router.get('/users', authenticateAdmin, async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const filter = {};
        if (search) {
            const rgx = new RegExp(search, 'i');
            filter.$or = [{ name: rgx }, { email: rgx }];
        }
        const total = await User.countDocuments(filter);
        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        // Attach order counts
        const enriched = await Promise.all(users.map(async u => {
            const [orderCount, totalSpentRes] = await Promise.all([
                Order.countDocuments({ userId: u._id }),
                Order.aggregate([
                    { $match: { userId: u._id, status: { $ne: 'Cancelled' } } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
                ])
            ]);
            return { ...u.toObject(), order_count: orderCount, total_spent: totalSpentRes[0]?.total || 0 };
        }));

        res.json({ users: enriched, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        await Order.deleteMany({ userId: req.params.id });
        res.json({ message: 'User and their orders deleted.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/contacts
router.get('/contacts', authenticateAdmin, async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.json({ contacts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin/contacts/:id
router.patch('/contacts/:id', authenticateAdmin, async (req, res) => {
    try {
        await Contact.findByIdAndUpdate(req.params.id, { status: req.body.status });
        res.json({ message: 'Updated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Analytics Routes ──────────────────────────────────────────────────────────

// POST /api/admin/track (public — no auth needed)
router.post('/track', async (req, res) => {
    try {
        const { page } = req.body;
        const userAgent = req.headers['user-agent'] || '';
        const referrer = req.headers['referer'] || req.body.referrer || '';
        await PageView.create({ page: page || '/', userAgent, referrer });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/analytics
router.get('/analytics', authenticateAdmin, async (req, res) => {
    try {
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [totalViews, weeklyViews, topPages, dailyViews, topReferrers] = await Promise.all([
            PageView.countDocuments(),
            PageView.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
            PageView.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                { $group: { _id: '$page', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
                { $project: { page: '$_id', count: 1, _id: 0 } }
            ]),
            PageView.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, views: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { day: '$_id', views: 1, _id: 0 } }
            ]),
            PageView.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo }, referrer: { $ne: '' } } },
                { $group: { _id: '$referrer', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
                { $project: { referrer: '$_id', count: 1, _id: 0 } }
            ])
        ]);

        res.json({ totalViews, weeklyViews, topPages, dailyViews, topReferrers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Site Settings / Coupon Routes ─────────────────────────────────────────────

// GET /api/admin/settings
router.get('/settings', authenticateAdmin, async (req, res) => {
    try {
        const settings = await SiteSettings.find();
        const obj = {};
        settings.forEach(s => { obj[s.key] = s.value; });
        // defaults
        if (!obj.discount_code) obj.discount_code = 'INSTANT25';
        if (!obj.discount_percent) obj.discount_percent = 25;
        if (!obj.discount_active) obj.discount_active = true;
        if (!obj.site_announcement) obj.site_announcement = '';
        if (!obj.whatsapp_number) obj.whatsapp_number = '+447700900000';
        res.json(obj);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin/settings
router.patch('/settings', authenticateAdmin, async (req, res) => {
    try {
        const updates = req.body;
        for (const [key, value] of Object.entries(updates)) {
            await SiteSettings.findOneAndUpdate(
                { key },
                { value },
                { upsert: true, new: true }
            );
        }
        res.json({ message: 'Settings updated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
