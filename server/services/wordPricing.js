import { SiteSettings } from '../db.js';
import { remember, cacheDel } from './cache.js';

// Word-based order pricing.
//
//   INR price   = total words × ₹1 × delivery multiplier
//   client price = INR price × current INR→currency exchange rate
//
// The delivery type (and so the multiplier) is chosen from the deadline:
// the longer the deadline, the lower the multiplier. Multipliers are set by an
// admin but always stay within 2×–5×. Spacing only converts words to a page
// count for display — it never affects the price. None of the internal numbers
// (multiplier, INR amount, exchange rate) are sent to customers.

export const BASE_RATE_PER_WORD_INR = 1;
export const MULTIPLIER_MIN = 2;
export const MULTIPLIER_MAX = 5;
export const MIN_NOTICE_HOURS = 3;            // earliest deadline accepted
export const MAX_WORDS = 200000;

export const SPACING = {
    DOUBLE: { label: 'Double spacing', wordsPerPage: 200 },
    ONE_HALF: { label: '1.5 spacing', wordsPerPage: 250 },
    SINGLE: { label: 'Single spacing', wordsPerPage: 300 },
};
export const DEFAULT_SPACING = 'ONE_HALF';

export const DELIVERY_TYPES = ['STANDARD', 'EXPRESS', 'URGENT', 'EMERGENCY'];
export const DELIVERY_LABELS = { STANDARD: 'Standard', EXPRESS: 'Express', URGENT: 'Urgent', EMERGENCY: 'Emergency' };

// minHours: the shortest time to the deadline for that type (Emergency is anything shorter).
export const DEFAULT_WORD_PRICING = {
    tiers: {
        STANDARD: { multiplier: 2, minHours: 144 },   // 6 days or more
        EXPRESS: { multiplier: 3, minHours: 72 },     // 3–6 days
        URGENT: { multiplier: 4, minHours: 24 },      // 1–3 days
        EMERGENCY: { multiplier: 5, minHours: 0 },    // under 24 hours
    },
};

export const SUPPORTED_CURRENCIES = {
    INR: '₹', USD: '$', GBP: '£', EUR: '€', AUD: 'A$', CAD: 'C$',
};

export class WordPricingError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

// ── Settings ────────────────────────────────────────────────────────────────
const KEY = 'word_pricing';

/** Checks a settings object; throws with a clear message when a rule is broken. */
export function validateWordPricing(value) {
    const tiers = value?.tiers || {};
    for (const t of DELIVERY_TYPES) {
        const m = Number(tiers[t]?.multiplier);
        if (!(m >= MULTIPLIER_MIN && m <= MULTIPLIER_MAX)) throw new WordPricingError(`${DELIVERY_LABELS[t]} multiplier must be between ${MULTIPLIER_MIN}× and ${MULTIPLIER_MAX}×.`);
    }
    for (let i = 1; i < DELIVERY_TYPES.length; i++) {
        const a = DELIVERY_TYPES[i - 1], b = DELIVERY_TYPES[i];
        if (Number(tiers[a].multiplier) > Number(tiers[b].multiplier)) throw new WordPricingError(`${DELIVERY_LABELS[b]} must cost at least as much as ${DELIVERY_LABELS[a]} (a closer deadline can't be cheaper).`);
    }
    const h = (t) => Number(tiers[t]?.minHours);
    if (!(h('URGENT') >= MIN_NOTICE_HOURS && h('EXPRESS') > h('URGENT') && h('STANDARD') > h('EXPRESS') && h('STANDARD') <= 24 * 90))
        throw new WordPricingError('Deadline limits must be in order: Standard longer than Express, Express longer than Urgent, Urgent at least 3 hours.');
    return {
        tiers: Object.fromEntries(DELIVERY_TYPES.map(t => [t, { multiplier: Math.round(Number(tiers[t].multiplier) * 100) / 100, minHours: t === 'EMERGENCY' ? 0 : Math.round(h(t)) }])),
    };
}

export async function getWordPricing() {
    return remember('settings:word_pricing', 900, async () => {
        const doc = await SiteSettings.findOne({ key: KEY }).lean();
        try { return validateWordPricing(doc?.value || DEFAULT_WORD_PRICING); }
        catch { return DEFAULT_WORD_PRICING; }   // never price from invalid stored settings
    });
}

export async function saveWordPricing(value) {
    const clean = validateWordPricing(value);
    await SiteSettings.findOneAndUpdate({ key: KEY }, { $set: { value: clean } }, { upsert: true });
    await cacheDel('settings:word_pricing');
    return getWordPricing();
}

// ── Exchange rates (INR → currency) ─────────────────────────────────────────
const FX_URL = () => process.env.FX_RATES_URL || 'https://open.er-api.com/v6/latest/INR';
const FX_TTL_MS = 6 * 60 * 60 * 1000;
// Used only if the live rates have never been fetched successfully.
const FALLBACK_RATES = { INR: 1, USD: 0.012, GBP: 0.0094, EUR: 0.011, AUD: 0.018, CAD: 0.0164 };
let fxMemo = null;   // { rates, at, source }

async function fetchLiveRates() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
        const res = await fetch(FX_URL(), { signal: ctrl.signal });
        const data = await res.json();
        const rates = data?.rates;
        if (!res.ok || !rates || !Object.keys(SUPPORTED_CURRENCIES).every(c => c === 'INR' || Number(rates[c]) > 0)) throw new Error('bad FX response');
        const picked = Object.fromEntries(Object.keys(SUPPORTED_CURRENCIES).map(c => [c, c === 'INR' ? 1 : Number(rates[c])]));
        return { rates: picked, at: new Date(), source: 'live' };
    } finally { clearTimeout(timer); }
}

