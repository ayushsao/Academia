import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
import { normalizeRole } from './permissions.js';
import { remember, cacheDel } from './services/cache.js';

// Secrets come from config.js, which never falls back to a known value in production.
export { JWT_SECRET, ADMIN_SECRET } from './config.js';
import { JWT_SECRET, ADMIN_SECRET } from './config.js';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// Signs a user JWT and sets the auth cookie. Returns the token so callers can
// also hand it to clients that use Bearer auth.
export function issueUserSession(res, user) {
    const token = jwt.sign({ id: user._id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: SESSION_MAX_AGE });
    return token;
}

function bearerToken(req) {
    return req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
}

export function authenticateUser(req, res, next) {
    const token = (req.cookies && req.cookies.auth_token) || bearerToken(req);
    if (!token)
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
}

// The admin's current role is read from the database (cached briefly) rather than
// trusted from the token, so deleting an admin or changing their role takes effect
// within ADMIN_ROLE_TTL_MS instead of when their 12-hour token expires.
const ADMIN_ROLE_TTL_MS = 60 * 1000;
const adminRoleCache = new Map();
export const invalidateAdminCache = (adminId) => {
    adminRoleCache.delete(String(adminId));
    cacheDel(`admin:role:${adminId}`).catch(() => {});
};

async function currentAdminRole(adminId) {
    const key = String(adminId);
    const hit = adminRoleCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.role;

    const role = await remember(`admin:role:${adminId}`, 60, async () => {
        const { Admin } = await import('./db.js');
        const admin = await Admin.findById(adminId).select('role').lean();
        return admin ? normalizeRole(admin.role) : null;
    });

    adminRoleCache.set(key, { role, expires: Date.now() + ADMIN_ROLE_TTL_MS });
    return role;
}

export async function authenticateAdmin(req, res, next) {
    const token = (req.cookies && req.cookies.admin_token) || bearerToken(req);
    if (!token)
        return res.status(401).json({ error: 'Unauthorized: No admin token' });
    let payload;
    try {
        payload = jwt.verify(token, ADMIN_SECRET);
    } catch {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    }
    try {
        const role = await currentAdminRole(payload.id);
        if (!role) return res.status(401).json({ error: 'Unauthorized: This admin account no longer exists' });
        req.admin = { ...payload, adminRole: role };
        next();
    } catch (err) {
        next(err);
    }
}

// Legacy role guard kept for compatibility; new code uses requirePermission (permissions.js).
export const requireAdminRole = (...roles) => (req, res, next) => {
    const allowed = roles.map(normalizeRole);
    if (!req.admin || !allowed.includes(req.admin.adminRole))
        return res.status(403).json({ error: 'Your admin role does not permit this action.' });
    next();
};

// Resolves whichever principal (admin or user) sent the request without
// rejecting anonymous requests. Used by file endpoints that serve both.
export async function identifyPrincipal(req, _res, next) {
    const candidates = [
        [req.cookies && req.cookies.admin_token, ADMIN_SECRET, 'admin'],
        [bearerToken(req), ADMIN_SECRET, 'admin'],
        [req.cookies && req.cookies.auth_token, JWT_SECRET, 'user'],
        [bearerToken(req), JWT_SECRET, 'user'],
    ];
    for (const [token, secret, kind] of candidates) {
        if (!token) continue;
        let payload;
        try { payload = jwt.verify(token, secret); } catch { continue; } // wrong secret or expired
        if (kind === 'user' && !req.user) req.user = payload;
        if (kind === 'admin' && !req.admin) {
            try {
                const role = await currentAdminRole(payload.id);
                if (role) req.admin = { ...payload, adminRole: role };
            } catch (err) { return next(err); }
        }
    }
    next();
}
