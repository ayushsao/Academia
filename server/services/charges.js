import { SiteSettings } from '../db.js';

// What a customer pays for an order, on top of its quoted price:
//   Subtotal → Coupon Discount → Tax → Final Total
// The discount comes off the subtotal first; tax is charged on what is left.
// Normal payment (Razorpay, UPI QR, manual UPI / PayPal) carries TAX_PERCENT;
// orders arranged over WhatsApp carry no tax. All amounts are minor units.

export const TAX_PERCENT = 9;
export const CHANNELS = ['STANDARD', 'WHATSAPP'];

export class CouponError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

/** The coupon set in Admin → Settings, or null when none is switched on. */
export async function activeCoupon() {
    const rows = await SiteSettings.find({ key: { $in: ['discount_code', 'discount_percent', 'discount_active'] } }).lean();
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const code = String(s.discount_code || '').trim().toUpperCase();
    const percent = Number(s.discount_percent) || 0;
    if (!code || s.discount_active !== true || !(percent > 0 && percent <= 100)) return null;
    return { code, percent };
}

/** The coupon for a code the customer typed; throws CouponError when it isn't valid. */
export async function findCoupon(input) {
    const code = String(input || '').trim().toUpperCase();
    if (!code) return null;
    const coupon = await activeCoupon();
    if (!coupon || coupon.code !== code) throw new CouponError('This coupon code is not valid or has expired.');
    return coupon;
}

export function computeCharges({ subtotalMinor, coupon, channel = 'STANDARD', currency }) {
    const discountMinor = coupon ? Math.round((subtotalMinor * coupon.percent) / 100) : 0;
    const taxableMinor = subtotalMinor - discountMinor;
    const taxPercent = channel === 'WHATSAPP' ? 0 : TAX_PERCENT;
    const taxMinor = Math.round((taxableMinor * taxPercent) / 100);
    return {
        channel, currency,
        subtotalMinor,
        couponCode: coupon?.code || '', discountPercent: coupon?.percent || 0, discountMinor,
        taxPercent, taxMinor,
        totalMinor: taxableMinor + taxMinor,
    };
}
