import { SiteSettings } from '../db.js';

// Standard (non-catalogue) order pricing. This is the ONLY place these prices
// are calculated: the website shows the quote from POST /api/orders/quote,
// passes that same quote to the order form, and POST /api/orders re-prices
// with the same function and refuses the order if the quote no longer matches.

export const ORDER_RATE_CARD_KEY = 'order_rate_card';

// Initial values only; a stored SiteSettings document (key above) overrides them.
export const DEFAULT_RATE_CARD = {
    baseCurrency: 'GBP',
    wordsPerPage: 250,
    maxPages: 500,
    defaultRate: 15,                         // per page, base currency
    rates: {
        'Take My Online Exam': 50,
        'Take My Online Class': 45,
        'Ghost Writer': 30,
        'MBA Essay Writing Service': 28,
        'Data Analysis & SPSS': 25,
        'Programming Assignment Help': 25,
        'Dissertation & Thesis': 22,
        'Dissertation Help': 22,
        'Thesis Help': 22,
        'Research Proposal Writing Service': 20,
        'Literature Review': 18,
        'Research Paper Writing': 18,
        'Assessment Help': 18,
        'Case Study Analysis': 16,
        'Term Paper Help': 16,
        'Academic Writing': 15,
        'Pay Someone To Do My Homework': 15,
        'Coursework Help': 15,
        'Essay Help': 14,
        'Homework Help': 12,
        'Powerpoint Presentation Services': 12,
        'Editing & Proofreading': 10,
        'Essay Editing Service': 10,
    },
    levelMultipliers: { 'Undergraduate': 1, "Master's": 1.15, 'PhD / Doctoral': 1.35, 'Professional': 1 },
    // Display currencies: units of this currency per 1 unit of the base currency.
    currencies: {
        GBP: { symbol: '£', rate: 1 },
        USD: { symbol: '$', rate: 1.28 },
        EUR: { symbol: '€', rate: 1.18 },
        AUD: { symbol: 'A$', rate: 1.95 },
    },
    addOns: {
        turnitinReport: { label: 'Plagiarism Report', price: 0 },
        topExpert: { label: 'Premium Writer Match', price: 15 },
        abstractPage: { label: 'Summary & Abstract', price: 10 },
    },
    discountPercent: 0,
    upi: { currency: 'INR', rate: 106 },     // INR per 1 unit of the base currency
};

export class OrderPricingError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

export async function getRateCard() {
    const row = await SiteSettings.findOne({ key: ORDER_RATE_CARD_KEY }).lean();
    const v = row?.value || {};
    const d = DEFAULT_RATE_CARD;
    return {
        ...d, ...v,
        rates: { ...d.rates, ...(v.rates || {}) },
        levelMultipliers: { ...d.levelMultipliers, ...(v.levelMultipliers || {}) },
        currencies: { ...d.currencies, ...(v.currencies || {}) },
        addOns: { ...d.addOns, ...(v.addOns || {}) },
        upi: { ...d.upi, ...(v.upi || {}) },
    };
}

// What the website may show (per-page rates, currencies, levels, add-ons).
export function publicRateCard(card) {
    const { baseCurrency, wordsPerPage, maxPages, defaultRate, rates, levelMultipliers, currencies, addOns, discountPercent } = card;
    return { baseCurrency, wordsPerPage, maxPages, defaultRate, rates, levelMultipliers, currencies, addOns, discountPercent };
}

/**
 * Normalises the inputs that affect the price. The returned `input` is echoed in
 * the quote so the client can tell whether a stored quote still matches its form.
 */
export function normaliseQuoteInput(body, card) {
    const pages = Math.floor(Number(body.pages));
    if (!Number.isFinite(pages) || pages < 1) throw new OrderPricingError('Enter at least 1 page.');
    if (pages > card.maxPages) throw new OrderPricingError(`Orders are limited to ${card.maxPages} pages.`);
    const currency = String(body.currency || card.baseCurrency).trim().toUpperCase();
    if (!card.currencies[currency]) throw new OrderPricingError('That currency is not supported.');
    const academicLevel = card.levelMultipliers[body.academicLevel] !== undefined ? body.academicLevel : 'Undergraduate';
    return {
        service: String(body.service || '').trim(),
        pages,
        academicLevel,
        currency,
        topExpert: Boolean(body.topExpert),
        abstractPage: Boolean(body.abstractPage),
    };
}

/** The complete quotation for a standard order. Amounts are whole units of `currency`. */
export function buildOrderQuote(input, card) {
    const fx = card.currencies[input.currency];
    const basePrice = card.rates[input.service] ?? card.defaultRate;
    const levelMultiplier = card.levelMultipliers[input.academicLevel] ?? 1;
    const inCurrency = (base) => Math.round(base * fx.rate);
    const subtotal = Math.round(input.pages * basePrice * levelMultiplier * fx.rate);
    const addOnOptions = Object.entries(card.addOns).map(([key, a]) => ({ key, label: a.label, price: inCurrency(a.price) }));
    const addOns = addOnOptions.filter(a => a.key === 'turnitinReport' || input[a.key]);
    const addOnsTotal = addOns.reduce((s, a) => s + a.price, 0);
    const discountPercent = Number(card.discountPercent) || 0;
    const discount = Math.round((subtotal + addOnsTotal) * discountPercent / 100);
    const total = subtotal + addOnsTotal - discount;
    const upiRate = card.upi.rate / fx.rate;             // INR per 1 unit of the quote currency
    return {
        input,
        service: input.service,
        academicLevel: input.academicLevel,
        pages: input.pages,
        words: input.pages * card.wordsPerPage,
        wordsPerPage: card.wordsPerPage,
        baseCurrency: card.baseCurrency,
        basePrice,                                        // per page, base currency
        exchangeRate: fx.rate,
        unitPrice: Math.round(basePrice * levelMultiplier * fx.rate * 100) / 100,
        levelMultiplier,
        multiplier: levelMultiplier,
        currency: input.currency,
        symbol: fx.symbol,
        subtotal,
        addOns,
        addOnOptions,
        addOnsTotal,
        discountPercent,
        discount,
        total,
        upi: { currency: card.upi.currency, rate: Math.round(upiRate * 100) / 100, amount: Math.round(total * upiRate) },
    };
}

export async function quoteOrder(body) {
    const card = await getRateCard();
    return buildOrderQuote(normaliseQuoteInput(body, card), card);
}

// The order must be placed at exactly the price the customer was shown.
export function quoteMatches(serverQuote, clientQuote) {
    return !!clientQuote
        && clientQuote.currency === serverQuote.currency
        && Number(clientQuote.total) === serverQuote.total
        && Number(clientQuote.pages) === serverQuote.pages;
}
