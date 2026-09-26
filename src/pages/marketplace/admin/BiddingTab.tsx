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
};
type BidRow = { id: string; writerName: string; amount: number; currency: string; note: string; status: string; withinBudget: boolean; createdAt: string };

function ProjectRow({ row, token, onChanged }: { row: Row; token: string; onChanged: (msg: string) => void }) {
    const [open, setOpen] = useState(false);
    const [min, setMin] = useState(row.bidding?.minBid != null ? String(row.bidding.minBid) : '');
    const [max, setMax] = useState(row.bidding?.maxBid != null ? String(row.bidding.maxBid) : '');
    const [bids, setBids] = useState<BidRow[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const currency = row.bidding?.currency || row.currency || 'GBP';
    const isOpen = Boolean(row.bidding?.open);

    const loadBids = useCallback(async () => {
        try { setBids((await api<{ bids: BidRow[] }>(`/order-workflow/admin/bidding/${encodeURIComponent(row.orderId)}`, { token })).bids); }
        catch (e) { setError((e as Error).message); }
    }, [row.orderId, token]);
    useEffect(() => { if (open) loadBids(); }, [open, loadBids]);

    const save = async (nextOpen: boolean) => {
        const minBid = Number(min), maxBid = Number(max);
        if (!(minBid > 0) || !(maxBid > 0) || minBid > maxBid) return setError('Enter a writer budget: minimum above 0 and not more than the maximum.');
        setBusy(true); setError('');
        try {
            await api(`/order-workflow/admin/bidding/${encodeURIComponent(row.orderId)}`, { method: 'PUT', token, body: { open: nextOpen, minBid, maxBid } });
            onChanged(nextOpen ? (isOpen ? `Budget updated for ${row.orderId}.` : `${row.orderId} is open for bids. Eligible writers were notified.`) : `Bidding closed for ${row.orderId}.`);
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };
    const accept = async (bid: BidRow) => {
        if (!confirm(`Assign ${row.orderId} to ${bid.writerName} for ${bid.currency} ${bid.amount}?`)) return;
        setBusy(true); setError('');
        try { await api(`/order-workflow/admin/bids/${bid.id}/accept`, { method: 'POST', token }); onChanged(`${row.orderId} assigned to ${bid.writerName} for ${bid.currency} ${bid.amount}.`); }
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
                        : <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-semibold text-gray-600">{row.bidding ? 'Bidding closed' : 'Not open for bids'}</span>}
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {open && (
                <div className="mt-4 space-y-4 rounded-xl bg-gray-50 p-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div><Label htmlFor={`min-${row.orderId}`}>Writer budget — minimum ({currency})</Label><input id={`min-${row.orderId}`} type="number" min="0" step="0.01" value={min} onChange={e => setMin(e.target.value)} className={fieldClass} /></div>
                        <div><Label htmlFor={`max-${row.orderId}`}>Writer budget — maximum ({currency})</Label><input id={`max-${row.orderId}`} type="number" min="0" step="0.01" value={max} onChange={e => setMax(e.target.value)} className={fieldClass} /></div>
                        <div className="flex gap-2">
                            <button onClick={() => save(true)} disabled={busy} className="rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isOpen ? 'Update budget' : 'Open bidding'}</button>
                            {isOpen && <button onClick={() => save(false)} disabled={busy} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#000a1e] disabled:opacity-50">Close</button>}
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">Writers see only this budget — never the internal price. Bids must fall inside it; you can change it at any time.</p>
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
                                            <p className="text-sm font-semibold text-[#000a1e]">{b.writerName} — {b.currency} {b.amount}{!b.withinBudget && b.status === 'PENDING' && <span className="ml-2 text-xs font-normal text-gray-500">(outside the current budget)</span>}</p>
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
                    <p className="text-sm text-gray-500">New orders no writer has taken. Open one for bids with a writer budget; eligible writers are notified.</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-1.5 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
            </div>
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
