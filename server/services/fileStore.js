import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import mongoose from 'mongoose';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';

// Where uploaded files are kept. Render's own disk is wiped on every deploy,
// so files go to durable storage. New uploads are written to ONE primary store:
//
//   mongodb     (default) GridFS in the app's MongoDB database, bucket "uploads"
//   r2          a private Cloudflare R2 bucket (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)
//   cloudinary  private raw files (CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/_API_KEY/_API_SECRET)
//   local       this server's disk (development only)
//
// Choose with FILE_STORAGE; without it MongoDB is used. Files saved earlier
// in another configured store are still found: reads fall back to every other
// configured store, so switching never strands existing files.
//
// Every file belongs to an area (a folder / key prefix). Uploads arrive as temp
// files on disk (multer); saveFile() moves one into storage, openFile() reads it
// back as a stream, removeFile() deletes it everywhere.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const privateDir = (name) => path.join(__dirname, '..', 'private_uploads', name);

export const LOCAL_DIRS = {
    deliveries: path.resolve(process.env.DELIVERY_STORAGE_DIR || privateDir('deliveries')),
    assignments: path.resolve(process.env.ASSIGNMENT_STORAGE_DIR || privateDir('assignments')),
    catalog: path.resolve(process.env.CATALOG_STORAGE_DIR || privateDir('catalog')),
    writers: path.resolve(process.env.WRITER_STORAGE_DIR || privateDir('writers')),
    orders: path.resolve(process.env.ORDER_UPLOADS_DIR || path.join(__dirname, '..', 'uploads')),
};
for (const dir of Object.values(LOCAL_DIRS)) fs.mkdirSync(dir, { recursive: true });

const MB = 1024 * 1024;
const env = (name) => (process.env[name] || '').trim();
const keyOf = (area, name) => `${area}/${path.basename(String(name))}`;
const isMissing = (err) => err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404
    || (err?.http_code ?? err?.error?.http_code) === 404;

/** A file the storage can't take (too large). `status` 413; the message is safe to show. */
export class StorageLimitError extends Error {
    constructor(message) { super(message); this.status = 413; }
}

// ── Stores ────────────────────────────────────────────────────────────────────
// Each store: save(temp, area, name, type), open(area, name) → stream|null,
// size(area, name) → bytes|null, remove(area, name).

const localStore = {
    name: 'local',
    path: (area, name) => path.join(LOCAL_DIRS[area], path.basename(String(name))),
    async save(temp, area, name) { await fs.promises.rename(temp, this.path(area, name)); },
    async open(area, name) {
        const full = this.path(area, name);
        try { await fs.promises.access(full); } catch { return null; }
        return fs.createReadStream(full);
    },
    async size(area, name) { try { return (await fs.promises.stat(this.path(area, name))).size; } catch { return null; } },
    async remove(area, name) { await fs.promises.unlink(this.path(area, name)).catch(() => {}); },
};

// MongoDB GridFS: files are split into 255 KB chunks in "uploads.files" / "uploads.chunks".
async function bucket() {
    if (mongoose.connection.readyState !== 1) await mongoose.connection.asPromise();
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
}
const latest = async (b, key) => (await b.find({ filename: key }).sort({ uploadDate: -1 }).limit(1).toArray())[0] || null;
const mongoStore = {
    name: 'mongodb',
    async save(temp, area, name, contentType) {
        const b = await bucket();
        const key = keyOf(area, name);
        const old = await b.find({ filename: key }).project({ _id: 1 }).toArray();
        await new Promise((resolve, reject) => {
            fs.createReadStream(temp).on('error', reject)
                .pipe(b.openUploadStream(key, { contentType, metadata: { area } }))
                .on('error', reject).on('finish', resolve);
        });
        await Promise.all(old.map(f => b.delete(f._id).catch(() => {})));   // overwrite semantics
        await fs.promises.unlink(temp).catch(() => {});
    },
    async open(area, name) {
        const b = await bucket();
        const file = await latest(b, keyOf(area, name));
        return file ? b.openDownloadStream(file._id) : null;
    },
    async size(area, name) {
        const file = await latest(await bucket(), keyOf(area, name));
        return file ? file.length : null;
    },
    async remove(area, name) {
        const b = await bucket();
        const files = await b.find({ filename: keyOf(area, name) }).project({ _id: 1 }).toArray();
        await Promise.all(files.map(f => b.delete(f._id).catch(() => {})));
    },
};

