import { Router } from 'express';
import { createRequire } from 'module';
import { User, Order, Contact, Admin, SiteSettings, PageView, AuditLog } from '../db.js';
import { authenticateAdmin, invalidateAdminCache, ADMIN_SECRET } from '../middleware.js';
import { ADMIN_ROLES, ROLE_LABELS, PERMISSIONS, normalizeRole, permissionsFor, requirePermission, noStore } from '../permissions.js';
import { recordAudit } from '../services/audit.js';
import { AbuseError, assertNotLocked, recordLoginFailure, clearLoginFailures } from '../services/abuse.js';
import { IS_PRODUCTION } from '../config.js';
import { streamOrderFile } from '../services/orderFiles.js';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

const router = Router();

// ── Seed default admin on first use ───────────────────────────────────────────
// Development keeps the familiar admin/admin123. Production never creates a
// known password: it uses ADMIN_INITIAL_PASSWORD, or generates one and prints it
// once to the server log so the owner can sign in and change it.
const DEV_ADMIN_PASSWORD = 'admin123';
async function ensureDefaultAdmin() {
    const count = await Admin.countDocuments();
    if (count === 0) {
        const provided = (process.env.ADMIN_INITIAL_PASSWORD || '').trim();
        const password = IS_PRODUCTION ? (provided.length >= 12 ? provided : crypto.randomBytes(18).toString('base64url')) : (provided || DEV_ADMIN_PASSWORD);
        await Admin.create({ username: 'admin', password: await bcrypt.hash(password, 12), role: 'SUPER_ADMIN' });
        if (IS_PRODUCTION && !provided) console.warn(`[Admin] First super admin created → username: admin | one-time password: ${password}  (change it after signing in)`);
        else console.log('[Admin] Default admin created → username: admin | password: [HIDDEN]');
        return;
    }
    if (IS_PRODUCTION) {
        const legacy = await Admin.findOne({ username: 'admin' }).select('password').lean();
        if (legacy && await bcrypt.compare(DEV_ADMIN_PASSWORD, legacy.password))
            console.error('[Security] The "admin" account still uses the default password. Sign in to the admin console and change it immediately (Password button in the header).');
    }
}
ensureDefaultAdmin().catch(console.error);

// POST /api/admin/login
import { rateLimit } from 'express-rate-limit';
import { validateInput, adminLoginSchema, adminPasswordSchema } from '../validation.js';

const adminAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Limit each IP to 5 admin login requests per windowMs
    message: { error: 'Too many admin authentication attempts. Please try again later.' }
});

