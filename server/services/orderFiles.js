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

export const EXT_MIMES = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.rtf': 'application/rtf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
};

// Detected kind → allowed extensions
const KINDS = {
    pdf: { exts: ['.pdf'] },
    doc: { exts: ['.doc', '.xls', '.ppt'] },
    zip: { exts: ['.docx', '.xlsx', '.pptx', '.zip'] },
    jpeg: { exts: ['.jpg', '.jpeg'] },
    png: { exts: ['.png'] },
    webp: { exts: ['.webp'] },
    rtf: { exts: ['.rtf'] },
    text: { exts: ['.txt', '.csv'] },
};

function looksLikeText(buf) {
    if (buf.includes(0)) return false;
    try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch { return false; }
}

/** True when a sniffed file kind is a valid match for the extension (e.g. a real PDF named .pdf). */
export const kindMatchesExtension = (kind, ext) => Boolean(kind && KINDS[kind]?.exts.includes(ext));

export function sniffOrderFileKind(buf) {
    const base = sniffKind(buf);
    if (base) return base;
    if (buf.length >= 5 && buf.slice(0, 5).toString('ascii') === '{\\rtf') return 'rtf';
    if (looksLikeText(buf)) return 'text';
    return null;
}

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

async function readHead(file, n = 64) {
    const fh = await fs.promises.open(file, 'r');
    try { const buf = Buffer.alloc(n); const { bytesRead } = await fh.read(buf, 0, n, 0); return buf.subarray(0, bytesRead); } finally { await fh.close(); }
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
            const head = await readHead(f.path, 64);
            const kind = sniffOrderFileKind(head);
            const ext = path.extname(f.originalname).toLowerCase();
            if (!kind || !KINDS[kind].exts.includes(ext)) {
                throw new OrderFileError(`“${safeName(f.originalname)}” isn’t a supported file. Upload PDF, Word, Excel, PowerPoint, Text, Image or ZIP files.`);
            }
            accepted.push({ f, kind, ext });
        }
        const stored = [];
        for (const { f, ext } of accepted) {
            const storedName = `${crypto.randomBytes(16).toString('hex')}-${safeName(f.originalname)}`;
            await fs.promises.rename(f.path, path.join(ORDER_UPLOADS_DIR, storedName));
            const mimeType = EXT_MIMES[ext] || 'application/octet-stream';
            await UploadedFile.create({
                storedName,
                userId,
                originalName: f.originalname.slice(0, 200),
                mimeType,
                size: f.size,
                sha256: await sha256(path.join(ORDER_UPLOADS_DIR, storedName))
            });
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

const mimeFor = (name) => {
    const ext = path.extname(name).toLowerCase();
    return EXT_MIMES[ext] || 'application/octet-stream';
};

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
