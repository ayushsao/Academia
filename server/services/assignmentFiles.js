import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { sniffKind, UploadError } from './writerFiles.js';

const require = createRequire(import.meta.url);
const multer = require('multer');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Private storage for assignment reference files and writer submissions.
export const ASSIGNMENT_STORAGE_DIR = path.resolve(process.env.ASSIGNMENT_STORAGE_DIR || path.join(__dirname, '..', 'private_uploads', 'assignments'));
fs.mkdirSync(ASSIGNMENT_STORAGE_DIR, { recursive: true });
// Customer order uploads (existing public /uploads folder), linked into assignments.
export const ORDER_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Every format the platform can verify. `sig` is the leading-bytes kind from
// sniffKind; ZIP-based and text formats are told apart by extension.
const FORMATS = {
    pdf: { sig: 'pdf', mime: 'application/pdf' },
    doc: { sig: 'doc', mime: 'application/msword' },
    docx: { sig: 'zip', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    xlsx: { sig: 'zip', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    pptx: { sig: 'zip', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    zip: { sig: 'zip', mime: 'application/zip' },
    jpg: { sig: 'jpeg', mime: 'image/jpeg' },
    png: { sig: 'png', mime: 'image/png' },
    txt: { sig: 'text', mime: 'text/plain' },
    csv: { sig: 'text', mime: 'text/csv' },
};

const extOf = (name) => {
    const ext = path.extname(name || '').slice(1).toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext;
};

// Plain text: no NUL bytes and valid UTF-8 in the sampled head.
function looksLikeText(buf) {
    if (buf.includes(0)) return false;
    try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch { return false; }
}

export function receiveFiles(maxFiles, maxBytes) {
    const upload = multer({
        storage: multer.diskStorage({ destination: ASSIGNMENT_STORAGE_DIR, filename: (_q, _f, cb) => cb(null, `tmp-${crypto.randomUUID()}`) }),
        limits: { fileSize: maxBytes, files: maxFiles, fields: 10, fieldSize: 8192 },
    });
    return (req, res, next) => upload.array('files', maxFiles)(req, res, (err) => {
        if (!err) return next();
        const message = err.code === 'LIMIT_FILE_SIZE' ? `Each file must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`
            : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `Upload at most ${maxFiles} files at a time.` : 'Upload failed.';
        res.status(400).json({ error: message });
    });
}

export const discardTempFiles = (files = []) => Promise.all(files.map(f => fs.promises.unlink(f.path).catch(() => {})));

// Verifies each temp file against the allowed formats (by content, not the
// client's MIME type) and moves it to a random permanent name. On any failure
// every temp file from the request is deleted.
export async function finalizeFiles(files, allowedFormats) {
    if (!files?.length) throw new UploadError('Attach at least one file.');
    const stored = [];
    try {
        for (const file of files) {
            const ext = extOf(file.originalname);
            const fmt = FORMATS[ext];
            if (!fmt || !allowedFormats.includes(ext))
                throw new UploadError(`“${file.originalname}” is not an accepted format. Allowed: ${allowedFormats.map(f => f.toUpperCase()).join(', ')}.`);
            const handle = await fs.promises.open(file.path, 'r');
            const head = Buffer.alloc(8192);
            const { bytesRead } = await handle.read(head, 0, 8192, 0);
            await handle.close();
            const sample = head.subarray(0, bytesRead);
            const ok = fmt.sig === 'text' ? looksLikeText(sample) : sniffKind(sample) === fmt.sig;
            if (!ok) throw new UploadError(`“${file.originalname}” doesn’t look like a real ${ext.toUpperCase()} file.`);
            const sha256 = crypto.createHash('sha256').update(await fs.promises.readFile(file.path)).digest('hex');
            const storedName = `${crypto.randomUUID()}.${ext}`;
            await fs.promises.rename(file.path, path.join(ASSIGNMENT_STORAGE_DIR, storedName));
            stored.push({
                storedName, mimeType: fmt.mime, size: file.size, sha256, source: 'UPLOAD',
                originalName: path.basename(file.originalname).replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 150) || storedName,
            });
        }
        return stored;
    } catch (err) {
        await discardTempFiles(files);
        await Promise.all(stored.map(s => fs.promises.unlink(path.join(ASSIGNMENT_STORAGE_DIR, s.storedName)).catch(() => {})));
        throw err;
    }
}

export const removeAssignmentFile = (storedName) =>
    fs.promises.unlink(path.join(ASSIGNMENT_STORAGE_DIR, path.basename(storedName))).catch(() => {});

// Streams an assignment file. Order-linked files live in the order uploads folder.
export function streamAssignmentFile(res, file, opts = {}) {
    if (file.source === 'ORDER') {
        const full = path.join(ORDER_UPLOADS_DIR, path.basename(file.storedName));
        if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found.' });
        res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.sendFile(full);
    }
    // Same hardening as writer documents: no sniffing, sandboxed unless PDF.
    const full = path.join(ASSIGNMENT_STORAGE_DIR, path.basename(file.storedName));
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found.' });
    const inline = !opts.download && (file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/'));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.setHeader('Content-Security-Policy', `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'${file.mimeType === 'application/pdf' ? '' : '; sandbox'}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(full);
}

// Guesses a MIME type for a customer order file from its extension.
export const mimeForName = (name) => FORMATS[extOf(name)]?.mime || 'application/octet-stream';

