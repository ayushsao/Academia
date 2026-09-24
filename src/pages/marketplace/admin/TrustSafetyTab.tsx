import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../../lib/api';
import { inputClass } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';
import { StatTile } from './membership/MembershipAnalytics';
import { RISK_KIND_LABEL } from './RiskBadge';
import AdminWriterDrawer from './AdminWriterDrawer';
import { hasPermission, type AdminAccess } from './access';

type WriterRef = { id: string; name: string; email: string; status: string; riskLevel: string };
type RiskEvent = {
    id: string; kind: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; status: 'OPEN' | 'CONFIRMED' | 'DISMISSED'; summary: string; occurrences: number;
    firstSeenAt: string; lastSeenAt: string; writer: WriterRef | null; related: WriterRef[];
    resolution: { note: string; byName?: string; at?: string } | null;
};
type Summary = { open: Partial<Record<'LOW' | 'MEDIUM' | 'HIGH', number>>; byKind: { kind: string; n: number }[]; flaggedWriters: number };

const SEVERITY_STYLE = { HIGH: 'bg-red-50 text-red-700 ring-red-200', MEDIUM: 'bg-amber-50 text-amber-800 ring-amber-200', LOW: 'bg-slate-100 text-slate-600 ring-slate-200' };
const STATUS_STYLE = { OPEN: 'text-[#b86e00]', CONFIRMED: 'text-red-700', DISMISSED: 'text-slate-500' };
const PAGE = 25;

