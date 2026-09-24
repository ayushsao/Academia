import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '../../../../lib/api';
import { currencyDigits, formatMoney, fromMinor } from '../../../../lib/money';
import { Spinner } from '../../../../components/writer/WriterBits';
import { inputClass } from '../../../../components/writer/FormKit';
import { cn } from '../../../../lib/utils';

type PriceRow = { currency: string; billingPeriod: 'MONTHLY' | 'ANNUAL'; amount: string; discountPercent: string; isActive: boolean };
type AdminPlan = {
    id: string; code: string; name: string; description: string; features: string[]; tier: number; sortOrder: number; highlight: boolean; isActive: boolean;
    prices: { currency: string; billingPeriod: 'MONTHLY' | 'ANNUAL'; amountMinor: number; discountPercent: number; isActive: boolean }[]; activeSubscribers: number;
};
type Draft = Omit<AdminPlan, 'id' | 'prices' | 'activeSubscribers' | 'features' | 'tier' | 'sortOrder'> & { id?: string; features: string; tier: string; sortOrder: string; prices: PriceRow[] };

const toDraft = (p?: AdminPlan): Draft => p ? {
    id: p.id, code: p.code, name: p.name, description: p.description, features: p.features.join('\n'), tier: String(p.tier), sortOrder: String(p.sortOrder),
    highlight: p.highlight, isActive: p.isActive,
    prices: p.prices.map(x => ({ currency: x.currency, billingPeriod: x.billingPeriod, amount: String(fromMinor(x.amountMinor, x.currency)), discountPercent: String(x.discountPercent), isActive: x.isActive })),
} : { code: '', name: '', description: '', features: '', tier: '', sortOrder: '0', highlight: false, isActive: false, prices: [] };

