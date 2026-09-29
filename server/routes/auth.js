import { Router } from 'express';
import { createRequire } from 'module';
import https from 'https';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
import { User, Writer } from '../db.js';
import { AbuseError, assertNotLocked, recordLoginFailure, clearLoginFailures } from '../services/abuse.js';
import { authenticateUser, issueUserSession, clearUserSession, CLIENT_COOKIE } from '../middleware.js';
import { validateInput, signupSchema, loginSchema, otpLoginSendSchema, otpLoginVerifySchema, googleAuthSchema } from '../validation.js';
import { issueOtp, verifyOtp, OtpError } from '../services/otp.js';
import { DeliveryUnavailableError } from '../services/messaging.js';
import { remember } from '../services/cache.js';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
// Hash of a random value, compared against when the email is unknown (equal timing).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

const router = Router();

// Writers and customers sign in through separate portals (separate sessions).
const WRONG_PORTAL = {
    client: 'This is a writer account. Please sign in from the Writer Login page.',
    writer: "You don't have a writer account. Customers sign in from the main website.",
};
const portalOf = (user) => (user.role === 'WRITER' ? 'writer' : 'client');

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
router.post('/google', authLimiter, validateInput(googleAuthSchema), async (req, res) => {
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
            if (portalOf(user) !== 'client') return res.status(403).json({ error: WRONG_PORTAL.client, portal: 'writer' });
            user.lastLogin = new Date();
            await user.save();
        }

        const token = issueUserSession(res, user);
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

        const token = issueUserSession(res, user);
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
        const portal = req.body.portal === 'writer' ? 'writer' : 'client';

        // Per-account lockout (across IPs) on top of the per-IP limiter.
        const throttleKey = `user:${email.toLowerCase()}`;
        try { await assertNotLocked(throttleKey); }
        catch (err) { if (err instanceof AbuseError) return res.status(err.status).json({ error: err.message }); throw err; }

        const user = await User.findOne({ email: email.toLowerCase() });
        // Compare against a dummy hash for unknown emails so response timing doesn't reveal which accounts exist.
        const match = await bcrypt.compare(password, user?.password || DUMMY_HASH);
        if (!user || !match) {
            const writer = user?.role === 'WRITER' ? await Writer.findOne({ userId: user._id }).select('_id').lean() : null;
            await recordLoginFailure(throttleKey, { writerId: writer?._id, userId: user?._id });
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        await clearLoginFailures(throttleKey);
        // Checked only after the password matched, so it reveals nothing about unknown emails.
        if (portalOf(user) !== portal) return res.status(403).json({ error: WRONG_PORTAL[portal], portal: portalOf(user) });

        user.lastLogin = new Date();
        await user.save();

        const token = issueUserSession(res, user);
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: 'Login failed due to a server error.' });
    }
});

// ── One-time code (email OTP) sign-in / sign-up for customers ─────────────────
// Login: the code goes to an existing customer account's email.
// Signup: the code proves the email; the account is created once it is verified.
// OTP tokens are keyed by a user id; before an account exists we use an id
// derived from the email address.
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many code requests. Please try again later.' } });
const pendingOtpId = (email) => crypto.createHash('sha256').update(`signup:${email}`).digest('hex').slice(0, 24);
const otpFail = (res, err) => {
    if (err instanceof OtpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    if (err instanceof DeliveryUnavailableError) return res.status(503).json({ error: 'Login with OTP isn’t available right now. Please use Google or email & password.' });
    console.error('[Auth OTP]', err?.message);
    res.status(500).json({ error: 'Could not send the code. Please try again.' });
};

// POST /api/auth/otp/send
router.post('/otp/send', otpLimiter, validateInput(otpLoginSendSchema), async (req, res) => {
    try {
        const email = req.body.email.toLowerCase();
        const user = await User.findOne({ email }).select('_id role').lean();
        if (req.body.mode === 'login') {
            if (!user) return res.status(404).json({ error: 'No account found with this email. Please sign up first.' });
            if (portalOf(user) !== 'client') return res.status(403).json({ error: WRONG_PORTAL.client, portal: 'writer' });
        } else if (user) {
            return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
        }
        const userId = user ? user._id : pendingOtpId(email);
        const subject = req.body.mode === 'login' ? 'Your AssignmentMinds login code' : 'Confirm your email for AssignmentMinds';
        res.json(await issueOtp({ userId, channel: 'EMAIL', target: email, subject }));
    } catch (err) { otpFail(res, err); }
});

// POST /api/auth/otp/verify
router.post('/otp/verify', otpLimiter, validateInput(otpLoginVerifySchema), async (req, res) => {
    try {
        const email = req.body.email.toLowerCase();
        let user = await User.findOne({ email });
        let isNewUser = false;
        if (req.body.mode === 'login') {
            if (!user) return res.status(404).json({ error: 'No account found with this email. Please sign up first.' });
            if (portalOf(user) !== 'client') return res.status(403).json({ error: WRONG_PORTAL.client, portal: 'writer' });
            await verifyOtp({ userId: user._id, channel: 'EMAIL', target: email, code: req.body.code });
        } else {
            if (user) return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
            await verifyOtp({ userId: pendingOtpId(email), channel: 'EMAIL', target: email, code: req.body.code });
            // No password was chosen: store a random one (they sign in with a code, Google, or a password reset).
            user = await User.create({ name: req.body.name || email.split('@')[0], email, password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12) });
            isNewUser = true;
        }
        user.lastLogin = new Date();
        await user.save();
        const token = issueUserSession(res, user);
        res.json({ token, isNewUser, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) { otpFail(res, err); }
});

// POST /api/auth/logout — signs out the customer account only (the writer
// portal has its own session: POST /api/writers/logout).
router.post('/logout', (req, res) => {
    clearUserSession(res, CLIENT_COOKIE);
    res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', authenticateUser, async (req, res) => {
    try {
        const user = await remember(`user:profile:${req.user.id}`, 180, async () => {
            return await User.findById(req.user.id).select('-password').lean();
        });
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve profile.' });
    }
});

export default router;
