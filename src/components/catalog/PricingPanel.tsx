import React, { useEffect, useState } from 'react';
import { ArrowRight, Calculator, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatMoney, currencyName } from '../../lib/money';
import type { PricingRate, PublicPricing, PublicQuote } from '../../lib/catalogContent';

type Ids = { subjectId: string; serviceId: string | null; projectId: string | null };
export type PricingChoice = { currency: string; words: number; spacing: string };

const CURRENCY_KEY = 'catalog.currency';
const readCurrency = () => { try { return localStorage.getItem(CURRENCY_KEY) || ''; } catch { return ''; } };
const saveCurrency = (c: string) => { try { localStorage.setItem(CURRENCY_KEY, c); } catch { /* storage unavailable */ } };
const query = (ids: Ids) => new URLSearchParams(Object.entries(ids).filter(([, v]) => v) as [string, string][]).toString();

/**
 * Live pricing for a catalogue page. Every number comes from the admin's
 * active pricing rule (GET /api/catalog/pricing); totals come from the server
 * quote. Renders nothing when no price is set for this selection.
 */
export function PricingPanel({ ids, onOrder }: { ids: Ids; onOrder: (choice: PricingChoice) => void }) {
    const [pricing, setPricing] = useState<PublicPricing | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);
    const [currency, setCurrency] = useState('');
    const [words, setWords] = useState(0);
    const [spacing, setSpacing] = useState('');
    const [quote, setQuote] = useState<PublicQuote | null>(null);
    const [quoteError, setQuoteError] = useState('');
    const qs = query(ids);

    useEffect(() => {
        const ctrl = new AbortController();
        setState('loading');
        api<{ pricing: PublicPricing }>(`/catalog/pricing?${qs}`, { signal: ctrl.signal })
            .then(({ pricing: p }) => {
                if (!p.rates.length) { setPricing(null); setState('none'); return; }
                const saved = readCurrency();
                const rate = p.rates.find(r => r.currency === saved) || p.rates[0];
                setPricing(p); setCurrency(rate.currency); setSpacing(p.defaultSpacing);
                setWords(w => w || rate.wordsPerPage); setState('ready');
            })
            .catch(e => { if (e?.name === 'AbortError') return; setPricing(null); setState(e instanceof ApiError && e.status === 404 ? 'none' : 'error'); });
        return () => ctrl.abort();
    }, [qs, attempt]);

    // Server-side quote for the calculator (debounced).
    useEffect(() => {
        if (state !== 'ready' || !currency || !(words > 0)) { setQuote(null); return; }
        const ctrl = new AbortController();
        const t = setTimeout(() => {
            api<{ quote: PublicQuote }>('/catalog/quote', { method: 'POST', signal: ctrl.signal, body: { ...Object.fromEntries(new URLSearchParams(qs)), words, spacing, currency } })
                .then(r => { setQuote(r.quote); setQuoteError(''); })
                .catch(e => { if (e?.name !== 'AbortError') { setQuote(null); setQuoteError((e as Error).message); } });
        }, 300);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [state, qs, currency, words, spacing]);

    if (state === 'none') return null;
    if (state === 'loading') return <div className="h-64 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-gray-100" aria-label="Loading pricing" />;
    if (state === 'error' || !pricing) return (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
            Pricing couldn’t be loaded right now.
            <button onClick={() => setAttempt(a => a + 1)} className="inline-flex items-center gap-1.5 font-semibold text-[#002147] underline"><RefreshCw className="h-3.5 w-3.5" /> Try again</button>
        </p>
    );

    const rate = pricing.rates.find(r => r.currency === currency) || pricing.rates[0];
    const pick = (c: string) => { setCurrency(c); saveCurrency(c); };
    const money = (minor: number) => formatMoney(minor, rate.currency);
    const stats: { label: string; value: string; hint?: string; testid: string }[] = [
        { label: 'Words per page', value: rate.wordsPerPage.toLocaleString(), testid: 'words-per-page' },
        { label: 'Base price', value: money(rate.basePriceMinor), hint: 'per page', testid: 'base-price' },
        { label: 'Multiplier', value: `×${rate.multiplier}`, testid: 'multiplier' },
        { label: 'Final price', value: money(rate.unitPriceMinor), hint: 'per page', testid: 'final-price' },
        { label: 'Currency', value: rate.currency, hint: currencyName(rate.currency), testid: 'currency' },
    ];

    return (
        <section id="pricing" className="scroll-mt-24 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100" data-testid="pricing-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-7">
                <h2 className="text-xl font-bold text-[#000a1e] md:text-2xl">Pricing</h2>
                {pricing.rates.length > 1 && (
                    <div className="flex rounded-full bg-gray-100 p-1" role="group" aria-label="Currency">
                        {pricing.rates.map((r: PricingRate) => (
                            <button key={r.currency} onClick={() => pick(r.currency)} aria-pressed={r.currency === rate.currency}
                                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${r.currency === rate.currency ? 'bg-white text-[#000a1e] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{r.currency}</button>
                        ))}
                    </div>
                )}
            </div>

            <dl className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-3 lg:grid-cols-5">
                {stats.map(s => (
                    // The fifth tile fills the last row on 2- and 3-column layouts.
                    <div key={s.label} className={`bg-white px-5 py-4 sm:px-7 ${s.testid === 'final-price' ? 'bg-[#fff9ef]' : ''} ${s.testid === 'currency' ? 'col-span-2 lg:col-span-1' : ''}`}>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">{s.label}</dt>
                        <dd className="mt-1.5 text-xl font-bold text-[#000a1e] md:text-2xl" data-testid={s.testid}>{s.value}</dd>
                        {s.hint && <dd className="text-xs text-gray-500">{s.hint}</dd>}
                    </div>
                ))}
            </dl>

            <div className="grid gap-4 px-5 py-5 sm:px-7 md:grid-cols-[1fr_auto] md:items-end">
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500"><Calculator className="h-3.5 w-3.5" /> Word count</span>
                        <input type="number" min={1} max={1000000} inputMode="numeric" value={words || ''} aria-label="Word count"
                            onChange={e => setWords(Math.max(0, Math.min(1_000_000, parseInt(e.target.value, 10) || 0)))}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base font-semibold text-[#000a1e] outline-none focus:border-[#fea520] focus:bg-white" />
                    </label>
                    {pricing.spacingOptions.length > 1 && (
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Spacing</span>
                            <select value={spacing} onChange={e => setSpacing(e.target.value)} aria-label="Spacing"
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base font-semibold text-[#000a1e] outline-none focus:border-[#fea520] focus:bg-white">
                                {pricing.spacingOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                            </select>
                        </label>
                    )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 md:justify-end">
                    <div className="text-right" aria-live="polite">
                        {quote ? (
                            <>
                                <p className="text-xs text-gray-500" data-testid="quote-pages">{quote.pages} {quote.pages === 1 ? 'page' : 'pages'} × {formatMoney(quote.unitPriceMinor, quote.currency)}</p>
                                <p className="text-2xl font-bold text-[#000a1e]" data-testid="quote-total">{formatMoney(quote.totalMinor, quote.currency)}</p>
                            </>
                        ) : <p className="text-sm text-gray-500">{quoteError || 'Enter a word count'}</p>}
                    </div>
                    <button onClick={() => onOrder({ currency: rate.currency, words, spacing })}
                        className="inline-flex items-center gap-2 rounded-full bg-[#000a1e] px-6 py-3 font-semibold text-white transition hover:bg-[#002147]">
                        Order now <ArrowRight className="h-4 w-4 text-[#fea520]" />
                    </button>
                </div>
            </div>
        </section>
    );
}
