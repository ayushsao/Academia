import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { sniffKind } from './writerFiles.js';

const require = createRequire(import.meta.url);
const multer = require('multer');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Catalogue images (subjects, projects) and downloadable project files. Stored
// outside the static folders and streamed through routes that check publish
// state (public) or admin permissions (admin). Type is decided by content.

export const CATALOG_STORAGE_DIR = path.resolve(process.env.CATALOG_STORAGE_DIR || path.join(__dirname, '..', 'private_uploads', 'catalog'));
fs.mkdirSync(CATALOG_STORAGE_DIR, { recursive: true });

const MB = 1024 * 1024;
const TYPES = {
    jpeg: { exts: ['.jpg', '.jpeg'], mime: 'image/jpeg', kind: 'IMAGE' },
    png: { exts: ['.png'], mime: 'image/png', kind: 'IMAGE' },
    webp: { exts: ['.webp'], mime: 'image/webp', kind: 'IMAGE' },
    pdf: { exts: ['.pdf'], mime: 'application/pdf', kind: 'FILE' },
    doc: { exts: ['.doc'], mime: 'application/msword', kind: 'FILE' },
    zip: { exts: ['.docx', '.zip', '.pptx', '.xlsx'], mime: null, kind: 'FILE' },
};
const ZIP_MIME = { '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.zip': 'application/zip', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
export const LIMITS = { IMAGE: 5 * MB, FILE: 25 * MB, files: 10 };

export class MediaError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

const upload = multer({
    storage: multer.diskStorage({ destination: CATALOG_STORAGE_DIR, filename: (_q, _f, cb) => cb(null, `.tmp-${crypto.randomBytes(16).toString('hex')}`) }),
    limits: { fileSize: LIMITS.FILE, files: LIMITS.files },
});

export const receiveCatalogFiles = (req, res, next) => upload.array('files', LIMITS.files)(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 25 MB or smaller.' : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `Upload at most ${LIMITS.files} files at once.` : 'Upload failed.';
    res.status(400).json({ error: message });
});

async function head(file, n = 16) {
    const fh = await fs.promises.open(file, 'r');
    try { const b = Buffer.alloc(n); await fh.read(b, 0, n, 0); return b; } finally { await fh.close(); }
}
const safeName = (n) => path.basename(String(n)).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(-80) || 'file';
export const discard = (files = []) => Promise.all(files.map(f => fs.promises.unlink(f.path).catch(() => {})));

// Validates every temp upload (all-or-nothing) and moves it to its final name.
// `allow` limits kinds: ['IMAGE'] for subject images, ['IMAGE','FILE'] for projects.
export async function storeCatalogFiles(files, allow) {
    if (!files?.length) throw new MediaError('No files uploaded.');
    const accepted = [];
    try {
        for (const f of files) {
            const sniffed = sniffKind(await head(f.path));
            const ext = path.extname(f.originalname).toLowerCase();
            const t = sniffed && TYPES[sniffed];
            if (!t || !t.exts.includes(ext)) throw new MediaError(`“${safeName(f.originalname)}” isn’t a supported file (JPG, PNG, WEBP, PDF, DOC, DOCX, PPTX, XLSX or ZIP).`);
            if (!allow.includes(t.kind)) throw new MediaError(`“${safeName(f.originalname)}” must be an image (JPG, PNG or WEBP).`);
            if (t.kind === 'IMAGE' && f.size > LIMITS.IMAGE) throw new MediaError(`“${safeName(f.originalname)}” is larger than 5 MB.`);
            accepted.push({ f, t, ext });
        }
        const stored = [];
        for (const { f, t, ext } of accepted) {
            const storedName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
            await fs.promises.rename(f.path, path.join(CATALOG_STORAGE_DIR, storedName));
            stored.push({ storedName, originalName: f.originalname.slice(0, 200), mimeType: t.mime || ZIP_MIME[ext], size: f.size, kind: t.kind });
        }
        return stored;
    } catch (err) { await discard(files); throw err; }
}

export const removeCatalogFile = (storedName) =>
    storedName ? fs.promises.unlink(path.join(CATALOG_STORAGE_DIR, path.basename(storedName))).catch(() => {}) : Promise.resolve();

// Images display inline; other files download. Hardened headers either way.
export async function streamCatalogFile(res, file, { cache = 'private, no-store' } = {}) {
    const full = path.join(CATALOG_STORAGE_DIR, path.basename(file.storedName));
    try { await fs.promises.access(full); } catch { return res.status(404).json({ error: 'File not found.' }); }
    const name = file.originalName.replace(/["\\\r\n]/g, '');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${file.kind === 'IMAGE' ? 'inline' : 'attachment'}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', cache);
    if (file.kind !== 'IMAGE') res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    fs.createReadStream(full).pipe(res);
}
