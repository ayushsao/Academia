import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CreditCard, Landmark, ShieldCheck, ArrowLeft, PartyPopper, Hourglass, CalendarClock, ExternalLink } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { formatDate, formatMoney } from '../../../lib/money';
import { PERIOD_LABEL, type BillingPeriod, type MembershipMe, type MembershipPayment, type Quote, type Subscription } from '../../../lib/membershipTypes';
import { MembershipDisclaimer } from '../../../components/writer/MembershipBits';
import { Field, Notice, inputClass } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { useWriter } from '../onboarding/WriterContext';
import { cn } from '../../../lib/utils';

type Step = 'plan' | 'review' | 'payment' | 'verification' | 'activation';
const STEPS: { id: Step; label: string }[] = [
    { id: 'plan', label: 'Plan' }, { id: 'review', label: 'Review' }, { id: 'payment', label: 'Payment' },
    { id: 'verification', label: 'Verification' }, { id: 'activation', label: 'Activation' },
];

declare global { interface Window { Razorpay?: any } }

function loadRazorpay(): Promise<void> {
    if (window.Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Could not load the payment window. Check your connection and try again.'));
        document.body.appendChild(s);
    });
}

function Stepper({ current }: { current: Step }) {
    const idx = STEPS.findIndex(s => s.id === current);
    return (
        <ol className="flex items-center gap-1 overflow-x-auto pb-1 sm:gap-2" aria-label="Checkout progress">
            {STEPS.map((s, i) => (
                <li key={s.id} className="flex shrink-0 items-center gap-1 sm:gap-2" aria-current={i === idx ? 'step' : undefined}>
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                        i < idx ? 'bg-emerald-500 text-white' : i === idx ? 'bg-[#002147] text-white' : 'bg-slate-100 text-slate-400')}>
                        {i < idx ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={cn('text-sm', i === idx ? 'font-bold text-[#0b1b33]' : 'text-slate-500', i !== idx && 'hidden sm:inline')}>{s.label}</span>
                    {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-slate-200 sm:w-8" />}
                </li>
            ))}
        </ol>
    );
}

function Row({ label, value, strong, tone }: { label: string; value: React.ReactNode; strong?: boolean; tone?: 'good' }) {
    return (
        <div className={cn('flex items-baseline justify-between gap-4 py-2.5', strong && 'border-t border-slate-200 pt-3.5')}>
            <dt className={cn('text-sm', strong ? 'font-bold text-[#0b1b33]' : 'text-slate-600')}>{label}</dt>
            <dd className={cn('text-right tabular-nums', strong ? 'text-xl font-extrabold text-[#0b1b33]' : 'font-semibold text-slate-800', tone === 'good' && 'text-emerald-700')}>{value}</dd>
        </div>
    );
}

