import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star, FileText, MapPin, SlidersHorizontal, BadgeCheck, ArrowRight } from 'lucide-react';
import { MarketplaceNavbar as Navbar } from '../../components/writer/MarketplaceNavbar';
import { Footer } from '../../components/Footer';
import { api } from '../../lib/api';
import type { PublicWriter } from '../../lib/writerTypes';
import { ACADEMIC_LEVELS, PREDEFINED_SKILLS, SUGGESTED_SUBJECTS, countryName } from '../../lib/writerOptions';
import { CountrySelect, inputClass } from '../../components/writer/FormKit';
import { AvailabilityDot, Spinner, WriterAvatar } from '../../components/writer/WriterBits';
import { cn } from '../../lib/utils';

const PAGE_SIZE = 12;

function WriterCard({ w }: { w: PublicWriter }) {
    return (
        <Link to={`/writer/${w.id}`} className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#002147]/30 hover:shadow-[0_20px_50px_-30px_rgba(0,33,71,0.45)] sm:p-6">
            <div className="flex items-start gap-4">
                <WriterAvatar writerId={w.id} name={w.name} hasPhoto={w.hasPhoto} version={w.photoVersion} size={60} />
                <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-1.5 truncate text-lg font-bold text-[#0b1b33] group-hover:text-[#002147]">{w.name}<BadgeCheck className="h-4 w-4 shrink-0 text-[#b86e00]" /></h3>
                    <p className="line-clamp-1 text-sm text-slate-600">{w.headline || w.topDegree}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{countryName(w.country)} · {w.yearsExperience} yrs</p>
                </div>
            </div>
            <div className="mt-4 flex items-center gap-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                <span className="inline-flex items-center gap-1 font-semibold text-[#0b1b33]"><Star className="h-4 w-4 fill-[#fea520] text-[#fea520]" />{w.metrics.ratingCount ? w.metrics.rating.toFixed(1) : 'New'}</span>
                <span className="inline-flex items-center gap-1 text-slate-600"><FileText className="h-4 w-4" />{w.metrics.completedAssignments}</span>
                <span className="ml-auto"><AvailabilityDot status={w.availability} /></span>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
                {w.subjects.slice(0, 4).map(s => <span key={s} className="rounded-md bg-[#002147]/[0.05] px-2 py-1 text-xs font-medium text-[#002147]">{s}</span>)}
                {w.subjects.length > 4 && <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">+{w.subjects.length - 4}</span>}
            </div>
            <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-[#002147]">View profile <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
        </Link>
    );
}

export default function HireWriters() {
    const [writers, setWriters] = useState<PublicWriter[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [filters, setFilters] = useState({ subject: '', level: '', skill: '', country: '', available: false });
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 350); return () => clearTimeout(t); }, [search]);
    useEffect(() => { setPage(1); }, [debounced, filters]);

    useEffect(() => {
        const ctrl = new AbortController();
        const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (debounced) q.set('search', debounced);
        Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v === true ? '1' : String(v)); });
        setLoading(true); setError('');
        api<{ writers: PublicWriter[]; total: number }>(`/writers/public?${q}`, { signal: ctrl.signal })
            .then(d => { setWriters(prev => (page === 1 ? d.writers : [...prev, ...d.writers])); setTotal(d.total); })
            .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
            .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
        return () => ctrl.abort();
    }, [page, debounced, filters]);

    const setFilter = <K extends keyof typeof filters>(k: K, v: (typeof filters)[K]) => setFilters(f => ({ ...f, [k]: v }));
    const activeCount = Object.values(filters).filter(Boolean).length;

    return (
        <div className="flex min-h-screen flex-col bg-[#f6f8fc] font-sans">
            <Navbar activeSection="writers" />
            <main className="mx-auto w-full max-w-7xl flex-grow px-4 pb-24 pt-10 sm:px-6 lg:pt-14">
                <header className="mx-auto mb-10 max-w-3xl text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b86e00]">Verified writer network</p>
                    <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0b1b33] sm:text-5xl">Find the right academic expert</h1>
                    <p className="mt-4 text-slate-600 sm:text-lg">Every writer here passed identity verification and a human review of their qualifications and writing.</p>
                </header>

                <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} maxLength={80} placeholder="Search by name, subject or expertise" aria-label="Search writers" className={cn(inputClass, 'pl-12')} />
                        </div>
                        <button onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-[#002147] hover:bg-slate-50">
                            <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ''}
                        </button>
                    </div>
                    {showFilters && (
                        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-5">
                            <select aria-label="Subject" className={inputClass} value={filters.subject} onChange={e => setFilter('subject', e.target.value)}>
                                <option value="">Any subject</option>{SUGGESTED_SUBJECTS.map(s => <option key={s}>{s}</option>)}
                            </select>
                            <select aria-label="Academic level" className={inputClass} value={filters.level} onChange={e => setFilter('level', e.target.value)}>
                                <option value="">Any level</option>{ACADEMIC_LEVELS.map(s => <option key={s}>{s}</option>)}
                            </select>
                            <select aria-label="Skill" className={inputClass} value={filters.skill} onChange={e => setFilter('skill', e.target.value)}>
                                <option value="">Any skill</option>{PREDEFINED_SKILLS.filter(s => s !== 'Other').map(s => <option key={s}>{s}</option>)}
                            </select>
                            <CountrySelect value={filters.country} onChange={v => setFilter('country', v)} placeholder="Any country" />
                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                                <input type="checkbox" checked={filters.available} onChange={e => setFilter('available', e.target.checked)} className="h-4 w-4 accent-[#002147]" /> Available now
                            </label>
                            {activeCount > 0 && <button onClick={() => setFilters({ subject: '', level: '', skill: '', country: '', available: false })} className="text-left text-sm font-semibold text-[#b86e00] hover:underline sm:col-span-2 lg:col-span-5">Clear filters</button>}
                        </div>
                    )}
                </div>

                {error && <p role="alert" className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

                {!loading && writers.length === 0 && !error ? (
                    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-20 text-center">
                        <FileText className="mx-auto h-12 w-12 text-slate-300" />
                        <h2 className="mt-4 text-xl font-bold text-[#0b1b33]">No writers match those filters</h2>
                        <p className="mt-1 text-slate-500">Try a broader search or clear some filters.</p>
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-sm text-slate-500">{total} writer{total === 1 ? '' : 's'}</p>
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{writers.map(w => <React.Fragment key={w.id}><WriterCard w={w} /></React.Fragment>)}</div>
                    </>
                )}

                <div className="mt-10 flex justify-center">
                    {loading ? <Spinner className="h-8 w-8 text-[#002147]" /> : writers.length < total && (
                        <button onClick={() => setPage(p => p + 1)} className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-[#002147] hover:bg-slate-50">Load more writers</button>
                    )}
                </div>

                <aside className="mt-16 flex flex-col items-start gap-4 rounded-3xl bg-[#002147] p-6 text-white sm:flex-row sm:items-center sm:p-8">
                    <div className="flex-1">
                        <p className="text-lg font-bold">Are you an academic expert?</p>
                        <p className="text-white/70">Join our international writer network. Applications are reviewed by our HR team.</p>
                    </div>
                    <Link to="/become-a-writer" className="rounded-xl bg-[#fea520] px-6 py-3 font-bold text-[#0b1b33] hover:bg-[#f39200]">Become a writer</Link>
                </aside>
            </main>
            <Footer />
        </div>
    );
}
