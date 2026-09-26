import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Spinner } from '../../../../components/writer/WriterBits';
import { BASE, Label, fieldClass } from './shared';

type Tier = { multiplier: number; minHours: number };
type Key = 'STANDARD' | 'EXPRESS' | 'URGENT' | 'EMERGENCY';
type Mode = 'SMOOTH' | 'STEPS';
type Pricing = {
    mode: Mode;
    tiers: Record<Key, Tier>;
    limits: { multiplierMin: number; multiplierMax: number; minNoticeHours: number };
    baseRatePerWord: number;
    exchangeRates: { rates: Record<string, number>; at: string; source: string };
};
const KEYS: Key[] = ['STANDARD', 'EXPRESS', 'URGENT', 'EMERGENCY'];
const LABEL: Record<Key, string> = { STANDARD: 'Standard', EXPRESS: 'Express', URGENT: 'Urgent', EMERGENCY: 'Emergency' };
// Same rule as the server (services/wordPricing.js multiplierFor) — for the preview only.
function multiplierAt(hours: number, mode: Mode, tiers: Record<Key, Tier>, minNotice: number) {
    const type: Key = hours >= tiers.STANDARD.minHours ? 'STANDARD' : hours >= tiers.EXPRESS.minHours ? 'EXPRESS' : hours >= tiers.URGENT.minHours ? 'URGENT' : 'EMERGENCY';
    if (mode === 'STEPS') return { type, m: tiers[type].multiplier };
    const pts: [number, number][] = [[tiers.STANDARD.minHours, tiers.STANDARD.multiplier], [tiers.EXPRESS.minHours, tiers.EXPRESS.multiplier], [tiers.URGENT.minHours, tiers.URGENT.multiplier], [minNotice, tiers.EMERGENCY.multiplier]];
    if (hours >= pts[0][0]) return { type, m: pts[0][1] };
    for (let i = 1; i < pts.length; i++) {
        const [h1, m1] = pts[i - 1], [h2, m2] = pts[i];
        if (hours >= h2) return { type, m: Math.round((m1 + (m2 - m1) * (h1 > h2 ? (h1 - hours) / (h1 - h2) : 1)) * 100) / 100 };
    }
    return { type, m: pts[3][1] };
}
const PREVIEW_HOURS = [240, 168, 120, 96, 72, 48, 36, 24, 12, 6, 3];
const days = (h: number) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? '' : 's'}` : `${h} hours`);

// Standard orders are priced by words: ₹ per word × the delivery type's multiplier,
// then converted to the customer's currency. Customers only ever see the final price.
export default function OrderPricingPanel({ token }: { token: string }) {
    const [data, setData] = useState<Pricing | null>(null);
    const [tiers, setTiers] = useState<Record<Key, Tier> | null>(null);
    const [mode, setMode] = useState<Mode>('SMOOTH');
    const [saved, setSaved] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const load = (d: { pricing: Pricing }) => { setData(d.pricing); setTiers(d.pricing.tiers); setMode(d.pricing.mode || 'SMOOTH'); setSaved(JSON.stringify({ mode: d.pricing.mode || 'SMOOTH', tiers: d.pricing.tiers })); };
    useEffect(() => { api<{ pricing: Pricing }>(`${BASE}/word-pricing`, { token }).then(load).catch(e => setError(e.message)); }, [token]);
    if (!data || !tiers) return error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>;

    const { multiplierMin: min, multiplierMax: max } = data.limits;
    const set = (k: Key, patch: Partial<Tier>) => { setTiers(t => t && { ...t, [k]: { ...t[k], ...patch } }); setDone(false); };
    const dirty = JSON.stringify({ mode, tiers }) !== saved;
    const outOfRange = KEYS.some(k => !(tiers[k].multiplier >= min && tiers[k].multiplier <= max));
    const save = async () => {
        setBusy(true); setError('');
        try { load(await api<{ pricing: Pricing }>(`${BASE}/word-pricing`, { method: 'PUT', token, body: { mode, tiers } })); setDone(true); }
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="font-bold text-[#000a1e]">Delivery multipliers</h3>
                        <p className="mt-1 text-xs text-gray-500">Each multiplier must be between {min}× and {max}×, and a closer deadline can't cost less.</p>
                    </div>
                    <div role="radiogroup" aria-label="How the price rises" className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
                        {([['SMOOTH', 'Gradual'], ['STEPS', 'Fixed steps']] as const).map(([v, l]) => (
                            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => { setMode(v); setDone(false); }}
                                className={`rounded-lg px-3 py-1.5 ${mode === v ? 'bg-white text-[#000a1e] shadow-sm' : 'text-gray-500 hover:text-[#000a1e]'}`}>{l}</button>
                        ))}
                    </div>
                </div>
                <p className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    {mode === 'SMOOTH'
                        ? <>Gradual: the price rises a little with every hour closer to the deadline. Each type's multiplier applies exactly at its "From" point (Emergency at {data.limits.minNoticeHours} hours), and deadlines in between are priced in between.</>
                        : <>Fixed steps: every deadline within a delivery type pays that type's multiplier.</>}
                </p>
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
                            <p className="pb-2.5 text-sm text-gray-500">Deadline {window(k)} · 1,000 words {mode === 'SMOOTH' ? (k === 'STANDARD' ? 'from' : 'up to') : '='} <strong className="text-[#000a1e]">₹{Math.round(1000 * data.baseRatePerWord * (tiers[k].multiplier || 0)).toLocaleString('en-IN')}</strong></p>
                        </li>
                    ))}
                </ul>
            </section>
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#000a1e]">Preview</h3>
                <p className="mt-1 text-xs text-gray-500">What 1,000 words cost for different deadlines with the settings above (before saving).</p>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm" data-testid="pricing-preview">
                        <thead><tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400"><th className="py-2 font-semibold">Deadline in</th><th className="py-2 font-semibold">Delivery type</th><th className="py-2 font-semibold">Multiplier</th><th className="py-2 text-right font-semibold">1,000 words</th></tr></thead>
                        <tbody>
                            {PREVIEW_HOURS.map(h => { const { type, m } = multiplierAt(h, mode, tiers, data.limits.minNoticeHours); return (
                                <tr key={h} className="border-b border-gray-50"><td className="py-2 text-gray-600">{days(h)}</td><td className="py-2 text-gray-600">{LABEL[type]}</td><td className="py-2 font-semibold text-[#000a1e]">{m}×</td><td className="py-2 text-right font-semibold text-[#000a1e]">₹{Math.round(1000 * data.baseRatePerWord * m).toLocaleString('en-IN')}</td></tr>
                            ); })}
                        </tbody>
                    </table>
                </div>
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
