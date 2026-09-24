import React, { useCallback, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../../../../lib/api';
import { formatDate, formatMoney } from '../../../../lib/money';
import { countryName } from '../../../../lib/writerOptions';
import { PAYMENT_STATUS_LABEL, PERIOD_LABEL, SUBSCRIPTION_STATUS_META, type MembershipPayment, type Subscription, type SubscriptionStatus } from '../../../../lib/membershipTypes';
import { SubscriptionBadge } from '../../../../components/writer/MembershipBits';
import { Spinner } from '../../../../components/writer/WriterBits';
import { inputClass } from '../../../../components/writer/FormKit';
import { cn } from '../../../../lib/utils';

type AdminSub = Subscription & { id: string; writerName?: string; writerEmail?: string; country?: string; history?: { type: string; note: string; actorType: string; at: string }[] };

function Detail({ id, token, canManage, onClose, onChanged }: { id: string; token: string; canManage: boolean; onClose: () => void; onChanged: () => void }) {
    const [data, setData] = useState<{ subscription: AdminSub; payments: (MembershipPayment & { needsAttention?: string })[] } | null>(null);
    const [action, setAction] = useState<'suspend' | 'reinstate' | 'cancel' | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(() => api<typeof data>(`/admin/membership/subscriptions/${id}`, { token }).then(setData).catch(e => setError(e.message)), [id, token]);
    useEffect(() => { load(); }, [load]);

    const run = async () => {
        setBusy(true); setError('');
        try { await api(`/admin/membership/subscriptions/${id}/actions`, { method: 'POST', token, body: { action, reason } }); setAction(null); setReason(''); await load(); onChanged(); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const s = data?.subscription;
    const available: ('suspend' | 'reinstate' | 'cancel')[] = !s || !canManage ? [] : [
        ...(['ACTIVE', 'PAST_DUE'].includes(s.status) ? ['suspend' as const] : []),
        ...(s.status === 'SUSPENDED' ? ['reinstate' as const] : []),
        ...(['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'].includes(s.status) ? ['cancel' as const] : []),
    ];

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Subscription details">
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
            <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-100 p-5">
                    {s ? <div><h2 className="text-lg font-bold text-[#000a1e]">{s.writerName}</h2><p className="text-sm text-gray-500">{s.writerEmail} · {s.subscriptionId}</p></div> : <span />}
                    <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                {!s ? <div className="flex flex-1 items-center justify-center">{error ? <p className="text-sm text-red-600">{error}</p> : <Spinner className="h-7 w-7 text-[#fea520]" />}</div> : (
                    <div className="flex-1 space-y-6 overflow-y-auto p-5 pr-24">
                        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                        <dl className="grid grid-cols-2 gap-4 text-sm">
                            {[['Status', <SubscriptionBadge status={s.status} />], ['Plan', `${s.planName} · ${PERIOD_LABEL[s.billingPeriod]}`], ['Price', `${formatMoney(s.amountMinor, s.currency)}${s.discountPercent ? ` (${s.discountPercent}% off)` : ''}`],
                              ['Country', countryName(s.country)], ['Started', formatDate(s.startDate)], ['Current period', `${formatDate(s.currentPeriodStart)} – ${formatDate(s.currentPeriodEnd)}`],
                              ['Auto-renew', s.autoRenew ? 'On' : 'Off'], ['Scheduled change', s.scheduledChange ? `${s.scheduledChange.planName} · ${PERIOD_LABEL[s.scheduledChange.billingPeriod]} on ${formatDate(s.scheduledChange.effectiveAt)}` : '—'],
                              ...(s.endedAt ? [['Ended', `${formatDate(s.endedAt)} · ${s.endReason}`]] : [])].map(([k, v]) => (
                                <div key={k as string}><dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">{k}</dt><dd className="mt-0.5 text-gray-800">{v}</dd></div>
                            ))}
                        </dl>

                        {available.length > 0 && (
                            <div className="rounded-xl border border-gray-200 p-4">
                                {action ? (
                                    <div className="space-y-2">
                                        <textarea rows={2} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className={cn(inputClass, 'text-sm')} placeholder={action === 'reinstate' ? 'Optional note' : 'Reason (sent to the writer)'} />
                                        <div className="flex gap-2">
                                            <button onClick={run} disabled={busy || (action !== 'reinstate' && reason.trim().length < 5)} className={cn('rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50', action === 'reinstate' ? 'bg-emerald-600' : 'bg-red-600')}>Confirm {action}</button>
                                            <button onClick={() => setAction(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {available.map(a => <button key={a} onClick={() => setAction(a)} className={cn('rounded-lg px-4 py-2 text-sm font-semibold', a === 'reinstate' ? 'bg-emerald-600 text-white' : a === 'suspend' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700')}>{{ suspend: 'Suspend', reinstate: 'Reinstate', cancel: 'Cancel immediately' }[a]}</button>)}
                                    </div>
                                )}
                            </div>
                        )}

                        <section>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Payments</h3>
                            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                                {data.payments.map(p => (
                                    <li key={p.paymentRef} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                                        <span><span className="font-medium">{p.kind} · {p.planName}</span><span className="block text-xs text-gray-400">{p.paymentRef} · {formatDate(p.paidAt || p.createdAt)} · {p.provider}{p.manual ? ` ${p.manual.reference}` : ''}</span>{p.needsAttention && <span className="block text-xs text-red-600">{p.needsAttention}</span>}</span>
                                        <span className="text-right"><span className="block font-semibold tabular-nums">{formatMoney(p.amountMinor, p.currency)}</span><span className="text-xs text-gray-500">{PAYMENT_STATUS_LABEL[p.status]}</span></span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                        <section>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">History</h3>
                            <ol className="space-y-2 text-sm">
                                {[...(s.history || [])].reverse().map((h, i) => (
                                    <li key={i}><span className="font-medium">{h.type.replace(/_/g, ' ').toLowerCase()}</span> <span className="text-xs text-gray-400">{new Date(h.at).toLocaleString()} · {h.actorType.toLowerCase()}</span>{h.note && <span className="block text-gray-600">{h.note}</span>}</li>
                                ))}
                            </ol>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SubscriptionsPanel({ token, canManage, initialPlan = '' }: { token: string; canManage: boolean; initialPlan?: string }) {
    const [status, setStatus] = useState('');
    const [plan, setPlan] = useState(initialPlan);
    const [plans, setPlans] = useState<{ code: string; name: string }[]>([]);
    useEffect(() => { api<{ plans: { code: string; name: string }[] }>('/admin/membership/plans', { token }).then(d => setPlans(d.plans)).catch(() => setPlans([])); }, [token]);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [rows, setRows] = useState<AdminSub[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<string | null>(null);

    useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);
    const load = useCallback(async () => {
        setLoading(true);
        const q = new URLSearchParams({ limit: '50', ...(status ? { status } : {}), ...(plan ? { plan } : {}), ...(query ? { search: query } : {}) });
        try { const d = await api<{ subscriptions: AdminSub[]; total: number }>(`/admin/membership/subscriptions?${q}`, { token }); setRows(d.subscriptions); setTotal(d.total); }
        finally { setLoading(false); }
    }, [status, plan, query, token]);
    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search writer name, email or SUB- reference" className={cn(inputClass, 'py-2.5 pl-11 text-sm')} /></div>
                <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status" className={cn(inputClass, 'py-2.5 text-sm sm:w-48')}>
                    <option value="">All statuses</option>
                    {(Object.keys(SUBSCRIPTION_STATUS_META) as SubscriptionStatus[]).map(s => <option key={s} value={s}>{SUBSCRIPTION_STATUS_META[s].label}</option>)}
                </select>
                <select value={plan} onChange={e => setPlan(e.target.value)} aria-label="Plan" className={cn(inputClass, 'py-2.5 text-sm sm:w-44')}>
                    <option value="">All plans</option>
                    {plans.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {loading ? <div className="flex justify-center py-12"><Spinner className="h-7 w-7 text-[#fea520]" /></div> : rows.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">No subscriptions.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                            <thead><tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-widest text-gray-400">
                                <th className="px-5 py-3 font-bold">Writer</th><th className="px-5 py-3 font-bold">Plan</th><th className="px-5 py-3 text-right font-bold">Price</th>
                                <th className="px-5 py-3 font-bold">Status</th><th className="px-5 py-3 font-bold">Renewal</th></tr></thead>
                            <tbody className="divide-y divide-gray-50">
                                {rows.map(r => (
                                    <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer hover:bg-gray-50/70">
                                        <td className="px-5 py-3"><p className="font-bold text-[#000a1e]">{r.writerName}</p><p className="text-xs text-gray-400">{r.subscriptionId} · {countryName(r.country)}</p></td>
                                        <td className="px-5 py-3">{r.planName} <span className="text-gray-400">· {PERIOD_LABEL[r.billingPeriod]}</span></td>
                                        <td className="px-5 py-3 text-right tabular-nums">{formatMoney(r.amountMinor, r.currency)}</td>
                                        <td className="px-5 py-3"><SubscriptionBadge status={r.status} />{!r.autoRenew && ['ACTIVE'].includes(r.status) && <span className="ml-2 text-xs text-gray-400">ends at period end</span>}</td>
                                        <td className="px-5 py-3 text-gray-600">{['ACTIVE', 'PAST_DUE', 'SUSPENDED'].includes(r.status) ? formatDate(r.currentPeriodEnd) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {total > rows.length && <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">Showing {rows.length} of {total}. Refine the search to narrow results.</p>}
            </div>
            {openId && <Detail id={openId} token={token} canManage={canManage} onClose={() => setOpenId(null)} onChanged={load} />}
        </div>
    );
}
