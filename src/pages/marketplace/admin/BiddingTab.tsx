import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatOrderTotal } from '../../../lib/money';
import { Label, fieldClass } from './catalog/shared';

// Admin/HR → Writer Bidding: open new orders for writer bids, set and change the
// writer budget, and accept a bid. The customer's price is shown here as the
// internal price for admins only — writers only ever see the budget.

type Bidding = { open: boolean; minBid: number; maxBid: number; currency: string; openedAt?: string; closedAt?: string } | null;
type Row = {
    orderId: string; service: string; subject: string; topicTitle: string; pages: number; wordCount?: number; deadline: string;
    totalAmount: number; currency?: string; bidding?: Bidding; adminApproved?: boolean; openBids: number; createdAt: string;
    // The limit the admin's rates give for this order's words and work type.
    suggestedBudget?: { min: number; max: number; currency: string; words: number } | null;
};
type BidRow = { id: string; writerName: string; amount: number; currency: string; note: string; status: string; withinBudget: boolean; createdAt: string };

export type BiddingRow = Row;
export type AssignedOrder = { orderId: string; status: string; assignedTo: string; writerPayout: { amount: number; currency: string } };

export function ProjectRow({ row, token, onChanged, startOpen = false, onAssigned }: { row: Row; token: string; onChanged: (msg: string) => void; startOpen?: boolean; onAssigned?: (o: AssignedOrder) => void }) {
    const [open, setOpen] = useState(startOpen);
    const hasLimit = row.bidding?.minBid != null && row.bidding?.maxBid != null;
    const [min, setMin] = useState(hasLimit ? String(row.bidding!.minBid) : row.suggestedBudget ? String(row.suggestedBudget.min) : '');
    const [max, setMax] = useState(hasLimit ? String(row.bidding!.maxBid) : row.suggestedBudget ? String(row.suggestedBudget.max) : '');
    const [bids, setBids] = useState<BidRow[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const currency = row.bidding?.currency || row.currency || 'GBP';
    const isOpen = row.bidding ? row.bidding.open !== false && Boolean(row.adminApproved || row.bidding.open) : Boolean(row.adminApproved);

    const loadBids = useCallback(async () => {
        try { setBids((await api<{ bids: BidRow[] }>(`/order-workflow/admin/bidding/${encodeURIComponent(row.orderId)}`, { token })).bids); }
        catch (e) { setError((e as Error).message); }
    }, [row.orderId, token]);
    useEffect(() => { if (open) loadBids(); }, [open, loadBids]);

    const save = async (nextOpen: boolean) => {
        // The budget is optional: leave both empty to let writers name their price.
        const noBudget = !min.trim() && !max.trim();
        const minBid = Number(min), maxBid = Number(max);
        if (!noBudget && (!(minBid > 0) || !(maxBid > 0) || minBid > maxBid)) return setError('Writer budget: fill both (minimum above 0, not more than the maximum) or leave both empty.');
        setBusy(true); setError('');
        try {
            await api(`/order-workflow/admin/bidding/${encodeURIComponent(row.orderId)}`, { method: 'PUT', token, body: noBudget ? { open: nextOpen, minBid: null, maxBid: null } : { open: nextOpen, minBid, maxBid } });
            onChanged(nextOpen ? (isOpen ? `Budget updated for ${row.orderId}.` : `${row.orderId} is open for bids. Eligible writers were notified.`) : `Bidding closed for ${row.orderId}.`);
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };
    const accept = async (bid: BidRow) => {
        if (!confirm(`Assign ${row.orderId} to ${bid.writerName} for ${bid.currency} ${bid.amount}?`)) return;
        setBusy(true); setError('');
        try {
            const r = await api<{ order: AssignedOrder }>(`/order-workflow/admin/bids/${bid.id}/accept`, { method: 'POST', token });
            onAssigned?.(r.order);
            onChanged(`${row.orderId} assigned to ${bid.writerName} for ${bid.currency} ${bid.amount}.`);
        }
        catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    return (
        <li className="p-4">
            <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#000a1e]">{row.topicTitle}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{row.orderId} · {row.subject} · {row.pages} page{row.pages === 1 ? '' : 's'}{row.wordCount ? ` · ${row.wordCount} words` : ''} · due {row.deadline}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                    <span className="text-gray-500">Internal price: <span className="font-semibold text-[#000a1e]">{formatOrderTotal(row.totalAmount, row.currency)}</span></span>
                    {isOpen
                        ? <span className="rounded-full bg-[#000a1e] px-2.5 py-0.5 font-semibold text-white">Bidding open · {row.openBids} bid{row.openBids === 1 ? '' : 's'}</span>
                        : <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-semibold text-gray-600">{row.adminApproved ? 'Bidding closed' : 'Awaiting approval'}</span>}
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {open && (
                <div className="mt-4 space-y-4 rounded-xl bg-gray-50 p-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div><Label htmlFor={`min-${row.orderId}`}>Writer budget — minimum ({currency})</Label><input id={`min-${row.orderId}`} type="number" min="0" step="0.01" value={min} onChange={e => setMin(e.target.value)} className={fieldClass} /></div>
                        <div><Label htmlFor={`max-${row.orderId}`}>Writer budget — maximum ({currency})</Label><input id={`max-${row.orderId}`} type="number" min="0" step="0.01" value={max} onChange={e => setMax(e.target.value)} className={fieldClass} /></div>
                        <div className="flex gap-2">
                            <button onClick={() => save(true)} disabled={busy} className="rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isOpen ? 'Update budget' : row.adminApproved ? 'Reopen bidding' : 'Approve & open for bids'}</button>
                            {isOpen && <button onClick={() => save(false)} disabled={busy} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#000a1e] disabled:opacity-50">Close</button>}
                        </div>
                    </div>
                    {row.suggestedBudget && <p className="text-xs text-gray-600">From your bid limits: {row.suggestedBudget.words.toLocaleString()} words → <span className="font-semibold text-[#000a1e]">{row.suggestedBudget.currency} {row.suggestedBudget.min}–{row.suggestedBudget.max}</span>{!hasLimit && ' (filled in above — save to apply)'}</p>}
                    <p className="text-xs text-gray-500">Optional: leave the budget empty and writers name their own price. If you set one, bids must fall inside it. Writers never see the internal price.</p>
                    {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                    <div>
                        <p className="mb-2 text-sm font-bold text-[#000a1e]">Bids</p>
                        {!bids && <p className="text-sm text-gray-400">Loading…</p>}
                        {bids?.length === 0 && <p className="text-sm text-gray-500">No bids yet.</p>}
                        {bids && bids.length > 0 && (
                            <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
                                {bids.map(b => (
                                    <li key={b.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-[#000a1e]">{b.writerName} — {b.currency} {b.amount}{b.id === bids.find(x => x.status === 'PENDING' && x.withinBudget)?.id && <span className="ml-2 rounded-full bg-[#000a1e] px-2 py-0.5 text-[10px] font-semibold text-white">Lowest bid</span>}{!b.withinBudget && b.status === 'PENDING' && <span className="ml-2 text-xs font-normal text-gray-500">(outside the current budget)</span>}</p>
                                            {b.note && <p className="mt-0.5 text-xs text-gray-600">{b.note}</p>}
                                        </div>
                                        <span className="text-xs text-gray-500">{b.status.charAt(0) + b.status.slice(1).toLowerCase()}</span>
                                        {b.status === 'PENDING' && <button onClick={() => accept(b)} disabled={busy || !b.withinBudget} className="rounded-lg bg-[#000a1e] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Accept</button>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </li>
    );
}

// Admin sets writer bid limits by the work: per 1,000 words, a default and
// optionally per type of work. Approved orders get their limit from these.
type Rate = { min: string; max: string };
function BidLimits({ token, onSaved }: { token: string; onSaved: (msg: string) => void }) {
    const [data, setData] = useState<{ baseCurrency: string; services: string[] } | null>(null);
    const [def, setDef] = useState<Rate>({ min: '', max: '' });
    const [perService, setPerService] = useState<Record<string, Rate>>({});
    const [showServices, setShowServices] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        api<{ rates: { min: number | null; max: number | null; services: Record<string, { min: number; max: number }> }; baseCurrency: string; services: string[] }>('/order-workflow/admin/bid-rates', { token })
            .then(r => {
                setData({ baseCurrency: r.baseCurrency, services: r.services });
                setDef({ min: r.rates.min != null ? String(r.rates.min) : '', max: r.rates.max != null ? String(r.rates.max) : '' });
                setPerService(Object.fromEntries(Object.entries(r.rates.services || {}).map(([k, v]) => [k, { min: String(v.min), max: String(v.max) }])));
                if (Object.keys(r.rates.services || {}).length) setShowServices(true);
            })
            .catch(e => setError((e as Error).message));
    }, [token]);

    const save = async () => {
        setError('');
        const num = (s: string) => (s.trim() === '' ? null : Number(s));
        const dMin = num(def.min), dMax = num(def.max);
        if ((dMin == null) !== (dMax == null) || (dMin != null && (!(dMin >= 0) || !(dMax! >= dMin)))) return setError('Default rate: fill both (minimum not more than maximum) or leave both empty.');
        const services: Record<string, { min: number; max: number }> = {};
        for (const [name, r] of Object.entries(perService) as [string, Rate][]) {
            const a = num(r.min), b = num(r.max);
            if (a == null && b == null) continue;
            if (a == null || b == null || !(a >= 0) || !(b >= a)) return setError(`${name}: fill both rates (minimum not more than maximum) or leave both empty.`);
            services[name] = { min: a, max: b };
        }
        setBusy(true);
        try { await api('/order-workflow/admin/bid-rates', { method: 'PUT', token, body: { min: dMin, max: dMax, services } }); onSaved('Bid limits saved. Newly approved orders use them.'); }
        catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };
    if (!data) return error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null;
    const cur = data.baseCurrency;
    const example = def.min && def.max ? `3,000 words → ${cur} ${Math.round(3 * Number(def.min))}–${Math.round(3 * Number(def.max))}` : '';

    return (
        <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5">
            <div>
                <p className="text-sm font-bold text-[#000a1e]">Bid limits by work</p>
                <p className="mt-0.5 text-xs text-gray-500">What a writer may bid per 1,000 words ({cur}). When you approve an order, its bid limit is worked out from its word count and converted to its currency. You can still change it per order.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div><Label htmlFor="rate-min">Default — minimum per 1,000 words ({cur})</Label><input id="rate-min" type="number" min="0" step="0.5" value={def.min} onChange={e => setDef({ ...def, min: e.target.value })} className={fieldClass} /></div>
                <div><Label htmlFor="rate-max">Default — maximum per 1,000 words ({cur})</Label><input id="rate-max" type="number" min="0" step="0.5" value={def.max} onChange={e => setDef({ ...def, max: e.target.value })} className={fieldClass} /></div>
                <button onClick={save} disabled={busy} className="rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save limits'}</button>
            </div>
            {example && <p className="text-xs text-gray-600">Example: {example}</p>}
            <button onClick={() => setShowServices(v => !v)} aria-expanded={showServices} className="text-xs font-semibold text-[#002147] hover:underline">{showServices ? 'Hide rates by type of work' : 'Set different rates by type of work'}</button>
            {showServices && (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 text-left text-xs text-gray-500"><th className="px-3 py-2 font-semibold">Type of work</th><th className="px-3 py-2 font-semibold">Min / 1,000 words</th><th className="px-3 py-2 font-semibold">Max / 1,000 words</th></tr></thead>
                        <tbody>
                            {data.services.map(name => {
                                const r = perService[name] || { min: '', max: '' };
                                const set = (patch: Partial<Rate>) => setPerService(p => ({ ...p, [name]: { ...r, ...patch } }));
                                return (
                                    <tr key={name} className="border-t border-gray-100">
                                        <td className="px-3 py-2 text-[#000a1e]">{name}</td>
                                        <td className="px-3 py-2"><input type="number" min="0" step="0.5" value={r.min} onChange={e => set({ min: e.target.value })} placeholder={def.min || 'default'} aria-label={`${name} minimum rate`} className={`${fieldClass} max-w-[140px]`} /></td>
                                        <td className="px-3 py-2"><input type="number" min="0" step="0.5" value={r.max} onChange={e => set({ max: e.target.value })} placeholder={def.max || 'default'} aria-label={`${name} maximum rate`} className={`${fieldClass} max-w-[140px]`} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
    );
}

export default function BiddingTab({ token }: { token: string }) {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const load = useCallback(async () => {
        setError('');
        try { setRows((await api<{ orders: Row[] }>('/order-workflow/admin/bidding', { token })).orders); }
        catch (e) { setError((e as Error).message); }
    }, [token]);
    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-bold text-[#000a1e]">Writer bidding</h2>
                    <p className="text-sm text-gray-500">Orders no writer has taken. Approved orders are open for bids (eligible writers are notified); accept the bid you want — the lowest is marked.</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-1.5 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
            </div>
            <BidLimits token={token} onSaved={m => { setNotice(m); load(); }} />
            {notice && <p role="status" className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-[#000a1e]">{notice}</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                {!rows && !error && <p className="p-8 text-center text-sm text-gray-400">Loading…</p>}
                {rows?.length === 0 && <p className="p-8 text-center text-sm text-gray-500">No new orders waiting for a writer.</p>}
                {rows && rows.length > 0 && (
                    <ul className="divide-y divide-gray-100">
                        {rows.map(r => <React.Fragment key={r.orderId}><ProjectRow row={r} token={token} onChanged={m => { setNotice(m); load(); }} /></React.Fragment>)}
                    </ul>
                )}
            </div>
        </div>
    );
}
