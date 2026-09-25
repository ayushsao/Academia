import React, { useCallback, useMemo, useState } from 'react';
import { Copy, Eye, EyeOff, ImagePlus, LayoutTemplate, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';
import { BLOCK_META, BLOCK_TYPES, type BlockType, type EntityType, type PageBlock } from '../../../../lib/catalogContent';
import { BlockRenderer, type ImgComponent } from '../../../../components/catalog/BlockRenderer';
import { BASE, ConfirmDialog, Drawer, Label, StatusPill, Switch, fieldClass, type CatalogStatus, type Options } from './shared';
import RichTextEditor from './RichTextEditor';
import { AdminImg, MediaPicker, type MediaItem } from './MediaLibrary';
import { EntitySelect, MoveControls, adminMediaUrl, scrubHtml, useReorder, type AdminBlock, type AdminFaq, type BlockMedia, type ContentEntity } from './cmsShared';

type Draft = { _id?: string; type: BlockType; title: string; content: Record<string, any>; media: BlockMedia[]; status: CatalogStatus; target: { type: EntityType; id: string } };

const plainText = (html: string) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
function summary(b: AdminBlock) {
    const c = b.content || {};
    switch (b.type) {
        case 'HEADING': return c.subtitle || '';
        case 'RICH_TEXT': case 'INTRODUCTION': case 'CUSTOM_HTML': case 'SEO_CONTENT': return plainText(c.html);
        case 'FEATURES': return `${(c.items || []).length} features · ${c.columns} columns`;
        case 'AVAILABLE_PROJECTS': return c.mode === 'MANUAL' ? `${(c.projectIds || []).length} chosen projects` : `Automatic · up to ${c.limit}`;
        case 'PROGRAMMING_LANGUAGES': return (c.items || []).map((i: { name: string }) => i.name).join(', ');
        case 'FAQ': return `Shows up to ${c.limit} FAQs from the FAQ tab`;
        case 'CTA': return `${c.buttonLabel || 'Button'} → ${c.action === 'LINK' ? c.buttonUrl || 'no link' : 'order form'}`;
        case 'IMAGE': return b.media[0]?.originalName || 'No image';
        default: return '';
    }
}

export default function BlockManager({ token, entity, blocks, setBlocks, faqs, options, onReload }: {
    token: string; entity: ContentEntity; blocks: AdminBlock[]; setBlocks: (b: AdminBlock[]) => void; faqs: AdminFaq[]; options: Options; onReload: () => void;
}) {
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [confirm, setConfirm] = useState<AdminBlock | null>(null);
    const [confirmError, setConfirmError] = useState('');

    const commitOrder = async (next: AdminBlock[]) => {
        const prev = blocks;
        setBlocks(next); setError('');
        try {
            const r = await api<{ blocks: AdminBlock[] }>(`${BASE}/blocks/reorder`, { method: 'PUT', token, body: { entityType: entity.type, entityId: entity.id, ids: next.map(b => b._id) } });
            setBlocks(r.blocks);
        } catch (e) { setBlocks(prev); setError((e as Error).message); }
    };
    const { move, rowProps, drag, over } = useReorder(blocks, commitOrder);

    const toggle = async (b: AdminBlock, on: boolean) => {
        setBusyId(b._id); setError('');
        try {
            const { block } = await api<{ block: AdminBlock }>(`${BASE}/blocks/${b._id}/status`, { method: 'PATCH', token, body: { status: on ? 'ACTIVE' : 'INACTIVE' } });
            setBlocks(blocks.map(x => (x._id === block._id ? block : x)));
        } catch (e) { setError((e as Error).message); } finally { setBusyId(null); }
    };
    const duplicate = async (b: AdminBlock) => {
        setBusyId(b._id); setError('');
        try { await api(`${BASE}/blocks/${b._id}/duplicate`, { method: 'POST', token }); onReload(); }
        catch (e) { setError((e as Error).message); } finally { setBusyId(null); }
    };
    const remove = async () => {
        if (!confirm) return;
        setBusyId(confirm._id); setConfirmError('');
        try { await api(`${BASE}/blocks/${confirm._id}`, { method: 'DELETE', token }); setBlocks(blocks.filter(b => b._id !== confirm._id)); setConfirm(null); }
        catch (e) { setConfirmError((e as Error).message); } finally { setBusyId(null); }
    };

    const start = (type: BlockType) => {
        setAdding(false);
        setDraft({ type, title: '', content: structuredClone(BLOCK_META[type].defaults), media: [], status: 'ACTIVE', target: { type: entity.type, id: entity.id } });
    };
    const edit = (b: AdminBlock) => setDraft({ _id: b._id, type: b.type, title: b.title, content: structuredClone(b.content || {}), media: b.media, status: b.status, target: { type: b.entityType, id: b.entityId } });

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">{blocks.length ? 'Drag blocks (or use the arrows) to change their order on the page. Disabled blocks stay hidden.' : 'Build this page from blocks — text, features, projects, FAQs, images, calls to action and more.'}</p>
                <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add block</button>
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

            {blocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center text-gray-400">
                    <LayoutTemplate className="mx-auto mb-3 h-10 w-10 opacity-40" />
                    <p className="font-semibold">No content blocks yet</p>
                    <button onClick={() => setAdding(true)} className="mt-3 text-sm font-semibold text-[#002147] hover:underline">Add the first block</button>
                </div>
            ) : (
                <ol className="space-y-2" aria-label="Content blocks">
                    {blocks.map((b, i) => (
                        <li key={b._id} {...rowProps(i)} data-testid="block-row"
                            className={cn('flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition sm:p-4', drag === i ? 'opacity-40' : '', over === i && drag !== i ? 'border-[#fea520] ring-2 ring-[#fea520]/30' : 'border-gray-100', b.status !== 'ACTIVE' && 'bg-gray-50')}>
                            <MoveControls index={i} count={blocks.length} onMove={move} label={b.title || BLOCK_META[b.type].label} />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-md bg-[#000a1e]/5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#002147]">{BLOCK_META[b.type]?.label || b.type}</span>
                                    {b.status !== 'ACTIVE' && <StatusPill status={b.status} />}
                                    <span className={cn('truncate font-semibold', b.status === 'ACTIVE' ? 'text-[#000a1e]' : 'text-gray-500')}>{b.title || <span className="font-normal italic text-gray-400">Untitled</span>}</span>
                                </div>
                                <p className="mt-1 line-clamp-1 text-xs text-gray-500">{summary(b) || '—'}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <Switch checked={b.status === 'ACTIVE'} tone="green" disabled={busyId === b._id} label={`${b.title || BLOCK_META[b.type].label}: enabled`} onChange={on => toggle(b, on)} />
                                <button onClick={() => edit(b)} aria-label={`Edit ${b.title || BLOCK_META[b.type].label}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#000a1e]"><Pencil className="h-4 w-4" /></button>
                                <button onClick={() => duplicate(b)} disabled={busyId === b._id} aria-label={`Duplicate ${b.title || BLOCK_META[b.type].label}`} className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#000a1e] sm:block"><Copy className="h-4 w-4" /></button>
                                <button onClick={() => { setConfirm(b); setConfirmError(''); }} aria-label={`Delete ${b.title || BLOCK_META[b.type].label}`} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            {adding && (
                <Drawer title="Add a block" onClose={() => setAdding(false)}>
                    <ul className="grid gap-2 sm:grid-cols-2">
                        {BLOCK_TYPES.map(t => (
                            <li key={t}>
                                <button onClick={() => start(t)} className="h-full w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-[#fea520]/60 hover:shadow">
                                    <span className="block font-bold text-[#000a1e]">{BLOCK_META[t].label}</span>
                                    <span className="mt-1 block text-xs leading-relaxed text-gray-500">{BLOCK_META[t].help}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </Drawer>
            )}

            {draft && <BlockEditor token={token} entity={entity} draft={draft} setDraft={setDraft} options={options} faqs={faqs}
                onSaved={(saved, moved) => { setDraft(null); if (moved) onReload(); else setBlocks(draft._id ? blocks.map(b => (b._id === saved._id ? saved : b)) : [...blocks, saved]); }} />}

            {confirm && (
                <ConfirmDialog title="Delete block?" busy={busyId === confirm._id} error={confirmError}
                    message={<>The {BLOCK_META[confirm.type]?.label.toLowerCase()} block{confirm.title ? <> “{confirm.title}”</> : ''} will be removed from this page. To hide it temporarily, switch it off instead.</>}
                    onConfirm={remove} onCancel={() => setConfirm(null)} />
            )}
        </div>
    );
}

// ── Editor ─────────────────────────────────────────────────────────────────────
function BlockEditor({ token, entity, draft, setDraft, options, faqs, onSaved }: {
    token: string; entity: ContentEntity; draft: Draft; setDraft: (d: Draft | null) => void; options: Options; faqs: AdminFaq[];
    onSaved: (b: AdminBlock, moved: boolean) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(false);
    const [picking, setPicking] = useState(false);
    const meta = BLOCK_META[draft.type];
    const Img = useCallback<ImgComponent>(p => <AdminImg token={token} {...p} />, [token]);
    const c = draft.content;
    const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
    const setC = (patch: Record<string, any>) => set({ content: { ...c, ...patch } });

    // Projects an "Available projects" block may list, scoped like the server.
    const scopeProjects = useMemo(() => {
        const t = draft.target;
        if (t.type === 'SUBJECT') return options.projects.filter(p => p.subjectId === t.id);
        if (t.type === 'SERVICE') return options.projects.filter(p => p.serviceId === t.id);
        const self = options.projects.find(p => p._id === t.id);
        return options.projects.filter(p => self && p.serviceId === self.serviceId && p._id !== t.id);
    }, [draft.target, options.projects]);

    const save = async () => {
        setSaving(true); setError('');
        const body = { entityType: draft.target.type, entityId: draft.target.id, type: draft.type, title: draft.title, content: draft.content, mediaIds: draft.media.map(m => m.mediaId), status: draft.status };
        try {
            const { block } = await api<{ block: AdminBlock }>(draft._id ? `${BASE}/blocks/${draft._id}` : `${BASE}/blocks`, { method: draft._id ? 'PUT' : 'POST', token, body });
            onSaved(block, block.entityId !== entity.id || block.entityType !== entity.type);
        } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
    };

    const previewBlock: PageBlock = {
        id: 'draft', type: draft.type, title: draft.title,
        content: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, k === 'html' ? scrubHtml(String(v)) : v])),
        media: draft.media.map(m => ({ url: adminMediaUrl(m.storedName), name: m.originalName, kind: m.kind, alt: m.alt })),
        projects: draft.type === 'AVAILABLE_PROJECTS' ? (c.mode === 'MANUAL' ? (c.projectIds || []).map((id: string) => scopeProjects.find(p => p._id === id)).filter(Boolean) : scopeProjects)
            .slice(0, c.limit || 12).map((p: { _id: string; title: string }) => ({ id: p._id, title: p.title, slug: '', summary: '', url: null, image: null })) : undefined,
        faqs: draft.type === 'FAQ' ? faqs.filter(f => f.status === 'ACTIVE').slice(0, c.limit || 20).map(f => ({ id: f._id, question: f.question, answer: f.answer })) : undefined,
    };

    const listEditor = (key: 'items', fields: { name: string; label: string; multiline?: boolean; required?: boolean }[], noun: string, max: number) => {
        const items: Record<string, string>[] = c[key] || [];
        const update = (i: number, patch: Record<string, string>) => setC({ [key]: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
        return (
            <div className="space-y-2">
                {items.map((it, i) => (
                    <div key={i} className="flex gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <MoveControls index={i} count={items.length} label={`${noun} ${i + 1}`} onMove={(from, to) => { if (to < 0 || to >= items.length) return; const n = [...items]; const [x] = n.splice(from, 1); n.splice(to, 0, x); setC({ [key]: n }); }} />
                        <div className="min-w-0 flex-1 space-y-2">
                            {fields.map(f => f.multiline
                                ? <textarea key={f.name} value={it[f.name] || ''} onChange={e => update(i, { [f.name]: e.target.value })} placeholder={f.label} aria-label={`${noun} ${i + 1} ${f.label}`} rows={2} className={fieldClass} />
                                : <input key={f.name} value={it[f.name] || ''} onChange={e => update(i, { [f.name]: e.target.value })} placeholder={`${f.label}${f.required ? ' *' : ''}`} aria-label={`${noun} ${i + 1} ${f.label}`} className={fieldClass} />)}
                        </div>
                        <button type="button" onClick={() => setC({ [key]: items.filter((_, j) => j !== i) })} aria-label={`Remove ${noun} ${i + 1}`} className="self-start rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                ))}
                {items.length < max && <button type="button" onClick={() => setC({ [key]: [...items, Object.fromEntries(fields.map(f => [f.name, '']))] })} className="inline-flex items-center gap-1 text-sm font-semibold text-[#002147] hover:underline"><Plus className="h-4 w-4" /> Add {noun}</button>}
            </div>
        );
    };

    const fields = () => {
        switch (draft.type) {
            case 'HEADING': return (<div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <div><Label htmlFor="b-sub">Subtitle</Label><input id="b-sub" value={c.subtitle || ''} onChange={e => setC({ subtitle: e.target.value })} maxLength={300} className={fieldClass} /></div>
                <div><Label htmlFor="b-level">Size</Label><select id="b-level" value={c.level} onChange={e => setC({ level: e.target.value })} className={fieldClass}><option value="h2">Large (H2)</option><option value="h3">Medium (H3)</option></select></div>
            </div>);
            case 'RICH_TEXT': return <div><Label>Text</Label><RichTextEditor label="Text" value={c.html || ''} onChange={html => setC({ html })} minHeight={220} /></div>;
            case 'INTRODUCTION': return (<>
                <div><Label>Introduction</Label><RichTextEditor label="Introduction" value={c.html || ''} onChange={html => setC({ html })} /></div>
                <div><Label htmlFor="b-hl" hint="(optional)">Highlight line</Label><input id="b-hl" value={c.highlight || ''} onChange={e => setC({ highlight: e.target.value })} maxLength={300} placeholder="e.g. 4.9/5 from 2,000+ students" className={fieldClass} /></div>
            </>);
            case 'FEATURES': return (<>
                <div className="w-40"><Label htmlFor="b-cols">Columns</Label><select id="b-cols" value={c.columns} onChange={e => setC({ columns: Number(e.target.value) })} className={fieldClass}>{[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><Label>Features</Label>{listEditor('items', [{ name: 'title', label: 'Title', required: true }, { name: 'text', label: 'Description', multiline: true }], 'feature', 24)}</div>
            </>);
            case 'AVAILABLE_PROJECTS': return (<>
                <fieldset className="space-y-2"><legend className="mb-1.5 text-xs font-semibold text-gray-600">Which projects</legend>
                    {[['AUTO', 'All published projects here, in their sort order'], ['MANUAL', 'Only projects I choose']].map(([v, l]) => (
                        <label key={v} className="flex items-center gap-2 text-sm text-gray-700"><input type="radio" name="b-mode" checked={c.mode === v} onChange={() => setC({ mode: v })} className="accent-[#000a1e]" />{l}</label>
                    ))}
                </fieldset>
                {c.mode === 'MANUAL' && (
                    <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
                        {scopeProjects.length === 0 ? <p className="p-2 text-sm text-gray-400">No projects under this {draft.target.type.toLowerCase()} yet.</p> : scopeProjects.map(p => {
                            const ids: string[] = c.projectIds || [];
                            return <label key={p._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50"><input type="checkbox" checked={ids.includes(p._id)} onChange={e => setC({ projectIds: e.target.checked ? [...ids, p._id] : ids.filter(x => x !== p._id) })} className="accent-[#000a1e]" />{p.title}{!(p.status === 'ACTIVE' && p.published) && <span className="text-xs text-gray-400">(not live)</span>}</label>;
                        })}
                    </div>
                )}
                <div className="w-40"><Label htmlFor="b-limit">Show at most</Label><input id="b-limit" type="number" min={1} max={50} value={c.limit} onChange={e => setC({ limit: Number(e.target.value) })} className={fieldClass} /></div>
            </>);
            case 'PROGRAMMING_LANGUAGES': return <div><Label>Languages & tools</Label>{listEditor('items', [{ name: 'name', label: 'Name', required: true }, { name: 'note', label: 'Note (e.g. versions, frameworks)' }], 'language', 60)}</div>;
            case 'FAQ': return (<>
                <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">This block shows the page’s active FAQs, in their FAQ-tab order. Manage questions in the <strong>FAQ</strong> tab.</p>
                <div className="w-40"><Label htmlFor="b-flimit">Show at most</Label><input id="b-flimit" type="number" min={1} max={50} value={c.limit} onChange={e => setC({ limit: Number(e.target.value) })} className={fieldClass} /></div>
            </>);
            case 'CTA': return (<>
                <div><Label htmlFor="b-text">Text</Label><textarea id="b-text" value={c.text || ''} onChange={e => setC({ text: e.target.value })} rows={3} maxLength={600} className={fieldClass} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label htmlFor="b-btn">Button label</Label><input id="b-btn" value={c.buttonLabel || ''} onChange={e => setC({ buttonLabel: e.target.value })} maxLength={60} className={fieldClass} /></div>
                    <div><Label htmlFor="b-action">Button opens</Label><select id="b-action" value={c.action} onChange={e => setC({ action: e.target.value })} className={fieldClass}><option value="ORDER">The order form</option><option value="LINK">A link</option></select></div>
                </div>
                {c.action === 'LINK' && <div><Label htmlFor="b-url">Link</Label><input id="b-url" value={c.buttonUrl || ''} onChange={e => setC({ buttonUrl: e.target.value })} placeholder="/subjects/law or https://…" className={fieldClass} /></div>}
            </>);
            case 'IMAGE': {
                const m = draft.media[0];
                return (<>
                    <div>
                        <Label>Image *</Label>
                        {m ? (
                            <div className="flex items-center gap-3 rounded-xl border border-gray-100 p-2">
                                <AdminImg token={token} src={adminMediaUrl(m.storedName)} alt={m.alt} className="h-16 w-24 rounded-lg object-cover" />
                                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{m.originalName}</span>
                                <button type="button" onClick={() => setPicking(true)} className="text-sm font-semibold text-[#002147] hover:underline">Change</button>
                            </div>
                        ) : <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-8 text-sm font-semibold text-gray-500 hover:border-[#fea520]/60"><ImagePlus className="h-5 w-5" /> Choose from media library</button>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                        <div><Label htmlFor="b-alt" hint="(describes the image for SEO and screen readers)">Alt text</Label><input id="b-alt" value={c.alt || ''} onChange={e => setC({ alt: e.target.value })} maxLength={200} placeholder={m?.alt || ''} className={fieldClass} /></div>
                        <div><Label htmlFor="b-size">Width</Label><select id="b-size" value={c.size} onChange={e => setC({ size: e.target.value })} className={fieldClass}><option value="medium">Medium</option><option value="wide">Wide</option><option value="full">Full</option></select></div>
                    </div>
                    <div><Label htmlFor="b-cap">Caption</Label><input id="b-cap" value={c.caption || ''} onChange={e => setC({ caption: e.target.value })} maxLength={300} className={fieldClass} /></div>
                </>);
            }
            case 'CUSTOM_HTML': return (<div>
                <Label htmlFor="b-html">HTML</Label>
                <textarea id="b-html" value={c.html || ''} onChange={e => setC({ html: e.target.value })} rows={12} spellCheck={false} className={cn(fieldClass, 'font-mono text-xs')} placeholder="<div>…</div>" />
                <p className="mt-1.5 text-xs text-gray-400">Scripts, inline styles and event handlers are removed when saved. YouTube, Vimeo and Google Maps embeds and https images are allowed.</p>
            </div>);
            case 'SEO_CONTENT': return (<>
                <div><Label>Content</Label><RichTextEditor label="SEO content" value={c.html || ''} onChange={html => setC({ html })} minHeight={220} /></div>
                <label className="flex items-center gap-3 text-sm text-gray-700"><Switch checked={!!c.collapsible} label="Collapsed behind “Read more”" onChange={v => setC({ collapsible: v })} />Collapse behind “Read more” (text stays indexable)</label>
            </>);
        }
    };

    return (
        <Drawer title={`${draft._id ? 'Edit' : 'Add'} ${meta.label.toLowerCase()} block`} onClose={() => setDraft(null)}
            footer={<div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setPreview(p => !p)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">{preview ? <><EyeOff className="h-4 w-4" /> Hide preview</> : <><Eye className="h-4 w-4" /> Preview</>}</button>
                <div className="flex gap-2">
                    <button onClick={() => setDraft(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button onClick={save} disabled={saving} className="rounded-xl bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : draft._id ? 'Save block' : 'Add block'}</button>
                </div>
            </div>}>
            <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4">
                <p className="text-sm text-gray-500">{meta.help}</p>
                {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
                <div><Label htmlFor="b-title" hint={meta.titlePlaceholder.includes('required') ? undefined : '(optional)'}>Title</Label><input id="b-title" value={draft.title} onChange={e => set({ title: e.target.value })} maxLength={200} placeholder={meta.titlePlaceholder} className={fieldClass} /></div>
                {fields()}
                <div className="grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div><Label htmlFor="b-target" hint="(moving a block adds it to the end of that page)">Show on</Label><EntitySelect id="b-target" value={draft.target} onChange={target => set({ target })} options={options} /></div>
                    <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-700"><Switch checked={draft.status === 'ACTIVE'} tone="green" label="Block enabled" onChange={on => set({ status: on ? 'ACTIVE' : 'INACTIVE' })} />Enabled</label>
                </div>
                <button type="submit" className="hidden" />
            </form>
            {preview && (
                <div className="mt-6 border-t border-gray-100 pt-5">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Preview{draft.type === 'CUSTOM_HTML' ? ' (embeds show after saving)' : ''}</p>
                    <div className="rounded-2xl bg-gray-50 p-4">
                        <BlockRenderer blocks={[previewBlock]} preview Img={Img} />
                    </div>
                </div>
            )}
            {picking && <MediaPicker token={token} pickedIds={draft.media.map(m => m.mediaId)} onClose={() => setPicking(false)}
                onPick={(item: MediaItem) => { set({ media: [{ mediaId: item._id, storedName: item.storedName, originalName: item.originalName, mimeType: item.mimeType, kind: item.kind, alt: item.alt }] }); setPicking(false); }} />}
        </Drawer>
    );
}
