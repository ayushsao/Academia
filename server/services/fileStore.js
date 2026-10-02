import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';

// Where uploaded files are kept. On Render the server's own disk is wiped on
// every deploy, so in production files go to cloud storage: a private
// Cloudflare R2 bucket (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET) or private Cloudinary files (CLOUDINARY_CLOUD_NAME,
// CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Without either (local
// development) they stay on this disk.
//
// Every file belongs to an area (a folder / key prefix). Uploads arrive as temp
// files on disk (multer); saveFile() moves one into storage, openFile() reads it
// back as a stream, removeFile() deletes it.

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

const keyOf = (area, name) => `${area}/${path.basename(String(name))}`;

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
export const usingR2 = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);
const r2 = usingR2
    ? new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
    : null;

// Either the three CLOUDINARY_* values or a single CLOUDINARY_URL
// (cloudinary://<key>:<secret>@<cloud name>) as shown on the API Keys page.
const env = (name) => (process.env[name] || '').trim();
const cldFromUrl = (() => {
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(env('CLOUDINARY_URL'));
    return m ? { api_key: m[1], api_secret: m[2], cloud_name: m[3] } : null;
})();
const cldConfig = env('CLOUDINARY_CLOUD_NAME') && env('CLOUDINARY_API_KEY') && env('CLOUDINARY_API_SECRET')
    ? { cloud_name: env('CLOUDINARY_CLOUD_NAME'), api_key: env('CLOUDINARY_API_KEY'), api_secret: env('CLOUDINARY_API_SECRET') }
    : cldFromUrl;
const CLOUDINARY_CLOUD_NAME = cldConfig?.cloud_name;
export const usingCloudinary = !usingR2 && Boolean(cldConfig);
if (usingCloudinary) cloudinary.config({ ...cldConfig, secure: true });

/** Where uploads are kept: 'r2', 'cloudinary' or 'local' (lost on redeploy). */
export const storageMode = usingR2 ? 'r2' : usingCloudinary ? 'cloudinary' : 'local';
// Stored as private raw files: nothing is reachable without a signed request.
const CLD = { resource_type: 'raw', type: 'private' };
const publicIdOf = (area, name) => `assignmentminds/${keyOf(area, name)}`;
const cldMissing = (err) => (err?.http_code ?? err?.error?.http_code) === 404;

if (usingR2) console.log(`[Files] uploads are stored in the R2 bucket "${R2_BUCKET}".`);
else if (usingCloudinary) console.log(`[Files] uploads are stored in Cloudinary ("${CLOUDINARY_CLOUD_NAME}", private files).`);
else if (process.env.NODE_ENV === 'production')
    console.warn('[Files] Cloud storage is not configured: uploads are kept on this server’s disk and are lost when it redeploys.');

const localPath = (area, name) => path.join(LOCAL_DIRS[area], path.basename(String(name)));

// Largest file the storage accepts. Cloudinary's free plan stores raw files of
// up to 10 MB (set CLOUDINARY_MAX_MB on a paid plan); R2 and disk have no
// practical limit here.
const MB = 1024 * 1024;
export const MAX_STORED_BYTES = usingCloudinary ? (Number(process.env.CLOUDINARY_MAX_MB) || 10) * MB : Infinity;

/** A file the storage can't take (too large). `status` 413; the message is safe to show. */
export class StorageLimitError extends Error {
    constructor(message) { super(message); this.status = 413; }
}
const tooLarge = () => new StorageLimitError(`Files can be up to ${Math.round(MAX_STORED_BYTES / MB)} MB. Please upload a smaller file (or compress or split it).`);
const notFound = (err) => err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;

