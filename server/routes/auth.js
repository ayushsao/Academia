import { Router } from 'express';
import { createRequire } from 'module';
import { User } from '../db.js';
import { JWT_SECRET, authenticateUser } from '../middleware.js';
import { OAuth2Client } from 'google-auth-library';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = Router();
const googleClient = new OAuth2Client();

// POST /api/auth/google
router.post('/google', async (req, res) => {
    try {
        const { access_token } = req.body;
        if (!access_token) return res.status(400).json({ error: 'Google access token missing.' });

        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        if (!googleRes.ok) return res.status(400).json({ error: 'Failed to verify Google token.' });

        const payload = await googleRes.json();
        if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google payload.' });

        const email = payload.email.toLowerCase();
        let user = await User.findOne({ email });

        if (!user) {
            // Create user silently using Google details
            const hash = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
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
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, picture: payload.picture } });
    } catch (err) {
        console.error('Google Auth Error:', err);
        res.status(500).json({ error: 'Failed to authenticate with Google.' });
    }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        if (password.length < 6)
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

        const hash = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hash });
        const token = jwt.sign({ id: user._id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email and password are required.' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign({ id: user._id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/me
router.get('/me', authenticateUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