router.post('/login', adminAuthLimiter, validateInput(adminLoginSchema), async (req, res) => {
    try {
        const { username, password } = req.body;

        const throttleKey = `admin:${String(username).toLowerCase()}`;
        try { await assertNotLocked(throttleKey); }
        catch (err) { if (err instanceof AbuseError) return res.status(err.status).json({ error: err.message }); throw err; }

        const admin = await Admin.findOne({ username });
        const match = await bcrypt.compare(password, admin?.password || DUMMY_HASH);
        if (!admin || !match) {
            await recordLoginFailure(throttleKey);
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        await clearLoginFailures(throttleKey);

        const adminRole = normalizeRole(admin.role);
        const token = jwt.sign({ id: admin._id, username: admin.username, role: 'admin', adminRole }, ADMIN_SECRET, { expiresIn: '12h' });
        await Admin.updateOne({ _id: admin._id }, { $set: { lastLoginAt: new Date() } });
        req.admin = { id: admin._id, username: admin.username, adminRole };
        await recordAudit(req, 'ADMIN_LOGIN', { targetType: 'ADMIN', targetId: admin._id });
        res.cookie('admin_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 12 * 60 * 60 * 1000 });
        res.json({ token, admin: { id: admin._id, username: admin.username, role: adminRole, permissions: permissionsFor(adminRole) } });
    } catch (err) {
        res.status(500).json({ error: 'Admin login failed.' });
    }
});

// Every route below is permission-checked here; see server/permissions.js.
// [method or '*', path regex, permission]
const ROUTE_PERMISSIONS = [
    ['GET', /^\/stats$/, 'orders.read'],
    ['GET', /^\/orders/, 'orders.read'],
    ['PATCH', /^\/orders\//, 'orders.write'],
    ['DELETE', /^\/orders\//, 'users.manage'],
    ['*', /^\/users/, 'users.manage'],
    ['*', /^\/contacts/, 'leads.manage'],
    ['*', /^\/managers/, 'admins.manage'],
    ['GET', /^\/analytics$/, 'analytics.read'],
    ['GET', /^\/audit$/, 'audit.read'],
    ['*', /^\/settings$/, 'settings.manage'],
];
const PUBLIC_PATHS = ['/login', '/track'];

router.use(noStore);
router.use(async (req, res, next) => {
    if (PUBLIC_PATHS.includes(req.path)) return next();
    await authenticateAdmin(req, res, () => {
        if (req.path === '/me' || req.path === '/me/password') return next();
        const rule = ROUTE_PERMISSIONS.find(([m, rx]) => (m === '*' || m === req.method) && rx.test(req.path));
        if (!rule) return res.status(403).json({ error: 'Your admin role does not permit this action.' });
        return requirePermission(rule[2])(req, res, next);
    });
});

// GET /api/admin/me — the signed-in admin's role and permissions (drives the console UI).
router.get('/me', (req, res) => {
    res.json({ admin: { id: req.admin.id, username: req.admin.username, role: req.admin.adminRole, roleLabel: ROLE_LABELS[req.admin.adminRole], permissions: permissionsFor(req.admin.adminRole) } });
});

// POST /api/admin/me/password — any admin can change their own password.
router.post('/me/password', validateInput(adminPasswordSchema), async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id);
        if (!admin) return res.status(404).json({ error: 'Admin not found.' });
        if (!await bcrypt.compare(req.body.currentPassword, admin.password)) return res.status(400).json({ error: 'Your current password is incorrect.' });
        if (await bcrypt.compare(req.body.newPassword, admin.password)) return res.status(400).json({ error: 'Choose a password you haven’t used here before.' });
        admin.password = await bcrypt.hash(req.body.newPassword, 12);
        await admin.save();
        await recordAudit(req, 'ADMIN_PASSWORD_CHANGED', { targetType: 'ADMIN', targetId: admin._id });
        res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Could not change password.' }); }
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
        res.status(500).json({ error: 'Internal server error.' });
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
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PATCH /api/admin/orders/:id
// GET /api/admin/orders/files/:name — order attachments (orders.read), audited.
router.get('/orders/files/:name', async (req, res) => {
    try {
        const name = String(req.params.name);
        const order = await Order.findOne({ files: name }).select('orderId').lean();
        if (!order) return res.status(404).json({ error: 'File not found.' });
        await recordAudit(req, 'ORDER_FILE_VIEWED', { targetType: 'ORDER', targetId: order.orderId, reason: name });
        await streamOrderFile(res, name);
    } catch { if (!res.headersSent) res.status(500).json({ error: 'Could not load file.' }); }
});

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
        await recordAudit(req, 'ORDER_UPDATED', { targetType: 'ORDER', targetId: order.orderId, reason: [status && `status ${status}`, assignedTo !== undefined && `assigned ${assignedTo}`].filter(Boolean).join(', ') });

        res.json({
            order: { ...order.toObject(), user_name: order.userId?.name, user_email: order.userId?.email }
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// DELETE /api/admin/orders/:id
router.delete('/orders/:id', authenticateAdmin, async (req, res) => {
    try {
        const order = await Order.findOneAndDelete({ orderId: req.params.id });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        await recordAudit(req, 'ORDER_DELETED', { targetType: 'ORDER', targetId: order.orderId });
        res.json({ message: 'Order deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/admin/users
router.get('/users', authenticateAdmin, async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const filter = {};
        if (search) {
            const rgx = new RegExp(String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
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
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        await Order.deleteMany({ userId: req.params.id });
        await recordAudit(req, 'CUSTOMER_DELETED', { targetType: 'USER', targetId: user._id, reason: user.email });
        res.json({ message: 'User and their orders deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/admin/contacts
router.get('/contacts', authenticateAdmin, async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.json({ contacts });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PATCH /api/admin/contacts/:id
router.patch('/contacts/:id', authenticateAdmin, async (req, res) => {
    try {
        await Contact.findByIdAndUpdate(req.params.id, { status: req.body.status });
        res.json({ message: 'Updated.' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── Analytics Routes ──────────────────────────────────────────────────────────

// ── Admins / Founders Management ────────────────────────────────────────────────
router.get('/managers', authenticateAdmin, async (req, res) => {
    try {
        const admins = await Admin.find().select('-password').sort({ createdAt: 1 }).lean();
        res.json({
            admins: admins.map(x => ({ ...x, role: normalizeRole(x.role), roleLabel: ROLE_LABELS[normalizeRole(x.role)], isSelf: String(x._id) === String(req.admin.id) })),
            roles: ADMIN_ROLES.map(r => ({ id: r, label: ROLE_LABELS[r], permissions: permissionsFor(r) })),
            permissions: PERMISSIONS,
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/managers', authenticateAdmin, async (req, res) => {
    try {
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const role = ADMIN_ROLES.includes(req.body.role) ? req.body.role : null;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
        if (!role) return res.status(400).json({ error: 'Choose a role.' });
        const existing = await Admin.findOne({ username: email });
        if (existing) return res.status(400).json({ error: 'An admin with this email/username already exists.' });

        const plainPassword = crypto.randomBytes(12).toString('base64url'); // shown once to the inviting admin
        const hash = await bcrypt.hash(plainPassword, 12);
        const admin = await Admin.create({ username: email, email, password: hash, role });
        await recordAudit(req, 'ADMIN_CREATED', { targetType: 'ADMIN', targetId: admin._id, reason: `${email} as ${ROLE_LABELS[role]}` });

        res.status(201).json({ admin: { id: admin._id, username: admin.username, email: admin.email, role: admin.role }, plainPassword });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

const SUPER_ROLES = ['SUPER_ADMIN', 'ADMIN', null, undefined];
const superAdminCount = () => Admin.countDocuments({ $or: [{ role: { $in: ['SUPER_ADMIN', 'ADMIN'] } }, { role: { $exists: false } }] });

// PATCH /api/admin/managers/:id/role  { role }
router.patch('/managers/:id/role', authenticateAdmin, async (req, res) => {
    try {
        const role = ADMIN_ROLES.includes(req.body?.role) ? req.body.role : null;
        if (!role) return res.status(400).json({ error: 'Choose a valid role.' });
        if (String(req.params.id) === String(req.admin.id)) return res.status(400).json({ error: 'You can’t change your own role.' });
        const target = await Admin.findById(req.params.id);
        if (!target) return res.status(404).json({ error: 'Admin not found.' });
        const wasSuper = SUPER_ROLES.includes(target.role);
        if (wasSuper && role !== 'SUPER_ADMIN' && (await superAdminCount()) <= 1)
            return res.status(400).json({ error: 'At least one Super Admin must remain.' });
        const previous = normalizeRole(target.role);
        target.role = role;
        await target.save();
        invalidateAdminCache(target._id);
        await recordAudit(req, 'ADMIN_ROLE_CHANGED', { targetType: 'ADMIN', targetId: target._id, reason: `${target.username}: ${ROLE_LABELS[previous]} → ${ROLE_LABELS[role]}` });
        res.json({ admin: { id: target._id, username: target.username, role, roleLabel: ROLE_LABELS[role] } });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.delete('/managers/:id', authenticateAdmin, async (req, res) => {
    try {
        if (String(req.params.id) === String(req.admin.id)) return res.status(400).json({ error: 'You can’t remove your own account.' });
        const target = await Admin.findById(req.params.id);
        if (!target) return res.status(404).json({ error: 'Admin not found.' });
        if (SUPER_ROLES.includes(target.role) && (await superAdminCount()) <= 1)
            return res.status(400).json({ error: 'Cannot delete the last Super Admin.' });
        await target.deleteOne();
        invalidateAdminCache(target._id);
        await recordAudit(req, 'ADMIN_DELETED', { targetType: 'ADMIN', targetId: target._id, reason: target.username });
        res.json({ message: 'Admin deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/admin/track (public — no auth needed)
router.post('/track', async (req, res) => {
    try {
        const { page } = req.body;
        const userAgent = req.headers['user-agent'] || '';
        const referrer = req.headers['referer'] || req.body.referrer || '';
        await PageView.create({ page: page || '/', userAgent, referrer });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
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
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── Site Settings / Coupon Routes ─────────────────────────────────────────────

// Writer review/management routes live in routes/writerAdmin.js (mounted at /api/admin/writers).

// GET /api/admin/audit
router.get('/audit', authenticateAdmin, async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
        const esc = (s) => String(s).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const filter = {};
        if (typeof req.query.action === 'string' && req.query.action.trim()) filter.action = new RegExp(esc(req.query.action.trim()), 'i');
        if (typeof req.query.admin === 'string' && req.query.admin.trim()) filter.adminUsername = new RegExp(esc(req.query.admin.trim()), 'i');
        if (ADMIN_ROLES.includes(req.query.role)) filter.adminRole = req.query.role === 'SUPER_ADMIN' ? { $in: ['SUPER_ADMIN', 'ADMIN', null] } : req.query.role;
        if (typeof req.query.targetType === 'string' && /^[A-Z_]{2,30}$/.test(req.query.targetType)) filter.targetType = req.query.targetType;
        const from = req.query.from ? new Date(String(req.query.from)) : null;
        const to = req.query.to ? new Date(String(req.query.to)) : null;
        if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
            filter.createdAt = {};
            if (from && !Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
            if (to && !Number.isNaN(to.getTime())) filter.createdAt.$lte = to;
        }
        const [total, logs] = await Promise.all([
            AuditLog.countDocuments(filter),
            AuditLog.find(filter).populate('writerId', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        ]);
        res.json({ logs: logs.map(l => ({ ...l, adminRole: normalizeRole(l.adminRole), adminRoleLabel: ROLE_LABELS[normalizeRole(l.adminRole)] })), total, page, limit });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Storefront settings editable from the admin Settings tab. Membership and
// assignment configuration live in their own validated endpoints.
const SITE_SETTING_VALIDATORS = {
    discount_code: v => typeof v === 'string' && v.length <= 40,
    discount_percent: v => typeof v === 'number' && v >= 0 && v <= 100,
    discount_active: v => typeof v === 'boolean',
    site_announcement: v => typeof v === 'string' && v.length <= 500,
    whatsapp_number: v => typeof v === 'string' && v.length <= 30,
};

// GET /api/admin/settings
router.get('/settings', authenticateAdmin, async (req, res) => {
    try {
        const settings = await SiteSettings.find({ key: { $in: Object.keys(SITE_SETTING_VALIDATORS) } });
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
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PATCH /api/admin/settings
router.patch('/settings', authenticateAdmin, async (req, res) => {
    try {
        const ALLOWED = SITE_SETTING_VALIDATORS;
        const updates = req.body && typeof req.body === 'object' ? req.body : {};
        const bad = Object.entries(updates).filter(([k, v]) => !ALLOWED[k] || !ALLOWED[k](v)).map(([k]) => k);
        if (bad.length) return res.status(400).json({ error: `Invalid or unknown setting: ${bad.join(', ')}` });
        for (const [key, value] of Object.entries(updates)) {
            await SiteSettings.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
        }
        await recordAudit(req, 'SITE_SETTINGS_UPDATED', { targetType: 'SETTINGS', reason: Object.keys(updates).join(', ') });
        res.json({ message: 'Settings updated.' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

export default router;
