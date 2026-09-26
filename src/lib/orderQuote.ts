import { useEffect, useRef, useState } from 'react';
import { api } from './api';

// Standard-order quotation. Pricing is word-based and calculated only on the
// server (POST /api/orders/quote): the customer sees the delivery type, words,
// pages and the final price in their currency — nothing about how it was worked
// out. The website passes the returned quote from the calculator to the order
// form, so the same total is shown on every step; it is re-quoted only when an
// input changes.

export type Spacing = 'DOUBLE' | 'ONE_HALF' | 'SINGLE';
export type DeliveryType = 'STANDARD' | 'EXPRESS' | 'URGENT' | 'EMERGENCY';
export type OrderQuoteInput = { words: number; spacing: Spacing; deadlineAt: string; currency: string };
export type OrderQuote = {
    input: OrderQuoteInput;
    words: number; spacing: Spacing; spacingLabel: string; wordsPerPage: number; pages: number;
    deliveryType: DeliveryType; deliveryLabel: string; deadlineAt: string;
    currency: string; symbol: string; total: number;
};
export type WordPricingInfo = {
    spacing: { key: Spacing; label: string; wordsPerPage: number }[];
    defaultSpacing: Spacing;
    currencies: { code: string; symbol: string }[];
    deliveryTypes: { key: DeliveryType; label: string; minHours: number }[];
    minNoticeHours: number;
};

// Spacing only turns words into a page count (it never changes the price).
export const SPACING_OPTIONS: { key: Spacing; label: string; wordsPerPage: number }[] = [
    { key: 'DOUBLE', label: 'Double spacing', wordsPerPage: 200 },
    { key: 'ONE_HALF', label: '1.5 spacing', wordsPerPage: 250 },
    { key: 'SINGLE', label: 'Single spacing', wordsPerPage: 300 },
];
export const DEFAULT_SPACING: Spacing = 'ONE_HALF';
export const wordsPerPageFor = (spacing: Spacing) => SPACING_OPTIONS.find(o => o.key === spacing)?.wordsPerPage ?? 250;
export const pagesFor = (words: number, spacing: Spacing) => (words > 0 ? Math.ceil(words / wordsPerPageFor(spacing)) : 0);

// Symbols used by the home calculator's currency switcher.
export const CURRENCY_BY_SYMBOL: Record<string, string> = { '£': 'GBP', '$': 'USD', '€': 'EUR', 'A$': 'AUD', 'C$': 'CAD', '₹': 'INR' };

/** "YYYY-MM-DD" for a date in the customer's own time zone (for date inputs). */
export const localDateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The exact deadline (ISO) from a date input ("YYYY-MM-DD") and a time label like "10:00 PM", in the customer's time zone. */
export function deadlineAtFrom(date: string, time = ''): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
    if (!m) return '';
    const t = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(time);
    // No time given (or "ASAP"): the start of the working day on that date.
    const hours = t ? (Number(t[1]) % 12) + (/PM/i.test(t[3]) ? 12 : 0) : 9;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hours, t ? Number(t[2]) : 0, 0);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

const norm = (i: OrderQuoteInput): OrderQuoteInput => ({
    words: Math.floor(i.words) || 0, spacing: i.spacing || DEFAULT_SPACING,
    deadlineAt: i.deadlineAt || '', currency: (i.currency || 'GBP').toUpperCase(),
});

/** True when a stored quote was made for exactly these inputs. */
export function quoteMatchesInput(q: OrderQuote | null | undefined, input: OrderQuoteInput) {
    if (!q?.input) return false;
    const a = q.input, b = norm(input);
    return a.words === b.words && a.spacing === b.spacing && a.currency === b.currency
        && new Date(a.deadlineAt).getTime() === new Date(b.deadlineAt).getTime();
}

// A 404 means the API doesn't have the quote route (e.g. an older backend still deployed).
const quoteErrorMessage = (e: any) =>
    e?.status === 404 || e?.status === 0 || e?.status >= 500
        ? 'Pricing is temporarily unavailable. Please try again in a moment.'
        : e?.message || 'Could not calculate a price.';

export const fetchOrderQuote = (input: OrderQuoteInput, signal?: AbortSignal) =>
    api<{ quote: OrderQuote }>('/orders/quote', { method: 'POST', body: norm(input), signal }).then(r => r.quote);

export const fetchWordPricing = () => api<{ pricing: WordPricingInfo }>('/orders/pricing').then(r => r.pricing);

/**
 * Keeps a quote in sync with the form. An `initial` quote (from the previous
 * step) is used as-is while the inputs still match it — it is never recalculated.
 * `quote` is only returned when it matches the current inputs.
 */
export function useOrderQuote(input: OrderQuoteInput, { enabled = true, initial = null as OrderQuote | null, delay = 250 } = {}) {
    const [stored, setStored] = useState<OrderQuote | null>(initial);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [attempt, setAttempt] = useState(0);   // bumped to retry after a failure
    const initialRef = useRef(initial);
    if (initial !== initialRef.current) { initialRef.current = initial; if (initial) setStored(initial); }

    const n = norm(input);
    const key = JSON.stringify(n);
    const valid = enabled && n.words >= 1 && !!n.deadlineAt;
    const fresh = quoteMatchesInput(stored, n);

    useEffect(() => {
        if (!valid || fresh) { setLoading(false); if (!valid) setError(''); return; }
        const ctrl = new AbortController();
        let retry: ReturnType<typeof setTimeout> | undefined;
        setLoading(true);
        const t = setTimeout(() => {
            fetchOrderQuote(n, ctrl.signal)
                .then(q => { setStored(q); setError(''); })
                .catch(e => {
                    if (e?.name === 'AbortError') return;
                    setError(quoteErrorMessage(e));
                    // Temporary failures (network, server, API not deployed yet) retry on their own.
                    if (!(e?.status >= 400 && e?.status < 500 && e?.status !== 404 && e?.status !== 429)) retry = setTimeout(() => setAttempt(a => a + 1), 4000);
                })
                .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
        }, delay);
        return () => { clearTimeout(t); if (retry) clearTimeout(retry); ctrl.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, valid, fresh, attempt]);

    return {
        quote: fresh ? stored : null,          // matches the current inputs
        lastQuote: stored,                     // most recent quote, possibly for older inputs
        loading, error,
        /** The quote for these inputs, fetching it now if needed. */
        ensure: async () => (quoteMatchesInput(stored, n) ? stored! : fetchOrderQuote(n).then(q => { setStored(q); return q; })),
        replace: (q: OrderQuote) => setStored(q),
    };
}

export const formatQuoteMoney = (amount: number, currency: string, symbol?: string) => {
    if (symbol) return `${symbol}${amount.toLocaleString()}`;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); } catch { return `${amount} ${currency}`; }
};
