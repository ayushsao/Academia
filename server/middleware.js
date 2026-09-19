import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

export const JWT_SECRET = process.env.JWT_SECRET || 'academiapro_secret_key_2025';
export const ADMIN_SECRET = process.env.ADMIN_SECRET || 'academiapro_admin_2025';

export function authenticateUser(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    try {
        req.user = jwt.verify(auth.slice(7), JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
}

export function authenticateAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
        return res.status(401).json({ error: 'Unauthorized: No admin token' });
    try {
        req.admin = jwt.verify(auth.slice(7), ADMIN_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    }
}
