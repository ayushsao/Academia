import { openFile } from './fileStore.js';

// Writer profile photos are uploaded at up to 5 MB, but they're shown as small
// avatars. Each photo is read from storage once, resized to a 320×320 WebP
// (~10–30 KB) and kept in memory, so lists of writers load quickly and don't
// depend on a storage round trip for every view.

const SIZE = 320;
const MAX_CACHE_BYTES = 30 * 1024 * 1024;
// A crop whose colours barely vary is a plain patch (a wall, paper): no face in it.
const FLAT_STDEV = 8;
/** Returned for a photo with nothing in it: shown as initials, like no photo. */
export const BLANK_PHOTO = Object.freeze({ blank: true });
const cache = new Map();   // storedName -> { body: Buffer, type: string }
let cachedBytes = 0;

let sharpLoader = null;
const loadSharp = () => (sharpLoader ||= import('sharp').then(m => m.default).catch(err => {
    console.warn('[Photos] sharp is unavailable; serving original photos:', err?.message);
    return null;
}));

function remember(key, value) {
    cache.set(key, value);
    cachedBytes += value.body?.length || 0;
    // Least recently used first: Map keeps insertion order and hits re-insert.
    for (const [k, v] of cache) {
        if (cachedBytes <= MAX_CACHE_BYTES) break;
        cache.delete(k); cachedBytes -= v.body?.length || 0;
    }
}

const isFlat = async (sharp, image) => {
    const { channels } = await sharp(image).stats();
    return Math.max(...channels.slice(0, 3).map(c => c.stdev)) < FLAT_STDEV;
};

/**
 * { body, type } for a stored photo, resized for display; BLANK_PHOTO when the
 * photo has nothing in it; null when the file is missing.
 */
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
            const square = (position) => sharp(original).rotate().resize(SIZE, SIZE, { fit: 'cover', position }).webp({ quality: 80 }).toBuffer();
            // 'attention' looks for the most detailed part, usually the face. Now and
            // then that is a patch of textured background instead: then the centre is used.
            let body = await square('attention');
            if (await isFlat(sharp, body)) body = await square('centre');
            const whole = await isFlat(sharp, body) && await isFlat(sharp, await sharp(original).rotate().resize(SIZE, SIZE, { fit: 'inside' }).toBuffer());
            if (whole) console.warn(`[Photos] ${storedName} is a plain image with no detail; showing initials instead.`);
            result = whole ? BLANK_PHOTO : { body, type: 'image/webp' };
        } catch (err) { console.warn(`[Photos] could not resize ${storedName}:`, err?.message); }
    }
    remember(storedName, result);
    return result;
}
