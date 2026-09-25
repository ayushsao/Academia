import crypto from 'crypto';
import QRCode from 'qrcode';
import { TWO_FACTOR_KEY } from '../config.js';

// Admin two-factor authentication: time-based one-time codes (RFC 6238, the
// 6-digit codes in Google Authenticator, Microsoft Authenticator, Authy, 1Password…)
// plus single-use recovery codes. Secrets are encrypted at rest (AES-256-GCM);
// recovery codes are stored only as hashes.

const ISSUER = 'AssignmentMinds Admin';
const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
    let bits = 0, value = 0, out = '';
    for (const byte of buf) {
        value = (value << 8) | byte; bits += 8;
        while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out;
}

export function base32Decode(str) {
    const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0, value = 0; const out = [];
    for (const ch of clean) {
        value = (value << 5) | B32.indexOf(ch); bits += 5;
        if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return Buffer.from(out);
}

export const newSecret = () => base32Encode(crypto.randomBytes(20));   // 160-bit, as RFC 4226 recommends

/** The code for a given 30-second step (exported for tests). */
export function totpAt(secretB32, step) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const hmac = crypto.createHmac('sha1', base32Decode(secretB32)).update(counter).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const bin = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
    return String(bin).padStart(DIGITS, '0');
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/**
 * Checks a 6-digit code, allowing one step of clock drift either way. Returns
 * the matched step, or null. Steps at or before `lastUsedStep` are refused so a
 * code can't be used twice.
 */
export function verifyTotp(secretB32, code, { lastUsedStep = -1, now = Date.now() } = {}) {
    const clean = String(code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) return null;
    const step = currentStep(now);
    for (const s of [step, step - 1, step + 1]) {
        if (s <= lastUsedStep) continue;
        const expected = Buffer.from(totpAt(secretB32, s));
        if (crypto.timingSafeEqual(expected, Buffer.from(clean))) return s;
    }
    return null;
}

// ── Secret storage (AES-256-GCM) ──────────────────────────────────────────────
const key = crypto.createHash('sha256').update(`2fa:${TWO_FACTOR_KEY}`).digest();

export function encryptSecret(secretB32) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(secretB32, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}

export function decryptSecret(stored) {
    const [iv, tag, enc] = String(stored).split('.').map(p => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ── Recovery codes ───────────────────────────────────────────────────────────
const hashCode = (code) => crypto.createHash('sha256').update(`recovery:${String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')}`).digest('hex');

/** Ten single-use codes like "K7Q2-M9XD"; returns { codes (show once), hashes (store) }. */
export function newRecoveryCodes(n = 10) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I
    const codes = Array.from({ length: n }, () => {
        const raw = Array.from(crypto.randomBytes(8), b => alphabet[b % alphabet.length]).join('');
        return `${raw.slice(0, 4)}-${raw.slice(4)}`;
    });
    return { codes, hashes: codes.map(hashCode) };
}

/** Returns the remaining hashes if `code` matched one (it is consumed), else null. */
export function consumeRecoveryCode(hashes, code) {
    const h = hashCode(code);
    const i = (hashes || []).findIndex(x => x.length === h.length && crypto.timingSafeEqual(Buffer.from(x), Buffer.from(h)));
    return i === -1 ? null : hashes.filter((_, j) => j !== i);
}

/** What the admin scans: otpauth URL, a QR code rendered here (never by a third party), and the key. */
export async function setupPayload(secretB32, username) {
    const label = encodeURIComponent(`${ISSUER}:${username}`);
    const otpauthUrl = `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
    return { secret: secretB32.replace(/(.{4})/g, '$1 ').trim(), otpauthUrl, qrDataUrl };
}
