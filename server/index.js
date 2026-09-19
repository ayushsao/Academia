import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

import { connectDB } from './db.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import contactRouter from './routes/contact.js';
import adminRouter from './routes/admin.js';

const require = createRequire(import.meta.url);
const multer = require('multer');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 5000;

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── File Uploads ─────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
app.use('/uploads', express.static(uploadsDir));

app.post('/api/upload', upload.array('files', 5), (req, res) => {
    if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded.' });
    res.json({ files: req.files.map(f => f.originalname) });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) =>
    res.json({ status: 'OK', version: 'v3-https-fix', timestamp: new Date().toISOString() })
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
