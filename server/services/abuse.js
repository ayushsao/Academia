import crypto from 'crypto';
import { Writer, WriterProfile, WriterDocument, SubscriptionPayment, AssignmentRating, RiskEvent, LoginThrottle } from '../db.js';
import { FINGERPRINT_SECRET } from '../config.js';

// Trust & safety. Clear-cut abuse is blocked at the point it happens (disposable
// or aliased duplicate emails, reused payment references, contact details in
// public profiles, brute-force sign-in). Grey areas are recorded as RiskEvents
// for HR/Finance to review, and summarised on Writer.risk for list filtering.
// Summaries never include full contact details or secrets.

export class AbuseError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

// ── Identity signals ────────────────────────────────────────────────────────

const DOMAIN_ALIASES = { 'googlemail.com': 'gmail.com' };
const DOT_INSENSITIVE = new Set(['gmail.com']);
const PLUS_TAGGED = new Set(['gmail.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me', 'fastmail.com', 'yahoo.com']);

// The mailbox an address actually delivers to: jane.doe+x@googlemail.com → janedoe@gmail.com.
export function canonicalEmail(email) {
    const [rawLocal = '', rawDomain = ''] = String(email).trim().toLowerCase().split('@');
    const domain = DOMAIN_ALIASES[rawDomain] || rawDomain;
    let local = rawLocal;
    if (PLUS_TAGGED.has(domain)) local = local.split(domain === 'yahoo.com' ? '-' : '+')[0];
    if (DOT_INSENSITIVE.has(domain)) local = local.replace(/\./g, '');
    return `${local}@${domain}`;
}

