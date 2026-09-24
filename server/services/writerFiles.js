import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const multer = require('multer');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Deliberately outside server/uploads, which is served statically. Files here
// are only reachable through authorised streaming endpoints.
export const WRITER_STORAGE_DIR = path.resolve(process.env.WRITER_STORAGE_DIR || path.join(__dirname, '..', 'private_uploads', 'writers'));
fs.mkdirSync(WRITER_STORAGE_DIR, { recursive: true });

const MB = 1024 * 1024;

const FILE_KINDS = {
    pdf: { mime: 'application/pdf', ext: '.pdf' },
    docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: '.docx' },
    doc: { mime: 'application/msword', ext: '.doc' },
    jpeg: { mime: 'image/jpeg', ext: '.jpg' },
    png: { mime: 'image/png', ext: '.png' },
    webp: { mime: 'image/webp', ext: '.webp' },
};

// Allowed kinds and size limit per upload purpose.
export const UPLOAD_RULES = {
    PHOTO: { kinds: ['jpeg', 'png', 'webp'], maxBytes: 5 * MB },
    RESUME: { kinds: ['pdf', 'docx', 'doc'], maxBytes: 10 * MB },
    CERTIFICATE: { kinds: ['pdf', 'jpeg', 'png', 'webp'], maxBytes: 10 * MB },
    WRITING_SAMPLE: { kinds: ['pdf', 'docx', 'doc'], maxBytes: 15 * MB },
    PORTFOLIO: { kinds: ['pdf', 'docx', 'doc', 'jpeg', 'png', 'webp'], maxBytes: 15 * MB },
};

const ALL_ALLOWED_MIMES = new Set(Object.values(FILE_KINDS).map(k => k.mime));

// Identify a file from its leading bytes rather than trusting the client.
// 'zip' covers ZIP containers (DOCX/XLSX/PPTX are ZIPs too).
export function sniffKind(buf) {
    const starts = (...bytes) => bytes.every((b, i) => buf[i] === b);
    if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'pdf';
    if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
    if (starts(0xff, 0xd8, 0xff)) return 'jpeg';
    if (starts(0x52, 0x49, 0x46, 0x46) && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
    if (starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return 'doc';
    if (starts(0x50, 0x4b, 0x03, 0x04)) return 'zip';
    return null;
}

export class UploadError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

const upload = multer({
    storage: multer.diskStorage({
        destination: WRITER_STORAGE_DIR,
        filename: (_req, _file, cb) => cb(null, `tmp-${crypto.randomUUID()}`),
    }),
    limits: { fileSize: 15 * MB, files: 1, fields: 10, fieldSize: 2048 },
    fileFilter: (_req, file, cb) => {
        if (ALL_ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
        else cb(new UploadError('Unsupported file type. Upload a PDF, Word document or image.'));
    },
});

// Express middleware: accepts a single file in field "file".
export function receiveSingleFile(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (!err) return next();
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : err.message || 'Upload failed.';
        res.status(400).json({ error: message });
    });
}

export const removeStoredFile = (storedName) =>
    fs.promises.unlink(path.join(WRITER_STORAGE_DIR, path.basename(storedName))).catch(() => {});

// Validates an uploaded temp file against the purpose's rules, then moves it to
// a random final name. Deletes the temp file on any failure.
export async function finalizeUpload(file, purpose) {
    const rules = UPLOAD_RULES[purpose];
    if (!file) throw new UploadError('No file received.');
    try {
        if (file.size > rules.maxBytes) throw new UploadError(`File is too large. Maximum is ${rules.maxBytes / MB} MB.`);

        const handle = await fs.promises.open(file.path, 'r');
        const head = Buffer.alloc(16);
        await handle.read(head, 0, 16, 0);
        await handle.close();

        let kind = sniffKind(head);
        if (kind === 'zip') kind = file.mimetype === FILE_KINDS.docx.mime ? 'docx' : null;
        if (!kind || !rules.kinds.includes(kind))
            throw new UploadError(`This file type is not accepted here. Allowed: ${rules.kinds.map(k => k.toUpperCase()).join(', ')}.`);

        const sha256 = crypto.createHash('sha256').update(await fs.promises.readFile(file.path)).digest('hex');
        const storedName = `${crypto.randomUUID()}${FILE_KINDS[kind].ext}`;
        await fs.promises.rename(file.path, path.join(WRITER_STORAGE_DIR, storedName));

        const originalName = path.basename(file.originalname).replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 150) || `document${FILE_KINDS[kind].ext}`;
        return { storedName, originalName, mimeType: FILE_KINDS[kind].mime, size: file.size, sha256 };
    } catch (err) {
        await fs.promises.unlink(file.path).catch(() => {});
        throw err;
    }
}

// Streams a stored file with headers that stop browsers from executing it.
export function streamStoredFile(res, { storedName, mimeType, originalName }, { download = false } = {}) {
    const filePath = path.join(WRITER_STORAGE_DIR, path.basename(storedName));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
    const inline = !download && (mimeType === 'application/pdf' || mimeType.startsWith('image/'));
    const safeName = encodeURIComponent(originalName || path.basename(storedName));
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${safeName}`);
    // Chrome's PDF viewer refuses to render inside a CSP sandbox, so only sandbox other types.
    res.setHeader('Content-Security-Policy', `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'${mimeType === 'application/pdf' ? '' : '; sandbox'}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(filePath);
}
