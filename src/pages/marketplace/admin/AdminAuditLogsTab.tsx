import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../../lib/api';
import { Spinner } from '../../../components/writer/WriterBits';
import { inputClass } from '../../../components/writer/FormKit';
import { cn } from '../../../lib/utils';

type Log = { _id: string; createdAt: string; adminUsername: string; adminRole: string; adminRoleLabel: string; action: string; targetType?: string; targetId?: string; writerId?: { name?: string } | null; reason?: string; ip?: string };

const ROLES = [['', 'All roles'], ['SUPER_ADMIN', 'Super Admin'], ['HR', 'HR'], ['OPERATIONS', 'Operations'], ['FINANCE', 'Finance'], ['MARKETING', 'Marketing']];
const TARGETS = ['', 'WRITER', 'ASSIGNMENT', 'PAYOUT', 'SUBSCRIPTION', 'PAYMENT', 'MEMBERSHIP', 'ORDER', 'ADMIN', 'SETTINGS', 'USER'];
const tone = (action: string) => /DELETED|REJECT|SUSPEND|CANCEL/.test(action) ? 'bg-red-50 text-red-700'
    : /VIEWED|LOGIN/.test(action) ? 'bg-slate-100 text-slate-600'
        : /APPROVE|CREATED|PAID|ACTIVATED/.test(action) ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700';

// Full audit trail with filters. Only Super Admins can open it.
export default function AdminAuditLogsTab({ token }: { token: string }) {
    const [logs, setLogs] = useState<Log[] | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [f, setF] = useState({ action: '', admin: '', role: '', targetType: '', from: '', to: '' });
    const [q, setQ] = useState(f);
    const [error, setError] = useState('');

    useEffect(() => { const t = setTimeout(() => { setQ(f); setPage(1); }, 300); return () => clearTimeout(t); }, [f]);
    const load = useCallback(async () => {
        setLogs(null); setError('');
        const p = new URLSearchParams({ page: String(page), limit: '25' });
        Object.entries(q).forEach(([k, v]) => v && p.set(k, k === 'to' ? `${v}T23:59:59` : String(v)));
        try { const d = await api<{ logs: Log[]; total: number }>(`/admin/audit?${p}`, { token }); setLogs(d.logs); setTotal(d.total); }
        catch (e) { setError((e as Error).message); setLogs([]); }
    }, [page, q, token]);
    useEffect(() => { load(); }, [load]);
    const pages = Math.max(1, Math.ceil(total / 25));
    const set = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }));

    return (
        <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <input value={f.action} onChange={e => set('action', e.target.value)} placeholder="Action (e.g. APPROVE)" className={cn(inputClass, 'py-2 text-sm')} aria-label="Action" />
                <input value={f.admin} onChange={e => set('admin', e.target.value)} placeholder="Admin" className={cn(inputClass, 'py-2 text-sm')} aria-label="Admin" />
                <select value={f.role} onChange={e => set('role', e.target.value)} className={cn(inputClass, 'py-2 text-sm')} aria-label="Role">{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <select value={f.targetType} onChange={e => set('targetType', e.target.value)} className={cn(inputClass, 'py-2 text-sm')} aria-label="Target">{TARGETS.map(t => <option key={t} value={t}>{t ? t.charAt(0) + t.slice(1).toLowerCase() : 'All targets'}</option>)}</select>
                <input type="date" value={f.from} onChange={e => set('from', e.target.value)} className={cn(inputClass, 'py-2 text-sm')} aria-label="From" />
                <input type="date" value={f.to} onChange={e => set('to', e.target.value)} className={cn(inputClass, 'py-2 text-sm')} aria-label="To" />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                    <h3 className="flex items-center gap-2 font-bold text-gray-700"><History className="h-4 w-4" /> Audit trail <span className="text-sm font-normal text-gray-400">({total})</span></h3>
                    <button onClick={load} aria-label="Refresh" className="rounded-lg p-2 hover:bg-gray-100"><RefreshCw className="h-4 w-4 text-gray-500" /></button>
                </div>
                {!logs ? <div className="flex justify-center py-12"><Spinner className="h-7 w-7 text-[#fea520]" /></div> : logs.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">No matching entries.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] text-left text-sm">
                            <thead><tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-widest text-gray-400">
                                <th className="px-5 py-3 font-bold">When</th><th className="px-5 py-3 font-bold">Admin</th><th className="px-5 py-3 font-bold">Action</th><th className="px-5 py-3 font-bold">Target</th><th className="px-5 py-3 font-bold">Details</th><th className="px-5 py-3 font-bold">IP</th></tr></thead>
                            <tbody className="divide-y divide-gray-50">
                                {logs.map(l => (
                                    <tr key={l._id} className="align-top">
                                        <td className="whitespace-nowrap px-5 py-3 text-gray-600">{new Date(l.createdAt).toLocaleString()}</td>
                                        <td className="px-5 py-3"><p className="font-semibold text-[#000a1e]">{l.adminUsername}</p><p className="text-xs text-gray-400">{l.adminRoleLabel}</p></td>
                                        <td className="px-5 py-3"><span className={cn('rounded-md px-2 py-1 text-[11px] font-bold', tone(l.action))}>{l.action.replace(/_/g, ' ')}</span></td>
                                        <td className="px-5 py-3 text-gray-600">{l.writerId?.name || (l.targetType ? `${l.targetType.toLowerCase()}${l.targetId ? ` · ${l.targetId.slice(-8)}` : ''}` : '—')}</td>
                                        <td className="max-w-[18rem] px-5 py-3 text-gray-600"><span className="line-clamp-2" title={l.reason}>{l.reason || '—'}</span></td>
                                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-gray-400">{l.ip || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {total > 25 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-500">
                        <span>Page {page} of {pages}</span>
                        <div className="flex gap-1">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page" className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="Next page" className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
