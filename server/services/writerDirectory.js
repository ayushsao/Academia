import { User, Writer, WriterProfile, WriterSkill, WriterAvailability } from '../db.js';
import { cacheDel, cacheDelPattern } from './cache.js';

// Writer.directory is an indexed snapshot of the profile, skills and availability
// fields that the public directory and admin search filter on. Keeping it on the
// Writer document turns each listing into a single indexed query with skip/limit,
// instead of joining every profile on every request.

const MAX_TOKENS = 120;

// Lowercase words (letters/digits, any script) of at least 2 characters.
export function tokenize(...values) {
    const out = new Set();
    for (const v of values.flat()) {
        if (!v) continue;
        for (const w of String(v).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}]+/u)) {
            if (w.length >= 2) out.add(w);
        }
    }
    return [...out].slice(0, MAX_TOKENS);
}

// Turns a free-text query into anchored, index-friendly prefix matches: every
// word must prefix-match one of the stored tokens.
export function prefixTerms(query, max = 5) {
    return tokenize(query).slice(0, max).map(w => new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
}

export async function buildDirectory(writerId) {
    const writer = await Writer.findById(writerId).select('userId');
    if (!writer) return null;
    const [user, profile, skills, availability] = await Promise.all([
        User.findById(writer.userId).select('name email').lean(),
        WriterProfile.findOne({ writerId }).lean(),
        WriterSkill.find({ writerId }).select('name slug').lean(),
        WriterAvailability.findOne({ writerId }).lean(),
    ]);
    const lower = (list) => [...new Set((list || []).map(s => String(s).trim().toLowerCase()).filter(Boolean))];
    const override = availability?.adminOverride?.active ? availability.adminOverride.status : null;
    const email = (user?.email || '').toLowerCase();
    return {
        directory: {
            visible: profile?.visibility === 'PUBLIC',
            available: (override || availability?.status || 'AVAILABLE') === 'AVAILABLE',
            country: profile?.country || '',
            subjects: lower([...(profile?.subjects || []), ...(profile?.expertiseAreas || [])]),
            levels: profile?.academicLevels || [],
            skills: [...new Set(skills.map(s => s.slug))],
            tokens: tokenize(user?.name, profile?.headline, profile?.subjects, profile?.expertiseAreas, skills.map(s => s.name)),
            yearsExperience: profile?.yearsExperience || 0,
            refreshedAt: new Date(),
        },
        // Admin-only: never used by public endpoints.
        searchKeys: [...new Set([...tokenize(user?.name), email, email.split('@')[0]].filter(Boolean))],
    };
}

export async function refreshWriterDirectory(writerId) {
    const snapshot = await buildDirectory(writerId);
    if (snapshot) await Writer.updateOne({ _id: writerId }, { $set: snapshot });
    // Invalidate Redis cache for this writer's profile and public directory listings
    await Promise.all([
        cacheDel(`writers:profile:${writerId}`),
        cacheDelPattern('writers:public:'),
    ]).catch(() => {});
    return snapshot;
}

// Hooks can fire several times for one request (e.g. deleteMany + insertMany of
// skills); coalesce them into one refresh per writer per tick.
const pending = new Map();
export function scheduleDirectoryRefresh(writerId) {
    const key = String(writerId);
    if (pending.has(key)) return pending.get(key);
    const p = new Promise(resolve => setImmediate(resolve))
        .then(() => { pending.delete(key); return refreshWriterDirectory(key); })
        .catch(err => { pending.delete(key); console.error('[Directory] refresh failed:', err.message); });
    pending.set(key, p);
    return p;
}

// Awaits any refreshes queued for these writers (used where a response must reflect them).
export const settleDirectory = (writerIds = [...pending.keys()]) =>
    Promise.all(writerIds.map(id => pending.get(String(id))).filter(Boolean));

export async function refreshForUser(userId) {
    const writer = await Writer.findOne({ userId }).select('_id');
    if (writer) await scheduleDirectoryRefresh(writer._id);
}

// Builds snapshots for writers created before the directory existed: one pass
// over a cursor, one writer at a time, so start-up stays responsive at scale.
export async function backfillWriterDirectory() {
    let done = 0;
    const cursor = Writer.find({ 'directory.refreshedAt': { $exists: false } }).select('_id').lean().cursor();
    for await (const w of cursor) {
        await refreshWriterDirectory(w._id).catch(err => console.error('[Directory] backfill failed for', String(w._id), err.message));
        done += 1;
    }
    if (done) console.log(`[Directory] backfilled ${done} writer(s).`);
    return done;
}
