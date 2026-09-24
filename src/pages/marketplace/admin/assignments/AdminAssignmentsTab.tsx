import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { api } from '../../../../lib/api';
import { formatMoney } from '../../../../lib/money';
import { AssignmentBadge } from '../../../../components/writer/AssignmentBits';
import { Spinner } from '../../../../components/writer/WriterBits';
import { inputClass } from '../../../../components/writer/FormKit';
import { cn } from '../../../../lib/utils';
import AssignmentForm, { type AdminAssignment } from './AssignmentForm';
import AssignmentDrawer from './AssignmentDrawer';
import PayoutsPanel from './PayoutsPanel';
import AssignmentSettingsPanel from './AssignmentSettingsPanel';
import { hasPermission, type AdminAccess } from '../access';

const QUEUES = [
    { key: '', label: 'All' },
    { key: 'UNALLOCATED', label: 'Needs allocation' },
    { key: 'DRAFT', label: 'Drafts' },
    { key: 'OPEN,OFFERED', label: 'Seeking writer' },
    { key: 'ASSIGNED,REVISION_REQUESTED', label: 'In progress' },
    { key: 'SUBMITTED,RESUBMITTED,UNDER_REVIEW', label: 'To review' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'CANCELLED', label: 'Cancelled' },
];

function AssignmentsPanel({ token, currencies }: { token: string; currencies: string[] }) {
    const [queue, setQueue] = useState('');
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');
    const [rows, setRows] = useState<any[] | null>(null);
    const [summary, setSummary] = useState<Record<string, number>>({});
    const [editing, setEditing] = useState<AdminAssignment | 'new' | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);

    useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);
    const load = useCallback(async () => {
        const p = new URLSearchParams({ limit: '50', ...(queue ? { status: queue } : {}), ...(q ? { search: q } : {}) });
        const [list, sum] = await Promise.all([
            api<{ assignments: any[] }>(`/admin/assignments?${p}`, { token }),
            api<{ byStatus: Record<string, number> }>('/admin/assignments/summary', { token }),
        ]);
        setRows(list.assignments); setSummary(sum.byStatus);
    }, [queue, q, token]);
    useEffect(() => { load().catch(() => setRows([])); }, [load]);
    const count = (key: string) => key.split(',').reduce((n, k) => n + (summary[k] || 0), 0);

    return (
        <div className="space-y-4">
            {editing ? (
                <AssignmentForm token={token} currencies={currencies} existing={editing === 'new' ? undefined : editing}
                    onSaved={a => { setEditing(null); load(); setOpenId(a.id); }} onCancel={() => setEditing(null)} />
            ) : (
                <button onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> New assignment</button>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {QUEUES.map(x => (
                    <button key={x.key} onClick={() => setQueue(x.key)} className={cn('inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-semibold', queue === x.key ? 'border-[#000a1e] bg-[#000a1e] text-white' : 'border-gray-200 bg-white text-gray-600')}>
                        {x.label}{x.key && <span className={cn('rounded-md px-1.5 text-xs', queue === x.key ? 'bg-white/15' : 'bg-gray-100', x.key === 'UNALLOCATED' && count(x.key) && queue !== x.key && 'bg-red-100 text-red-700')}>{count(x.key)}</span>}
                    </button>
                ))}
            </div>
            <div className="flex gap-2">
                <div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, subject or ASG- reference" className={cn(inputClass, 'py-2.5 pl-11 text-sm')} /></div>
                <button onClick={() => load()} aria-label="Refresh" className="rounded-xl border border-gray-200 bg-white px-4"><RefreshCw className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {!rows ? <div className="flex justify-center py-12"><Spinner className="h-7 w-7 text-[#fea520]" /></div> : rows.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">No assignments.</p> : (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left text-sm">
                                <thead><tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-widest text-gray-400">
                                    <th className="px-5 py-3 font-bold">Assignment</th><th className="px-5 py-3 font-bold">Writer</th><th className="px-5 py-3 font-bold">Status</th>
                                    <th className="px-5 py-3 font-bold">Deadline</th><th className="px-5 py-3 text-right font-bold">Payout</th></tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {rows.map(r => (
                                        <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer hover:bg-gray-50/70">
                                            <td className="px-5 py-3"><p className="font-bold text-[#000a1e]">{r.title}</p><p className="text-xs text-gray-400">{r.ref} · {r.subject} · {r.academicLevel} · {r.wordCount.toLocaleString()} words{r.orderLinked ? ' · order' : ''}</p></td>
                                            <td className="px-5 py-3 text-gray-600">{r.assignedWriter || (r.pendingOffers ? `${r.pendingOffers} offer${r.pendingOffers > 1 ? 's' : ''} out` : '—')}</td>
                                            <td className="px-5 py-3"><AssignmentBadge status={r.status} />{r.allocationMode && <span className="ml-2 text-xs text-gray-400">{r.allocationMode.toLowerCase()}</span>}</td>
                                            <td className="px-5 py-3 text-gray-600">{new Date(r.writerDeadline).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                            <td className="px-5 py-3 text-right tabular-nums">{formatMoney(r.payout.amountMinor, r.payout.currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <ul className="divide-y divide-gray-100 md:hidden">
                            {rows.map(r => (
                                <li key={r.id}><button onClick={() => setOpenId(r.id)} className="flex w-full items-center gap-3 p-4 text-left">
                                    <div className="min-w-0 flex-1"><p className="truncate font-bold text-[#000a1e]">{r.title}</p><p className="truncate text-xs text-gray-400">{r.ref} · {r.assignedWriter || r.subject}</p></div>
                                    <AssignmentBadge status={r.status} />
                                </button></li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
            {openId && <AssignmentDrawer id={openId} token={token} onClose={() => setOpenId(null)} onChanged={load} onEdit={a => { setOpenId(null); setEditing(a); }} />}
        </div>
    );
}

// Each section lists the permissions that unlock it; the API enforces the same rules.
const SECTIONS = [
    { id: 'Assignments', perms: ['assignments.manage'] },
    { id: 'Payouts', perms: ['payouts.manage'] },
    { id: 'Settings', perms: ['assignments.manage'] },
] as const;
type SectionId = typeof SECTIONS[number]['id'];

// Writer assignments admin: Operations (assignments) and Finance (payouts).
export default function AdminAssignmentsTab({ token, access }: { token: string; access: AdminAccess | null }) {
    const sections = SECTIONS.filter(s => hasPermission(access, ...s.perms));
    const [picked, setSection] = useState<SectionId | null>(null);
    const section = sections.find(s => s.id === picked)?.id || sections[0]?.id;
    const [currencies, setCurrencies] = useState<string[]>(['USD']);
    // Active currencies from the public catalogue, so roles without membership access can still price work.
    useEffect(() => {
        api<{ currencies: string[] }>('/membership/plans')
            .then(d => { if (d.currencies?.length) setCurrencies(d.currencies); }).catch(() => {});
    }, []);
    if (!section) return <p className="text-sm text-gray-500">Your role doesn’t include assignment access.</p>;
    return (
        <div className="space-y-6">
            <nav className="flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Assignment sections">
                {sections.map(({ id: s }) => <button key={s} onClick={() => setSection(s)} aria-current={section === s ? 'page' : undefined} className={cn('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold', section === s ? 'border-[#fea520] text-[#000a1e]' : 'border-transparent text-gray-500')}>{s}</button>)}
            </nav>
            {section === 'Assignments' && <AssignmentsPanel token={token} currencies={currencies} />}
            {section === 'Payouts' && <PayoutsPanel token={token} />}
            {section === 'Settings' && <AssignmentSettingsPanel token={token} />}
        </div>
    );
}
