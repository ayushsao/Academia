import React, { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, PenTool, ChevronLeft, ChevronRight, CheckCircle2, XCircle, SlidersHorizontal, Star } from 'lucide-react';
import { api } from '../../../lib/api';
import { APPLICATION_STATUS_LABEL, ACADEMIC_LEVELS, countryName, type WriterStatus } from '../../../lib/writerOptions';
import { CountrySelect, inputClass } from '../../../components/writer/FormKit';
import { AvailabilityDot, Spinner, StatusBadge, WriterAvatar } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';
import AdminWriterDrawer from './AdminWriterDrawer';
import { hasPermission, type AdminAccess } from './access';
import { RiskBadge, type RiskSummary } from './RiskBadge';

type Row = {
    id: string; name: string; email: string | null; status: WriterStatus; emailVerified: boolean; phoneVerified: boolean;
    country: string; city: string; subjects: string[]; academicLevels: string[]; yearsExperience: number | null; hasPhoto: boolean; photoVersion?: number;
    applicationStatus: string; submittedAt?: string; availability: 'AVAILABLE' | 'UNAVAILABLE'; membership: string; plan: string | null;
    metrics: { rating: number; ratingCount: number; completed: number; qualityScore: number; onTimeRate: number } | null; createdAt: string;
    risk?: RiskSummary;
};
export type ListMode = 'queue' | 'directory';

