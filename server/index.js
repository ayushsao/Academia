import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { rateLimit } from 'express-rate-limit';

import { connectDB } from './db.js';
import { isAllowedOrigin, securityWarnings, IS_PRODUCTION } from './config.js';
import { authenticateUser } from './middleware.js';
import { receiveOrderFiles, storeOrderUploads } from './services/orderFiles.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import contactRouter from './routes/contact.js';
import toolsRouter from './routes/tools.js';
import adminRouter from './routes/admin.js';
import agentRouter from './routes/agent.js';
import writersRouter from './routes/writers.js';
import writerAdminRouter from './routes/writerAdmin.js';
import membershipRouter from './routes/membership.js';
import membershipAdminRouter from './routes/membershipAdmin.js';
import assignmentsRouter from './routes/assignments.js';
import assignmentAdminRouter from './routes/assignmentAdmin.js';
import notificationsRouter from './routes/notifications.js';
import adminInsightsRouter from './routes/adminInsights.js';
import contentRouter, { contentAdminRouter } from './routes/content.js';
import riskAdminRouter from './routes/riskAdmin.js';
import catalogAdminRouter from './routes/catalogAdmin.js';
import catalogContentAdminRouter from './routes/catalogContentAdmin.js';
import catalogRouter from './routes/catalog.js';
import paymentsRouter from './routes/payments.js';
import { startNotificationWorker } from './services/notifications.js';
import { backfillWriterDirectory } from './services/writerDirectory.js';
import { startAssignmentScheduler } from './services/assignmentService.js';
import { startMembershipScheduler } from './services/membershipService.js';
import { ensureDefaultPlans } from './services/membershipSettings.js';
import { isRedisAvailable, cacheStats } from './services/cache.js';


const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ── Security Headers ────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Required for serving images if they are requested cross-origin
}));

// ── CORS ────────────────────────────────────────────────────────────────────
// Credentialed requests only from the app's own origin(s): APP_URL plus any in
// CORS_ORIGINS (and localhost in development). Matching is exact, never substring.
app.use(cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
}));

// ── Protect against NoSQL Injection ──────────────────────────────────────────
app.use(mongoSanitize());

// Payment webhooks are signature-checked against the exact raw bytes, so they
// must bypass JSON parsing (express.json skips bodies that are already read).
app.use('/api/membership/webhooks', express.raw({ type: '*/*', limit: '1mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting (Global) ───────────────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', globalLimiter);

// ── Customer order uploads ───────────────────────────────────────────────────
// Signed-in customers only. Files are identified by their content (not the
// client's MIME type), stored under unguessable names, recorded against the
// uploader, and never served statically: see GET /api/orders/files/:name and
// GET /api/admin/orders/files/:name.
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Too many uploads. Please try again later.' } });
app.post('/api/upload', uploadLimiter, authenticateUser, receiveOrderFiles, async (req, res) => {
    try {
        const files = await storeOrderUploads(req.files || [], req.user.id);
        res.json({ files });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Upload failed.' });
    }
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/contact', contactRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/agent', agentRouter);
app.use('/api/admin/writers', writerAdminRouter); // must precede the generic /api/admin router
app.use('/api/admin/membership', membershipAdminRouter); // likewise
app.use('/api/admin/assignments', assignmentAdminRouter); // likewise
app.use('/api/admin/insights', adminInsightsRouter); // likewise
app.use('/api/admin/content', contentAdminRouter); // likewise
app.use('/api/admin/risk', riskAdminRouter); // likewise
app.use('/api/admin/catalog', catalogAdminRouter); // likewise
app.use('/api/admin/catalog', catalogContentAdminRouter); // content blocks, FAQs, SEO, media library
app.use('/api/admin', adminRouter);
app.use('/api/writers', writersRouter);
app.use('/api/membership', membershipRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/content', contentRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api', paymentsRouter);
app.use('/api/orders', paymentsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/', paymentsRouter);

app.get('/api/health', (req, res) =>
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        redis: {
            connected: isRedisAvailable(),
            stats: cacheStats,
        },
    })
);

app.use('/api/*', (req, res) =>
    res.status(404).json({ error: 'API route not found.' })
);

// ── Status Route for Render ───────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send('AcademiaPro API is running smoothly. Frontend is hosted on Vercel.');
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
    // Handle JSON parse errors gracefully (bad request bodies from bots/malformed clients)
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON in request body.' });
    }
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const DEPLOY_VERSION = '2026-09-19-v3-https-fix';

// ── Self-Ping to prevent sleep (Render Free Tier) ───────────────────────────
const PING_INTERVAL = 14 * 60 * 1000; // 14 mins
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    if (url.startsWith('http')) {
        const clientName = url.startsWith('https') ? 'https' : 'http';
        import(clientName).then((client) => {
            client.get(`${url}/api/health`, (res) => {
                console.log(`[Self-Ping] Keep-alive ping sent to ${url}. Status: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error(`[Self-Ping] Error: ${err.message}`);
            });
        });
    }
}, PING_INTERVAL);

connectDB().then(() => {
    for (const w of securityWarnings()) console.error(`[Security] ${w}`);
    ensureDefaultPlans().catch(err => console.error('[Membership] plan seeding failed:', err.message));
    backfillWriterDirectory().catch(err => console.error('[Directory] backfill failed:', err.message));
    startMembershipScheduler();
    startAssignmentScheduler();
    startNotificationWorker();
    app.listen(PORT, () => {
        console.log(`\n🎓 AcademiaPro Backend  →  http://localhost:${PORT}`);
        console.log(`📦 Deploy Version      →  ${DEPLOY_VERSION}`);
        console.log(`⚡ Redis Caching       →  ${isRedisAvailable() ? 'Active (Upstash Redis)' : 'Standby / Direct DB'}`);
        if (!IS_PRODUCTION) console.log(`📊 Admin Panel         →  http://localhost:3000/admin  (dev login: admin / admin123)\n`);
    });
});
