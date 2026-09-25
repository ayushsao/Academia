import { SiteSettings, MembershipPlan } from '../db.js';
import { remember, cacheDel } from './cache.js';

const KEY = 'membership';

export const MEMBERSHIP_DISCLAIMER =
    'Membership provides access to platform features and opportunities. Assignments depend on eligibility, requirements, availability and platform allocation.';

// Grace period after a missed renewal before the membership expires.
export const GRACE_DAYS = 7;
// Renewal invoices are issued this many days before the renewal date.
export const RENEWAL_NOTICE_DAYS = 7;

export const DEFAULT_SETTINGS = {
    currencies: ['INR', 'USD', 'GBP', 'AUD', 'CAD', 'AED'].map(code => ({ code, isActive: true })),
    // Suggested currency by writer country; anything else falls back to defaultCurrency.
    countryCurrency: { IN: 'INR', US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD', AE: 'AED' },
    defaultCurrency: 'USD',
    // Existing site practice: pay by UPI / PayPal and submit the reference for manual verification.
    manualPayment: { enabled: false, upiId: '', paypalUrl: '', bankDetails: '', instructions: '' },
    // Admin-maintained rates used only to convert analytics into one reporting currency.
    reporting: { currency: 'USD', ratesToReporting: {} },
};

export async function getMembershipSettings() {
    return remember('settings:membership', 900, async () => {
        const doc = await SiteSettings.findOne({ key: KEY }).lean();
        const stored = doc?.value || {};
        return {
            ...DEFAULT_SETTINGS,
            ...stored,
            manualPayment: { ...DEFAULT_SETTINGS.manualPayment, ...(stored.manualPayment || {}) },
            reporting: { ...DEFAULT_SETTINGS.reporting, ...(stored.reporting || {}) },
            countryCurrency: { ...DEFAULT_SETTINGS.countryCurrency, ...(stored.countryCurrency || {}) },
        };
    });
}

export async function saveMembershipSettings(value) {
    await SiteSettings.findOneAndUpdate({ key: KEY }, { $set: { value } }, { upsert: true });
    await cacheDel('settings:membership');
    return getMembershipSettings();
}

export const activeCurrencyCodes = (settings) => settings.currencies.filter(c => c.isActive).map(c => c.code);

export const manualPaymentAvailable = (settings) => {
    const m = settings.manualPayment;
    return Boolean(m.enabled && (m.upiId || m.paypalUrl || m.bankDetails));
};

// Seeds the three standard plans on first run. They start INACTIVE with
// suggested prices so an admin reviews pricing before anything is sold.
export async function ensureDefaultPlans() {
    if (await MembershipPlan.estimatedDocumentCount()) return;
    // Suggested list prices (major units) per currency: [monthly, annual].
    const suggested = {
        BASIC: { INR: [799, 7990], USD: [12, 120], GBP: [10, 100], AUD: [18, 180], CAD: [16, 160], AED: [45, 450] },
        PROFESSIONAL: { INR: [1799, 17990], USD: [25, 250], GBP: [20, 200], AUD: [38, 380], CAD: [34, 340], AED: [92, 920] },
        PREMIUM: { INR: [2999, 29990], USD: [45, 450], GBP: [36, 360], AUD: [68, 680], CAD: [60, 600], AED: [165, 1650] },
    };
    const plans = [
        { code: 'BASIC', name: 'Basic', tier: 1, sortOrder: 1, description: 'Get listed and start receiving opportunities that match your profile.',
          features: ['Verified listing in the writer directory', 'Access to matched assignment opportunities', 'Email support'] },
        { code: 'PROFESSIONAL', name: 'Professional', tier: 2, sortOrder: 2, highlight: true, description: 'More visibility for established writers.',
          features: ['Everything in Basic', 'Higher placement in directory results', 'Plan badge on your public profile'] },
        { code: 'PREMIUM', name: 'Premium', tier: 3, sortOrder: 3, description: 'Maximum visibility and priority support.',
          features: ['Everything in Professional', 'Highest placement in directory results', 'Priority support'] },
    ];
    await MembershipPlan.insertMany(plans.map(p => ({
        ...p,
        isActive: false,
        prices: Object.entries(suggested[p.code]).flatMap(([currency, [monthly, annual]]) => [
            { currency, billingPeriod: 'MONTHLY', amountMinor: monthly * 100, discountPercent: 0 },
            { currency, billingPeriod: 'ANNUAL', amountMinor: annual * 100, discountPercent: 0 },
        ]),
    })));
    console.log('[Membership] Seeded Basic/Professional/Premium plans (inactive — review prices in the admin panel).');
}
