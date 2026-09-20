import { Router } from 'express';
import { createRequire } from 'module';
import https from 'https';
import { rateLimit } from 'express-rate-limit';
import { User } from '../db.js';
import { JWT_SECRET, authenticateUser } from '../middleware.js';
import { validateInput, signupSchema, loginSchema } from '../validation.js';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 10, // 10 attempts
    message: { error: 'Too many authentication attempts. Please try again later.' }
});

// Helper: fetch Google userinfo using Node's built-in https (works on ALL Node versions)
function fetchGoogleUserInfo(accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.googleapis.com',
            path: '/oauth2/v3/userinfo',
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject(new Error(`Google API returned ${res.statusCode}: ${data}`));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject(new Error('Failed to parse Google response'));
                }
            });
        });
        req.on('error', (err) => reject(err));
        req.end();
    });
}

// POST /api/auth/google
router.post('/google', authLimiter, async (req, res) => {
    try {
        const { access_token } = req.body;
        if (!access_token) return res.status(400).json({ error: 'Google access token missing.' });

        let payload;
        try {
            payload = await fetchGoogleUserInfo(access_token);
        } catch (fetchErr) {
            console.error('Google userinfo fetch error:', fetchErr);
            return res.status(500).json({ error: 'Could not reach Google servers. ' + (fetchErr.message || '') });
        }

        if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google payload.' });

        const email = payload.email.toLowerCase();
        let user = await User.findOne({ email });
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            // Generate a secure random password for Google-authenticated users
            const crypto = require('crypto');
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hash = await bcrypt.hash(randomPassword, 12);
            user = await User.create({
                name: payload.name || 'Google User',
                email,
                password: hash,
                role: 'student',
                lastLogin: new Date()
            });
        } else {
            user.lastLogin = new Date();
            await user.save();
        }

        const token = jwt.sign({ id: user._id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.json({ token, isNewUser, user: { id: user._id, name: user.name, email: user.email, role: user.role, picture: payload.picture } });
    } catch (err) {
        console.error('Google Auth Error:', err);
        res.status(500).json({ error: 'Failed to authenticate with Google. ' + (err.message || '') });
    }
});

// POST /api/auth/signup
router.post('/signup', authLimiter, validateInput(signupSchema), async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            // Anti-enumeration generic response
            return res.status(400).json({ error: 'Account registration failed. If you already have an account, please log in.' });
        }

        // Use bcrypt 12 for better security
        const hash = await bcrypt.hash(password, 12);
        const user = await User.create({ name, email: email.toLowerCase(), password: hash });

        const token = jwt.sign({ id: user._id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        // Prevent leaking mongodb errors
        res.status(400).json({ error: 'Registration failed. Please check your data and try again.' });
    }
});

// POST /api/auth/login
router.post('/login', authLimiter, validateInput(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Constant time comparison (dummy) can prevent timing attacks, but just return generic error
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign({ id: user._id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: 'Login failed due to a server error.' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token', { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', authenticateUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve profile.' });
    }
});

export default router;
