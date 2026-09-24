// Money helpers. Amounts are integer minor units; the number of minor digits
// per currency comes from Intl, so any ISO 4217 currency works (JPY 0, KWD 3…).

const ISO_CURRENCIES = new Set(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : []);

export const isIsoCurrency = (code) => typeof code === 'string' && /^[A-Z]{3}$/.test(code) && (ISO_CURRENCIES.size === 0 || ISO_CURRENCIES.has(code));

export const currencyDigits = (currency) =>
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;

export const toMinor = (major, currency) => Math.round(Number(major) * 10 ** currencyDigits(currency));
export const fromMinor = (minor, currency) => minor / 10 ** currencyDigits(currency);

export const formatMoney = (minor, currency) =>
    new Intl.NumberFormat('en', { style: 'currency', currency }).format(fromMinor(minor, currency));

export const applyDiscount = (minor, percent = 0) => Math.round((minor * (100 - percent)) / 100);