// Common throwaway-inbox providers; extend with DISPOSABLE_EMAIL_DOMAINS (comma-separated).
const DISPOSABLE = new Set([
    'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', '10minutemail.com', '10minutemail.net', 'temp-mail.org',
    'tempmail.com', 'tempmailo.com', 'throwawaymail.com', 'yopmail.com', 'yopmail.net', 'getnada.com', 'nada.email', 'trashmail.com',
    'dispostable.com', 'maildrop.cc', 'mintemail.com', 'mohmal.com', 'fakeinbox.com', 'emailondeck.com', 'mailnesia.com', 'mytemp.email',
    'tempinbox.com', 'burnermail.io', 'spamgourmet.com', 'tempr.email', 'discard.email', 'moakt.com', 'mailcatch.com', 'inboxkitten.com',
    'emailfake.com', 'luxusmail.org', 'minuteinbox.com', 'tmpmail.org', 'tmpmail.net', 'dropmail.me', 'mail.tm', 'mailpoof.com', 'spambox.us',
    ...(process.env.DISPOSABLE_EMAIL_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
]);
export const isDisposableEmail = (email) => {
    const domain = String(email).trim().toLowerCase().split('@')[1] || '';
    return [...DISPOSABLE].some(d => domain === d || domain.endsWith(`.${d}`));
};

// Keyed hash so accounts can be linked by IP without storing the IP itself.
export const fingerprint = (value) => (value ? crypto.createHmac('sha256', FINGERPRINT_SECRET).update(String(value)).digest('hex').slice(0, 32) : '');

// ── Risk events ──────────────────────────────────────────────────────────────

const WEIGHT = { LOW: 10, MEDIUM: 25, HIGH: 50 };
const levelFor = (score) => (score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : score > 0 ? 'LOW' : 'NONE');

// Upserts one signal; repeated detections bump `occurrences` instead of duplicating.
// A dismissed signal stays dismissed unless it comes back at a higher severity.
export async function recordRisk({ kind, severity, writerId = null, userId = null, relatedWriterIds = [], summary, dedupeKey }) {
    try {
        const existing = await RiskEvent.findOne({ kind, dedupeKey }).select('status severity').lean();
        const escalate = existing?.status === 'DISMISSED' && WEIGHT[severity] > WEIGHT[existing.severity];
        await RiskEvent.updateOne({ kind, dedupeKey }, {
            $setOnInsert: { writerId, userId, status: 'OPEN' },
            $set: { severity: existing && !escalate && WEIGHT[existing.severity] > WEIGHT[severity] ? existing.severity : severity, summary, lastSeenAt: new Date(), ...(escalate ? { status: 'OPEN' } : {}) },
            $addToSet: { relatedWriterIds: { $each: relatedWriterIds.filter(Boolean) } },
            $inc: { occurrences: 1 },
        }, { upsert: true });
        if (writerId) await refreshRiskSummary(writerId);
    } catch (err) {
        // Detection must never break the user-facing action.
        console.error('[Abuse] could not record risk:', err.message);
    }
}

export async function refreshRiskSummary(writerId) {
    const events = await RiskEvent.find({ writerId, status: { $in: ['OPEN', 'CONFIRMED'] } }).select('kind severity status').lean();
    const score = Math.min(100, events.reduce((s, e) => s + WEIGHT[e.severity] * (e.status === 'CONFIRMED' ? 2 : 1), 0));
    await Writer.updateOne({ _id: writerId }, { $set: { risk: { score, level: levelFor(score), flags: [...new Set(events.map(e => e.kind))], updatedAt: new Date() } } });
}

// ── Registration ─────────────────────────────────────────────────────────────

const GENERIC_DUPLICATE = 'We could not create an account with these details. If you already have an account, please sign in.';

// Runs before a writer account is created. Throws AbuseError to refuse.
export async function checkRegistration({ email, phoneE164 }) {
    if (isDisposableEmail(email)) throw new AbuseError('Please use a permanent email address. Temporary inbox services can’t be used for writer accounts.');
    // Aliases of an existing writer's mailbox (dots, +tags, googlemail) are the same person.
    if (await Writer.exists({ emailCanonical: canonicalEmail(email) })) throw new AbuseError(GENERIC_DUPLICATE, 409);
    if (phoneE164 && await Writer.exists({ phoneE164, phoneVerified: true })) throw new AbuseError(GENERIC_DUPLICATE, 409);
}

// Runs after the account exists: records softer signals for review.
export async function afterRegistration(writer, { ip } = {}) {
    const others = await Writer.find({ _id: { $ne: writer._id }, phoneE164: writer.phoneE164 }).select('_id').limit(10).lean();
    if (others.length) {
        await recordRisk({
            kind: 'DUPLICATE_PHONE', severity: 'MEDIUM', writerId: writer._id, userId: writer.userId, relatedWriterIds: others.map(o => o._id),
            summary: `Phone number ending ${String(writer.phoneE164).slice(-3)} is also on ${others.length} other unverified writer account(s).`,
            dedupeKey: `phone:${writer._id}`,
        });
    }
    if (writer.signupIpHash) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const sameIp = await Writer.find({ _id: { $ne: writer._id }, signupIpHash: writer.signupIpHash, createdAt: { $gte: since } }).select('_id').limit(20).lean();
        if (sameIp.length >= 2) {
            await recordRisk({
                kind: 'SHARED_SIGNUP_IP', severity: sameIp.length >= 4 ? 'HIGH' : 'MEDIUM', writerId: writer._id, userId: writer.userId,
                relatedWriterIds: sameIp.map(o => o._id),
                summary: `${sameIp.length + 1} writer accounts were created from the same network in 24 hours.`,
                dedupeKey: `ip:${writer._id}`,
            });
        }
    }
}

// ── Profiles ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+|\b)\d[\d\s()-]{7,}\d/g;
const HANDLE_RE = /\b(?:whats\s*app|telegram|skype|wechat|signal|viber)\b\s*[:@-]?\s*[+@\w]|\b(?:wa\.me|t\.me)\//i;
const LINK_RE = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|me|info|biz|xyz|link|site|online)\b/i;
// Phone-shaped numbers only: international (+/00) or trunk-prefixed (0…) numbers,
// or a bare 10-digit mobile. ISBNs, DOIs and year ranges don't match.
const phoneLike = (s) => (String(s).match(PHONE_RE) || []).some(m => {
    const t = m.trim(), digits = t.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) return false;
    return /^(?:\+|00|0)/.test(t) || /^[6-9]\d{9}$/.test(t);
});

