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

// Coupons offered until an admin saves their own list in Admin → Settings.
export const DEFAULT_COUPONS = [
    { code: 'NEWONE', percent: 10, active: true },
    { code: 'FLAT10', percent: 10, active: true },
    { code: 'GRAB10', percent: 10, active: true },
];

/** Every coupon (active or not): the admin's saved list, else the defaults. */
export async function listCoupons() {
    const saved = await SiteSettings.findOne({ key: 'coupons' }).lean();
    return Array.isArray(saved?.value) ? saved.value : DEFAULT_COUPONS;
}

/** The coupon for a code the customer typed; throws CouponError when it isn't valid. */
export async function findCoupon(input) {
    const code = String(input || '').trim().toUpperCase();
    if (!code) return null;
    const coupon = (await listCoupons()).find(c => c.active && String(c.code).toUpperCase() === code);
    const percent = Number(coupon?.percent) || 0;
    if (!coupon || !(percent > 0 && percent <= 100)) throw new CouponError('This coupon code is not valid or has expired.');
    return { code, percent };
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
