import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { UploadedFile, Order } from '../db.js';
import { sniffKind } from './writerFiles.js';
import { ORDER_UPLOADS_DIR } from './assignmentFiles.js';

const require = createRequire(import.meta.url);
const multer = require('multer');

// Customer order attachments. These are private documents: stored under
// unguessable names, attributed to the uploader, and only streamed through
// authorised routes (the order's owner, or an admin with orders.read).

const MB = 1024 * 1024;
const MAX_FILES = 5;
const MAX_BYTES = 50 * MB;
// Detected kind → allowed extensions and the MIME type we serve it with.
const KINDS = {
    pdf: { exts: ['.pdf'], mime: 'application/pdf' },
    doc: { exts: ['.doc'], mime: 'application/msword' },
    zip: { exts: ['.docx'], mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    jpeg: { exts: ['.jpg', '.jpeg'], mime: 'image/jpeg' },
    png: { exts: ['.png'], mime: 'image/png' },
    webp: { exts: ['.webp'], mime: 'image/webp' },
};

class OrderFileError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

fs.mkdirSync(ORDER_UPLOADS_DIR, { recursive: true });
const upload = multer({
    storage: multer.diskStorage({
        destination: ORDER_UPLOADS_DIR,
        filename: (_req, _file, cb) => cb(null, `.tmp-${crypto.randomBytes(16).toString('hex')}`),
    }),
    limits: { fileSize: MAX_BYTES, files: MAX_FILES },
});

export function receiveOrderFiles(req, res, next) {
    upload.array('files', MAX_FILES)(req, res, (err) => {
        if (!err) return next();
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 50 MB or smaller.'
            : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `Upload at most ${MAX_FILES} files.` : 'Upload failed.';
        res.status(400).json({ error: message });
    });
}

const safeName = (name) => path.basename(String(name)).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(-80) || 'file';

async function readHead(file, n = 16) {
    const fh = await fs.promises.open(file, 'r');
    try { const buf = Buffer.alloc(n); await fh.read(buf, 0, n, 0); return buf; } finally { await fh.close(); }
}

async function sha256(file) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}

// Validates each temp upload by content, renames it to its final unguessable
// name and records the uploader. All-or-nothing: any bad file rejects the batch.
export async function storeOrderUploads(files, userId) {
    const discard = () => Promise.all(files.map(f => fs.promises.unlink(f.path).catch(() => {})));
    if (!files.length) throw new OrderFileError('No files uploaded.');
    const accepted = [];
    try {
        for (const f of files) {
            const kind = sniffKind(await readHead(f.path));
            const ext = path.extname(f.originalname).toLowerCase();
            if (!kind || !KINDS[kind].exts.includes(ext)) throw new OrderFileError(`“${safeName(f.originalname)}” isn’t a supported file. Upload PDF, Word (DOC/DOCX) or image (JPG/PNG/WEBP) files.`);
            accepted.push({ f, kind, ext });
        }
        const stored = [];
        for (const { f, kind } of accepted) {
            const storedName = `${crypto.randomBytes(16).toString('hex')}-${safeName(f.originalname)}`;
            await fs.promises.rename(f.path, path.join(ORDER_UPLOADS_DIR, storedName));
            await UploadedFile.create({ storedName, userId, originalName: f.originalname.slice(0, 200), mimeType: KINDS[kind].mime, size: f.size, sha256: await sha256(path.join(ORDER_UPLOADS_DIR, storedName)) });
            stored.push(storedName);
        }
        return stored;
    } catch (err) {
        await discard();
        throw err;
    }
}

// Keeps only file names this user uploaded (an order can't claim someone else's file).
export async function ownedFileNames(names, userId) {
    if (!Array.isArray(names) || !names.length) return [];
    const owned = new Set((await UploadedFile.find({ storedName: { $in: names.map(String) }, userId }).select('storedName').lean()).map(f => f.storedName));
    return names.map(String).filter(n => owned.has(n));
}

const mimeFor = (name) => Object.values(KINDS).find(k => k.exts.includes(path.extname(name).toLowerCase()))?.mime || 'application/octet-stream';

// Streams a stored order file as a download with hardened headers.
export async function streamOrderFile(res, storedName) {
    const name = path.basename(String(storedName));
    if (!name || name.startsWith('.')) return res.status(404).json({ error: 'File not found.' });
    const full = path.join(ORDER_UPLOADS_DIR, name);
    try { await fs.promises.access(full); } catch { return res.status(404).json({ error: 'File not found.' }); }
    const meta = await UploadedFile.findOne({ storedName: name }).select('originalName mimeType').lean();
    const downloadName = (meta?.originalName || name.replace(/^[0-9a-f]{32}-/, '')).replace(/["\\\r\n]/g, '');
    res.setHeader('Content-Type', meta?.mimeType || mimeFor(name));
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(full).pipe(res);
}

// May this customer download this file? Their own upload, or a file on one of their orders (legacy uploads).
export async function customerCanAccess(userId, storedName) {
    const name = path.basename(String(storedName));
    return Boolean(await UploadedFile.exists({ storedName: name, userId }) || await Order.exists({ userId, files: name }));
}