export default function MembershipCheckout() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { refresh: refreshWriter } = useWriter();
    const selection = { planCode: params.get('plan') || '', billingPeriod: (params.get('period') || 'MONTHLY') as BillingPeriod, currency: params.get('currency') || '' };
    const resumeRef = params.get('pay');

    const [step, setStep] = useState<Step>(resumeRef ? 'payment' : 'review');
    const [me, setMe] = useState<MembershipMe | null>(null);
    const [quote, setQuote] = useState<Quote | null>(null);
    const [payment, setPayment] = useState<MembershipPayment | null>(null);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [scheduled, setScheduled] = useState(false);
    const [understood, setUnderstood] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [manual, setManual] = useState<{ open: boolean; method: string; reference: string }>({ open: false, method: 'UPI', reference: '' });

    // Review step: the server prices the selection; nothing is charged yet.
    useEffect(() => {
        (async () => {
            try {
                const m = await api<MembershipMe>('/membership/me');
                setMe(m);
                if (resumeRef) {
                    const p = await api<{ payment: MembershipPayment }>(`/membership/payments/${encodeURIComponent(resumeRef)}`);
                    setPayment(p.payment);
                    if (p.payment.status === 'PAID') setStep('activation');
                    else if (p.payment.status === 'PENDING_VERIFICATION') setStep('verification');
                    else if (p.payment.status !== 'CREATED') setError(`This invoice is ${p.payment.status.toLowerCase().replace('_', ' ')}.`);
                } else {
                    setQuote((await api<{ quote: Quote }>('/membership/quote', { method: 'POST', body: selection })).quote);
                }
            } catch (e) { setError((e as Error).message); }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resumeRef]);

    const confirm = async () => {
        setBusy(true); setError('');
        try {
            const r = await api<{ quote: Quote; payment: MembershipPayment | null; subscription: Subscription }>('/membership/checkout', { method: 'POST', body: selection });
            setQuote(r.quote); setSubscription(r.subscription);
            if (!r.payment) { setScheduled(true); setStep('activation'); }
            else if (r.payment.status === 'PAID') { setPayment(r.payment); setStep('activation'); refreshWriter(); }
            else { setPayment(r.payment); setStep('payment'); }
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };

    const payOnline = async () => {
        if (!payment) return;
        setBusy(true); setError('');
        try {
            const start = await api<{ checkout: any }>(`/membership/payments/${payment.paymentRef}/start`, { method: 'POST', body: { provider: 'RAZORPAY' } });
            await loadRazorpay();
            const c = start.checkout;
            const rzp = new window.Razorpay({
                key: c.key, order_id: c.orderId, amount: c.amountMinor, currency: c.currency, name: c.name, description: c.description,
                prefill: c.prefill, theme: { color: '#002147' },
                handler: async (resp: Record<string, string>) => {
                    setStep('verification'); setBusy(true);
                    try {
                        const v = await api<{ payment: MembershipPayment; subscription: Subscription }>(`/membership/payments/${payment.paymentRef}/razorpay/verify`, {
                            method: 'POST',
                            body: { razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature },
                        });
                        setPayment(v.payment); setSubscription(v.subscription); setStep('activation'); refreshWriter();
                    } catch (e) {
                        setError(`${(e as Error).message} If money left your account, it will be matched automatically or you can contact support with reference ${payment.paymentRef}.`);
                        setStep('payment');
                    } finally { setBusy(false); }
                },
                modal: { ondismiss: () => setBusy(false) },
            });
            rzp.on('payment.failed', (resp: any) => setError(resp?.error?.description || 'The payment failed. Please try again.'));
            rzp.open();
        } catch (e) { setError((e as Error).message); setBusy(false); }
    };

    const submitManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payment) return;
        setBusy(true); setError('');
        try {
            await api(`/membership/payments/${payment.paymentRef}/start`, { method: 'POST', body: { provider: 'MANUAL' } });
            const r = await api<{ payment: MembershipPayment }>(`/membership/payments/${payment.paymentRef}/manual`, { method: 'POST', body: { method: manual.method, reference: manual.reference } });
            setPayment(r.payment); setStep('verification');
        } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    };

    const cancelCheckout = async () => {
        if (payment?.status === 'CREATED' && payment.kind !== 'RENEWAL') {
            try { await api(`/membership/payments/${payment.paymentRef}/cancel`, { method: 'POST' }); } catch (e) { if (!(e instanceof ApiError)) throw e; }
        }
        navigate('/writer/membership');
    };

    const providers = me?.providers;
    const amount = payment ? payment.amountMinor : quote?.amountDueMinor ?? 0;
    const currency = payment?.currency || quote?.currency || '';
    const onlineOk = providers?.razorpay.enabled && amount >= providers.razorpay.minAmountMinor;

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <Link to="/writer/membership" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#002147]"><ArrowLeft className="h-4 w-4" /> Membership</Link>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
                <Stepper current={step} />
                <div className="mt-8">
                    {error && <Notice tone="error" className="mb-6">{error}</Notice>}
                    {!me && !error && <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#002147]" /></div>}

                    {/* REVIEW */}
                    {me && step === 'review' && quote && (
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-2xl font-extrabold text-[#0b1b33]">Review your {quote.type === 'NEW' ? 'membership' : quote.type === 'UPGRADE' ? 'upgrade' : 'plan change'}</h1>
                                <p className="mt-1 text-slate-600">Prices are calculated by our server from the current plan settings.</p>
                            </div>
                            <dl className="rounded-2xl bg-slate-50 px-5 py-2">
                                <Row label="Plan" value={`${quote.planName} · ${PERIOD_LABEL[quote.billingPeriod]}`} />
                                <Row label={`List price per ${quote.billingPeriod === 'ANNUAL' ? 'year' : 'month'}`} value={formatMoney(quote.listAmountMinor, quote.currency)} />
                                {quote.discountPercent > 0 && <Row label={`Discount (${quote.discountPercent}%)`} value={`− ${formatMoney(quote.listAmountMinor - quote.periodAmountMinor, quote.currency)}`} tone="good" />}
                                {quote.creditMinor > 0 && <Row label="Credit for unused time on current plan" value={`− ${formatMoney(quote.creditMinor, quote.currency)}`} tone="good" />}
                                <Row label={quote.type === 'DOWNGRADE' ? 'Due today' : 'Total due today'} value={formatMoney(quote.amountDueMinor, quote.currency)} strong />
                            </dl>
                            <p className="flex items-start gap-2 text-sm text-slate-600"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                {quote.type === 'DOWNGRADE'
                                    ? `Your plan switches on ${formatDate(quote.effectiveAt)}. You keep your current plan until then, and your next renewal will be ${formatMoney(quote.periodAmountMinor, quote.currency)}.`
                                    : `Renews ${formatDate(quote.renewsAt)} at ${formatMoney(quote.periodAmountMinor, quote.currency)} per ${quote.billingPeriod === 'ANNUAL' ? 'year' : 'month'} while auto-renewal is on. You can cancel auto-renewal at any time.`}
                            </p>
                            <MembershipDisclaimer text={me.disclaimer} />
                            <label className="flex items-start gap-3 text-sm text-slate-700">
                                <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#002147]" />
                                I understand that membership gives access to platform features and does not guarantee assignments or income.
                            </label>
                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                                <Link to="/writer/membership" className="rounded-xl px-5 py-3 text-center font-semibold text-slate-600 hover:bg-slate-100">Change plan</Link>
                                <button onClick={confirm} disabled={!understood || busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white disabled:opacity-50">
                                    {busy && <Spinner className="h-4 w-4" />} {quote.type === 'DOWNGRADE' ? 'Confirm plan change' : 'Continue to payment'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PAYMENT */}
                    {me && step === 'payment' && payment && (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <h1 className="text-2xl font-extrabold text-[#0b1b33]">Payment</h1>
                                    <p className="mt-1 text-slate-600">{payment.planName} · {PERIOD_LABEL[payment.billingPeriod]} · invoice {payment.paymentRef}</p>
                                </div>
                                <p className="text-3xl font-extrabold text-[#0b1b33]">{formatMoney(amount, currency)}</p>
                            </div>
                            {!onlineOk && !providers?.manual.enabled && <Notice tone="warning">Payments aren’t available right now. Please try again later or contact support.</Notice>}

                            {onlineOk && (
                                <button onClick={payOnline} disabled={busy} className="flex w-full items-center gap-4 rounded-2xl border-2 border-[#002147] p-5 text-left transition hover:bg-[#002147]/[0.03] disabled:opacity-60">
                                    <CreditCard className="h-7 w-7 shrink-0 text-[#002147]" />
                                    <span className="flex-1"><span className="block font-bold text-[#0b1b33]">Pay online</span><span className="text-sm text-slate-600">Card, UPI, net banking or wallet. Confirmed instantly.</span></span>
                                    {busy ? <Spinner className="h-5 w-5 text-[#002147]" /> : <ShieldCheck className="h-5 w-5 text-emerald-600" />}
                                </button>
                            )}

                            {providers?.manual.enabled && (
                                <div className="rounded-2xl border border-slate-200">
                                    <button onClick={() => setManual(m => ({ ...m, open: !m.open }))} aria-expanded={manual.open} className="flex w-full items-center gap-4 p-5 text-left">
                                        <Landmark className="h-7 w-7 shrink-0 text-[#002147]" />
                                        <span className="flex-1"><span className="block font-bold text-[#0b1b33]">Pay by UPI, PayPal or bank transfer</span><span className="text-sm text-slate-600">Submit your payment reference; we verify it before activating, usually within one working day.</span></span>
                                    </button>
                                    {manual.open && (
                                        <form onSubmit={submitManual} className="space-y-4 border-t border-slate-100 p-5">
                                            <div className="grid gap-3 text-sm sm:grid-cols-2">
                                                {providers.manual.upiId && <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">UPI ID</p><p className="mt-1 break-all font-semibold text-[#0b1b33]">{providers.manual.upiId}</p></div>}
                                                {providers.manual.paypalUrl && <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">PayPal</p><a href={providers.manual.paypalUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 break-all font-semibold text-[#002147] underline">{providers.manual.paypalUrl.replace(/^https:\/\//, '')} <ExternalLink className="h-3.5 w-3.5" /></a></div>}
                                                {providers.manual.bankDetails && <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bank transfer</p><p className="mt-1 whitespace-pre-line text-slate-800">{providers.manual.bankDetails}</p></div>}
                                            </div>
                                            <p className="text-sm text-slate-700">Send exactly <strong>{formatMoney(amount, currency)}</strong> and include <strong>{payment.paymentRef}</strong> in the payment note. {providers.manual.instructions}</p>
                                            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                                                <Field label="Paid with" htmlFor="m-method">
                                                    <select id="m-method" className={inputClass} value={manual.method} onChange={e => setManual(m => ({ ...m, method: e.target.value }))}>
                                                        <option value="UPI">UPI</option><option value="PAYPAL">PayPal</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option>
                                                    </select>
                                                </Field>
                                                <Field label="Transaction ID / UTR / PayPal reference" htmlFor="m-ref" required>
                                                    <input id="m-ref" className={inputClass} maxLength={80} value={manual.reference} onChange={e => setManual(m => ({ ...m, reference: e.target.value }))} />
                                                </Field>
                                            </div>
                                            <button type="submit" disabled={busy || manual.reference.trim().length < 4} className="inline-flex items-center gap-2 rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white disabled:opacity-50">
                                                {busy && <Spinner className="h-4 w-4" />} Submit for verification
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}
                            <button onClick={cancelCheckout} className="text-sm font-semibold text-slate-500 hover:text-red-600">{payment.kind === 'RENEWAL' ? 'Pay later' : 'Cancel checkout'}</button>
                        </div>
                    )}

                    {/* VERIFICATION */}
                    {me && step === 'verification' && (
                        <div className="py-6 text-center">
                            {payment?.status === 'PENDING_VERIFICATION' ? (
                                <>
                                    <Hourglass className="mx-auto h-12 w-12 text-[#b86e00]" />
                                    <h1 className="mt-4 text-2xl font-extrabold text-[#0b1b33]">We’re verifying your payment</h1>
                                    <p className="mx-auto mt-2 max-w-md text-slate-600">We received reference <strong>{payment.manual?.reference}</strong> for invoice {payment.paymentRef}. We’ll activate your membership and email you as soon as it’s confirmed.</p>
                                    <Link to="/writer/membership" className="mt-6 inline-block rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white">Back to membership</Link>
                                </>
                            ) : (
                                <>
                                    <Spinner className="mx-auto h-10 w-10 text-[#002147]" />
                                    <h1 className="mt-4 text-2xl font-extrabold text-[#0b1b33]">Confirming your payment…</h1>
                                    <p className="mt-2 text-slate-600">Please don’t close this page.</p>
                                </>
                            )}
                        </div>
                    )}

                    {/* ACTIVATION */}
                    {me && step === 'activation' && (
                        <div className="space-y-6 py-4 text-center">
                            {scheduled ? <CalendarClock className="mx-auto h-12 w-12 text-[#002147]" /> : <PartyPopper className="mx-auto h-12 w-12 text-[#b86e00]" />}
                            <h1 className="text-2xl font-extrabold text-[#0b1b33]">
                                {scheduled ? 'Plan change scheduled' : payment?.kind === 'UPGRADE' ? 'Upgrade complete' : payment?.kind === 'RENEWAL' ? 'Membership renewed' : 'Your membership is active'}
                            </h1>
                            <p className="mx-auto max-w-md text-slate-600">
                                {scheduled
                                    ? `You’ll move to ${quote?.planName} on ${formatDate(quote?.effectiveAt)}.`
                                    : `${(subscription || me.subscription)?.planName || payment?.planName} · next renewal ${formatDate((subscription || me.subscription)?.currentPeriodEnd)}.`}
                            </p>
                            <MembershipDisclaimer text={me.disclaimer} className="text-left" />
                            <div className="flex flex-col justify-center gap-3 sm:flex-row">
                                <Link to="/writer/dashboard" className="rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white">Go to dashboard</Link>
                                <Link to="/writer/membership" className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-[#002147]">View membership</Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
