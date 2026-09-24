import crypto from 'crypto';

// Payment providers for writer memberships.
//   RAZORPAY — card/UPI/netbanking checkout, verified server-side (enabled when keys are set).
//   MANUAL   — the site's existing practice: pay by UPI/PayPal/bank and submit the
//              reference, which an admin verifies before activation.

const RZP_BASE = (process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1').replace(/\/+$/, '');
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RZP_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

export class PaymentProviderError extends Error {
    constructor(message, status = 502) { super(message); this.status = status; }
}

export const razorpayEnabled = () => Boolean(RZP_KEY_ID && RZP_KEY_SECRET);
export const razorpayKeyId = () => RZP_KEY_ID;
// Razorpay's minimum charge is 100 minor units in every currency it supports.
export const RAZORPAY_MIN_MINOR = 100;

async function rzp(method, path, body) {
    const res = await fetch(`${RZP_BASE}${path}`, {
        method,
        headers: {
            Authorization: `Basic ${Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64')}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        console.error(`[Razorpay] ${method} ${path} → ${res.status}`, data?.error?.description || '');
        throw new PaymentProviderError(data?.error?.description || 'The payment provider rejected the request.');
    }
    return data;
}

export async function createRazorpayOrder({ amountMinor, currency, receipt, notes }) {
    if (!razorpayEnabled()) throw new PaymentProviderError('Online payments are not configured.', 503);
    if (amountMinor < RAZORPAY_MIN_MINOR) throw new PaymentProviderError('Amount is below the minimum for online payment.', 400);
    return rzp('POST', '/orders', { amount: amountMinor, currency, receipt, notes });
}

const safeEqualHex = (a, b) => {
    const x = Buffer.from(String(a), 'utf8'), y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Checkout callback signature: HMAC_SHA256(order_id|payment_id, key_secret).
export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
    const expected = crypto.createHmac('sha256', RZP_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
    return safeEqualHex(expected, signature);
}

// Webhook signature: HMAC_SHA256(raw body, webhook secret).
export function verifyRazorpayWebhook(rawBody, signature) {
    if (!RZP_WEBHOOK_SECRET || !signature) return false;
    const expected = crypto.createHmac('sha256', RZP_WEBHOOK_SECRET).update(rawBody).digest('hex');
    return safeEqualHex(expected, signature);
}

// Re-fetches the payment from Razorpay and confirms it is captured for exactly
// the expected order, amount and currency. Captures authorised payments.
export async function confirmRazorpayPayment({ paymentId, orderId, amountMinor, currency }) {
    let payment = await rzp('GET', `/payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== orderId) throw new PaymentProviderError('Payment does not belong to this order.', 400);
    if (payment.amount !== amountMinor || payment.currency !== currency)
        throw new PaymentProviderError('Payment amount or currency does not match the invoice.', 400);
    if (payment.status === 'authorized') {
        payment = await rzp('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountMinor, currency });
    }
    if (payment.status !== 'captured') throw new PaymentProviderError(`Payment is ${payment.status}, not captured.`, 402);
    return payment;
}