/** Moves an uploaded temp file into storage as `area/name`. */
export async function saveFile(tempPath, area, name, contentType = 'application/octet-stream') {
    if (!usingR2 && !usingCloudinary) {
        await fs.promises.rename(tempPath, localPath(area, name));
        return;
    }
    if (usingCloudinary) {
        const { size } = await fs.promises.stat(tempPath);
        if (size > MAX_STORED_BYTES) { await fs.promises.unlink(tempPath).catch(() => {}); throw tooLarge(); }
        await cloudinary.uploader.upload(tempPath, { ...CLD, public_id: publicIdOf(area, name), overwrite: true, invalidate: true })
            .catch(async err => {
                const message = err?.message || err?.error?.message || String(err);
                console.error(`[Files] Cloudinary upload failed for ${publicIdOf(area, name)}:`, message);
                await fs.promises.unlink(tempPath).catch(() => {});
                if (/file size too large|too large/i.test(message)) throw tooLarge();
                throw err;
            });
        await fs.promises.unlink(tempPath).catch(() => {});
        return;
    }
    const { size } = await fs.promises.stat(tempPath);
    await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET, Key: keyOf(area, name), Body: fs.createReadStream(tempPath),
        ContentLength: size, ContentType: contentType,
    }));
    await fs.promises.unlink(tempPath).catch(() => {});
}

/** A readable stream of the stored file, or null when it doesn't exist. */
export async function openFile(area, name) {
    if (!usingR2 && !usingCloudinary) {
        const full = localPath(area, name);
        try { await fs.promises.access(full); } catch { return null; }
        return fs.createReadStream(full);
    }
    if (usingCloudinary) {
        const url = cloudinary.utils.private_download_url(publicIdOf(area, name), '', {
            ...CLD, expires_at: Math.floor(Date.now() / 1000) + 300,
        });
        const res = await fetch(url);
        if (res.status === 404) { console.warn(`[Files] not in Cloudinary: ${publicIdOf(area, name)}`); return null; }
        if (!res.ok) {
            console.error(`[Files] Cloudinary download failed (${res.status}) for ${publicIdOf(area, name)}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
            throw Object.assign(new Error(`Cloudinary download failed (${res.status}).`), { storageStatus: res.status });
        }
        return Readable.fromWeb(res.body);
    }
    try {
        const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: keyOf(area, name) }));
        return obj.Body;
    } catch (err) {
        if (notFound(err)) return null;
        throw err;
    }
}

/** Size in bytes of the stored file, or null when it doesn't exist. */
export async function fileSize(area, name) {
    if (!usingR2 && !usingCloudinary) {
        try { return (await fs.promises.stat(localPath(area, name))).size; } catch { return null; }
    }
    if (usingCloudinary) {
        try {
            return (await cloudinary.api.resource(publicIdOf(area, name), CLD)).bytes ?? null;
        } catch (err) {
            if (cldMissing(err)) return null;
            throw err;
        }
    }
    try {
        return (await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: keyOf(area, name) }))).ContentLength ?? null;
    } catch (err) {
        if (notFound(err)) return null;
        throw err;
    }
}

/** Deletes a stored file (no error when it's already gone). */
export async function removeFile(area, name) {
    if (!name) return;
    if (usingCloudinary)
        return cloudinary.uploader.destroy(publicIdOf(area, name), { ...CLD, invalidate: true }).then(() => {}, () => {});
    if (!usingR2) return fs.promises.unlink(localPath(area, name)).catch(() => {});
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: keyOf(area, name) })).catch(() => {});
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

// Start-up self-test for cloud storage: saves, reads back and deletes a small
// text file, PDF and ZIP (DOCX files are ZIPs; Cloudinary can block PDF/ZIP
// delivery on new accounts). The result appears in /api/health so a broken
// setup is visible without digging through logs. It never includes keys.
export const storageCheck = { status: storageMode === 'local' ? 'skipped' : 'pending' };
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
        await saveFile(temp, 'deliveries', name, SAMPLES[ext].type);
        step = 'download';
        const stream = await openFile('deliveries', name);
        if (!stream) throw new Error('file not found after upload');
        const chunks = [];
        for await (const c of stream) chunks.push(Buffer.from(c));
        if (!Buffer.concat(chunks).equals(body)) throw new Error('downloaded content differs');
        step = 'delete';
        await removeFile('deliveries', name);
        return 'ok';
    } catch (err) {
        await fs.promises.unlink(temp).catch(() => {});
        await removeFile('deliveries', name).catch(() => {});
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
if (storageMode !== 'local') setTimeout(() => { selfTest(); }, 3000);