const R2 = { account: env('R2_ACCOUNT_ID'), key: env('R2_ACCESS_KEY_ID'), secret: env('R2_SECRET_ACCESS_KEY'), bucket: env('R2_BUCKET') };
const r2Configured = Boolean(R2.account && R2.key && R2.secret && R2.bucket);
const r2 = r2Configured
    ? new S3Client({ region: 'auto', endpoint: `https://${R2.account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2.key, secretAccessKey: R2.secret } })
    : null;
const r2Store = {
    name: 'r2',
    async save(temp, area, name, contentType) {
        const { size } = await fs.promises.stat(temp);
        await r2.send(new PutObjectCommand({ Bucket: R2.bucket, Key: keyOf(area, name), Body: fs.createReadStream(temp), ContentLength: size, ContentType: contentType }));
        await fs.promises.unlink(temp).catch(() => {});
    },
    async open(area, name) {
        try { return (await r2.send(new GetObjectCommand({ Bucket: R2.bucket, Key: keyOf(area, name) }))).Body; }
        catch (err) { if (isMissing(err)) return null; throw err; }
    },
    async size(area, name) {
        try { return (await r2.send(new HeadObjectCommand({ Bucket: R2.bucket, Key: keyOf(area, name) }))).ContentLength ?? null; }
        catch (err) { if (isMissing(err)) return null; throw err; }
    },
    async remove(area, name) { await r2.send(new DeleteObjectCommand({ Bucket: R2.bucket, Key: keyOf(area, name) })).catch(() => {}); },
};

// Cloudinary: private raw files, read through signed download URLs.
const cldFromUrl = (() => {
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(env('CLOUDINARY_URL'));
    return m ? { api_key: m[1], api_secret: m[2], cloud_name: m[3] } : null;
})();
const cldConfig = env('CLOUDINARY_CLOUD_NAME') && env('CLOUDINARY_API_KEY') && env('CLOUDINARY_API_SECRET')
    ? { cloud_name: env('CLOUDINARY_CLOUD_NAME'), api_key: env('CLOUDINARY_API_KEY'), api_secret: env('CLOUDINARY_API_SECRET') }
    : cldFromUrl;
const cloudinaryConfigured = Boolean(cldConfig);
if (cloudinaryConfigured) cloudinary.config({ ...cldConfig, secure: true });
const CLD = { resource_type: 'raw', type: 'private' };
const publicIdOf = (area, name) => `assignmentminds/${keyOf(area, name)}`;
const cloudinaryStore = {
    name: 'cloudinary',
    maxBytes: (Number(env('CLOUDINARY_MAX_MB')) || 10) * MB,   // free plan: 10 MB raw files
    async save(temp, area, name) {
        await cloudinary.uploader.upload(temp, { ...CLD, public_id: publicIdOf(area, name), overwrite: true, invalidate: true })
            .catch(err => {
                const message = err?.message || err?.error?.message || String(err);
                console.error(`[Files] Cloudinary upload failed for ${publicIdOf(area, name)}:`, message);
                if (/too large/i.test(message)) throw tooLarge(this.maxBytes);
                throw err;
            });
        await fs.promises.unlink(temp).catch(() => {});
    },
    async open(area, name) {
        const url = cloudinary.utils.private_download_url(publicIdOf(area, name), '', { ...CLD, expires_at: Math.floor(Date.now() / 1000) + 300 });
        const res = await fetch(url);
        if (res.status === 404) return null;
        if (!res.ok) {
            console.error(`[Files] Cloudinary download failed (${res.status}) for ${publicIdOf(area, name)}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
            throw new Error(`Cloudinary download failed (${res.status}).`);
        }
        return Readable.fromWeb(res.body);
    },
    async size(area, name) {
        try { return (await cloudinary.api.resource(publicIdOf(area, name), CLD)).bytes ?? null; }
        catch (err) { if (isMissing(err)) return null; throw err; }
    },
    async remove(area, name) { await cloudinary.uploader.destroy(publicIdOf(area, name), { ...CLD, invalidate: true }).catch(() => {}); },
};

// ── Choice of primary store, and fallbacks for reading older files ───────────
const STORES = { mongodb: mongoStore, r2: r2Store, cloudinary: cloudinaryStore, local: localStore };
const configured = (s) => s === mongoStore || s === localStore || (s === r2Store && r2Configured) || (s === cloudinaryStore && cloudinaryConfigured);
const requested = env('FILE_STORAGE').toLowerCase();
let primary = STORES[requested] || mongoStore;
if (!configured(primary)) {
    console.warn(`[Files] FILE_STORAGE=${requested} is not configured; using MongoDB instead.`);
    primary = mongoStore;
}
// Older files may live in any other configured store (local disk last).
const fallbacks = [mongoStore, cloudinaryStore, r2Store, localStore].filter(s => s !== primary && configured(s));

export const storageMode = primary.name;
// Back-compat for callers that checked the old flags.
export const usingR2 = primary === r2Store;
export const usingCloudinary = primary === cloudinaryStore;

/** Largest file accepted for storage (FILE_MAX_MB for MongoDB; Cloudinary's free plan caps raw files at 10 MB). */
export const MAX_STORED_BYTES = primary === cloudinaryStore ? cloudinaryStore.maxBytes
    : primary === mongoStore ? (Number(env('FILE_MAX_MB')) || 25) * MB
    : Infinity;
function tooLarge(limit = MAX_STORED_BYTES) {
    return new StorageLimitError(`Files can be up to ${Math.round(limit / MB)} MB. Please upload a smaller file (or compress or split it).`);
}

