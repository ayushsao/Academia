import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Spinner } from '../../../../components/writer/WriterBits';
import { BASE, Label, fieldClass } from './shared';

type Tier = { multiplier: number; minHours: number };
type Key = 'STANDARD' | 'EXPRESS' | 'URGENT' | 'EMERGENCY';
type Pricing = {
    tiers: Record<Key, Tier>;
    limits: { multiplierMin: number; multiplierMax: number; minNoticeHours: number };
    baseRatePerWord: number;
    exchangeRates: { rates: Record<string, number>; at: string; source: string };
};
const KEYS: Key[] = ['STANDARD', 'EXPRESS', 'URGENT', 'EMERGENCY'];
const LABEL: Record<Key, string> = { STANDARD: 'Standard', EXPRESS: 'Express', URGENT: 'Urgent', EMERGENCY: 'Emergency' };
const days = (h: number) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? '' : 's'}` : `${h} hours`);

// Standard orders are priced by words: ₹ per word × the delivery type's multiplier,
// then converted to the customer's currency. Customers only ever see the final price.
export default function OrderPricingPanel({ token }: { token: string }) {
    const [data, setData] = useState<Pricing | null>(null);
    const [tiers, setTiers] = useState<Record<Key, Tier> | null>(null);
    const [saved, setSaved] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const load = (d: { pricing: Pricing }) => { setData(d.pricing); setTiers(d.pricing.tiers); setSaved(JSON.stringify(d.pricing.tiers)); };
    useEffect(() => { api<{ pricing: Pricing }>(`${BASE}/word-pricing`, { token }).then(load).catch(e => setError(e.message)); }, [token]);
    if (!data || !tiers) return error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>;

    const { multiplierMin: min, multiplierMax: max } = data.limits;
    const set = (k: Key, patch: Partial<Tier>) => { setTiers(t => t && { ...t, [k]: { ...t[k], ...patch } }); setDone(false); };
    const dirty = JSON.stringify(tiers) !== saved;
    const outOfRange = KEYS.some(k => !(tiers[k].multiplier >= min && tiers[k].multiplier <= max));
    const save = async () => {
        setBusy(true); setError('');
        try { load(await api<{ pricing: Pricing }>(`${BASE}/word-pricing`, { method: 'PUT', token, body: { tiers } })); setDone(true); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const window = (k: Key) => {
        const i = KEYS.indexOf(k);
        if (k === 'STANDARD') return `${days(tiers.STANDARD.minHours)} or more`;
        if (k === 'EMERGENCY') return `under ${days(tiers.URGENT.minHours)}`;
        return `${days(tiers[k].minHours)} to ${days(tiers[KEYS[i - 1]].minHours)}`;
    };
    const fx = data.exchangeRates;

    return (
        <div className="space-y-5">
            <p className="text-sm text-gray-500">
                Standard orders are priced by words: <strong className="text-[#000a1e]">₹{data.baseRatePerWord} per word × the delivery multiplier</strong>, then converted to the customer's currency at the latest exchange rate.
                The delivery type is picked from the deadline. Customers see only the delivery type, words, pages, deadline and the final price. Spacing changes the page count only.
            </p>
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#000a1e]">Delivery multipliers</h3>
                <p className="mt-1 text-xs text-gray-500">Each multiplier must be between {min}× and {max}×, and a closer deadline can't cost less.</p>
                <ul className="mt-4 space-y-3">
                    {KEYS.map(k => (
                        <li key={k} className="grid items-end gap-3 sm:grid-cols-[9rem_8rem_10rem_1fr]">
                            <div className="pb-2.5 font-semibold text-[#000a1e]">{LABEL[k]}</div>
                            <div>
                                <Label htmlFor={`m-${k}`}>Multiplier (×)</Label>
                                <input id={`m-${k}`} type="number" step="0.1" min={min} max={max} value={tiers[k].multiplier} onChange={e => set(k, { multiplier: Number(e.target.value) })} className={fieldClass} />
                            </div>
                            <div>
                                {k === 'EMERGENCY' ? <p className="pb-2.5 text-xs text-gray-400">Anything shorter</p> : <>
                                    <Label htmlFor={`h-${k}`}>From (hours before)</Label>
                                    <input id={`h-${k}`} type="number" min={data.limits.minNoticeHours} max={2160} value={tiers[k].minHours} onChange={e => set(k, { minHours: Number(e.target.value) })} className={fieldClass} />
                                </>}
                            </div>
                            <p className="pb-2.5 text-sm text-gray-500">Deadline {window(k)} · 1,000 words = <strong className="text-[#000a1e]">₹{Math.round(1000 * data.baseRatePerWord * (tiers[k].multiplier || 0)).toLocaleString('en-IN')}</strong></p>
                        </li>
                    ))}
                </ul>
            </section>
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#000a1e]">Exchange rates (₹1 =)</h3>
                <p className="mt-1 text-xs text-gray-500">
                    {fx.source === 'live' ? 'Latest rates' : fx.source === 'stored' ? 'Last saved rates (live rates unavailable right now)' : 'Fallback rates (live rates unavailable)'} · updated {new Date(fx.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. Each order keeps the rate it was priced with.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(fx.rates).filter(([c]) => c !== 'INR').map(([c, r]) => <span key={c} className="rounded-lg bg-gray-50 px-3 py-1.5 text-sm text-gray-700">{c} {Number(r).toPrecision(4)}</span>)}
                </div>
            </section>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
            {outOfRange && <p className="text-sm font-medium text-red-600">Multipliers must be between {min}× and {max}×.</p>}
            <button onClick={save} disabled={!dirty || busy || outOfRange} className="inline-flex items-center gap-2 rounded-xl bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? 'Saving…' : done && !dirty ? <><Check className="h-4 w-4" /> Saved</> : 'Save order pricing'}
            </button>
        </div>
    );
}
