import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

export const JWT_SECRET = process.env.JWT_SECRET || 'academiapro_secret_key_2025';
export const ADMIN_SECRET = process.env.ADMIN_SECRET || 'academiapro_admin_2025';

export function authenticateUser(req, res, next) {
    const token = (req.cookies && req.cookies.auth_token) || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token)
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
}

export function authenticateAdmin(req, res, next) {
    const token = (req.cookies && req.cookies.admin_token) || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token)
        return res.status(401).json({ error: 'Unauthorized: No admin token' });
    try {
        req.admin = jwt.verify(token, ADMIN_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    }
}
