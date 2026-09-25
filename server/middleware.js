import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
import { normalizeRole } from './permissions.js';
import { remember, cacheDel } from './services/cache.js';

// Secrets come from config.js, which never falls back to a known value in production.
export { JWT_SECRET, ADMIN_SECRET } from './config.js';
import { JWT_SECRET, ADMIN_SECRET } from './config.js';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
// A signed-in admin session (a 2FA challenge token carries a "purpose" instead).
const isAdminSession = (p) => p && p.role === 'admin' && !p.purpose;

// Only our own HMAC tokens are accepted (never "none" or another algorithm).
const VERIFY = { algorithms: ['HS256'] };

// Session cookies: httpOnly (page scripts can never read them), Secure, and
// Partitioned + SameSite=None so they work for the site's own origin even
// though the API is on a different domain (browsers keep them in a partition
// keyed to the site, so other websites can't use them either).
export const sessionCookie = (maxAge) => ({ httpOnly: true, secure: true, sameSite: 'none', partitioned: true, path: '/', maxAge });
export const clearSessionCookie = { httpOnly: true, secure: true, sameSite: 'none', partitioned: true, path: '/' };

// Writers and customers have completely separate sessions, each in its own
// cookie, so one browser can be signed in to both and neither sign-in (or
// sign-out) touches the other. Which cookie a request uses depends on the API
// area it calls: the writer portal's APIs read writer_token, everything else auth_token.
export const CLIENT_COOKIE = 'auth_token';
export const WRITER_COOKIE = 'writer_token';
const WRITER_AREA = /^\/api\/(writers|membership|assignments|notifications|order-workflow\/writer)(\/|\?|$)/;
export const isWriterArea = (req) => WRITER_AREA.test(req.originalUrl || req.url || '');
export const sessionCookieName = (role) => (role === 'WRITER' ? WRITER_COOKIE : CLIENT_COOKIE);
const sessionCookieFor = (req) => req.cookies && req.cookies[isWriterArea(req) ? WRITER_COOKIE : CLIENT_COOKIE];

// Signs a user JWT and sets the session cookie for the account's portal. The
// token is also returned for browsers that block even partitioned cookies
// (kept in memory there, never stored).
export function issueUserSession(res, user) {
    const token = jwt.sign({ id: user._id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(sessionCookieName(user.role), token, sessionCookie(SESSION_MAX_AGE));
    return token;
}

/** Signs out one portal: clears its cookie (partitioned and any older unpartitioned copy). */
export function clearUserSession(res, cookieName) {
    res.clearCookie(cookieName, clearSessionCookie);
    res.clearCookie(cookieName, { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
}

// CSRF defence for cookie sessions: a state-changing request authenticated by
// cookie (no Authorization header) must come from one of our own origins.
// Bearer-token requests can't be forged cross-site, so they pass through.
export function csrfGuard(isAllowedOrigin) {
    return (req, res, next) => {
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
        const hasCookie = Boolean(req.cookies && (req.cookies[CLIENT_COOKIE] || req.cookies[WRITER_COOKIE] || req.cookies.admin_token));
        if (!hasCookie || req.headers.authorization) return next();
        let origin = req.get('origin');
        if (!origin) { try { origin = new URL(req.get('referer') || '').origin; } catch { origin = ''; } }
        if (origin && origin !== 'null' && isAllowedOrigin(origin)) return next();
        return res.status(403).json({ error: 'Request blocked: it did not come from this website.' });
    };
}

function bearerToken(req) {
    return req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
}

export function authenticateUser(req, res, next) {
    const token = sessionCookieFor(req) || bearerToken(req);
    if (!token)
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET, VERIFY);
    } catch {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
    // A writer's session never opens the customer account (and vice versa the
    // writer portal checks the WRITER role itself).
    if (!isWriterArea(req) && payload.role === 'WRITER')
        return res.status(401).json({ error: 'Unauthorized: This is a writer account. Sign in to the Writer portal instead.' });
    req.user = payload;
    next();
}

// The admin's current role is read from the database (cached briefly) rather than
// trusted from the token, so deleting an admin or changing their role takes effect
// within ADMIN_ROLE_TTL_MS instead of when their 12-hour token expires.
const ADMIN_ROLE_TTL_MS = 60 * 1000;
const adminRoleCache = new Map();
// Awaited by callers: a removed admin or changed role must take effect on the very next request.
export const invalidateAdminCache = async (adminId) => {
    adminRoleCache.delete(String(adminId));
    await cacheDel(`admin:role:${adminId}`).catch(() => {});
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
        payload = jwt.verify(token, ADMIN_SECRET, VERIFY);
    } catch {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    }
    // Only a full session token opens the console — never a two-factor challenge.
    if (!isAdminSession(payload)) return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
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
        [sessionCookieFor(req), JWT_SECRET, 'user'],
        [bearerToken(req), JWT_SECRET, 'user'],
    ];
    for (const [token, secret, kind] of candidates) {
        if (!token) continue;
        let payload;
        try { payload = jwt.verify(token, secret, VERIFY); } catch { continue; } // wrong secret or expired
        if (kind === 'user' && !req.user) req.user = payload;
        if (kind === 'admin' && !req.admin && isAdminSession(payload)) {
            try {
                const role = await currentAdminRole(payload.id);
                if (role) req.admin = { ...payload, adminRole: role };
            } catch (err) { return next(err); }
        }
    }
    next();
}
