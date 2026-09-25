import React, { useState } from 'react';
import { AlertTriangle, ImagePlus, X } from 'lucide-react';
import { api } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';
import { BASE, Label, fieldClass } from './shared';
import { AdminImg, MediaPicker, type MediaItem } from './MediaLibrary';
import { Counter, adminMediaUrl, type ContentEntity, type SeoDefaults } from './cmsShared';

const ROBOTS: [string, string][] = [
    ['index,follow', 'Index this page (recommended)'],
    ['noindex,follow', 'Hide from search, follow links'],
    ['index,nofollow', 'Index, don’t follow links'],
    ['noindex,nofollow', 'Hide from search entirely'],
];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type OgChoice = { mode: 'keep' } | { mode: 'clear' } | { mode: 'set'; item: MediaItem };

export default function SeoEditor({ token, entity, defaults, onSaved }: { token: string; entity: ContentEntity; defaults: SeoDefaults; onSaved: (e: Partial<ContentEntity>) => void }) {
    const s = entity.seo || {};
    const [v, setV] = useState({
        slug: entity.slug, metaTitle: s.metaTitle || '', metaDescription: s.metaDescription || '', canonicalUrl: s.canonicalUrl || '',
        ogTitle: s.ogTitle || '', ogDescription: s.ogDescription || '', robots: s.robots || 'index,follow',
    });
    const [keywords, setKeywords] = useState<string[]>(s.keywords || []);
    const [kw, setKw] = useState('');
    const [og, setOg] = useState<OgChoice>({ mode: 'keep' });
    const [picking, setPicking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const set = (patch: Partial<typeof v>) => { setV(x => ({ ...x, ...patch })); setNotice(''); };

    const addKeywords = (raw: string) => {
        const add = raw.split(',').map(k => k.trim()).filter(Boolean);
        if (!add.length) return;
        setKeywords(list => [...new Set([...list, ...add])].slice(0, 30));
        setKw(''); setNotice('');
    };

    const path = entity.path.replace(/[^/]+$/, v.slug || entity.slug);
    const title = v.metaTitle || defaults.title;
    const description = v.metaDescription || defaults.description;
    const canonical = v.canonicalUrl || (defaults.canonical.startsWith('http') ? defaults.canonical.replace(entity.path, path) : `${window.location.origin}${path}`);
    const ogImageSrc = og.mode === 'set' ? adminMediaUrl(og.item.storedName) : og.mode === 'keep' && s.ogImage ? adminMediaUrl(s.ogImage.storedName) : og.mode === 'clear' || !s.ogImage ? defaults.og.image : null;
    const ogIsFallback = og.mode === 'clear' || (og.mode === 'keep' && !s.ogImage);
    const slugOk = SLUG_RE.test(v.slug);
    let host = window.location.host;
    try { host = new URL(canonical).host; } catch { /* relative */ }

    const save = async () => {
        setSaving(true); setError(''); setNotice('');
        const pending = kw.trim() ? [...new Set([...keywords, ...kw.split(',').map(k => k.trim()).filter(Boolean)])] : keywords;
        const body: Record<string, unknown> = { ...v, keywords: pending };
        if (og.mode === 'set') body.ogImageMediaId = og.item._id;
        if (og.mode === 'clear') body.ogImageMediaId = null;
        try {
            const r = await api<{ entity: { slug: string; path: string; live: boolean; seo: ContentEntity['seo'] } }>(`${BASE}/seo/${entity.type}/${entity.id}`, { method: 'PUT', token, body });
            setKeywords(r.entity.seo.keywords || []); setKw(''); setOg({ mode: 'keep' });
            onSaved({ slug: r.entity.slug, path: r.entity.path, live: r.entity.live, seo: r.entity.seo });
            setNotice('SEO saved.');
        } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
    };

    return (
        <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_1fr]">
            <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
                <section className="space-y-4">
                    <h3 className="font-bold text-[#000a1e]">Search engines</h3>
                    <div>
                        <Label htmlFor="seo-slug">URL slug</Label>
                        <div className="flex items-center overflow-hidden rounded-xl border border-gray-200 focus-within:border-[#fea520] focus-within:ring-2 focus-within:ring-[#fea520]/20">
                            <span className="hidden max-w-[50%] truncate bg-gray-50 px-3 py-2.5 text-sm text-gray-400 sm:block">{entity.path.replace(/[^/]+$/, '')}</span>
                            <input id="seo-slug" value={v.slug} onChange={e => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} maxLength={120} className="min-w-0 flex-1 px-3 py-2.5 text-sm text-[#000a1e] focus:outline-none" />
                        </div>
                        {!slugOk && <p className="mt-1 text-xs text-red-600">Use lowercase letters, numbers and single hyphens.</p>}
                        {v.slug !== entity.slug && slugOk && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />Changing the slug changes the page URL; old links and search results will stop working.</p>}
                    </div>
                    <div>
                        <div className="flex justify-between"><Label htmlFor="seo-title">Meta title</Label><span className="text-xs"><Counter value={v.metaTitle} ideal={60} max={120} /></span></div>
                        <input id="seo-title" value={v.metaTitle} onChange={e => set({ metaTitle: e.target.value })} maxLength={120} placeholder={defaults.title} className={fieldClass} />
                    </div>
                    <div>
                        <div className="flex justify-between"><Label htmlFor="seo-desc">Meta description</Label><span className="text-xs"><Counter value={v.metaDescription} ideal={160} max={320} /></span></div>
                        <textarea id="seo-desc" value={v.metaDescription} onChange={e => set({ metaDescription: e.target.value })} maxLength={320} rows={3} placeholder={defaults.description} className={fieldClass} />
                    </div>
                    <div>
                        <Label htmlFor="seo-kw" hint="(press Enter or comma to add)">Keywords</Label>
                        <div className="flex flex-wrap gap-1.5 rounded-xl border border-gray-200 p-2 focus-within:border-[#fea520]">
                            {keywords.map(k => (
                                <span key={k} className="inline-flex items-center gap-1 rounded-lg bg-[#000a1e]/5 py-1 pl-2.5 pr-1 text-xs font-medium text-[#002147]">
                                    {k}<button type="button" onClick={() => { setKeywords(l => l.filter(x => x !== k)); setNotice(''); }} aria-label={`Remove keyword ${k}`} className="rounded p-0.5 hover:bg-white"><X className="h-3 w-3" /></button>
                                </span>
                            ))}
                            <input id="seo-kw" value={kw} onChange={e => { if (e.target.value.includes(',')) addKeywords(e.target.value); else setKw(e.target.value); }}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeywords(kw); } else if (e.key === 'Backspace' && !kw && keywords.length) setKeywords(l => l.slice(0, -1)); }}
                                onBlur={() => addKeywords(kw)} maxLength={60} placeholder={keywords.length ? '' : 'e.g. law assignment help'} className="min-w-[140px] flex-1 px-1 py-1 text-sm focus:outline-none" />
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="seo-canon" hint="(optional)">Canonical URL</Label>
                            <input id="seo-canon" value={v.canonicalUrl} onChange={e => set({ canonicalUrl: e.target.value })} maxLength={500} placeholder={canonical} className={fieldClass} />
                        </div>
                        <div>
                            <Label htmlFor="seo-robots">Search visibility</Label>
                            <select id="seo-robots" value={v.robots} onChange={e => set({ robots: e.target.value })} className={fieldClass}>{ROBOTS.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select>
                        </div>
                    </div>
                </section>

                <section className="space-y-4 border-t border-gray-100 pt-5">
                    <h3 className="font-bold text-[#000a1e]">Social sharing</h3>
                    <div>
                        <div className="flex justify-between"><Label htmlFor="seo-ogt">Share title</Label><span className="text-xs"><Counter value={v.ogTitle} ideal={70} max={120} /></span></div>
                        <input id="seo-ogt" value={v.ogTitle} onChange={e => set({ ogTitle: e.target.value })} maxLength={120} placeholder={title} className={fieldClass} />
                    </div>
                    <div>
                        <div className="flex justify-between"><Label htmlFor="seo-ogd">Share description</Label><span className="text-xs"><Counter value={v.ogDescription} ideal={200} max={320} /></span></div>
                        <textarea id="seo-ogd" value={v.ogDescription} onChange={e => set({ ogDescription: e.target.value })} maxLength={320} rows={2} placeholder={description} className={fieldClass} />
                    </div>
                    <div>
                        <Label>Share image <span className="font-normal text-gray-400">(1200×630 works best)</span></Label>
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-[#000a1e] hover:bg-gray-50"><ImagePlus className="h-4 w-4" />{ogIsFallback ? 'Choose image' : 'Change image'}</button>
                            {!ogIsFallback && <button type="button" onClick={() => { setOg({ mode: 'clear' }); setNotice(''); }} className="text-sm font-semibold text-red-600 hover:underline">Remove</button>}
                            <span className="text-xs text-gray-400">{og.mode === 'set' ? og.item.originalName : ogIsFallback ? (ogImageSrc ? 'Using the page’s own image' : 'No image') : s.ogImage?.originalName}</span>
                        </div>
                    </div>
                </section>

                <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                    {notice && <span className="text-sm text-emerald-700">{notice}</span>}
                    <button type="submit" disabled={saving || !slugOk} className="rounded-xl bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save SEO'}</button>
                </div>
            </form>

            <aside className="space-y-5 xl:sticky xl:top-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Google preview</p>
                    <div className="font-[arial,sans-serif]" data-testid="serp-preview">
                        <p className="truncate text-xs text-[#202124]">{host} <span className="text-[#4d5156]">› {path.split('/').filter(Boolean).join(' › ')}</span></p>
                        <p className="mt-1 line-clamp-1 text-lg leading-snug text-[#1a0dab]">{title}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-snug text-[#4d5156]">{description}</p>
                    </div>
                    {v.robots.startsWith('noindex') && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">This page is hidden from search engines and left out of the sitemap.</p>}
                    {!entity.live && <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">The page isn’t live yet, so search engines can’t see it.</p>}
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Social card preview</p>
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                        {ogImageSrc ? <AdminImg token={token} src={ogImageSrc} alt="" className="aspect-[1200/630] w-full object-cover" /> : <div className="flex aspect-[1200/630] items-center justify-center bg-gray-100 text-sm text-gray-400">No image</div>}
                        <div className={cn('space-y-0.5 bg-gray-50 px-3.5 py-3')}>
                            <p className="text-[11px] uppercase text-gray-500">{host}</p>
                            <p className="line-clamp-1 font-semibold text-[#000a1e]">{v.ogTitle || title}</p>
                            <p className="line-clamp-2 text-sm text-gray-500">{v.ogDescription || description}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {picking && <MediaPicker token={token} title="Choose a share image" pickedIds={og.mode === 'set' ? [og.item._id] : []} onClose={() => setPicking(false)}
                onPick={item => { setOg({ mode: 'set', item }); setPicking(false); setNotice(''); }} />}
        </div>
    );
}
