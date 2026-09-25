import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ChevronRight, FileText, SearchX } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { OrderModal } from '../components/OrderModal';
import { SignInModal } from '../components/SignInModal';
import { SideDrawer } from '../components/SideDrawer';
import { BlockRenderer, FaqList } from '../components/catalog/BlockRenderer';
import { PricingPanel, type PricingChoice } from '../components/catalog/PricingPanel';
import { api, ApiError } from '../lib/api';
import { absoluteMedia, type CatalogOrderContext, type CatalogPageData } from '../lib/catalogContent';
import { useSeo } from '../lib/useSeo';

// Database-driven catalogue pages: /subjects/:subject[/:service[/:project]].
// Content blocks, FAQs and SEO all come from the admin CMS.
export function CatalogPage() {
    const { subject = '', service, project } = useParams();
    const [page, setPage] = useState<CatalogPageData | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);
    const [orderOpen, setOrderOpen] = useState(false);
    const [orderCtx, setOrderCtx] = useState<CatalogOrderContext | null>(null);
    const [signInOpen, setSignInOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        const ctrl = new AbortController();
        const seg = (s: string) => encodeURIComponent(s.toLowerCase());
        const path = project ? `/catalog/pages/project/${seg(subject)}/${seg(service!)}/${seg(project)}`
            : service ? `/catalog/pages/service/${seg(subject)}/${seg(service)}` : `/catalog/pages/subject/${seg(subject)}`;
        setState('loading');
        api<{ page: CatalogPageData }>(path, { signal: ctrl.signal })
            .then(r => { setPage(r.page); setState('ready'); window.scrollTo(0, 0); })
            .catch(e => { if (e?.name === 'AbortError') return; setPage(null); setState(e instanceof ApiError && e.status === 404 ? 'missing' : 'error'); });
        return () => ctrl.abort();
    }, [subject, service, project, attempt]);

    useSeo(state === 'ready' ? page : null);
    useEffect(() => {
        if (state !== 'missing') return;
        const robots = document.createElement('meta');
        robots.name = 'robots'; robots.content = 'noindex';
        document.head.appendChild(robots);
        return () => robots.remove();
    }, [state]);

    // Every order button on the page orders this subject/service/project at the admin's price.
    const orderWith = (choice?: PricingChoice) => {
        if (page && state === 'ready') {
            const [subjectCrumb, serviceCrumb, projectCrumb] = page.breadcrumbs;
            setOrderCtx({
                ...page.entity.ids,
                subjectName: subjectCrumb?.name || page.entity.name,
                serviceName: serviceCrumb?.name || '',
                projectTitle: projectCrumb?.name || '',
                ...choice,
            });
        } else setOrderCtx(null);
        setOrderOpen(true);
    };
    const openOrder = () => orderWith();
    const hasFaqBlock = page?.blocks.some(b => b.type === 'FAQ');
    // A service page with an "Available projects" block already lists its projects.
    const children = page?.entity.type === 'SERVICE' && page.blocks.some(b => b.type === 'AVAILABLE_PROJECTS' && b.projects?.length) ? [] : page?.children || [];
    const e = page?.entity;
    const childLabel = e?.type === 'SUBJECT' ? 'Services' : 'Projects';

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 font-sans">
            <Navbar onOpenOrder={openOrder} onOpenSignIn={() => setSignInOpen(true)} onOpenDrawer={() => setDrawerOpen(true)} activeSection="" onNavigate={() => { }} />

            <main className="flex-grow">
                {state === 'loading' && (
                    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
                        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#002147]" />
                    </div>
                )}

                {(state === 'missing' || state === 'error') && (
                    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-20 text-center">
                        <SearchX className="mb-4 h-12 w-12 text-gray-300" />
                        <h1 className="text-2xl font-bold text-[#000a1e]">{state === 'missing' ? 'Page not found' : 'Something went wrong'}</h1>
                        <p className="mt-2 text-gray-500">{state === 'missing' ? 'This page may have moved or is no longer available.' : 'We couldn’t load this page. Please try again.'}</p>
                        <div className="mt-6 flex gap-3">
                            {state === 'error' && <button onClick={() => setAttempt(a => a + 1)} className="rounded-full bg-[#000a1e] px-6 py-3 font-semibold text-white">Try again</button>}
                            <Link to="/" className="rounded-full border border-gray-200 bg-white px-6 py-3 font-semibold text-[#000a1e]">Go home</Link>
                        </div>
                    </div>
                )}

                {state === 'ready' && page && e && (
                    <>
                        {/* Hero */}
                        <header className="relative overflow-hidden bg-gradient-to-br from-[#000a1e] via-[#001330] to-[#002147] text-white">
                            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#fea520]/15 blur-3xl" aria-hidden />
                            <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.4fr_1fr] lg:px-8">
                                <div>
                                    <nav aria-label="Breadcrumb">
                                        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/60">
                                            <li><Link to="/" className="hover:text-white">Home</Link></li>
                                            {page.breadcrumbs.map((c, i) => (
                                                <li key={c.path} className="flex items-center gap-1.5">
                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                    {i === page.breadcrumbs.length - 1 ? <span aria-current="page" className="text-white/90">{c.name}</span> : <Link to={c.path} className="hover:text-white">{c.name}</Link>}
                                                </li>
                                            ))}
                                        </ol>
                                    </nav>
                                    <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">{e.name}</h1>
                                    {e.description && <p className="mt-5 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-white/75 md:text-xl">{e.description}</p>}
                                    <div className="mt-8 flex flex-wrap gap-3">
                                        <button onClick={openOrder} className="inline-flex items-center gap-2 rounded-full bg-[#fea520] px-7 py-3.5 font-bold text-[#000a1e] shadow-lg shadow-[#fea520]/20 transition hover:bg-[#ffb340]">Get a free quote <ArrowRight className="h-4 w-4" /></button>
                                        {children.length > 0 && <a href="#explore" className="inline-flex items-center rounded-full border border-white/25 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10">Explore {childLabel.toLowerCase()}</a>}
                                    </div>
                                </div>
                                {e.image && <img src={absoluteMedia(e.image.url)} alt={e.image.alt} className="hidden aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl ring-1 ring-white/10 lg:block" />}
                            </div>
                        </header>

                        <div className="mx-auto max-w-7xl space-y-16 px-4 py-14 sm:px-6 md:py-20 lg:px-8">
                            <PricingPanel ids={e.ids} onOrder={orderWith} />
                            {page.blocks.length > 0 && <BlockRenderer blocks={page.blocks} onOrder={openOrder} />}

                            {e.files.length > 0 && (
                                <section className="space-y-5">
                                    <h2 className="text-2xl font-bold text-[#000a1e] md:text-3xl">Project files</h2>
                                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {e.files.map(f => (
                                            <li key={f.url}>
                                                <a href={absoluteMedia(f.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:border-[#fea520]/50">
                                                    {f.kind === 'IMAGE' ? <img src={absoluteMedia(f.url)} alt="" loading="lazy" className="h-12 w-12 rounded-lg object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100"><FileText className="h-5 w-5 text-gray-400" /></span>}
                                                    <span className="min-w-0 truncate font-medium text-[#000a1e]">{f.name}</span>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {children.length > 0 && (
                                <section id="explore" className="scroll-mt-24 space-y-6">
                                    <h2 className="text-2xl font-bold text-[#000a1e] md:text-3xl">{childLabel} in {e.name}</h2>
                                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {children.map(c => (
                                            <li key={c.path}>
                                                <Link to={c.path} className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                                                    <span className="text-lg font-bold text-[#000a1e]">{c.name}</span>
                                                    {c.summary && <span className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-gray-600">{c.summary}</span>}
                                                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#002147]">Learn more <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {/* FAQs are always shown when present (also backs the FAQPage schema). */}
                            {!hasFaqBlock && page.faqs.length > 0 && (
                                <section className="max-w-4xl space-y-6">
                                    <h2 className="text-2xl font-bold text-[#000a1e] md:text-3xl">Frequently asked questions</h2>
                                    <FaqList faqs={page.faqs} />
                                </section>
                            )}
                        </div>
                    </>
                )}
            </main>

            <Footer onOpenOrder={openOrder} onOpenSignIn={() => setSignInOpen(true)} onNavigate={() => { }} />
            <SideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onProceedToOrder={openOrder} />
            <OrderModal isOpen={orderOpen} onClose={() => setOrderOpen(false)} catalog={orderCtx} />
            <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
        </div>
    );
}
