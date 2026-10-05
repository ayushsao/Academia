import { openFile } from './fileStore.js';

// Writer profile photos are uploaded at up to 5 MB, but they're shown as small
// avatars. Each photo is read from storage once, resized to a 320×320 WebP
// (~10–30 KB) and kept in memory, so lists of writers load quickly and don't
// depend on a storage round trip for every view.

const SIZE = 320;
const MAX_CACHE_BYTES = 30 * 1024 * 1024;
const cache = new Map();   // storedName -> { body: Buffer, type: string }
let cachedBytes = 0;

let sharpLoader = null;
const loadSharp = () => (sharpLoader ||= import('sharp').then(m => m.default).catch(err => {
    console.warn('[Photos] sharp is unavailable; serving original photos:', err?.message);
    return null;
}));

function remember(key, value) {
    cache.set(key, value);
    cachedBytes += value.body.length;
    // Least recently used first: Map keeps insertion order and hits re-insert.
    for (const [k, v] of cache) {
        if (cachedBytes <= MAX_CACHE_BYTES) break;
        cache.delete(k); cachedBytes -= v.body.length;
    }
}

/** { body, type } for a stored photo, resized for display; null when the file is missing. */
export async function photoForDisplay(storedName, originalType) {
    const hit = cache.get(storedName);
    if (hit) { cache.delete(storedName); cache.set(storedName, hit); return hit; }

    const stream = await openFile('writers', storedName);
    if (!stream) return null;
    const chunks = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    const original = Buffer.concat(chunks);

    let result = { body: original, type: originalType };
    const sharp = await loadSharp();
    if (sharp) {
        try {
            const body = await sharp(original).rotate().resize(SIZE, SIZE, { fit: 'cover', position: 'attention' }).webp({ quality: 80 }).toBuffer();
            result = { body, type: 'image/webp' };
        } catch (err) { console.warn(`[Photos] could not resize ${storedName}:`, err?.message); }
    }
    remember(storedName, result);
    return result;
}
