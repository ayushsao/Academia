import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Spinner } from '../../../../components/writer/WriterBits';
import { cn } from '../../../../lib/utils';
import type { CatalogPageData, EntityType } from '../../../../lib/catalogContent';
import { BlockRenderer, FaqList, type ImgComponent } from '../../../../components/catalog/BlockRenderer';
import { BASE, PublishPill, StatusPill, Switch, type Options } from './shared';
import { AdminImg } from './MediaLibrary';
import BlockManager from './BlockManager';
import FaqManager from './FaqManager';
import SeoEditor from './SeoEditor';
import { ENTITY_LABEL, ENTITY_PATH, type AdminBlock, type AdminFaq, type ContentEntity, type SeoDefaults } from './cmsShared';

type Tab = 'blocks' | 'faq' | 'seo' | 'preview';
type ContentResponse = { entity: ContentEntity; blocks: AdminBlock[]; faqs: AdminFaq[]; seoDefaults: SeoDefaults };

/**
 * Full-screen page builder for one subject / service / project: content
 * blocks, FAQs, SEO and a preview, with a publish toggle.
 */
export default function ContentManager({ token, target, options, onClose }: { token: string; target: { type: EntityType; id: string }; options: Options; onClose: (changed: boolean) => void }) {
    const [data, setData] = useState<ContentResponse | null>(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<Tab>('blocks');
    const [publishing, setPublishing] = useState(false);
    const [changed, setChanged] = useState(false);

    const load = useCallback(async () => {
        setError('');
        try { setData(await api<ContentResponse>(`${BASE}/content/${target.type}/${target.id}`, { token })); }
        catch (e) { setError((e as Error).message); }
    }, [target.type, target.id, token]);
    useEffect(() => { load(); }, [load]);
    // Full-screen editor: lock page scroll and keep the floating chat button off the editor's buttons.
    useEffect(() => {
        document.body.style.overflow = 'hidden'; document.body.classList.add('cms-editing');
        return () => { document.body.style.overflow = ''; document.body.classList.remove('cms-editing'); };
    }, []);

    const entity = data?.entity;
    const setBlocks = (blocks: AdminBlock[]) => setData(d => d && { ...d, blocks });
    const setFaqs = (faqs: AdminFaq[]) => setData(d => d && { ...d, faqs });

    const publish = async (on: boolean) => {
        if (!entity) return;
        setPublishing(true); setError('');
        try {
            await api(`${BASE}${ENTITY_PATH[entity.type]}/${entity.id}/publish`, { method: 'PATCH', token, body: { published: on } });
            setChanged(true); await load();
        } catch (e) { setError((e as Error).message); } finally { setPublishing(false); }
    };

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: 'blocks', label: 'Content blocks', count: data?.blocks.length },
        { id: 'faq', label: 'FAQ', count: data?.faqs.length },
        { id: 'seo', label: 'SEO' },
        { id: 'preview', label: 'Preview' },
    ];

    return (
        <div className="fixed inset-0 z-[45] flex flex-col bg-[#f7f8fa]" role="dialog" aria-modal="true" aria-label={entity ? `Content for ${entity.name}` : 'Content'}>
            <header className="border-b border-gray-200 bg-white">
                <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
                    <button onClick={() => onClose(changed)} className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /> Back</button>
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{ENTITY_LABEL[target.type]} · Content & SEO</p>
                        <h2 className="truncate text-lg font-bold text-[#000a1e]">{entity?.name || '…'}</h2>
                    </div>
                    {entity && (
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="flex gap-1.5"><StatusPill status={entity.status} /><PublishPill published={entity.published} /></span>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><Switch checked={entity.published} disabled={publishing} label="Published" onChange={publish} />Published</label>
                            {entity.live
                                ? <a href={entity.path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-[#002147] hover:bg-gray-50">View live <ExternalLink className="h-3.5 w-3.5" /></a>
                                : <span className="text-xs text-gray-400">{entity.status !== 'ACTIVE' ? 'Inactive — hidden' : !entity.published ? 'Draft — not on the site' : 'Hidden: a parent is off'}</span>}
                        </div>
                    )}
                </div>
                <nav className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6" aria-label="Content sections">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
                            className={cn('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold', tab === t.id ? 'border-[#fea520] text-[#000a1e]' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                            {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{t.count}</span>}
                        </button>
                    ))}
                </nav>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
                    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error} {!data && <button onClick={load} className="ml-2 underline">Try again</button>}</p>}
                    {!data ? (!error && <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-[#fea520]" /></div>) : (
                        <>
                            {tab === 'blocks' && <BlockManager token={token} entity={data.entity} blocks={data.blocks} setBlocks={b => { setBlocks(b); setChanged(true); }} faqs={data.faqs} options={options} onReload={() => { setChanged(true); load(); }} />}
                            {tab === 'faq' && <FaqManager token={token} entity={data.entity} faqs={data.faqs} setFaqs={f => { setFaqs(f); setChanged(true); }} />}
                            {tab === 'seo' && <SeoEditor token={token} entity={data.entity} defaults={data.seoDefaults}
                                onSaved={patch => { setChanged(true); setData(d => d && { ...d, entity: { ...d.entity, ...patch } }); }} />}
                            {tab === 'preview' && <PagePreview token={token} type={data.entity.type} id={data.entity.id} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// The page as visitors will see it (disabled blocks hidden, drafts included).
function PagePreview({ token, type, id }: { token: string; type: EntityType; id: string }) {
    const [page, setPage] = useState<CatalogPageData | null>(null);
    const [error, setError] = useState('');
    const Img = useCallback<ImgComponent>(p => <AdminImg token={token} {...p} />, [token]);
    const load = useCallback(() => { setError(''); api<{ page: CatalogPageData }>(`${BASE}/preview/${type}/${id}`, { token }).then(r => setPage(r.page)).catch(e => setError(e.message)); }, [type, id, token]);
    useEffect(() => { load(); }, [load]);
    if (error) return <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error} <button onClick={load} className="ml-2 underline">Try again</button></p>;
    if (!page) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-[#fea520]" /></div>;
    const e = page.entity;
    const hasFaqBlock = page.blocks.some(b => b.type === 'FAQ');
    const children = e.type === 'SERVICE' && page.blocks.some(b => b.type === 'AVAILABLE_PROJECTS' && b.projects?.length) ? [] : page.children;
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">Preview of <span className="font-mono text-xs text-gray-700">{e.path}</span> — links are disabled here.</p>
                <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Search result</p>
                <p className="line-clamp-1 text-lg text-[#1a0dab]">{page.seo.title}</p>
                <p className="line-clamp-2 text-sm text-[#4d5156]">{page.seo.description}</p>
                {page.seo.keywords.length > 0 && <p className="mt-2 text-xs text-gray-400">Keywords: {page.seo.keywords.join(', ')}</p>}
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm" data-testid="page-preview">
                <div className="bg-gradient-to-br from-[#000a1e] via-[#001330] to-[#002147] px-6 py-10 text-white md:px-10">
                    <p className="flex flex-wrap items-center gap-1 text-sm text-white/60">Home{page.breadcrumbs.map(c => <React.Fragment key={c.path}><ChevronRight className="h-3.5 w-3.5" />{c.name}</React.Fragment>)}</p>
                    <h1 className="mt-4 text-3xl font-bold md:text-4xl">{e.name}</h1>
                    {e.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-white/75">{e.description}</p>}
                </div>
                <div className="space-y-14 px-6 py-10 md:px-10">
                    {page.blocks.length ? <BlockRenderer blocks={page.blocks} preview Img={Img} /> : <p className="text-center text-sm text-gray-400">No enabled blocks — the page shows the description{page.children.length ? ' and its sub-pages' : ''} only.</p>}
                    {children.length > 0 && (
                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-[#000a1e]">{e.type === 'SUBJECT' ? 'Services' : 'Projects'} in {e.name}</h2>
                            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children.map(c => <li key={c.path} className="rounded-2xl border border-gray-100 bg-white p-5 font-semibold text-[#000a1e]">{c.name}</li>)}</ul>
                        </section>
                    )}
                    {!hasFaqBlock && page.faqs.length > 0 && (
                        <section className="max-w-4xl space-y-4"><h2 className="text-2xl font-bold text-[#000a1e]">Frequently asked questions</h2><FaqList faqs={page.faqs} /></section>
                    )}
                </div>
            </div>
        </div>
    );
}
