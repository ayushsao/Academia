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
const notFound = (err) => err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;

/** Moves an uploaded temp file into storage as `area/name`. */
export async function saveFile(tempPath, area, name, contentType = 'application/octet-stream') {
    if (!usingR2 && !usingCloudinary) {
        await fs.promises.rename(tempPath, localPath(area, name));
        return;
    }
    if (usingCloudinary) {
        await cloudinary.uploader.upload(tempPath, { ...CLD, public_id: publicIdOf(area, name), overwrite: true, invalidate: true })
            .catch(err => {
                console.error(`[Files] Cloudinary upload failed for ${publicIdOf(area, name)}:`, err?.message || err?.error?.message || err);
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
            throw new Error(`Cloudinary download failed (${res.status}).`);
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
