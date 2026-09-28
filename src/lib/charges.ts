import { currencyDigits } from './money';

// What the customer pays on top of the quoted price — the same rule as the
// server (server/services/charges.js), which recalculates it for every order:
//   Subtotal → Coupon Discount → Tax → Final Total
// Normal payment carries TAX_PERCENT; orders arranged on WhatsApp carry no tax.

export const TAX_PERCENT = 9;

export type PayChannel = 'STANDARD' | 'WHATSAPP';
export type Coupon = { code: string; percent: number };

export type Charges = {
    channel?: PayChannel; currency: string;
    subtotalMinor: number; couponCode: string; discountPercent: number; discountMinor: number;
    taxPercent: number; taxMinor: number; totalMinor: number;
};

export const toMinor = (major: number, currency: string) => Math.round(major * 10 ** currencyDigits(currency));

export function computeCharges(subtotalMinor: number, currency: string, coupon: Coupon | null, channel: PayChannel): Charges {
    const discountMinor = coupon ? Math.round((subtotalMinor * coupon.percent) / 100) : 0;
    const taxableMinor = subtotalMinor - discountMinor;
    const taxPercent = channel === 'WHATSAPP' ? 0 : TAX_PERCENT;
    const taxMinor = Math.round((taxableMinor * taxPercent) / 100);
    return {
        channel, currency, subtotalMinor,
        couponCode: coupon?.code || '', discountPercent: coupon?.percent || 0, discountMinor,
        taxPercent, taxMinor, totalMinor: taxableMinor + taxMinor,
    };
}

/** Rows for Subtotal → Coupon Discount → Tax → Final Total (amounts in minor units; discount negative). */
export function chargeRows(c: Charges) {
    return [
        { key: 'subtotal', label: 'Subtotal', minor: c.subtotalMinor },
        { key: 'discount', label: `Coupon Discount${c.couponCode ? ` (${c.couponCode} · ${c.discountPercent}%)` : ''}`, minor: -c.discountMinor },
        { key: 'tax', label: `Tax (${c.taxPercent}%)`, minor: c.taxMinor },
        { key: 'total', label: 'Final Total', minor: c.totalMinor },
    ];
}

/** Payment status shown to customers and admins: Paid, Failed or Pending. */
export function paymentState(payment?: { status?: string } | null): 'PAID' | 'FAILED' | 'PENDING' {
    if (payment?.status === 'PAID') return 'PAID';
    if (payment?.status === 'FAILED') return 'FAILED';
    return 'PENDING';
}
