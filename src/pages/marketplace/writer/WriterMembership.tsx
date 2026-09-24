import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, CalendarClock, AlertTriangle, RotateCcw, Receipt, ArrowRight } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatDate, formatMoney, currencyName } from '../../../lib/money';
import { PAYMENT_STATUS_LABEL, PERIOD_LABEL, type BillingPeriod, type MembershipMe, type MembershipPayment, type PublicPlan } from '../../../lib/membershipTypes';
import { BillingToggle, MembershipDisclaimer, SubscriptionBadge } from '../../../components/writer/MembershipBits';
import { Notice, inputClass } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { useWriter } from '../onboarding/WriterContext';
import { cn } from '../../../lib/utils';

const PERIOD_RANK = { MONTHLY: 1, ANNUAL: 2 };
const checkoutUrl = (q: Record<string, string>) => `/writer/membership/checkout?${new URLSearchParams(q)}`;

function CurrentMembership({ me, onChanged }: { me: MembershipMe; onChanged: () => void }) {
    const navigate = useNavigate();
    const sub = me.subscription!;
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [confirmCancel, setConfirmCancel] = useState(false);
    const live = ['ACTIVE', 'PAST_DUE'].includes(sub.status);
    const openPayment = me.openPayments[0];

    const run = async (key: string, fn: () => Promise<unknown>) => {
        setBusy(key); setError('');
        try { await fn(); onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); setConfirmCancel(false); }
    };
    const payRenewal = () => run('renew', async () => {
        const r = await api<{ payment: MembershipPayment }>('/membership/renewal', { method: 'POST' });
        navigate(checkoutUrl({ pay: r.payment.paymentRef }));
    });

    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fea520]/15 text-[#b86e00]"><Crown className="h-6 w-6" /></span>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-bold text-[#0b1b33]">{sub.planName}</h2>
                            <SubscriptionBadge status={sub.status} />
                        </div>
                        <p className="mt-1 text-slate-600">
                            {formatMoney(sub.amountMinor, sub.currency)} / {sub.billingPeriod === 'ANNUAL' ? 'year' : 'month'}
                            {sub.discountPercent > 0 && <span className="ml-2 text-sm text-emerald-700">{sub.discountPercent}% off</span>}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">Subscription {sub.subscriptionId}</p>
                    </div>
                </div>
                {live && sub.currentPeriodEnd && (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <p className="flex items-center gap-2 font-semibold text-[#0b1b33]"><CalendarClock className="h-4 w-4 text-slate-500" />
                            {sub.autoRenew ? 'Renews' : 'Ends'} {formatDate(sub.currentPeriodEnd)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Member since {formatDate(sub.startDate)}</p>
                    </div>
                )}
            </div>

            <div className="mt-6 space-y-3">
                {error && <Notice tone="error">{error}</Notice>}
                {sub.status === 'PAST_DUE' && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-center">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-orange-700" />
                        <p className="flex-1 text-sm text-orange-900">Your renewal payment is overdue. Pay by <strong>{formatDate(sub.graceEndsAt)}</strong> to keep your membership.</p>
                        <button onClick={payRenewal} disabled={busy !== null} className="rounded-xl bg-[#002147] px-5 py-2.5 text-sm font-semibold text-white">Pay renewal</button>
                    </div>
                )}
                {sub.status === 'SUSPENDED' && <Notice tone="error">Your membership is suspended. Please contact support.</Notice>}
                {sub.status === 'PENDING' && openPayment && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
                        <p className="flex-1 text-sm text-amber-900">
                            {openPayment.status === 'PENDING_VERIFICATION'
                                ? `We’re verifying your payment reference ${openPayment.manual?.reference}. Your membership activates as soon as it’s confirmed.`
                                : 'Your checkout isn’t finished yet.'}
                        </p>
                        {openPayment.status === 'CREATED' && <button onClick={() => navigate(checkoutUrl({ pay: openPayment.paymentRef }))} className="rounded-xl bg-[#002147] px-5 py-2.5 text-sm font-semibold text-white">Complete payment</button>}
                    </div>
                )}
                {live && me.openPayments.filter(p => p.kind !== 'NEW').map(p => (
                    <div key={p.paymentRef} className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center">
                        <Receipt className="h-5 w-5 shrink-0 text-sky-700" />
                        <p className="flex-1 text-sm text-sky-900">
                            {p.kind === 'RENEWAL' ? 'Renewal invoice' : 'Upgrade invoice'} for {formatMoney(p.amountMinor, p.currency)}
                            {p.status === 'PENDING_VERIFICATION' ? ' — payment reference received, verifying.' : ' is ready.'}
                        </p>
                        {p.status === 'CREATED' && <button onClick={() => navigate(checkoutUrl({ pay: p.paymentRef }))} className="rounded-xl bg-[#002147] px-5 py-2.5 text-sm font-semibold text-white">Pay now</button>}
                    </div>
                ))}
                {sub.scheduledChange && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                        <p className="flex-1 text-sm text-slate-700">Switching to <strong>{sub.scheduledChange.planName}</strong> ({PERIOD_LABEL[sub.scheduledChange.billingPeriod].toLowerCase()}) on {formatDate(sub.scheduledChange.effectiveAt)}.</p>
                        <button onClick={() => run('undo', () => api('/membership/scheduled-change', { method: 'DELETE' }))} disabled={busy !== null}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><RotateCcw className="h-4 w-4" /> Keep current plan</button>
                    </div>
                )}
                {live && (
                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-600">
                            {sub.autoRenew
                                ? 'Auto-renewal is on. We’ll send your renewal invoice 7 days before the renewal date.'
                                : `Auto-renewal is off. Your membership ends on ${formatDate(sub.currentPeriodEnd)}.`}
                        </p>
                        {sub.autoRenew ? (
                            confirmCancel ? (
                                <div className="flex gap-2">
                                    <button onClick={() => run('off', () => api('/membership/auto-renew', { method: 'POST', body: { enabled: false } }))} disabled={busy !== null} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white">Yes, cancel renewal</button>
                                    <button onClick={() => setConfirmCancel(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Keep it</button>
                                </div>
                            ) : <button onClick={() => setConfirmCancel(true)} className="text-sm font-semibold text-red-600 hover:underline">Cancel auto-renewal</button>
                        ) : (
                            <button onClick={() => run('on', () => api('/membership/auto-renew', { method: 'POST', body: { enabled: true } }))} disabled={busy !== null || sub.status !== 'ACTIVE'} className="rounded-xl bg-[#002147] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Resume auto-renewal</button>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

function PaymentHistory({ payments }: { payments: MembershipPayment[] }) {
    if (!payments.length) return null;
    const statusClass = (s: string) => s === 'PAID' ? 'text-emerald-700' : ['REJECTED', 'FAILED'].includes(s) ? 'text-red-700' : 'text-slate-500';
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
            <h2 className="mb-4 text-lg font-bold text-[#0b1b33]">Payment history</h2>
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                    <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                        <th className="py-2 pr-4 font-semibold">Date</th><th className="py-2 pr-4 font-semibold">Description</th><th className="py-2 pr-4 font-semibold">Method</th>
                        <th className="py-2 pr-4 text-right font-semibold">Amount</th><th className="py-2 font-semibold">Status</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                        {payments.map(p => (
                            <tr key={p.paymentRef}>
                                <td className="py-3 pr-4 text-slate-600">{formatDate(p.paidAt || p.createdAt)}</td>
                                <td className="py-3 pr-4"><span className="font-medium text-[#0b1b33]">{p.planName} · {PERIOD_LABEL[p.billingPeriod]}</span><span className="block text-xs text-slate-400">{p.kind === 'NEW' ? 'New membership' : p.kind === 'RENEWAL' ? 'Renewal' : 'Upgrade'} · {p.paymentRef}</span></td>
                                <td className="py-3 pr-4 text-slate-600">{p.provider === 'RAZORPAY' ? 'Online' : p.provider === 'MANUAL' ? `${p.manual?.method?.replace('_', ' ') || 'Manual'}` : '—'}</td>
                                <td className="py-3 pr-4 text-right tabular-nums font-semibold text-[#0b1b33]">{formatMoney(p.amountMinor, p.currency)}</td>
                                <td className={cn('py-3 font-semibold', statusClass(p.status))}>{PAYMENT_STATUS_LABEL[p.status]}{p.reviewNote && <span className="block text-xs font-normal text-red-600">{p.reviewNote}</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
                {payments.map(p => (
                    <li key={p.paymentRef} className="flex items-start justify-between gap-3 py-3 text-sm">
                        <div><p className="font-medium text-[#0b1b33]">{p.planName} · {PERIOD_LABEL[p.billingPeriod]}</p><p className="text-xs text-slate-400">{formatDate(p.paidAt || p.createdAt)} · {p.paymentRef}</p></div>
                        <div className="text-right"><p className="font-semibold text-[#0b1b33]">{formatMoney(p.amountMinor, p.currency)}</p><p className={cn('text-xs font-semibold', statusClass(p.status))}>{PAYMENT_STATUS_LABEL[p.status]}</p></div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function WriterMembership() {
    const navigate = useNavigate();
    const { refresh: refreshWriter } = useWriter();
    const [me, setMe] = useState<MembershipMe | null>(null);
    const [catalogue, setCatalogue] = useState<{ plans: PublicPlan[]; currencies: string[]; suggestedCurrency: string } | null>(null);
    const [payments, setPayments] = useState<MembershipPayment[]>([]);
    const [period, setPeriod] = useState<BillingPeriod>('MONTHLY');
    const [currency, setCurrency] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const [m, c, p] = await Promise.all([
                api<MembershipMe>('/membership/me'),
                api<{ plans: PublicPlan[]; currencies: string[]; suggestedCurrency: string }>('/membership/plans'),
                api<{ payments: MembershipPayment[] }>('/membership/payments'),
            ]);
            setMe(m); setCatalogue(c); setPayments(p.payments);
            const live = m.subscription && ['ACTIVE', 'PAST_DUE', 'SUSPENDED'].includes(m.subscription.status);
            setCurrency(cur => cur || (live ? m.subscription!.currency : c.suggestedCurrency));
            if (live) setPeriod(pr => pr === 'MONTHLY' && m.subscription!.billingPeriod === 'ANNUAL' ? 'ANNUAL' : pr);
        } catch (e) { setError((e as Error).message); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const sub = me?.subscription;
    const live = !!sub && ['ACTIVE', 'PAST_DUE'].includes(sub.status);
    const currencyLocked = live || sub?.status === 'SUSPENDED';

    // Annual saving shown on the toggle: best discount across plans in this currency.
    const annualSaving = useMemo(() => {
        if (!catalogue || !currency) return 0;
        const savings = catalogue.plans.map(p => {
            const m = p.prices.find(x => x.currency === currency && x.billingPeriod === 'MONTHLY');
            const a = p.prices.find(x => x.currency === currency && x.billingPeriod === 'ANNUAL');
            return m && a ? Math.round((1 - a.amountMinor / (m.amountMinor * 12)) * 100) : 0;
        });
        return Math.max(0, ...savings);
    }, [catalogue, currency]);

    if (error) return <Notice tone="error">{error}</Notice>;
    if (!me || !catalogue) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8 text-[#002147]" /></div>;

    const actionFor = (plan: PublicPlan) => {
        if (!live || !sub) return { label: 'Choose plan', kind: 'new' as const };
        if (plan.tier === sub.tier && period === sub.billingPeriod) return { label: 'Current plan', kind: 'current' as const };
        if (sub.status === 'PAST_DUE') return { label: 'Pay renewal first', kind: 'blocked' as const };
        if (plan.tier > sub.tier) return PERIOD_RANK[period] >= PERIOD_RANK[sub.billingPeriod] ? { label: 'Upgrade now', kind: 'upgrade' as const } : { label: 'Choose annual to upgrade', kind: 'blocked' as const };
        if (plan.tier === sub.tier) return PERIOD_RANK[period] > PERIOD_RANK[sub.billingPeriod] ? { label: 'Switch to annual', kind: 'upgrade' as const } : { label: 'Switch at renewal', kind: 'downgrade' as const };
        return { label: 'Switch at renewal', kind: 'downgrade' as const };
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Membership</h1>
                <p className="mt-1 text-slate-600">Choose how you work with AssignmentMinds.</p>
            </div>
            <MembershipDisclaimer text={me.disclaimer} />

            {!me.eligibility.eligible && !live && <Notice tone="warning">{me.eligibility.reason}</Notice>}
            {sub && !(sub.status === 'EXPIRED' && !sub.startDate) && <CurrentMembership me={me} onChanged={() => { load(); refreshWriter(); }} />}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <h2 className="text-lg font-bold text-[#0b1b33]">{live ? 'Change plan' : 'Plans'}</h2>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <BillingToggle value={period} onChange={setPeriod} annualSavingPercent={annualSaving} />
                        <select aria-label="Currency" value={currency} disabled={currencyLocked} onChange={e => setCurrency(e.target.value)} className={cn(inputClass, 'py-2.5 sm:w-56')}>
                            {catalogue.currencies.map(c => <option key={c} value={c}>{c} · {currencyName(c)}</option>)}
                        </select>
                    </div>
                </div>
                {currencyLocked && <p className="-mt-3 mb-5 text-xs text-slate-500">Plan changes are billed in your subscription currency ({sub!.currency}).</p>}

                {catalogue.plans.length === 0 ? (
                    <Notice tone="info">Membership plans aren’t available yet. We’ll email you when they launch.</Notice>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {catalogue.plans.map(plan => {
                            const price = plan.prices.find(p => p.currency === currency && p.billingPeriod === period);
                            const action = actionFor(plan);
                            const disabled = !price || action.kind === 'current' || action.kind === 'blocked' || (!live && !me.eligibility.eligible) || sub?.status === 'SUSPENDED';
                            return (
                                <article key={plan.code} className={cn('relative flex flex-col rounded-2xl border p-5 sm:p-6', plan.highlight ? 'border-[#002147] ring-2 ring-[#002147]/10' : 'border-slate-200', action.kind === 'current' && 'bg-slate-50')}>
                                    {plan.highlight && <span className="absolute -top-3 left-5 rounded-full bg-[#fea520] px-3 py-0.5 text-xs font-bold text-[#0b1b33]">Most popular</span>}
                                    <h3 className="text-lg font-bold text-[#0b1b33]">{plan.name}</h3>
                                    <p className="mt-1 min-h-[2.5rem] text-sm text-slate-600">{plan.description}</p>
                                    <div className="mt-4">
                                        {price ? (
                                            <>
                                                <p className="text-3xl font-extrabold text-[#0b1b33]">{formatMoney(price.amountMinor, currency)}<span className="text-base font-medium text-slate-500"> /{period === 'ANNUAL' ? 'year' : 'month'}</span></p>
                                                {price.discountPercent > 0 && <p className="text-sm"><span className="text-slate-400 line-through">{formatMoney(price.listAmountMinor, currency)}</span> <span className="font-semibold text-emerald-700">{price.discountPercent}% off</span></p>}
                                            </>
                                        ) : <p className="text-sm text-slate-500">Not offered {period.toLowerCase()} in {currency}.</p>}
                                    </div>
                                    <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-700">
                                        {plan.features.map(f => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{f}</li>)}
                                    </ul>
                                    <button disabled={disabled} onClick={() => navigate(checkoutUrl({ plan: plan.code, period, currency }))}
                                        className={cn('mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition disabled:cursor-not-allowed',
                                            action.kind === 'current' ? 'bg-slate-200 text-slate-600' : plan.highlight ? 'bg-[#002147] text-white hover:bg-[#0b2f5c] disabled:opacity-50' : 'border border-[#002147] text-[#002147] hover:bg-[#002147]/5 disabled:opacity-40')}>
                                        {action.label}{!disabled && <ArrowRight className="h-4 w-4" />}
                                    </button>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <PaymentHistory payments={payments} />
        </div>
    );
}