console.log(`[Files] uploads are stored in ${primary === mongoStore ? 'MongoDB (GridFS bucket "uploads")' : primary.name}${fallbacks.length ? `; older files are also read from ${fallbacks.map(s => s.name).join(', ')}` : ''}.`);
if (primary === localStore && process.env.NODE_ENV === 'production')
    console.warn('[Files] Files are kept on this server’s disk and are lost when it redeploys.');

// ── Public API ────────────────────────────────────────────────────────────────

/** Moves an uploaded temp file into storage as `area/name`. */
export async function saveFile(tempPath, area, name, contentType = 'application/octet-stream') {
    const { size } = await fs.promises.stat(tempPath);
    if (size > MAX_STORED_BYTES) { await fs.promises.unlink(tempPath).catch(() => {}); throw tooLarge(); }
    try { await primary.save(tempPath, area, name, contentType); }
    catch (err) { await fs.promises.unlink(tempPath).catch(() => {}); throw err; }
}

/** A readable stream of the stored file, or null when it isn't in any store. */
export async function openFile(area, name) {
    let firstError = null;
    for (const store of [primary, ...fallbacks]) {
        try {
            const stream = await store.open(area, name);
            if (stream) return stream;
        } catch (err) {
            console.error(`[Files] reading ${keyOf(area, name)} from ${store.name} failed:`, err?.message || err);
            firstError ||= err;
        }
    }
    if (firstError) throw firstError;
    console.warn(`[Files] not found in any store: ${keyOf(area, name)}`);
    return null;
}

/** Size in bytes of the stored file, or null when it isn't in any store. */
export async function fileSize(area, name) {
    for (const store of [primary, ...fallbacks]) {
        try {
            const size = await store.size(area, name);
            if (size !== null && size !== undefined) return size;
        } catch { /* try the next store */ }
    }
    return null;
}

/** Deletes a stored file from every store (no error when it's already gone). */
export async function removeFile(area, name) {
    if (!name) return;
    await Promise.all([primary, ...fallbacks].map(s => s.remove(area, name).catch(() => {})));
}

/**
 * Sends a stored file as the response (headers must already be set, apart
 * from Content-Type when `contentType` is given). Responds 404 when missing.
 */
export async function sendStoredFile(res, area, name, { contentType, notFoundMessage = 'File not found.' } = {}) {
    const stream = await openFile(area, name);
    if (!stream) return res.status(404).json({ error: notFoundMessage });
    if (contentType) res.setHeader('Content-Type', contentType);
    stream.on('error', () => { if (!res.headersSent) res.status(500).json({ error: 'Could not load file.' }); else res.destroy(); });
    stream.pipe(res);
}

// ── Start-up self-test ────────────────────────────────────────────────────────
// Saves, reads back and deletes a small text file, PDF and ZIP (DOCX files are
// ZIPs) in the primary store. The result appears in /api/health so a broken
// setup is visible without digging through logs. It never includes keys.
export const storageCheck = { status: primary === localStore ? 'skipped' : 'pending', primary: primary.name, fallbacks: fallbacks.map(s => s.name) };
const SAMPLES = {
    txt: { type: 'text/plain', body: () => Buffer.from(`storage check ${new Date().toISOString()}`) },
    pdf: { type: 'application/pdf', body: () => Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n') },
    // An empty ZIP archive: the end-of-central-directory record only.
    zip: { type: 'application/zip', body: () => Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(18)]) },
};
async function checkOne(ext) {
    const name = `selftest-${Date.now()}.${ext}`;
    const temp = path.join(LOCAL_DIRS.deliveries, `tmp-${name}`);
    const body = SAMPLES[ext].body();
    let step = 'upload';
    try {
        await fs.promises.writeFile(temp, body);
        await primary.save(temp, 'deliveries', name, SAMPLES[ext].type);
        step = 'download';
        const stream = await primary.open('deliveries', name);
        if (!stream) throw new Error('file not found after upload');
        const chunks = [];
        for await (const c of stream) chunks.push(Buffer.from(c));
        if (!Buffer.concat(chunks).equals(body)) throw new Error('downloaded content differs');
        step = 'delete';
        await primary.remove('deliveries', name);
        return 'ok';
    } catch (err) {
        await fs.promises.unlink(temp).catch(() => {});
        await primary.remove('deliveries', name).catch(() => {});
        return `${step} failed: ${String(err?.message || err?.error?.message || err).replace(/api_key\s*\S+/gi, 'api_key').slice(0, 160)}`;
    }
}
async function selfTest() {
    const files = {};
    for (const ext of Object.keys(SAMPLES)) files[ext] = await checkOne(ext);
    const failed = Object.entries(files).filter(([, r]) => r !== 'ok');
    storageCheck.status = failed.length ? `problems: ${failed.map(([e, r]) => `${e} ${r}`).join('; ')}` : 'ok';
    storageCheck.files = files;
    storageCheck.at = new Date().toISOString();
    if (failed.length) console.error(`[Files] storage self-test ${storageCheck.status}`);
}
// GridFS waits for the database connection (bucket() does that).
if (primary !== localStore) setTimeout(() => { selfTest(); }, 5000);
