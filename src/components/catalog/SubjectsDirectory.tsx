import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { absoluteMedia, type CatalogTree } from '../../lib/catalogContent';

type TreeState = { tree: CatalogTree | null; state: 'loading' | 'ready' | 'error'; retry: () => void };

// The published subject → service → project hierarchy (GET /api/catalog/tree).
export function useCatalogTree(): TreeState {
    const [tree, setTree] = useState<CatalogTree | null>(null);
    const [state, setState] = useState<TreeState['state']>('loading');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const ctrl = new AbortController();
        setState('loading');
        api<CatalogTree>('/catalog/tree', { signal: ctrl.signal })
            .then(t => { setTree(t); setState('ready'); })
            .catch(e => { if (e?.name !== 'AbortError') setState('error'); });
        return () => ctrl.abort();
    }, [attempt]);
    return { tree, state, retry: () => setAttempt(a => a + 1) };
}

// Cards for each live subject with its first few services.
export function SubjectGrid({ subjects, maxServices = 4 }: { subjects: CatalogTree['subjects']; maxServices?: number }) {
    // One or two subjects fill the row with wider cards instead of leaving a gap.
    const few = subjects.length < 3;
    return (
        <ul className={`grid gap-5 sm:grid-cols-2 ${subjects.length === 1 ? 'sm:grid-cols-1' : few ? '' : 'lg:grid-cols-3'}`} data-testid="subject-grid">
            {subjects.map(s => (
                <li key={s.id} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md">
                    <Link to={`/subjects/${s.slug}`} className="group flex flex-1 flex-col">
                        {s.image
                            ? <img src={absoluteMedia(s.image.url)} alt="" loading="lazy" className={`aspect-[16/9] w-full object-cover ${few ? 'lg:aspect-[21/9]' : ''}`} />
                            : <span className={`flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-[#000a1e] to-[#002147] ${few ? 'lg:aspect-[21/9]' : ''}`}><BookOpen className="h-10 w-10 text-[#fea520]" /></span>}
                        <span className="flex flex-1 flex-col p-6">
                            <span className="text-lg font-bold text-[#000a1e]">{s.name}</span>
                            {s.description && <span className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-600">{s.description}</span>}
                            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#002147]">Explore <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
                        </span>
                    </Link>
                    {s.services.length > 0 && (
                        <ul className="flex flex-wrap gap-2 border-t border-gray-100 px-6 py-4">
                            {s.services.slice(0, maxServices).map(v => (
                                <li key={v.id}><Link to={`/subjects/${s.slug}/${v.slug}`} className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-[#fea520]/20 hover:text-[#000a1e]">{v.name}</Link></li>
                            ))}
                            {s.services.length > maxServices && <li><Link to={`/subjects/${s.slug}`} className="inline-block px-1 py-1 text-xs font-semibold text-gray-500 hover:text-[#000a1e]">+{s.services.length - maxServices} more</Link></li>}
                        </ul>
                    )}
                </li>
            ))}
        </ul>
    );
}

// Home page section. Hidden until the admin publishes at least one subject.
export function SubjectsSection({ limit = 6 }: { limit?: number }) {
    const { tree, state } = useCatalogTree();
    const subjects = tree?.subjects || [];
    if (state !== 'ready' || subjects.length === 0) return null;
    return (
        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="subjects-heading" data-testid="home-subjects">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-[#fea520]">Subjects</p>
                    <h2 id="subjects-heading" className="mt-1 text-3xl font-bold tracking-tight text-[#000a1e] md:text-4xl">Browse by subject</h2>
                </div>
                <Link to="/subjects" className="inline-flex items-center gap-1.5 font-semibold text-[#002147] hover:text-[#000a1e]">All subjects <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <SubjectGrid subjects={subjects.slice(0, limit)} />
        </section>
    );
}
