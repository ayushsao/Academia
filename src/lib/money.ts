// Amounts from the API are integer minor units. Minor digits per currency come
// from Intl so any ISO 4217 currency formats correctly.

export const currencyDigits = (currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;

export const fromMinor = (minor: number, currency: string) => minor / 10 ** currencyDigits(currency);

export function formatMoney(minor: number, currency: string, opts: { compact?: boolean } = {}) {
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency', currency,
            ...(opts.compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
        }).format(fromMinor(minor, currency));
    } catch {
        return `${fromMinor(minor, currency)} ${currency}`;
    }
}

// Order totals are stored in major units; orders without a currency are legacy GBP orders.
export function formatOrderTotal(amount: number, currency?: string) {
    if (!currency || currency === 'GBP') return `£${amount}`;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); } catch { return `${amount} ${currency}`; }
}

export const currencyName = (code: string) => {
    try { return new Intl.DisplayNames([navigator.language || 'en'], { type: 'currency' }).of(code) || code; } catch { return code; }
};

export const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
