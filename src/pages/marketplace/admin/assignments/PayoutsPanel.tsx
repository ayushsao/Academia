import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../../lib/api';
import { formatDate, formatMoney } from '../../../../lib/money';
import { Spinner } from '../../../../components/writer/WriterBits';
import { inputClass } from '../../../../components/writer/FormKit';
import { cn } from '../../../../lib/utils';

type Row = { id: string; amountMinor: number; currency: string; status: string; approvedAt?: string; paidAt?: string; payoutReference?: string; writer: { name: string; email: string } | null; assignment: { ref: string; title: string } | null; adjustments: any[] };

export default function PayoutsPanel({ token }: { token: string }) {
    const [status, setStatus] = useState('APPROVED');
    const [rows, setRows] = useState<Row[] | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [reference, setReference] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [adjusting, setAdjusting] = useState<string | null>(null);
    const [adj, setAdj] = useState({ amount: '', reason: '' });

    const load = useCallback(async () => {
        setRows(null); setSelected(new Set());
        setRows((await api<{ earnings: Row[] }>(`/admin/assignments/earnings/list?status=${status}`, { token })).earnings);
    }, [status, token]);
    useEffect(() => { load().catch(e => setMsg({ ok: false, text: e.message })); }, [load]);

    const totals = useMemo(() => (rows || []).filter(r => selected.has(r.id)).reduce((acc, r) => { acc[r.currency] = (acc[r.currency] || 0) + r.amountMinor; return acc; }, {} as Record<string, number>), [rows, selected]);
    const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const pay = async () => {
        setBusy(true); setMsg(null);
        try {
            const r = await api<{ paid: number }>('/admin/assignments/earnings/pay', { method: 'POST', token, body: { ids: [...selected], reference } });
            setMsg({ ok: true, text: `Marked ${r.paid} payout${r.paid === 1 ? '' : 's'} as paid. Writers have been notified.` });
            setReference(''); load();
        } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
    };
    const adjust = async (id: string) => {
        setBusy(true); setMsg(null);
        try {
            await api(`/admin/assignments/earnings/${id}/adjust`, { method: 'POST', token, body: { amount: Number(adj.amount), reason: adj.reason } });
            setAdjusting(null); setAdj({ amount: '', reason: '' }); load();
        } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto">
                {[['APPROVED', 'Ready to pay'], ['PENDING', 'In progress'], ['PAID', 'Paid'], ['CANCELLED', 'Cancelled']].map(([k, l]) => (
                    <button key={k} onClick={() => setStatus(k)} className={cn('whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-semibold', status === k ? 'border-[#000a1e] bg-[#000a1e] text-white' : 'border-gray-200 bg-white text-gray-600')}>{l}</button>
                ))}
            </div>
            {status === 'APPROVED' && (
                <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                    <p className="flex-1 text-sm text-gray-600">{selected.size ? <>Selected {selected.size}: <strong className="tabular-nums">{Object.entries(totals).map(([c, v]) => formatMoney(v as number, c)).join(' · ')}</strong></> : 'Select approved payouts after you’ve sent them, then record the payment reference.'}</p>
                    <input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder="Payout reference (bank/Wise/PayPal ID)" className={cn(inputClass, 'py-2 text-sm sm:w-72')} />
                    <button onClick={pay} disabled={busy || !selected.size || reference.trim().length < 3} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Mark as paid</button>
                </div>
            )}
            {msg && <p className={cn('rounded-lg px-3 py-2 text-sm', msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>{msg.text}</p>}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {!rows ? <div className="flex justify-center py-12"><Spinner className="h-7 w-7 text-[#fea520]" /></div> : rows.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">Nothing here.</p> : (
                    <ul className="divide-y divide-gray-100">
                        {rows.map(r => (
                            <li key={r.id} className="p-4">
                                <div className="flex items-center gap-3">
                                    {status === 'APPROVED' && <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-[#000a1e]" aria-label={`Select ${r.writer?.name}`} />}
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-[#000a1e]">{r.writer?.name} <span className="text-xs font-normal text-gray-400">{r.writer?.email}</span></p>
                                        <p className="truncate text-xs text-gray-500">{r.assignment?.ref} · {r.assignment?.title} · {formatDate(r.paidAt || r.approvedAt)}{r.payoutReference ? ` · ${r.payoutReference}` : ''}</p>
                                        {r.adjustments.map((x, i) => <p key={i} className="text-xs text-gray-500">{x.amountMinor > 0 ? '+' : ''}{formatMoney(x.amountMinor, r.currency)} — {x.reason}</p>)}
                                    </div>
                                    <span className="font-semibold tabular-nums">{formatMoney(r.amountMinor, r.currency)}</span>
                                    {['APPROVED', 'PENDING'].includes(status) && <button onClick={() => setAdjusting(a => (a === r.id ? null : r.id))} className="text-xs font-semibold text-gray-500 hover:text-[#000a1e]">Adjust</button>}
                                </div>
                                {adjusting === r.id && (
                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                        <input value={adj.amount} onChange={e => setAdj(x => ({ ...x, amount: e.target.value.replace(/[^\d.-]/g, '') }))} placeholder={`± ${r.currency}`} className={cn(inputClass, 'py-1.5 text-sm sm:w-32')} />
                                        <input value={adj.reason} onChange={e => setAdj(x => ({ ...x, reason: e.target.value }))} placeholder="Reason (shown to the writer)" className={cn(inputClass, 'py-1.5 text-sm')} />
                                        <button onClick={() => adjust(r.id)} disabled={busy || !adj.amount || adj.reason.trim().length < 5} className="rounded-lg bg-[#000a1e] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Apply</button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