/** Current INR→currency rates: live (refreshed every 6 h), else the last good copy, else fallbacks. */
export async function getInrRates() {
    if (fxMemo && Date.now() - new Date(fxMemo.at).getTime() < FX_TTL_MS) return fxMemo;
    try {
        fxMemo = await fetchLiveRates();
        SiteSettings.findOneAndUpdate({ key: 'fx_inr_rates' }, { $set: { value: fxMemo } }, { upsert: true }).catch(() => {});
        return fxMemo;
    } catch (err) {
        console.warn('[FX] live exchange rates unavailable:', err.message);
        const stored = await SiteSettings.findOne({ key: 'fx_inr_rates' }).lean().catch(() => null);
        fxMemo = stored?.value?.rates ? { ...stored.value, source: 'stored' } : { rates: FALLBACK_RATES, at: new Date(), source: 'fallback' };
        // Try live again in 10 minutes rather than 6 hours.
        fxMemo.at = new Date(Date.now() - FX_TTL_MS + 10 * 60 * 1000);
        return fxMemo;
    }
}

/** INR → `currency` rate right now. */
export async function inrRate(currency) {
    const fx = await getInrRates();
    const rate = fx.rates[currency];
    if (!(rate > 0)) throw new WordPricingError('That currency is not supported.');
    return { rate, fx };
}

// ── Quote ───────────────────────────────────────────────────────────────────
export function deliveryTypeFor(hours, tiers) {
    if (hours >= tiers.STANDARD.minHours) return 'STANDARD';
    if (hours >= tiers.EXPRESS.minHours) return 'EXPRESS';
    if (hours >= tiers.URGENT.minHours) return 'URGENT';
    return 'EMERGENCY';
}

/**
 * The full pricing snapshot for an order (saved with the order as-is).
 * Everything is computed here; nothing is taken from the client except the inputs.
 */
export async function quoteByWords({ words, spacing, deadlineAt, currency }, { now = new Date() } = {}) {
    const w = Math.floor(Number(words));
    if (!(w >= 1)) throw new WordPricingError('Enter the total number of words.');
    if (w > MAX_WORDS) throw new WordPricingError(`Orders are limited to ${MAX_WORDS.toLocaleString('en-GB')} words.`);
    const sp = SPACING[spacing] ? spacing : DEFAULT_SPACING;
    const cur = String(currency || 'INR').toUpperCase();
    if (!SUPPORTED_CURRENCIES[cur]) throw new WordPricingError('That currency is not supported.');
    const due = new Date(deadlineAt);
    if (Number.isNaN(due.getTime())) throw new WordPricingError('Choose a deadline.');
    const hours = (due.getTime() - now.getTime()) / 3600000;
    if (hours < MIN_NOTICE_HOURS) throw new WordPricingError(`Choose a deadline at least ${MIN_NOTICE_HOURS} hours from now.`);

    const { tiers } = await getWordPricing();
    const deliveryType = deliveryTypeFor(hours, tiers);
    const multiplier = tiers[deliveryType].multiplier;
    const inrTotal = Math.round(w * BASE_RATE_PER_WORD_INR * multiplier);
    const { rate, fx } = await inrRate(cur);
    const total = cur === 'INR' ? inrTotal : Math.max(1, Math.round(Number((inrTotal * rate).toFixed(6))));
    const wordsPerPage = SPACING[sp].wordsPerPage;
    return {
        model: 'WORDS',
        words: w,
        spacing: sp,
        wordsPerPage,
        pages: Math.ceil(w / wordsPerPage),          // display only
        deadlineAt: due,
        deliveryType,
        multiplier,
        baseRatePerWord: BASE_RATE_PER_WORD_INR,
        inrTotal,
        currency: cur,
        exchangeRate: rate,                           // INR → currency
        fxSource: fx.source,
        fxAt: fx.at,
        total,                                        // what the customer pays, in `currency`
        quotedAt: now,
    };
}

/** What a customer may see of a quote: no multiplier, no INR maths, no exchange rate. */
// (UPI payments are offered only for rupee quotes, so no separate INR amount is sent.)
export function publicQuote(q, input = {}) {
    return {
        input: { words: q.words, spacing: q.spacing, deadlineAt: String(input.deadlineAt || new Date(q.deadlineAt).toISOString()), currency: q.currency },
        words: q.words,
        spacing: q.spacing,
        spacingLabel: SPACING[q.spacing].label,
        wordsPerPage: q.wordsPerPage,
        pages: q.pages,
        deliveryType: q.deliveryType,
        deliveryLabel: DELIVERY_LABELS[q.deliveryType],
        deadlineAt: q.deadlineAt,
        currency: q.currency,
        symbol: SUPPORTED_CURRENCIES[q.currency],
        total: q.total,
    };
}

/** Public settings for the calculator (labels and spacing only). */
export async function publicWordPricing() {
    const { tiers } = await getWordPricing();
    return {
        spacing: Object.entries(SPACING).map(([key, s]) => ({ key, label: s.label, wordsPerPage: s.wordsPerPage })),
        defaultSpacing: DEFAULT_SPACING,
        currencies: Object.entries(SUPPORTED_CURRENCIES).map(([code, symbol]) => ({ code, symbol })),
        // When each delivery type applies (for showing "Standard: 7+ days" etc.) — not what it costs.
        deliveryTypes: DELIVERY_TYPES.map(t => ({ key: t, label: DELIVERY_LABELS[t], minHours: tiers[t].minHours })),
        minNoticeHours: MIN_NOTICE_HOURS,
    };
}