// Fraud & abuse signals (duplicate accounts/documents, reused payment references,
// rating anomalies…) for HR and Finance to confirm or dismiss. Every decision is audited.
export default function TrustSafetyTab({ token, access }: { token: string; access: AdminAccess | null }) {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [rows, setRows] = useState<RiskEvent[] | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ status: 'OPEN', severity: '', kind: '' });
    const [error, setError] = useState('');
    const [acting, setActing] = useState<{ event: RiskEvent; status: 'CONFIRMED' | 'DISMISSED' | 'OPEN' } | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [openWriter, setOpenWriter] = useState<string | null>(null);
    const canOpenWriters = hasPermission(access, 'writers.read');

    const load = useCallback(async () => {
        setError('');
        const q = new URLSearchParams({ page: String(page), limit: String(PAGE), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
        try {
            const [s, list] = await Promise.all([
                api<Summary>('/admin/risk/summary', { token }),
                api<{ events: RiskEvent[]; total: number }>(`/admin/risk?${q}`, { token }),
            ]);
            setSummary(s); setRows(list.events); setTotal(list.total);
        } catch (e) { setError((e as Error).message); }
    }, [token, page, filters]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [filters]);

    const resolve = async () => {
        if (!acting) return;
        setBusy(true); setError('');
        try {
            await api(`/admin/risk/${acting.event.id}/resolve`, { method: 'POST', token, body: { status: acting.status, note } });
            setActing(null); setNote(''); await load();
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };

    const writerLink = (w: WriterRef) => canOpenWriters
        ? <button onClick={() => setOpenWriter(w.id)} className="font-semibold text-[#002147] hover:underline">{w.name}</button>
        : <span className="font-semibold text-[#000a1e]">{w.name}</span>;
    const pages = Math.max(1, Math.ceil(total / PAGE));

    return (
        <div className="space-y-6">
            <p className="text-sm text-gray-500">Automatic signals of duplicate accounts, fake profiles, payment or rating abuse. Clear-cut abuse (disposable emails, reused payment references, contact details in profiles) is already blocked; these need a human decision.</p>
            {summary && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatTile label="Open · high" value={summary.open.HIGH || 0} sub="Review first" />
                    <StatTile label="Open · medium" value={summary.open.MEDIUM || 0} />
                    <StatTile label="Open · low" value={summary.open.LOW || 0} />
                    <StatTile label="Writers flagged" value={summary.flaggedWriters} sub="Medium or high risk" />
                </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select aria-label="Status" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className={cn(inputClass, 'py-2.5 text-sm sm:w-44')}>
                    <option value="OPEN">Open</option><option value="CONFIRMED">Confirmed</option><option value="DISMISSED">Dismissed</option><option value="">All statuses</option>
                </select>
                <select aria-label="Severity" value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))} className={cn(inputClass, 'py-2.5 text-sm sm:w-44')}>
                    <option value="">Any severity</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
                </select>
                <select aria-label="Signal" value={filters.kind} onChange={e => setFilters(f => ({ ...f, kind: e.target.value }))} className={cn(inputClass, 'py-2.5 text-sm sm:w-64')}>
                    <option value="">All signals</option>
                    {Object.entries(RISK_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}{summary?.byKind.find(x => x.kind === k) ? ` (${summary.byKind.find(x => x.kind === k)!.n})` : ''}</option>)}
                </select>
                <button onClick={load} aria-label="Refresh" className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 hover:bg-gray-50 sm:ml-auto"><RefreshCw className="h-4 w-4 text-gray-500" /></button>
            </div>

            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

            {!rows ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div> : rows.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-gray-400"><ShieldCheck className="mx-auto mb-3 h-10 w-10 opacity-40" /><p className="font-semibold">Nothing to review</p></div>
            ) : (
                <ul className="space-y-3">
                    {rows.map(ev => (
                        <li key={ev.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset', SEVERITY_STYLE[ev.severity])}>{ev.severity.toLowerCase()}</span>
                                        <span className="font-bold text-[#000a1e]">{RISK_KIND_LABEL[ev.kind] || ev.kind}</span>
                                        <span className={cn('text-xs font-semibold', STATUS_STYLE[ev.status])}>{ev.status.toLowerCase()}</span>
                                    </div>
                                    <p className="mt-1.5 text-sm text-gray-700">{ev.summary}</p>
                                    <p className="mt-2 text-xs text-gray-500">
                                        {ev.writer ? <>Writer: {writerLink(ev.writer)} <span className="text-gray-400">({ev.writer.email} · {ev.writer.status.toLowerCase()})</span></> : 'No writer linked'}
                                        {ev.related.length > 0 && <> · Related: {ev.related.map((w, i) => <React.Fragment key={w.id}>{i > 0 && ', '}{writerLink(w)}</React.Fragment>)}</>}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-400">First seen {new Date(ev.firstSeenAt).toLocaleString()}{ev.occurrences > 1 ? ` · seen ${ev.occurrences} times, last ${new Date(ev.lastSeenAt).toLocaleString()}` : ''}</p>
                                    {ev.resolution?.at && <p className="mt-1 text-xs text-gray-500">{ev.status === 'CONFIRMED' ? 'Confirmed' : 'Dismissed'} by {ev.resolution.byName} · {new Date(ev.resolution.at).toLocaleString()}{ev.resolution.note ? ` — “${ev.resolution.note}”` : ''}</p>}
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {ev.status === 'OPEN' ? (<>
                                        <button onClick={() => { setActing({ event: ev, status: 'CONFIRMED' }); setNote(''); }} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white">Confirm</button>
                                        <button onClick={() => { setActing({ event: ev, status: 'DISMISSED' }); setNote(''); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700">Dismiss</button>
                                    </>) : <button onClick={() => { setActing({ event: ev, status: 'OPEN' }); setNote(''); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700">Reopen</button>}
                                </div>
                            </div>
                            {acting?.event.id === ev.id && (
                                <div className="mt-4 rounded-xl bg-gray-50 p-3">
                                    {acting.status !== 'OPEN' && <label className="block text-xs font-semibold text-gray-600">Note (required, kept in the audit log)
                                        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000} className={cn(inputClass, 'mt-1 text-sm')} placeholder={acting.status === 'CONFIRMED' ? 'e.g. Same person as ACC-…; account suspended' : 'e.g. Verified by video call — shared agency CV template'} /></label>}
                                    <div className="mt-2 flex gap-2">
                                        <button onClick={resolve} disabled={busy || (acting.status !== 'OPEN' && note.trim().length < 3)} className="rounded-lg bg-[#000a1e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : acting.status === 'CONFIRMED' ? 'Confirm signal' : acting.status === 'DISMISSED' ? 'Dismiss signal' : 'Reopen'}</button>
                                        <button onClick={() => setActing(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                                    </div>
                                    {acting.status === 'CONFIRMED' && <p className="mt-2 text-xs text-gray-500">Confirming records the finding and raises the writer’s risk score. To restrict the account, suspend it from the writer’s profile.</p>}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {pages > 1 && (
                <div className="flex items-center justify-center gap-3 text-sm text-gray-600">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className="rounded-lg border border-gray-200 bg-white p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    Page {page} of {pages}
                    <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} aria-label="Next page" className="rounded-lg border border-gray-200 bg-white p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
            )}
            {openWriter && <AdminWriterDrawer writerId={openWriter} token={token} onClose={() => setOpenWriter(null)} onChanged={load} />}
        </div>
    );
}
