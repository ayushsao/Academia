import { WriterSubscription, SubscriptionPayment } from '../db.js';
import { fromMinor, toMinor } from './money.js';
import { getMembershipSettings } from './membershipSettings.js';

// Subscription analytics. Money is always reported per currency; a converted
// total in the reporting currency is added only where the admin has set a rate.

const sumByCurrency = (rows) => rows.reduce((acc, r) => { acc[r.currency] = (acc[r.currency] || 0) + r.amountMinor; return acc; }, {});

function convert(byCurrency, reporting) {
    let totalMajor = 0;
    const unconverted = [];
    for (const [currency, minor] of Object.entries(byCurrency)) {
        const rate = currency === reporting.currency ? 1 : reporting.ratesToReporting?.[currency];
        if (!rate) { unconverted.push(currency); continue; }
        totalMajor += fromMinor(minor, currency) * rate;
    }
    return { currency: reporting.currency, amountMinor: toMinor(totalMajor, reporting.currency), unconverted };
}

const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export async function membershipAnalytics({ from, to }) {
    const settings = await getMembershipSettings();
    const reporting = settings.reporting;
    const now = new Date();
    const yearAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

    const [subs, paidInRange, paidLast12] = await Promise.all([
        WriterSubscription.find({ startDate: { $ne: null } })
            .select('writerId status billingPeriod currency amountMinor planCode planName country startDate endedAt cancelledAt autoRenew').lean(),
        SubscriptionPayment.find({ status: 'PAID', amountMinor: { $gt: 0 }, paidAt: { $gte: from, $lte: to } })
            .select('currency amountMinor planCode planName country kind').lean(),
        SubscriptionPayment.find({ status: 'PAID', amountMinor: { $gt: 0 }, paidAt: { $gte: yearAgo } })
            .select('currency amountMinor paidAt').lean(),
    ]);

    const inRange = (d) => d && d >= from && d <= to;
    const statusCounts = subs.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});

    // MRR: paying (ACTIVE) subscriptions normalised to one month.
    const active = subs.filter(s => s.status === 'ACTIVE');
    const mrrByCurrency = {};
    for (const s of active) {
        const monthly = s.billingPeriod === 'ANNUAL' ? s.amountMinor / 12 : s.amountMinor;
        mrrByCurrency[s.currency] = (mrrByCurrency[s.currency] || 0) + monthly;
    }
    for (const c of Object.keys(mrrByCurrency)) mrrByCurrency[c] = Math.round(mrrByCurrency[c]);
    const arrByCurrency = Object.fromEntries(Object.entries(mrrByCurrency).map(([c, v]) => [c, v * 12]));

    const groupRevenue = (keyFn) => {
        const groups = {};
        for (const p of paidInRange) {
            const key = keyFn(p);
            groups[key] = groups[key] || { byCurrency: {}, payments: 0 };
            groups[key].byCurrency[p.currency] = (groups[key].byCurrency[p.currency] || 0) + p.amountMinor;
            groups[key].payments++;
        }
        return Object.entries(groups).map(([key, g]) => ({ key, payments: g.payments, byCurrency: g.byCurrency, converted: convert(g.byCurrency, reporting) }))
            .sort((a, b) => b.converted.amountMinor - a.converted.amountMinor);
    };

    const planNames = Object.fromEntries(paidInRange.map(p => [p.planCode, p.planName]));
    const activeByPlan = active.reduce((acc, s) => { acc[s.planCode] = (acc[s.planCode] || 0) + 1; return acc; }, {});

    // Last 12 calendar months of collected revenue (per currency) and new subscribers.
    const months = Array.from({ length: 12 }, (_, i) => monthKey(new Date(Date.UTC(yearAgo.getUTCFullYear(), yearAgo.getUTCMonth() + i, 1))));
    const series = months.map(m => ({ month: m, byCurrency: {}, newSubscribers: 0 }));
    const idx = Object.fromEntries(months.map((m, i) => [m, i]));
    for (const p of paidLast12) {
        const i = idx[monthKey(p.paidAt)];
        if (i !== undefined) series[i].byCurrency[p.currency] = (series[i].byCurrency[p.currency] || 0) + p.amountMinor;
    }
    for (const s of subs) {
        const i = s.startDate ? idx[monthKey(new Date(s.startDate))] : undefined;
        if (i !== undefined) series[i].newSubscribers++;
    }
    for (const row of series) row.converted = convert(row.byCurrency, reporting);

    const collectedByCurrency = sumByCurrency(paidInRange);
    const collected12ByCurrency = sumByCurrency(paidLast12);

    return {
        range: { from, to },
        reportingCurrency: reporting.currency,
        subscribers: {
            total: new Set(subs.map(s => String(s.writerId))).size,
            active: statusCounts.ACTIVE || 0,
            pastDue: statusCounts.PAST_DUE || 0,
            suspended: statusCounts.SUSPENDED || 0,
            cancelled: statusCounts.CANCELLED || 0,
            expired: statusCounts.EXPIRED || 0,
            new: subs.filter(s => inRange(s.startDate)).length,
            cancelledInRange: subs.filter(s => s.status === 'CANCELLED' && inRange(s.endedAt)).length,
            expiredInRange: subs.filter(s => s.status === 'EXPIRED' && inRange(s.endedAt)).length,
            cancellingAtPeriodEnd: active.filter(s => !s.autoRenew).length,
        },
        mrr: { byCurrency: mrrByCurrency, converted: convert(mrrByCurrency, reporting) },
        arr: { byCurrency: arrByCurrency, converted: convert(arrByCurrency, reporting) },
        collected: { byCurrency: collectedByCurrency, converted: convert(collectedByCurrency, reporting), payments: paidInRange.length },
        collectedLast12Months: { byCurrency: collected12ByCurrency, converted: convert(collected12ByCurrency, reporting) },
        revenueByPlan: groupRevenue(p => p.planCode).map(r => ({ ...r, planName: planNames[r.key] || r.key, activeSubscribers: activeByPlan[r.key] || 0 })),
        activeByPlan,
        revenueByCountry: groupRevenue(p => p.country || 'Unknown'),
        revenueByCurrency: Object.entries(collectedByCurrency).map(([currency, amountMinor]) => ({ currency, amountMinor, converted: convert({ [currency]: amountMinor }, reporting) }))
            .sort((a, b) => b.converted.amountMinor - a.converted.amountMinor),
        monthly: series,
        queue: {
            pendingVerification: await SubscriptionPayment.countDocuments({ status: 'PENDING_VERIFICATION' }),
            needsAttention: await SubscriptionPayment.countDocuments({ needsAttention: { $nin: ['', null] } }),
        },
    };
}