const publicText = (p) => [p.headline, p.bio, p.writingExperience, ...(p.expertiseAreas || []), ...(p.subjects || [])].filter(Boolean).join('\n');

// Contact details in a public profile would let clients bypass the platform and
// expose the writer's private details, so they are refused outright.
export function assertNoContactDetails(profile) {
    const text = publicText(profile);
    if (EMAIL_RE.test(text) || phoneLike(text) || HANDLE_RE.test(text)) {
        throw new AbuseError('Please remove email addresses, phone numbers and messaging handles from your profile. Clients contact you through AssignmentMinds, and your contact details stay private.');
    }
}

export const bioFingerprint = (bio) => {
    const normalized = String(bio || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    return normalized.length >= 80 ? crypto.createHash('sha256').update(normalized).digest('hex') : '';
};

// After a profile save: links and copy-pasted bios are flagged for review.
export async function afterProfileSaved(writer, profile) {
    if (LINK_RE.test(publicText(profile))) {
        await recordRisk({ kind: 'LINKS_IN_PROFILE', severity: 'LOW', writerId: writer._id, userId: writer.userId, summary: 'Public profile contains web links or domain names.', dedupeKey: `links:${writer._id}` });
    }
    if (profile.bioHash) {
        const copies = await WriterProfile.find({ bioHash: profile.bioHash, writerId: { $ne: writer._id } }).select('writerId').limit(10).lean();
        if (copies.length) {
            await recordRisk({
                kind: 'DUPLICATE_BIO', severity: 'MEDIUM', writerId: writer._id, userId: writer.userId, relatedWriterIds: copies.map(c => c.writerId),
                summary: `Profile bio is identical to ${copies.length} other writer profile(s).`, dedupeKey: `bio:${writer._id}:${profile.bioHash}`,
            });
        }
    }
}

// After an upload: the same file under different writer accounts suggests
// shared or borrowed credentials.
export async function afterDocumentUploaded(writer, doc) {
    const copies = await WriterDocument.find({ sha256: doc.sha256, writerId: { $ne: writer._id } }).select('writerId').limit(10).lean();
    if (!copies.length) return;
    const credential = ['RESUME', 'CERTIFICATE'].includes(doc.type);
    await recordRisk({
        kind: 'DUPLICATE_DOCUMENT', severity: credential ? 'HIGH' : 'MEDIUM', writerId: writer._id, userId: writer.userId,
        relatedWriterIds: [...new Set(copies.map(c => String(c.writerId)))],
        summary: `An uploaded ${doc.type.toLowerCase().replace('_', ' ')} is byte-for-byte identical to a file on ${copies.length} other writer account(s).`,
        dedupeKey: `doc:${writer._id}:${doc.sha256}`,
    });
}

// ── Payments ─────────────────────────────────────────────────────────────────

export const paymentReferenceKey = (ref) => String(ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// A bank/UPI/PayPal transaction ID identifies one payment. Reusing one that is
// awaiting verification or already accepted is refused.
export async function assertReferenceUnused(payment, reference) {
    const key = paymentReferenceKey(reference);
    if (key.length < 6) return key;
    const clash = await SubscriptionPayment.findOne({ _id: { $ne: payment._id }, 'manual.referenceKey': key, status: { $in: ['PENDING_VERIFICATION', 'PAID'] } })
        .select('writerId paymentRef').lean();
    if (clash) {
        const other = String(clash.writerId) !== String(payment.writerId);
        await recordRisk({
            kind: 'PAYMENT_REFERENCE_REUSED', severity: other ? 'HIGH' : 'MEDIUM', writerId: payment.writerId,
            relatedWriterIds: other ? [clash.writerId] : [],
            summary: `Submitted a transaction reference already used on payment ${clash.paymentRef}${other ? ' by a different writer' : ''}.`,
            dedupeKey: `ref:${payment._id}:${key}`,
        });
        throw new AbuseError('This transaction reference has already been submitted. Please check it, or contact support if you believe this is a mistake.', 409);
    }
    return key;
}

// Many checkouts in a short time (cycling plans/currencies for a better price,
// card testing) are flagged for Finance.
export async function afterCheckout(writer) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const n = await SubscriptionPayment.countDocuments({ writerId: writer._id, createdAt: { $gte: since } });
    if (n >= 6) {
        await recordRisk({
            kind: 'CHECKOUT_CHURN', severity: n >= 12 ? 'MEDIUM' : 'LOW', writerId: writer._id, userId: writer.userId,
            summary: `${n} membership checkouts started in 24 hours.`, dedupeKey: `churn:${writer._id}:${since.toISOString().slice(0, 10)}`,
        });
    }
}

// ── Ratings ──────────────────────────────────────────────────────────────────

// Ratings are admin-only and one per assignment already; this watches for
// patterns that suggest favouritism or score fixing.
export async function afterRating(rating, { previous } = {}) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const mine = await AssignmentRating.find({ ratedBy: rating.ratedBy, writerId: rating.writerId, createdAt: { $gte: since } }).select('overall').lean();
    const avg = mine.reduce((s, r) => s + r.overall, 0) / (mine.length || 1);
    if (mine.length >= 5 && avg >= 4.8) {
        await recordRisk({
            kind: 'RATING_ANOMALY', severity: 'MEDIUM', writerId: rating.writerId,
            summary: `One admin gave this writer ${mine.length} near-perfect ratings (avg ${avg.toFixed(2)}) in 30 days.`,
            dedupeKey: `rating-streak:${rating.ratedBy}:${rating.writerId}`,
        });
    }
    if (previous && previous.overall <= 2.5 && rating.overall >= 4) {
        await recordRisk({
            kind: 'RATING_ANOMALY', severity: 'MEDIUM', writerId: rating.writerId,
            summary: `A rating was edited from ${previous.overall.toFixed(1)} to ${rating.overall.toFixed(1)}.`, dedupeKey: `rating-flip:${rating._id}`,
        });
    }
    if ((rating.edits?.length || 0) >= 3) {
        await recordRisk({
            kind: 'RATING_ANOMALY', severity: 'LOW', writerId: rating.writerId,
            summary: `A rating has been edited ${rating.edits.length} times.`, dedupeKey: `rating-edits:${rating._id}`,
        });
    }
}

