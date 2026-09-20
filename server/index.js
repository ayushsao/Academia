import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { rateLimit } from 'express-rate-limit';

import { connectDB } from './db.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import contactRouter from './routes/contact.js';
import toolsRouter from './routes/tools.js';
import adminRouter from './routes/admin.js';

const require = createRequire(import.meta.url);
const multer = require('multer');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Headers ────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Required for serving images if they are requested cross-origin
}));

// ── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (origin.includes('localhost') || origin.includes('vercel.app')) {
            return callback(null, true);
        }
        const appUrl = process.env.APP_URL ? process.env.APP_URL.trim().replace(/\/$/, '') : '';
        if (origin === appUrl) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

// ── Protect against NoSQL Injection ──────────────────────────────────────────
app.use(mongoSanitize());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting (Global) ───────────────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', globalLimiter);

// ── File Uploads ─────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Ensure strict file validation for uploads!
const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '')}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        // Only allow safe file types
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type.'), false);
        }
    }
});
app.use('/uploads', express.static(uploadsDir));

app.post('/api/upload', (req, res, next) => {
    // Wrap multer to handle errors gracefully
    upload.array('files', 5)(req, res, function (err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded or invalid file type.' });
    res.json({ files: req.files.map(f => f.filename) });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/contact', contactRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) =>
    res.json({ status: 'OK', version: 'latest-admin-fix', timestamp: new Date().toISOString() })
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
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const DEPLOY_VERSION = '2026-09-19-v3-https-fix';
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🎓 AcademiaPro Backend  →  http://localhost:${PORT}`);
        console.log(`📦 Deploy Version      →  ${DEPLOY_VERSION}`);
        console.log(`📊 Admin Panel         →  http://localhost:3000/admin`);
        console.log(`🔑 Admin login         →  username: admin  |  password: admin123\n`);
    });
});