function Editor({ draft: initial, currencies, token, onSaved, onCancel }: { draft: Draft; currencies: string[]; token: string; onSaved: () => void; onCancel: () => void }) {
    const [d, setD] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));
    const setPrice = (i: number, patch: Partial<PriceRow>) => set('prices', d.prices.map((p, j) => (j === i ? { ...p, ...patch } : p)));

    const save = async () => {
        setBusy(true); setError('');
        try {
            const body = {
                code: d.code.trim().toUpperCase(), name: d.name, description: d.description,
                features: d.features.split('\n').map(f => f.trim()).filter(Boolean), tier: Number(d.tier), sortOrder: Number(d.sortOrder) || 0,
                highlight: d.highlight, isActive: d.isActive,
                prices: d.prices.map(p => ({ currency: p.currency, billingPeriod: p.billingPeriod, amount: Number(p.amount), discountPercent: Number(p.discountPercent) || 0, isActive: p.isActive })),
            };
            if (body.prices.some(p => !Number.isFinite(p.amount) || p.amount < 0)) throw new Error('Every price needs a valid amount.');
            await api(d.id ? `/admin/membership/plans/${d.id}` : '/admin/membership/plans', { method: d.id ? 'PUT' : 'POST', token, body });
            onSaved();
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };

    return (
        <div className="space-y-5 rounded-2xl border border-[#fea520]/50 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-4">
                <label className="text-sm font-semibold text-gray-700">Code<input className={cn(inputClass, 'mt-1 py-2 uppercase')} value={d.code} disabled={!!d.id} onChange={e => set('code', e.target.value)} placeholder="e.g. BASIC" /></label>
                <label className="text-sm font-semibold text-gray-700 sm:col-span-2">Name<input className={cn(inputClass, 'mt-1 py-2')} value={d.name} maxLength={40} onChange={e => set('name', e.target.value)} /></label>
                <label className="text-sm font-semibold text-gray-700">Tier<input className={cn(inputClass, 'mt-1 py-2')} inputMode="numeric" value={d.tier} onChange={e => set('tier', e.target.value.replace(/\D/g, ''))} title="Higher tier = upgrade" /></label>
                <label className="text-sm font-semibold text-gray-700 sm:col-span-4">Description<input className={cn(inputClass, 'mt-1 py-2')} value={d.description} maxLength={200} onChange={e => set('description', e.target.value)} /></label>
                <label className="text-sm font-semibold text-gray-700 sm:col-span-3">Features <span className="font-normal text-gray-400">(one per line — describe access, never promise work or income)</span>
                    <textarea rows={4} className={cn(inputClass, 'mt-1 text-sm')} value={d.features} onChange={e => set('features', e.target.value)} /></label>
                <div className="space-y-3 text-sm">
                    <label className="block font-semibold text-gray-700">Sort order<input className={cn(inputClass, 'mt-1 py-2')} inputMode="numeric" value={d.sortOrder} onChange={e => set('sortOrder', e.target.value.replace(/\D/g, ''))} /></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={d.highlight} onChange={e => set('highlight', e.target.checked)} className="h-4 w-4 accent-[#000a1e]" /> Highlight as “Most popular”</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={d.isActive} onChange={e => set('isActive', e.target.checked)} className="h-4 w-4 accent-[#000a1e]" /> Active (available to buy)</label>
                </div>
            </div>

            <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">Prices <span className="font-normal text-gray-400">— list price per period; discount applies at checkout and renewal</span></p>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                        <thead><tr className="text-left text-xs uppercase tracking-wider text-gray-400"><th className="py-1 pr-2">Currency</th><th className="py-1 pr-2">Billing</th><th className="py-1 pr-2">Amount</th><th className="py-1 pr-2">Discount %</th><th className="py-1 pr-2">Charged</th><th className="py-1 pr-2">Active</th><th /></tr></thead>
                        <tbody>
                            {d.prices.map((p, i) => {
                                const amt = Number(p.amount), disc = Number(p.discountPercent) || 0;
                                const charged = Number.isFinite(amt) ? Math.round(amt * 10 ** currencyDigits(p.currency) * (100 - disc) / 100) : 0;
                                return (
                                    <tr key={i}>
                                        <td className="py-1 pr-2"><select className={cn(inputClass, 'py-1.5')} value={p.currency} onChange={e => setPrice(i, { currency: e.target.value })}>{currencies.map(c => <option key={c}>{c}</option>)}</select></td>
                                        <td className="py-1 pr-2"><select className={cn(inputClass, 'py-1.5')} value={p.billingPeriod} onChange={e => setPrice(i, { billingPeriod: e.target.value as PriceRow['billingPeriod'] })}><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select></td>
                                        <td className="py-1 pr-2"><input className={cn(inputClass, 'py-1.5 tabular-nums')} inputMode="decimal" value={p.amount} onChange={e => setPrice(i, { amount: e.target.value.replace(/[^\d.]/g, '') })} /></td>
                                        <td className="py-1 pr-2"><input className={cn(inputClass, 'w-20 py-1.5 tabular-nums')} inputMode="numeric" value={p.discountPercent} onChange={e => setPrice(i, { discountPercent: e.target.value.replace(/[^\d.]/g, '') })} /></td>
                                        <td className="py-1 pr-2 tabular-nums text-gray-600">{formatMoney(charged, p.currency)}</td>
                                        <td className="py-1 pr-2"><input type="checkbox" checked={p.isActive} onChange={e => setPrice(i, { isActive: e.target.checked })} className="h-4 w-4 accent-[#000a1e]" aria-label="Price active" /></td>
                                        <td className="py-1"><button onClick={() => set('prices', d.prices.filter((_, j) => j !== i))} aria-label="Remove price" className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <button onClick={() => set('prices', [...d.prices, { currency: currencies[0] || 'USD', billingPeriod: 'MONTHLY', amount: '', discountPercent: '0', isActive: true }])}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700"><Plus className="h-4 w-4" /> Add price</button>
            </div>
            <p className="text-xs text-gray-500">Price changes apply to new checkouts and future renewals. Current billing periods are not affected.</p>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
            <div className="flex gap-2">
                <button onClick={save} disabled={busy} className="rounded-xl bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save plan'}</button>
                <button onClick={onCancel} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
            </div>
        </div>
    );
}

export default function PlansPanel({ token, onViewSubscribers }: { token: string; onViewSubscribers?: (planCode: string) => void }) {
    const [plans, setPlans] = useState<AdminPlan[] | null>(null);
    const [currencies, setCurrencies] = useState<string[]>([]);
    const [editing, setEditing] = useState<Draft | null>(null);
    const [error, setError] = useState('');
    const load = async () => {
        try {
            const [p, s] = await Promise.all([
                api<{ plans: AdminPlan[] }>('/admin/membership/plans', { token }),
                api<{ settings: { currencies: { code: string }[] } }>('/admin/membership/settings', { token }),
            ]);
            setPlans(p.plans); setCurrencies(s.settings.currencies.map(c => c.code));
        } catch (e) { setError((e as Error).message); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [token]);

    const toggle = async (p: AdminPlan) => {
        setError('');
        try { await api(`/admin/membership/plans/${p.id}/status`, { method: 'PATCH', token, body: { isActive: !p.isActive } }); load(); }
        catch (e) { setError((e as Error).message); }
    };

    if (!plans) return error ? <p className="text-sm text-red-600">{error}</p> : <div className="flex justify-center py-12"><Spinner className="h-7 w-7 text-[#fea520]" /></div>;
    return (
        <div className="space-y-4">
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
            {editing ? <Editor draft={editing} currencies={currencies} token={token} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} /> : (
                <button onClick={() => setEditing(toDraft())} className="inline-flex items-center gap-1.5 rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> New plan</button>
            )}
            <div className="grid gap-4 lg:grid-cols-3">
                {plans.map(p => (
                    <div key={p.id} className={cn('rounded-2xl border bg-white p-5 shadow-sm', p.isActive ? 'border-gray-100' : 'border-dashed border-gray-300')}>
                        <div className="flex items-start justify-between gap-2">
                            <div><p className="font-bold text-[#000a1e]">{p.name} <span className="text-xs font-normal text-gray-400">{p.code} · tier {p.tier}</span></p><p className="text-sm text-gray-500">{p.description}</p></div>
                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}>{p.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                        <p className="mt-3 text-xs text-gray-500">{p.activeSubscribers} active subscriber{p.activeSubscribers === 1 ? '' : 's'} · {p.prices.filter(x => x.isActive).length} active prices</p>
                        <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
                            {p.prices.filter(x => x.isActive && x.billingPeriod === 'MONTHLY').map(x => (
                                <li key={x.currency} className="rounded-md bg-gray-50 px-2 py-1 tabular-nums text-gray-700">{formatMoney(Math.round(x.amountMinor * (100 - x.discountPercent) / 100), x.currency)}/mo{x.discountPercent ? ` (−${x.discountPercent}%)` : ''}</li>
                            ))}
                        </ul>
                        <div className="mt-4 flex gap-2">
                            <button onClick={() => setEditing(toDraft(p))} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                            <button onClick={() => toggle(p)} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', p.isActive ? 'text-red-600 hover:bg-red-50' : 'bg-emerald-600 text-white')}>{p.isActive ? 'Deactivate' : 'Activate'}</button>
                            {onViewSubscribers && <button onClick={() => onViewSubscribers(p.code)} className="ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-[#002147] hover:bg-slate-50">View subscribers →</button>}
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-xs text-gray-500">Deactivating a plan hides it from new writers; existing subscribers keep renewing on it.</p>
        </div>
    );
}
