import crypto from 'crypto';

// Central place for security-sensitive configuration. Secret values are read
// from the environment only and are never logged or sent to clients.

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Defaults that were once committed to the repository. They're public, so in
// production they're treated as if no secret were set at all.
const PUBLIC_DEFAULTS = {
    JWT_SECRET: 'academiapro_secret_key_2025',
    ADMIN_SECRET: 'academiapro_admin_2025',
};

const warnings = [];

function secret(name) {
    const value = (process.env[name] || '').trim();
    if (value && value !== PUBLIC_DEFAULTS[name]) return value;
    if (!IS_PRODUCTION) return PUBLIC_DEFAULTS[name] || `dev-only-${name}`;
    // Production without a usable secret: never fall back to a known value (that
    // would let anyone forge sessions). A random per-process secret keeps the
    // app secure; the cost is that sign-ins don't survive a restart.
    warnings.push(`${name} is not set (or uses the old public default). A random value is being used, so everyone is signed out whenever the server restarts. Set ${name} in the environment.`);
    return crypto.randomBytes(48).toString('hex');
}

export const JWT_SECRET = secret('JWT_SECRET');
export const ADMIN_SECRET = secret('ADMIN_SECRET');
// Keyed hashing for OTP codes and anti-abuse fingerprints (IP addresses).
export const OTP_SECRET = (process.env.OTP_SECRET || '').trim() || JWT_SECRET;
export const FINGERPRINT_SECRET = (process.env.FINGERPRINT_SECRET || '').trim() || JWT_SECRET;

// Browser origins allowed to call the API with credentials: the app itself plus
// any extra origins listed in CORS_ORIGINS (comma-separated, e.g. a custom domain).
const normalizeOrigin = (o) => { try { const u = new URL(o.trim()); return `${u.protocol}//${u.host}`; } catch { return ''; } };
export const ALLOWED_ORIGINS = new Set([
    'https://academia-wheat-eta.vercel.app',
    process.env.APP_URL || '',
    ...(process.env.CORS_ORIGINS || '').split(','),
].map(normalizeOrigin).filter(Boolean));

export function isAllowedOrigin(origin) {
    if (!origin) return true;   // same-origin, server-to-server, curl
    const normalized = normalizeOrigin(origin);
    if (!normalized) return false;
    if (ALLOWED_ORIGINS.has(normalized)) return true;
    const { hostname, protocol } = new URL(normalized);
    if (hostname.endsWith('.vercel.app')) return protocol === 'https:';
    // Local development only.
    if (!IS_PRODUCTION && (hostname === 'localhost' || hostname === '127.0.0.1' || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname))) return protocol === 'http:' || protocol === 'https:';
    return false;
}

// Start-up report of configuration problems. Names only, never values.
export function securityWarnings() {
    const list = [...warnings];
    if (IS_PRODUCTION) {
        if (!process.env.MONGO_URI) list.push('MONGO_URI is not set; the default local database URL is being used.');
        if (!process.env.OTP_SECRET) list.push('OTP_SECRET is not set; falling back to JWT_SECRET for one-time code hashing.');
        if (!ALLOWED_ORIGINS.size) list.push('Neither APP_URL nor CORS_ORIGINS is set, so browsers cannot call the API.');
        if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_WEBHOOK_SECRET) list.push('RAZORPAY_WEBHOOK_SECRET is not set; Razorpay webhooks will be rejected.');
        const exposed = Object.keys(process.env).filter(k => k.startsWith('VITE_') && /SECRET|PRIVATE|PASSWORD|API_KEY/i.test(k) && k !== 'VITE_EMAILJS_PUBLIC_KEY');
        if (exposed.length) list.push(`${exposed.join(', ')} ${exposed.length === 1 ? 'is' : 'are'} prefixed VITE_; server secrets must not use that prefix (it is reserved for values that ship to browsers).`);
    }
    return list;
}
