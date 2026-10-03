import fs from 'fs';
import { UploadUsage } from '../db.js';

// Daily upload quota per signed-in customer or writer, so one account can't
// fill the file storage (and with it the database). Admin uploads aren't
// limited. Runs after multer, so it sees the real file sizes; rejected
// uploads are deleted straight away.

const MB = 1024 * 1024;
export const DAILY_UPLOAD_BYTES = (Number(process.env.UPLOAD_DAILY_MB) || 100) * MB;

const filesOf = (req) => [
    ...(req.file ? [req.file] : []),
    ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat()),
];

export async function enforceUploadQuota(req, res, next) {
    const files = filesOf(req);
    const userId = req.user?.id;
    if (!files.length || !userId) return next();
    const total = files.reduce((n, f) => n + (f.size || 0), 0);
    const day = new Date().toISOString().slice(0, 10);
    try {
        const usage = await UploadUsage.findOneAndUpdate(
            { key: String(userId), day },
            { $inc: { bytes: total }, $setOnInsert: { expiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000) } },
            { upsert: true, new: true },
        );
        if (usage.bytes <= DAILY_UPLOAD_BYTES) return next();
        await UploadUsage.updateOne({ _id: usage._id }, { $inc: { bytes: -total } });
    } catch (err) {
        console.error('[Uploads] quota check failed:', err?.message);
        return next();   // never block uploads because the quota store is unavailable
    }
    await Promise.all(files.map(f => fs.promises.unlink(f.path).catch(() => {})));
    res.status(429).json({ error: `You can upload up to ${Math.round(DAILY_UPLOAD_BYTES / MB)} MB of files a day. Please try again tomorrow, or contact support if you need to send more.` });
}