const QUEUE_FILTERS = [
    { key: 'SUBMITTED', label: 'Awaiting review' }, { key: 'UNDER_REVIEW', label: 'In review' }, { key: 'INFO_REQUESTED', label: 'Info requested' },
    { key: 'APPROVED,REJECTED', label: 'Decided' }, { key: 'DRAFT', label: 'Incomplete drafts' },
];
const DIRECTORY_TABS = [
    { key: '', label: 'All' }, { key: 'PENDING,UNDER_REVIEW', label: 'Pending' }, { key: 'APPROVED,ACTIVE', label: 'Approved' },
    { key: 'ACTIVE', label: 'Active members' }, { key: 'SUSPENDED', label: 'Suspended' }, { key: 'REJECTED', label: 'Rejected' }, { key: 'INACTIVE', label: 'Inactive' },
];
const MEMBERSHIP = ['', 'NONE', 'PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'SUSPENDED'];
const SORTS = [['newest', 'Newest'], ['oldest', 'Oldest'], ['rating', 'Rating'], ['completed', 'Completed work'], ['quality', 'Quality score'], ['experience', 'Experience']];
const EMPTY = { country: '', subject: '', skill: '', level: '', membership: '', plan: '', minRating: '', minExperience: '', joinedFrom: '', joinedTo: '', risk: '', sort: 'newest' };
const PAGE_SIZE = 20;

export default function AdminWriterList({ token, access, mode }: { token: string; access: AdminAccess | null; mode: ListMode }) {
    const [rows, setRows] = useState<Row[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [tab, setTab] = useState(mode === 'queue' ? 'SUBMITTED' : '');
    const [filters, setFilters] = useState(EMPTY);
    const [showFilters, setShowFilters] = useState(false);
    const [facets, setFacets] = useState<{ subjects: string[]; skills: { slug: string; label: string }[]; plans: string[] }>({ subjects: [], skills: [], plans: [] });
    const [summary, setSummary] = useState<{ writers: Record<string, number>; applications: Record<string, number> } | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);

    useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
    useEffect(() => { setPage(1); }, [debounced, tab, filters]);
    useEffect(() => { api<typeof facets>('/admin/writers/facets', { token }).then(setFacets).catch(() => {}); }, [token]);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (debounced) q.set('search', debounced);
        if (tab) q.set(mode === 'queue' ? 'application' : 'status', tab);
        Object.entries(filters).forEach(([k, v]) => { if (v && !(k === 'sort' && v === 'newest')) q.set(k, String(v)); });
        try {
            const [list, sum] = await Promise.all([
                api<{ writers: Row[]; total: number }>(`/admin/writers?${q}`, { token }),
                api<typeof summary>('/admin/writers/summary', { token }),
            ]);
            setRows(list.writers); setTotal(list.total); setSummary(sum);
        } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
    }, [page, debounced, tab, filters, mode, token]);
    useEffect(() => { load(); }, [load]);

    const count = (key: string) => key.split(',').reduce((n, k) => n + ((mode === 'queue' ? summary?.applications : summary?.writers)?.[k] || 0), 0);
    const chips = mode === 'queue' ? QUEUE_FILTERS : DIRECTORY_TABS;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const set = (k: keyof typeof EMPTY, v: string) => setFilters(f => ({ ...f, [k]: v }));
    const activeFilters = Object.entries(filters).filter(([k, v]) => v && !(k === 'sort' && v === 'newest')).length;
    const showPerf = rows.some(r => r.metrics);
    const canRisk = hasPermission(access, 'risk.review');

    return (
        <div className="space-y-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
                {chips.map(c => (
                    <button key={c.key} onClick={() => setTab(c.key)}
                        className={cn('inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-semibold transition',
                            tab === c.key ? 'border-[#000a1e] bg-[#000a1e] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300')}>
                        {c.label}
                        {c.key && summary && <span className={cn('rounded-md px-1.5 text-xs', tab === c.key ? 'bg-white/15' : 'bg-gray-100')}>{count(c.key)}</span>}
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={access?.permissions.includes('writers.contact') ? 'Search name, email or phone' : 'Search name or email'} className={cn(inputClass, 'py-2.5 pl-11 text-sm')} aria-label="Search writers" />
                </div>
                <button onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">
                    <SlidersHorizontal className="h-4 w-4" /> Filters{activeFilters ? ` (${activeFilters})` : ''}
                </button>
                <button onClick={load} aria-label="Refresh" className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 hover:bg-gray-50"><RefreshCw className="h-4 w-4 text-gray-500" /></button>
            </div>

            {showFilters && (
                <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs font-semibold text-gray-500">Country<CountrySelect value={filters.country} onChange={v => set('country', v)} placeholder="Any country" /></label>
                    <label className="text-xs font-semibold text-gray-500">Subject<select className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.subject} onChange={e => set('subject', e.target.value)}><option value="">Any subject</option>{facets.subjects.map(s => <option key={s}>{s}</option>)}</select></label>
                    <label className="text-xs font-semibold text-gray-500">Skill<select className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.skill} onChange={e => set('skill', e.target.value)}><option value="">Any skill</option>{facets.skills.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}</select></label>
                    <label className="text-xs font-semibold text-gray-500">Academic level<select className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.level} onChange={e => set('level', e.target.value)}><option value="">Any level</option>{ACADEMIC_LEVELS.map(l => <option key={l}>{l}</option>)}</select></label>
                    <label className="text-xs font-semibold text-gray-500">Membership<select className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.membership} onChange={e => set('membership', e.target.value)}>{MEMBERSHIP.map(m => <option key={m} value={m}>{m ? m.charAt(0) + m.slice(1).toLowerCase().replace('_', ' ') : 'Any membership'}</option>)}</select></label>
                    <label className="text-xs font-semibold text-gray-500">Plan<select className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.plan} onChange={e => set('plan', e.target.value)}><option value="">Any plan</option>{facets.plans.map(p => <option key={p}>{p}</option>)}</select></label>
                    <label className="text-xs font-semibold text-gray-500">Minimum rating<select className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.minRating} onChange={e => set('minRating', e.target.value)}><option value="">Any</option>{['3', '3.5', '4', '4.5'].map(r => <option key={r} value={r}>{r}+ ★</option>)}</select></label>
                    <label className="text-xs font-semibold text-gray-500">Minimum experience<select className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.minExperience} onChange={e => set('minExperience', e.target.value)}><option value="">Any</option>{['1', '3', '5', '10'].map(r => <option key={r} value={r}>{r}+ years</option>)}</select></label>
                    <label className="text-xs font-semibold text-gray-500">Joined from<input type="date" className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.joinedFrom} onChange={e => set('joinedFrom', e.target.value)} /></label>
                    <label className="text-xs font-semibold text-gray-500">Joined to<input type="date" className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.joinedTo} onChange={e => set('joinedTo', e.target.value)} /></label>
                    {canRisk && <label className="text-xs font-semibold text-gray-500">Risk<select className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.risk} onChange={e => set('risk', e.target.value)}><option value="">Any</option><option value="LOW">Any flag</option><option value="MEDIUM">Medium or high</option><option value="HIGH">High only</option></select></label>}
                    <label className="text-xs font-semibold text-gray-500">Sort by<select className={cn(inputClass, 'mt-1 py-2 text-sm')} value={filters.sort} onChange={e => set('sort', e.target.value)}>{[...SORTS, ...(canRisk ? [['risk', 'Risk score']] : [])].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                    <div className="flex items-end"><button onClick={() => setFilters(EMPTY)} disabled={!activeFilters} className="text-sm font-semibold text-[#b86e00] hover:underline disabled:text-gray-300 disabled:no-underline">Clear filters</button></div>
                </div>
            )}

            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {loading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>
                    : rows.length === 0 ? <div className="py-16 text-center text-gray-400"><PenTool className="mx-auto mb-3 h-10 w-10 opacity-40" /><p className="font-semibold">No writers match</p></div> : (
                        <>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[900px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50 text-xs font-bold uppercase tracking-widest text-gray-400">
                                            <th className="px-5 py-3">Writer</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Expertise</th>
                                            <th className="px-5 py-3">Status</th><th className="px-5 py-3">Membership</th>
                                            {showPerf && <th className="px-5 py-3">Performance</th>}
                                            <th className="px-5 py-3">{mode === 'queue' ? 'Submitted' : 'Joined'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {rows.map(r => (
                                            <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer hover:bg-gray-50/70">
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <WriterAvatar writerId={r.id} name={r.name} hasPhoto={r.hasPhoto} version={r.photoVersion} mode="private" token={token} size={36} />
                                                        <div className="min-w-0">
                                                            <p className="flex items-center gap-2 truncate font-bold text-[#000a1e]">{r.name}<RiskBadge risk={r.risk} /></p>
                                                            <p className="flex items-center gap-2 truncate text-xs text-gray-400">
                                                                {r.email && <span>{r.email}</span>}
                                                                <span className="inline-flex items-center gap-0.5">{r.emailVerified ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <XCircle className="h-3 w-3 text-gray-300" />}email</span>
                                                                <span className="inline-flex items-center gap-0.5">{r.phoneVerified ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <XCircle className="h-3 w-3 text-gray-300" />}phone</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-gray-600">{countryName(r.country)}<span className="block text-xs text-gray-400">{r.city}</span></td>
                                                <td className="px-5 py-3.5 text-gray-600"><span className="line-clamp-1">{r.subjects.join(', ') || '—'}</span><span className="block text-xs text-gray-400">{r.academicLevels.join(', ')}{r.yearsExperience !== null ? ` · ${r.yearsExperience} yrs` : ''}</span></td>
                                                <td className="px-5 py-3.5"><StatusBadge status={r.status} /><span className="mt-1 block text-xs text-gray-400">{APPLICATION_STATUS_LABEL[r.applicationStatus]}</span></td>
                                                <td className="px-5 py-3.5 text-gray-600">{r.plan && r.membership !== 'NONE' ? r.plan : '—'}<span className="block text-xs text-gray-400">{r.membership.toLowerCase().replace('_', ' ')}{['APPROVED', 'ACTIVE'].includes(r.status) && <> · <AvailabilityDot status={r.availability} label={false} /></>}</span></td>
                                                {showPerf && <td className="px-5 py-3.5 text-gray-600">{r.metrics?.ratingCount ? <span className="inline-flex items-center gap-1 font-semibold text-[#000a1e]"><Star className="h-3.5 w-3.5 fill-[#f39200] text-[#f39200]" />{r.metrics.rating.toFixed(2)}</span> : <span className="text-gray-400">unrated</span>}<span className="block text-xs text-gray-400">{r.metrics?.completed ?? 0} completed{r.metrics?.completed ? ` · Q${Math.round(r.metrics.qualityScore)}` : ''}</span></td>}
                                                <td className="whitespace-nowrap px-5 py-3.5 text-gray-500">{new Date((mode === 'queue' && r.submittedAt) || r.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <ul className="divide-y divide-gray-100 md:hidden">
                                {rows.map(r => (
                                    <li key={r.id}><button onClick={() => setOpenId(r.id)} className="flex w-full items-center gap-3 p-4 text-left">
                                        <WriterAvatar writerId={r.id} name={r.name} hasPhoto={r.hasPhoto} version={r.photoVersion} mode="private" token={token} size={40} />
                                        <div className="min-w-0 flex-1"><p className="flex items-center gap-2 truncate font-bold text-[#000a1e]">{r.name}<RiskBadge risk={r.risk} /></p><p className="truncate text-xs text-gray-400">{countryName(r.country)} · {r.plan && r.membership !== 'NONE' ? r.plan : APPLICATION_STATUS_LABEL[r.applicationStatus]}</p></div>
                                        <StatusBadge status={r.status} />
                                    </button></li>
                                ))}
                            </ul>
                        </>
                    )}
                {total > PAGE_SIZE && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-500">
                        <span>Page {page} of {pages} · {total} writers</span>
                        <div className="flex gap-1">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-30" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-30" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                    </div>
                )}
            </div>

            {openId && <AdminWriterDrawer writerId={openId} token={token} onClose={() => setOpenId(null)} onChanged={load} />}
        </div>
    );
}