// ── Sign-in throttling (per account, across all IPs) ─────────────────────────

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;

export async function assertNotLocked(key) {
    const t = await LoginThrottle.findOne({ key }).lean();
    if (t?.lockedUntil && t.lockedUntil > new Date()) {
        const minutes = Math.ceil((t.lockedUntil - Date.now()) / 60000);
        throw new AbuseError(`Too many failed sign-in attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'} or reset your password.`, 429);
    }
}

export async function recordLoginFailure(key, { writerId, userId } = {}) {
    const now = new Date();
    const t = await LoginThrottle.findOne({ key });
    if (!t || now - t.firstFailureAt > WINDOW_MS) {
        await LoginThrottle.updateOne({ key }, { $set: { failures: 1, firstFailureAt: now, lockedUntil: null, expiresAt: new Date(now.getTime() + WINDOW_MS + LOCK_MS) } }, { upsert: true });
        return;
    }
    t.failures += 1;
    t.expiresAt = new Date(now.getTime() + WINDOW_MS + LOCK_MS);
    if (t.failures >= MAX_FAILURES) {
        t.lockedUntil = new Date(now.getTime() + LOCK_MS);
        if (writerId) await recordRisk({ kind: 'LOGIN_LOCKOUT', severity: 'LOW', writerId, userId, summary: `Account locked after ${t.failures} failed sign-in attempts.`, dedupeKey: `lock:${writerId}:${now.toISOString().slice(0, 13)}` });
    }
    await t.save();
}

export const clearLoginFailures = (key) => LoginThrottle.deleteOne({ key });
