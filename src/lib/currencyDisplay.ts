// Currencies offered as quick choices in the price calculators, and the
// symbol shown before a price (falls back to the ISO code, e.g. "AED ").
export const MAIN_CURRENCIES = ['INR', 'GBP', 'USD', 'EUR', 'AUD', 'CAD'];
const SYMBOLS: Record<string, string> = { INR: '₹', GBP: '£', USD: '$', EUR: '€', AUD: 'A$', CAD: 'C$' };

export const currencySymbolOf = (code: string) => {
    if (SYMBOLS[code]) return SYMBOLS[code];
    try {
        const sym = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(p => p.type === 'currency')?.value;
        return sym && sym !== code ? sym : `${code} `;
    } catch { return `${code} `; }
};
