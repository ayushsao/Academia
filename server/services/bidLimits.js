import { SiteSettings } from '../db.js';
import { remember, cacheDel } from './cache.js';
import { getRateCard } from './orderPricing.js';
import { getInrRates } from './wordPricing.js';

// Writer bid limits by the work: an admin sets what a writer may bid per 1,000
// words (a default, and optionally per type of work/service), in the price
// list's base currency. When an order is approved its bid limit is worked out
// from its own word count and currency. An admin can still change it per order.

const KEY = 'writer_bid_rates';
export const DEFAULT_BID_RATES = { min: null, max: null, services: {} };

export async function getBidRates() {
    return remember('settings:writer_bid_rates', 900, async () => {
        const doc = await SiteSettings.findOne({ key: KEY }).lean();
        return { ...DEFAULT_BID_RATES, ...(doc?.value || {}) };
    });
}

export async function saveBidRates(value) {
    await SiteSettings.findOneAndUpdate({ key: KEY }, { $set: { value } }, { upsert: true });
    await cacheDel('settings:writer_bid_rates');
    return getBidRates();
}

const rateFor = (rates, service) => {
    const s = rates.services?.[service];
    if (s && s.min != null && s.max != null) return s;
    return rates.min != null && rates.max != null ? { min: rates.min, max: rates.max } : null;
};

/**
 * The bid limit for an order from the admin's rates: words ÷ 1,000 × rate,
 * converted to the order's currency. Null when no rate applies.
 */
export async function budgetFor(order, rates, card) {
    rates = rates || await getBidRates();
    const rate = rateFor(rates, order.service);
    if (!rate) return null;
    card = card || await getRateCard();
    const words = Number(order.wordCount) || (Number(order.pages) || 1) * (card.wordsPerPage || 250);
    const currency = order.currency || card.baseCurrency;
    let fx;
    if (order.pricing?.model === 'WORDS') {
        // Word-priced orders save an INR → currency rate; bid rates are in the base currency.
        const { rates: inr } = await getInrRates();
        fx = (Number(order.pricing.exchangeRate) || inr[currency] || 1) / (inr[card.baseCurrency] || 1);
    } else {
        // The exchange rate saved with the order's quote, else today's rate for its currency.
        fx = Number(order.pricing?.exchangeRate) || card.currencies?.[currency]?.rate || 1;
    }
    const scale = (perThousand) => Math.max(1, Math.round((words / 1000) * perThousand * fx));
    const minBid = scale(rate.min), maxBid = Math.max(scale(rate.max), scale(rate.min));
    return { minBid, maxBid, currency, words };
}

/** What the admin screen needs: rates, base currency and the list of services. */
export async function bidRatesView() {
    const [rates, card] = await Promise.all([getBidRates(), getRateCard()]);
    return { rates, baseCurrency: card.baseCurrency, wordsPerPage: card.wordsPerPage, services: Object.keys(card.rates || {}).sort() };
}
