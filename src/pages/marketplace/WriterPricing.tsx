import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Info } from 'lucide-react';
import { MarketplaceNavbar as Navbar } from '../../components/writer/MarketplaceNavbar';
import { Footer } from '../../components/Footer';
import { BillingToggle } from '../../components/writer/MembershipBits';
import { Spinner } from '../../components/writer/WriterBits';
import { inputClass } from '../../components/writer/FormKit';
import { api } from '../../lib/api';
import { formatMoney, currencyName } from '../../lib/money';
import { useMarketplaceContent } from '../../lib/marketplaceContent';
import type { BillingPeriod, PublicPlan } from '../../lib/membershipTypes';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { ContactStrip } from './BecomeWriter';

type Catalogue = { plans: PublicPlan[]; currencies: string[]; suggestedCurrency: string; disclaimer: string };

// Public membership pricing. Plans, prices and features come from the plan
// catalogue (Admin → Memberships → Plans); headings, taglines, notes and FAQ from
// Admin → Site Content. Prices are for display: checkout re-prices on the server.
export default function WriterPricing() {
    const isWriter = useStore(s => Boolean(s.writer));
    const { data: content } = useMarketplaceContent();
    const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
    const [error, setError] = useState('');
    const [period, setPeriod] = useState<BillingPeriod>('MONTHLY');
    const [currency, setCurrency] = useState('');

    useEffect(() => {
        api<Catalogue>('/membership/plans').then(c => { setCatalogue(c); setCurrency(c.suggestedCurrency || c.currencies[0] || 'USD'); })
            .catch(e => setError(e.message));
    }, []);

    const annualSaving = useMemo(() => {
        if (!catalogue) return 0;
        return Math.max(0, ...catalogue.plans.map(p => {
            const m = p.prices.find(x => x.currency === currency && x.billingPeriod === 'MONTHLY');
            const a = p.prices.find(x => x.currency === currency && x.billingPeriod === 'ANNUAL');
            return m && a ? Math.round((1 - a.amountMinor / (m.amountMinor * 12)) * 100) : 0;
        }));
    }, [catalogue, currency]);

    const cta = isWriter ? { href: '/writer/membership', label: 'Choose in your dashboard' } : { href: '/writer/register', label: 'Apply to join' };
    const pricing = content?.content.pricing;

    return (
        <div className="flex min-h-screen flex-col bg-[#f6f8fc] font-sans">
            <Navbar />
            <main className="flex-grow px-4 pb-24 pt-10 sm:px-6 lg:pt-14">
                <div className="mx-auto max-w-6xl">
                    <header className="mx-auto max-w-2xl text-center">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b86e00]">For approved writers</p>
                        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-[#0b1b33] sm:text-5xl">{pricing?.title || 'Writer membership'}</h1>
                        {pricing?.subtitle && <p className="mt-4 text-lg leading-relaxed text-slate-600">{pricing.subtitle}</p>}
                    </header>

                    {error && <p className="mt-10 text-center text-slate-600">We couldn’t load plans right now. Please refresh to try again.</p>}
                    {!catalogue && !error && <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-[#002147]" /></div>}

                    {catalogue && (
                        <>
                            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                                <BillingToggle value={period} onChange={setPeriod} annualSavingPercent={annualSaving} />
                                {catalogue.currencies.length > 1 && (
                                    <select aria-label="Currency" value={currency} onChange={e => setCurrency(e.target.value)} className={cn(inputClass, 'w-full py-2.5 sm:w-60')}>
                                        {catalogue.currencies.map(c => <option key={c} value={c}>{c} · {currencyName(c)}</option>)}
                                    </select>
                                )}
                            </div>

                            {catalogue.plans.length === 0 ? (
                                <p className="mt-12 rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-600">Membership plans will be published soon.</p>
                            ) : (
                                <div className={cn('mt-10 grid gap-5', catalogue.plans.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 md:max-w-3xl md:mx-auto')}>
                                    {catalogue.plans.map(plan => {
                                        const price = plan.prices.find(p => p.currency === currency && p.billingPeriod === period);
                                        const monthly = plan.prices.find(p => p.currency === currency && p.billingPeriod === 'MONTHLY');
                                        const note = pricing?.planNotes?.[plan.code];
                                        return (
                                            <article key={plan.code} className={cn('relative flex flex-col rounded-3xl border bg-white p-6 sm:p-8', plan.highlight ? 'border-[#002147] shadow-[0_30px_80px_-40px_rgba(0,33,71,0.55)] ring-2 ring-[#002147]/10' : 'border-slate-200')}>
                                                {(note?.tagline || plan.highlight) && (
                                                    <span className={cn('absolute -top-3 left-6 rounded-full px-3 py-0.5 text-xs font-bold', plan.highlight ? 'bg-[#fea520] text-[#0b1b33]' : 'bg-slate-100 text-slate-700')}>{note?.tagline || 'Most popular'}</span>
                                                )}
                                                <h2 className="text-xl font-bold text-[#0b1b33]">{plan.name}</h2>
                                                {note?.bestFor && <p className="mt-1 text-sm font-medium text-[#b86e00]">{note.bestFor}</p>}
                                                <p className="mt-2 min-h-[2.5rem] text-sm leading-relaxed text-slate-600">{plan.description}</p>
                                                <div className="mt-5">
                                                    {price ? (
                                                        <>
                                                            <p className="text-4xl font-extrabold tracking-tight text-[#0b1b33]">{formatMoney(price.amountMinor, currency)}<span className="text-base font-medium text-slate-500"> /{period === 'ANNUAL' ? 'year' : 'month'}</span></p>
                                                            <p className="mt-1 min-h-[1.25rem] text-sm">
                                                                {price.discountPercent > 0 && <><span className="text-slate-400 line-through">{formatMoney(price.listAmountMinor, currency)}</span> <span className="font-semibold text-emerald-700">{price.discountPercent}% off</span> </>}
                                                                {period === 'ANNUAL' && monthly && <span className="text-slate-500">≈ {formatMoney(Math.round(price.amountMinor / 12), currency)}/month</span>}
                                                            </p>
                                                        </>
                                                    ) : <p className="text-sm text-slate-500">Not offered {period === 'ANNUAL' ? 'annually' : 'monthly'} in {currency}.</p>}
                                                </div>
                                                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-700">
                                                    {plan.features.map(f => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{f}</li>)}
                                                </ul>
                                                <Link to={cta.href} className={cn('mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition', plan.highlight ? 'bg-[#002147] text-white hover:bg-[#0b2f5c]' : 'border border-[#002147] text-[#002147] hover:bg-[#002147]/5')}>
                                                    {cta.label} <ArrowRight className="h-4 w-4" />
                                                </Link>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}

                            <p className="mx-auto mt-8 flex max-w-3xl items-start gap-2 rounded-2xl bg-white px-5 py-4 text-sm text-slate-600 ring-1 ring-slate-200">
                                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#002147]" />
                                <span>{catalogue.disclaimer}{pricing?.footnote ? ` ${pricing.footnote}` : ''}</span>
                            </p>
                            {!isWriter && <p className="mt-4 text-center text-sm text-slate-500">Membership is available once your application is approved. <Link to="/become-a-writer" className="font-semibold text-[#002147] hover:underline">How applying works</Link></p>}
                        </>
                    )}

                    {pricing && pricing.faq.length > 0 && (
                        <section className="mx-auto mt-16 max-w-3xl">
                            <h2 className="text-center text-2xl font-extrabold tracking-tight text-[#0b1b33] sm:text-3xl">Membership questions</h2>
                            <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                                {pricing.faq.map(f => (
                                    <details key={f.q} className="group px-5 py-4 sm:px-6">
                                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#0b1b33]">
                                            {f.q}<ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
                                        </summary>
                                        <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600">{f.a}</p>
                                    </details>
                                ))}
                            </div>
                            {content && <ContactStrip contact={content.content.contact} />}
                            <p className="mt-6 text-center text-xs text-slate-500">See the <Link to="/writer-terms" className="font-semibold text-[#002147] underline">writer terms</Link> for billing and cancellation details.</p>
                        </section>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
