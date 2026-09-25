import { useEffect, useRef, useState } from 'react';
import { api } from './api';

// Standard-order quotation. The server (POST /api/orders/quote) is the only
// place a price is calculated; the website stores the returned quote and passes
// that exact object from the calculator to the order form, so the customer sees
// the same total on every step. It is re-quoted only when an input changes.

export type OrderQuoteInput = { service: string; pages: number; academicLevel: string; currency: string; topExpert?: boolean; abstractPage?: boolean };
export type QuoteAddOn = { key: string; label: string; price: number };
export type OrderQuote = {
    input: Required<OrderQuoteInput>;
    service: string; academicLevel: string;
    pages: number; words: number; wordsPerPage: number;
    baseCurrency: string; basePrice: number; exchangeRate: number; unitPrice: number;
    levelMultiplier: number; multiplier: number;
    currency: string; symbol: string;
    subtotal: number; addOns: QuoteAddOn[]; addOnOptions: QuoteAddOn[]; addOnsTotal: number;
    discountPercent: number; discount: number; total: number;
    upi: { currency: string; rate: number; amount: number };
};
export type RateCard = {
    baseCurrency: string; wordsPerPage: number; maxPages: number; defaultRate: number;
    rates: Record<string, number>; levelMultipliers: Record<string, number>;
    currencies: Record<string, { symbol: string; rate: number }>;
    addOns: Record<string, { label: string; price: number }>; discountPercent: number;
};

// Symbols used by the home calculator's currency switcher.
export const CURRENCY_BY_SYMBOL: Record<string, string> = { '£': 'GBP', '$': 'USD', '€': 'EUR', 'A$': 'AUD' };

const norm = (i: OrderQuoteInput): Required<OrderQuoteInput> => ({
    service: (i.service || '').trim(), pages: Math.floor(i.pages), academicLevel: i.academicLevel || 'Undergraduate',
    currency: (i.currency || 'GBP').toUpperCase(), topExpert: !!i.topExpert, abstractPage: !!i.abstractPage,
});

/** True when a stored quote was made for exactly these inputs. */
export function quoteMatchesInput(q: OrderQuote | null | undefined, input: OrderQuoteInput) {
    if (!q) return false;
    const a = q.input, b = norm(input);
    return a.service === b.service && a.pages === b.pages && a.academicLevel === b.academicLevel
        && a.currency === b.currency && a.topExpert === b.topExpert && a.abstractPage === b.abstractPage;
}

// A 404 means the API doesn't have the quote route (e.g. an older backend still deployed).
const quoteErrorMessage = (e: any) =>
    e?.status === 404 || e?.status === 0 || e?.status >= 500
        ? 'Pricing is temporarily unavailable. Please try again in a moment.'
        : e?.message || 'Could not calculate a price.';

export const fetchOrderQuote = (input: OrderQuoteInput, signal?: AbortSignal) =>
    api<{ quote: OrderQuote }>('/orders/quote', { method: 'POST', body: norm(input), signal }).then(r => r.quote);

export const fetchRateCard = () => api<{ pricing: RateCard }>('/orders/pricing').then(r => r.pricing);

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
    const valid = enabled && n.pages >= 1;
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
