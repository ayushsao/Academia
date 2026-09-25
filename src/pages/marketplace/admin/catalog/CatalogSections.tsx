import React, { useEffect, useMemo, useState } from 'react';
import { Upload, Trash2, Calculator, LayoutTemplate } from 'lucide-react';
import { api } from '../../../../lib/api';
import { formatMoney } from '../../../../lib/money';
import { formatBytes, Spinner } from '../../../../components/writer/WriterBits';
import { cn } from '../../../../lib/utils';
import CrudSection, { type Column, type FormApi } from './CrudSection';
import {
    BASE, Label, MediaThumb, PublishPill, StatusPill, fieldClass, visibilityNote,
    type CatalogFile, type CatalogStatus, type Options, type PricingRule, type Project, type Service, type Subject,
} from './shared';

const SORTS: [string, string][] = [['order', 'Sort order'], ['name', 'Name A–Z'], ['newest', 'Newest'], ['updated', 'Recently updated']];
const PROJECT_SORTS: [string, string][] = [['order', 'Sort order'], ['title', 'Title A–Z'], ['newest', 'Newest'], ['updated', 'Recently updated']];
const CURRENCIES = ['GBP', 'USD', 'EUR', 'INR', 'AUD', 'CAD', 'AED'];

// ── Shared form fields ─────────────────────────────────────────────────────────
type Common = { slug: string; description: string; status: CatalogStatus; published: boolean; sortOrder: number };

function CommonFields<V extends Common>({ f, nameKey, nameLabel }: { f: FormApi<V>; nameKey: keyof V & string; nameLabel: string }) {
    const v = f.value as V & Record<string, any>;
    return (<>
        <div>
            <Label htmlFor="c-name">{nameLabel} *</Label>
            <input id="c-name" required maxLength={160} value={v[nameKey] || ''} onChange={e => f.set({ [nameKey]: e.target.value } as Partial<V>)} className={fieldClass} autoFocus />
        </div>
        <div>
            <Label htmlFor="c-slug" hint="(leave blank to generate from the name)">Slug</Label>
            <input id="c-slug" maxLength={120} value={v.slug} onChange={e => f.set({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-') } as Partial<V>)} placeholder="e.g. law-and-legal-studies" className={fieldClass} />
        </div>
        <div>
            <Label htmlFor="c-desc">Description</Label>
            <textarea id="c-desc" rows={4} maxLength={10000} value={v.description} onChange={e => f.set({ description: e.target.value } as Partial<V>)} className={fieldClass} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
            <div>
                <Label htmlFor="c-status">Status</Label>
                <select id="c-status" value={v.status} onChange={e => f.set({ status: e.target.value as CatalogStatus } as Partial<V>)} className={fieldClass}>
                    <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
                </select>
            </div>
            <div>
                <Label htmlFor="c-sort">Sort order</Label>
                <input id="c-sort" type="number" value={v.sortOrder} onChange={e => f.set({ sortOrder: Number(e.target.value) } as Partial<V>)} className={fieldClass} />
            </div>
            <label className="flex items-end gap-2 pb-2.5 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={v.published} onChange={e => f.set({ published: e.target.checked } as Partial<V>)} className="h-4 w-4 accent-[#000a1e]" /> Published
            </label>
        </div>
    </>);
}

const commonFrom = (i: { slug: string; description: string; status: CatalogStatus; published: boolean; sortOrder: number }) =>
    ({ slug: i.slug, description: i.description, status: i.status, published: i.published, sortOrder: i.sortOrder });
const commonBody = (v: Common) => ({ slug: v.slug.trim(), description: v.description, status: v.status, published: v.published, sortOrder: Number(v.sortOrder) || 0 });
const EMPTY_COMMON: Common = { slug: '', description: '', status: 'ACTIVE', published: false, sortOrder: 0 };

const count = (n: number | undefined, word: string) => `${n ?? 0} ${word}${n === 1 ? '' : 's'}`;

const Name = ({ title, sub }: { title: string; sub?: string }) => (
    <span className="block min-w-0"><span className="block font-semibold text-[#000a1e]">{title}</span>{sub && <span className="block truncate text-xs text-gray-400">{sub}</span>}</span>
);

// ── Media (saved immediately; available once the item exists) ──────────────────
function MediaManager({ token, uploadPath, files, single, onChange, deletePath }: {
    token: string; uploadPath: string | null; files: CatalogFile[]; single?: boolean; onChange: (item: any) => void; deletePath: (f: CatalogFile) => string;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    if (!uploadPath) return <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">Save first, then you can add {single ? 'an image' : 'images and files'}.</p>;
    const upload = async (list: FileList | null) => {
        if (!list?.length) return;
        setBusy(true); setError('');
        const form = new FormData();
        [...list].forEach(f => form.append('files', f));
        try { onChange((await api<{ item: any }>(uploadPath, { method: 'POST', token, body: form })).item); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const remove = async (f: CatalogFile) => {
        setBusy(true); setError('');
        try { onChange((await api<{ item: any }>(deletePath(f), { method: 'DELETE', token })).item); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    return (
        <div className="space-y-3">
            {files.length > 0 && (
                <ul className={cn('grid gap-3', single ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3')}>
                    {files.map(f => (
                        <li key={f.storedName} className="group relative overflow-hidden rounded-xl border border-gray-100">
                            <MediaThumb file={f} token={token} className={cn('w-full', single ? 'h-40' : 'h-24')} />
                            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                                <span className="min-w-0 truncate text-xs text-gray-600" title={f.originalName}>{f.originalName}<span className="block text-[11px] text-gray-400">{formatBytes(f.size)}</span></span>
                                <button type="button" onClick={() => remove(f)} disabled={busy} aria-label={`Remove ${f.originalName}`} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <label className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-4 text-sm font-semibold text-gray-600 hover:border-[#fea520]', busy && 'pointer-events-none opacity-60')}>
                {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                {single ? (files.length ? 'Replace image' : 'Upload image') : 'Add images or files'}
                <input type="file" className="sr-only" multiple={!single} accept={single ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.pptx,.xlsx,.zip'} onChange={e => { upload(e.target.files); e.target.value = ''; }} />
            </label>
            <p className="text-xs text-gray-400">{single ? 'JPG, PNG or WEBP up to 5 MB.' : 'Images (JPG, PNG, WEBP up to 5 MB) and files (PDF, DOC, DOCX, PPTX, XLSX, ZIP up to 25 MB).'}</p>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
    );
}

// Opens the page builder (blocks, FAQ, SEO) for a row.
const contentAction = (onContent: ((id: string) => void) | undefined, id: string, name: string) => onContent && (
    <button onClick={() => onContent(id)} aria-label={`Content & SEO for ${name}`} title="Content & SEO" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#002147] hover:bg-blue-50"><LayoutTemplate className="h-4 w-4" /><span className="hidden 2xl:inline">Content</span></button>
);

// ── Subjects ───────────────────────────────────────────────────────────────────
type SubjectForm = Common & { name: string };
export function SubjectsSection({ token, onChanged, onContent }: { token: string; onChanged: () => void; onContent?: (id: string) => void }) {
    const columns: Column<Subject>[] = [
        { key: 'name', header: 'Subject', render: s => <span className="flex items-center gap-3">{s.image ? <MediaThumb file={s.image} token={token} className="h-10 w-10 shrink-0" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-gray-100" />}<Name title={s.name} sub={`/${s.slug}`} /></span> },
        { key: 'content', header: 'Contents', render: s => <span className="text-gray-600">{count(s.servicesCount, 'service')} · {count(s.projectsCount, 'project')}</span> },
        { key: 'state', header: 'State', render: s => <span className="flex flex-wrap gap-1.5"><StatusPill status={s.status} /><PublishPill published={s.published} /></span> },
        { key: 'order', header: 'Order', render: s => <span className="tabular-nums text-gray-500">{s.sortOrder}</span>, className: 'w-20' },
    ];
    return (
        <CrudSection<Subject, SubjectForm> token={token} path="/subjects" noun="subject" nameOf={s => s.name} columns={columns} sorts={SORTS} rowActions={s => contentAction(onContent, s._id, s.name)}
            emptyValue={{ ...EMPTY_COMMON, name: '' }} fromItem={s => ({ ...commonFrom(s), name: s.name })} toBody={v => ({ ...commonBody(v), name: v.name })}
            canSave={v => v.name.trim().length >= 2} afterSave={onChanged}
            renderForm={f => (<>
                <CommonFields f={f} nameKey="name" nameLabel="Subject name" />
                <div>
                    <Label>Image</Label>
                    <MediaManager token={token} single uploadPath={f.editing ? `${BASE}/subjects/${f.editing._id}/image` : null}
                        files={(f.editing as Subject | null)?.image ? [(f.editing as Subject).image!] : []}
                        deletePath={() => `${BASE}/subjects/${f.editing!._id}/image`} onChange={f.onItemChange} />
                </div>
            </>)} />
    );
}

// ── Services ───────────────────────────────────────────────────────────────────
type ServiceForm = Common & { name: string; subjectId: string };
export function ServicesSection({ token, options, onChanged, onContent }: { token: string; options: Options; onChanged: () => void; onContent?: (id: string) => void }) {
    const subjectOpts = options.subjects.map(s => ({ value: s._id, label: s.name }));
    const columns: Column<Service>[] = [
        { key: 'name', header: 'Service', render: s => <Name title={s.name} sub={`/${s.slug}`} /> },
        { key: 'subject', header: 'Subject', render: s => <span className="text-gray-700">{s.subject?.name || '—'}</span> },
        { key: 'projects', header: 'Projects', render: s => <span className="tabular-nums text-gray-600">{s.projectsCount ?? 0}</span>, className: 'w-24' },
        { key: 'state', header: 'State', render: s => <span className="flex flex-col gap-1"><span className="flex flex-wrap gap-1.5"><StatusPill status={s.status} /><PublishPill published={s.published} /></span><span className="text-[11px] text-gray-400">{visibilityNote(s, [s.subject || null])}</span></span> },
    ];
    return (
        <CrudSection<Service, ServiceForm> token={token} path="/services" noun="service" nameOf={s => s.name} columns={columns} sorts={SORTS} rowActions={s => contentAction(onContent, s._id, s.name)}
            filters={[{ key: 'subjectId', label: 'Subjects', options: subjectOpts }]}
            createDisabledReason={options.subjects.length ? undefined : 'Add a subject first — every service belongs to a subject.'}
            emptyValue={{ ...EMPTY_COMMON, name: '', subjectId: options.subjects[0]?._id || '' }}
            fromItem={s => ({ ...commonFrom(s), name: s.name, subjectId: s.subjectId })} toBody={v => ({ ...commonBody(v), name: v.name, subjectId: v.subjectId })}
            canSave={v => v.name.trim().length >= 2 && !!v.subjectId} afterSave={onChanged}
            renderForm={f => (<>
                <div>
                    <Label htmlFor="c-subject">Subject *</Label>
                    <select id="c-subject" value={f.value.subjectId} onChange={e => f.set({ subjectId: e.target.value })} className={fieldClass}>
                        {subjectOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <CommonFields f={f} nameKey="name" nameLabel="Service name" />
            </>)} />
    );
}

// ── Projects ───────────────────────────────────────────────────────────────────
type ProjectForm = Common & { title: string; subjectId: string; serviceId: string };
export function ProjectsSection({ token, options, onChanged, onContent }: { token: string; options: Options; onChanged: () => void; onContent?: (id: string) => void }) {
    const [subjectFilter, setSubjectFilter] = useState('');
    const columns: Column<Project>[] = [
        { key: 'title', header: 'Project', render: p => { const img = p.files.find(x => x.kind === 'IMAGE'); return <span className="flex items-center gap-3">{img ? <MediaThumb file={img} token={token} className="h-10 w-10 shrink-0" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-gray-100" />}<Name title={p.title} sub={`/${p.slug}`} /></span>; } },
        { key: 'where', header: 'Subject › Service', render: p => <span className="text-gray-700">{p.subject?.name || '—'} <span className="text-gray-300">›</span> {p.service?.name || '—'}</span> },
        { key: 'files', header: 'Files', render: p => <span className="tabular-nums text-gray-600">{p.files.length}</span>, className: 'w-20' },
        { key: 'state', header: 'State', render: p => <span className="flex flex-col gap-1"><span className="flex flex-wrap gap-1.5"><StatusPill status={p.status} /><PublishPill published={p.published} /></span><span className="text-[11px] text-gray-400">{visibilityNote(p, [p.subject || null, p.service || null])}</span></span> },
    ];
    const serviceOpts = options.services.filter(s => !subjectFilter || s.subjectId === subjectFilter).map(s => ({ value: s._id, label: `${options.subjects.find(x => x._id === s.subjectId)?.name || '?'} › ${s.name}` }));
    return (
        <div onChange={(e) => { const t = e.target as HTMLSelectElement; if (t.getAttribute('aria-label') === 'Subjects') setSubjectFilter(t.value); }}>
            <CrudSection<Project, ProjectForm> token={token} path="/projects" noun="project" nameOf={p => p.title} columns={columns} sorts={PROJECT_SORTS} rowActions={p => contentAction(onContent, p._id, p.title)}
                filters={[{ key: 'subjectId', label: 'Subjects', options: options.subjects.map(s => ({ value: s._id, label: s.name })) }, { key: 'serviceId', label: 'Services', options: serviceOpts }]}
                createDisabledReason={options.services.length ? undefined : 'Add a service first — every project belongs to a service.'}
                emptyValue={{ ...EMPTY_COMMON, title: '', subjectId: options.services[0]?.subjectId || '', serviceId: options.services[0]?._id || '' }}
                fromItem={p => ({ ...commonFrom(p), title: p.title, subjectId: p.subjectId, serviceId: p.serviceId })}
                toBody={v => ({ ...commonBody(v), title: v.title, serviceId: v.serviceId })}
                canSave={v => v.title.trim().length >= 2 && !!v.serviceId} afterSave={onChanged}
                renderForm={f => {
                    const services = options.services.filter(s => s.subjectId === f.value.subjectId);
                    return (<>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <Label htmlFor="c-psubject">Subject *</Label>
                                <select id="c-psubject" value={f.value.subjectId} onChange={e => { const sid = e.target.value; f.set({ subjectId: sid, serviceId: options.services.find(s => s.subjectId === sid)?._id || '' }); }} className={fieldClass}>
                                    {options.subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <Label htmlFor="c-pservice">Service *</Label>
                                <select id="c-pservice" value={f.value.serviceId} onChange={e => f.set({ serviceId: e.target.value })} className={fieldClass}>
                                    {services.length === 0 && <option value="">No services in this subject</option>}
                                    {services.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <CommonFields f={f} nameKey="title" nameLabel="Project title" />
                        <div>
                            <Label>Images & files</Label>
                            <MediaManager token={token} uploadPath={f.editing ? `${BASE}/projects/${f.editing._id}/files` : null}
                                files={(f.editing as Project | null)?.files || []} deletePath={file => `${BASE}/projects/${f.editing!._id}/files/${file._id}`} onChange={f.onItemChange} />
                        </div>
                    </>);
                }} />
        </div>
    );
}

// ── Pricing ────────────────────────────────────────────────────────────────────
type PricingForm = {
    subjectId: string; serviceId: string; projectId: string; label: string; wordsPerPage: string; basePrice: string; multiplier: string;
    currency: string; formula: string; effectiveDate: string; status: CatalogStatus;
};
const STATE_STYLE: Record<PricingRule['state'], string> = {
    IN_EFFECT: 'bg-emerald-50 text-emerald-700 ring-emerald-200', SCHEDULED: 'bg-blue-50 text-blue-700 ring-blue-200',
    SUPERSEDED: 'bg-gray-100 text-gray-500 ring-gray-200', INACTIVE: 'bg-gray-100 text-gray-500 ring-gray-200',
};
const STATE_LABEL = { IN_EFFECT: 'In effect', SCHEDULED: 'Scheduled', SUPERSEDED: 'Superseded', INACTIVE: 'Inactive' };
const toLocalInput = (d: string | Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };

function ScopeSelects({ options, value, set, allowAll = true, idPrefix = 's' }: { options: Options; value: { subjectId: string; serviceId: string; projectId: string }; set: (p: Partial<{ subjectId: string; serviceId: string; projectId: string }>) => void; allowAll?: boolean; idPrefix?: string }) {
    const services = options.services.filter(s => s.subjectId === value.subjectId);
    const projects = options.projects.filter(p => p.subjectId === value.subjectId && (!value.serviceId || p.serviceId === value.serviceId));
    return (
        <div className="grid gap-3 sm:grid-cols-3">
            <div>
                <Label htmlFor={`${idPrefix}-subject`}>Subject *</Label>
                <select id={`${idPrefix}-subject`} value={value.subjectId} onChange={e => set({ subjectId: e.target.value, serviceId: '', projectId: '' })} className={fieldClass}>
                    {options.subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
            </div>
            <div>
                <Label htmlFor={`${idPrefix}-service`}>Service</Label>
                <select id={`${idPrefix}-service`} value={value.serviceId} onChange={e => set({ serviceId: e.target.value, projectId: '' })} className={fieldClass}>
                    <option value="">{allowAll ? 'All services' : 'Any'}</option>
                    {services.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
            </div>
            <div>
                <Label htmlFor={`${idPrefix}-project`}>Project</Label>
                <select id={`${idPrefix}-project`} value={value.projectId} onChange={e => set({ projectId: e.target.value })} className={fieldClass}>
                    <option value="">{allowAll ? 'All projects' : 'Any'}</option>
                    {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                </select>
            </div>
        </div>
    );
}

// Tries the live resolution: which rule applies and what the customer would pay.
function PricePreview({ token, options, defaultWords }: { token: string; options: Options; defaultWords: number | null }) {
    const [scope, setScope] = useState({ subjectId: options.subjects[0]?._id || '', serviceId: '', projectId: '' });
    const [amount, setAmount] = useState({ mode: 'words', value: '1000' });
    const [currency, setCurrency] = useState('GBP');
    const [spacing, setSpacing] = useState('');
    const [spacingOptions, setSpacingOptions] = useState<{ key: string; label: string }[]>([]);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (!scope.subjectId && options.subjects[0]) setScope(s => ({ ...s, subjectId: options.subjects[0]._id })); }, [options.subjects, scope.subjectId]);
    useEffect(() => { api<{ config: any }>(`${BASE}/word-config`, { token }).then(d => { setSpacingOptions(d.config.spacingOptions); setSpacing(d.config.defaultSpacing); }).catch(() => {}); }, [token]);
    const run = async () => {
        setBusy(true); setError(''); setResult(null);
        try {
            const body: Record<string, unknown> = { subjectId: scope.subjectId, currency, spacing, [amount.mode]: Number(amount.value) };
            if (scope.serviceId) body.serviceId = scope.serviceId;
            if (scope.projectId) body.projectId = scope.projectId;
            setResult((await api<{ quote: any }>(`${BASE}/pricing-preview`, { method: 'POST', token, body })).quote);
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    if (!options.subjects.length) return null;
    return (
        <details className="group rounded-2xl border border-gray-100 bg-white p-4 shadow-sm open:pb-5">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-[#000a1e]"><Calculator className="h-4 w-4 text-[#fea520]" /> Price calculator <span className="text-xs font-normal text-gray-400">— check what a customer would pay</span></summary>
            <div className="mt-4 space-y-3">
                <ScopeSelects idPrefix="pp" options={options} value={scope} set={p => setScope(s => ({ ...s, ...p }))} />
                <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                        <Label htmlFor="pp-mode">Length</Label>
                        <div className="flex gap-2">
                            <input id="pp-mode" type="number" min={1} value={amount.value} onChange={e => setAmount(a => ({ ...a, value: e.target.value }))} className={fieldClass} />
                            <select aria-label="Unit" value={amount.mode} onChange={e => setAmount(a => ({ ...a, mode: e.target.value }))} className={cn(fieldClass, 'w-28')}><option value="words">words</option><option value="pages">pages</option></select>
                        </div>
                    </div>
                    <div><Label htmlFor="pp-spacing">Spacing</Label><select id="pp-spacing" value={spacing} onChange={e => setSpacing(e.target.value)} className={fieldClass}>{spacingOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
                    <div><Label htmlFor="pp-cur">Currency</Label><input id="pp-cur" list="crm-currencies" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 3))} className={fieldClass} /></div>
                    <div className="flex items-end"><button type="button" onClick={run} disabled={busy || !scope.subjectId} className="w-full rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Calculating…' : 'Calculate'}</button></div>
                </div>
                {error && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}
                {result && (
                    <div className="grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-4">
                        <div><p className="text-xs text-gray-500">Billable pages</p><p className="text-lg font-bold text-[#000a1e]">{result.pages}</p><p className="text-xs text-gray-400">{result.wordsPerPage} words/page{defaultWords && result.wordsPerPage !== defaultWords ? ' (rule override)' : ''}</p></div>
                        <div><p className="text-xs text-gray-500">Price per page</p><p className="text-lg font-bold text-[#000a1e]">{formatMoney(result.unitPriceMinor, result.currency)}</p><p className="text-xs text-gray-400">{result.formula === 'BASE_X_MULTIPLIER' ? 'base × multiplier' : result.formula}</p></div>
                        <div className="sm:col-span-2"><p className="text-xs text-gray-500">Final price</p><p className="text-2xl font-extrabold text-[#000a1e]">{formatMoney(result.totalMinor, result.currency)}</p><p className="text-xs text-gray-400">{result.pages} × {formatMoney(result.unitPriceMinor, result.currency)}</p></div>
                    </div>
                )}
            </div>
        </details>
    );
}

export function PricingSection({ token, options }: { token: string; options: Options }) {
    const [formulas, setFormulas] = useState<{ key: string; label: string; description: string }[]>([{ key: 'BASE_X_MULTIPLIER', label: 'Base price × multiplier', description: '' }]);
    const [defaultWords, setDefaultWords] = useState<number | null>(null);
    useEffect(() => {
        api<{ formulas: typeof formulas }>(`${BASE}/pricing-formulas`, { token }).then(d => setFormulas(d.formulas)).catch(() => {});
        api<{ config: { defaultWordsPerPage: number } }>(`${BASE}/word-config`, { token }).then(d => setDefaultWords(d.config.defaultWordsPerPage)).catch(() => {});
    }, [token]);
    const columns: Column<PricingRule>[] = [
        { key: 'scope', header: 'Applies to', render: r => <Name title={[r.subject?.name, r.service?.name, r.project?.name].filter(Boolean).join(' › ') || '—'} sub={r.label || (r.project ? 'Project price' : r.service ? 'Service price' : 'Subject default')} /> },
        { key: 'price', header: 'Base × multiplier', render: r => <span className="whitespace-nowrap tabular-nums text-gray-700">{formatMoney(r.basePriceMinor, r.currency)} × {r.multiplier}</span> },
        { key: 'unit', header: 'Price / page', render: r => <span className="whitespace-nowrap font-semibold tabular-nums text-[#000a1e]">{formatMoney(r.unitPriceMinor, r.currency)}</span> },
        { key: 'words', header: 'Words / page', render: r => <span className="tabular-nums text-gray-600">{r.wordsPerPage ?? <span className="text-gray-400">default{defaultWords ? ` (${defaultWords})` : ''}</span>}</span> },
        { key: 'from', header: 'Effective', render: r => <span className="flex flex-col gap-1"><span className="whitespace-nowrap text-gray-600">{new Date(r.effectiveDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span><span className={cn('inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold ring-1', STATE_STYLE[r.state])}>{STATE_LABEL[r.state]}</span></span> },
    ];
    const currencies = useMemo(() => CURRENCIES.map(c => ({ value: c, label: c })), []);
    return (<>
        <datalist id="crm-currencies">{CURRENCIES.map(c => <option key={c} value={c} />)}</datalist>
        <CrudSection<PricingRule, PricingForm> token={token} path="/pricing" noun="price rule" publishable={false} nameOf={r => r.label || [r.subject?.name, r.service?.name, r.project?.name].filter(Boolean).join(' › ')}
            columns={columns} sorts={[['updated', 'Recently updated'], ['newest', 'Newest']]}
            filters={[
                { key: 'subjectId', label: 'Subjects', options: options.subjects.map(s => ({ value: s._id, label: s.name })) },
                { key: 'serviceId', label: 'Services', options: options.services.map(s => ({ value: s._id, label: `${options.subjects.find(x => x._id === s.subjectId)?.name || '?'} › ${s.name}` })) },
                { key: 'currency', label: 'Currencies', options: currencies },
            ]}
            intro={<>
                <p className="text-sm text-gray-500">The most specific rule wins: project, then service, then subject. Among those, the latest active rule whose effective date has passed applies. <strong className="font-semibold text-gray-700">Final price per page = base price × multiplier</strong>; the total is that times the billable pages.</p>
                <PricePreview token={token} options={options} defaultWords={defaultWords} />
            </>}
            createDisabledReason={options.subjects.length ? undefined : 'Add a subject first — prices are set per subject, service or project.'}
            emptyValue={{ subjectId: options.subjects[0]?._id || '', serviceId: '', projectId: '', label: '', wordsPerPage: '', basePrice: '', multiplier: '1', currency: 'GBP', formula: 'BASE_X_MULTIPLIER', effectiveDate: toLocalInput(new Date()), status: 'ACTIVE' }}
            fromItem={r => ({ subjectId: r.subjectId, serviceId: r.serviceId || '', projectId: r.projectId || '', label: r.label, wordsPerPage: r.wordsPerPage ? String(r.wordsPerPage) : '', basePrice: String(r.basePrice), multiplier: String(r.multiplier), currency: r.currency, formula: r.formula, effectiveDate: toLocalInput(r.effectiveDate), status: r.status })}
            toBody={v => ({
                subjectId: v.subjectId, serviceId: v.serviceId || null, projectId: v.projectId || null, label: v.label, wordsPerPage: v.wordsPerPage ? Number(v.wordsPerPage) : null,
                basePrice: Number(v.basePrice), multiplier: Number(v.multiplier), currency: v.currency, formula: v.formula, effectiveDate: new Date(v.effectiveDate).toISOString(), status: v.status,
            })}
            canSave={v => !!v.subjectId && v.basePrice !== '' && v.multiplier !== '' && /^[A-Z]{3}$/.test(v.currency) && !!v.effectiveDate}
            renderForm={f => {
                const v = f.value;
                const base = Number(v.basePrice), mult = Number(v.multiplier);
                const unit = Number.isFinite(base) && Number.isFinite(mult) && v.basePrice !== '' ? base * mult : null;
                return (<>
                    <ScopeSelects options={options} value={v} set={p => f.set(p)} />
                    <p className="-mt-1 text-xs text-gray-400">Leave service and project empty for a subject-wide default price.</p>
                    <div><Label htmlFor="p-label" hint="(optional)">Label</Label><input id="p-label" maxLength={120} value={v.label} onChange={e => f.set({ label: e.target.value })} placeholder="e.g. Standard 2026 price" className={fieldClass} /></div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div><Label htmlFor="p-base">Base price / page *</Label><input id="p-base" type="number" min={0} step="0.01" value={v.basePrice} onChange={e => f.set({ basePrice: e.target.value })} className={fieldClass} /></div>
                        <div><Label htmlFor="p-mult">Multiplier *</Label><input id="p-mult" type="number" min={0} step="0.0001" value={v.multiplier} onChange={e => f.set({ multiplier: e.target.value })} className={fieldClass} /></div>
                        <div><Label htmlFor="p-cur">Currency *</Label><input id="p-cur" list="crm-currencies" value={v.currency} onChange={e => f.set({ currency: e.target.value.toUpperCase().slice(0, 3) })} className={fieldClass} /></div>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        Final price per page: <strong className="text-[#000a1e]">{unit === null ? '—' : `${unit.toFixed(2)} ${v.currency}`}</strong>
                        <span className="text-gray-400"> = {v.basePrice || 0} × {v.multiplier || 0}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div><Label htmlFor="p-wpp" hint="(blank = default)">Words / page</Label><input id="p-wpp" type="number" min={50} max={2000} value={v.wordsPerPage} onChange={e => f.set({ wordsPerPage: e.target.value })} placeholder={defaultWords ? String(defaultWords) : ''} className={fieldClass} /></div>
                        <div><Label htmlFor="p-date">Effective from *</Label><input id="p-date" type="datetime-local" value={v.effectiveDate} onChange={e => f.set({ effectiveDate: e.target.value })} className={fieldClass} /></div>
                        <div><Label htmlFor="p-status">Status</Label><select id="p-status" value={v.status} onChange={e => f.set({ status: e.target.value as CatalogStatus })} className={fieldClass}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
                    </div>
                    <div>
                        <Label htmlFor="p-formula">Formula</Label>
                        <select id="p-formula" value={v.formula} onChange={e => f.set({ formula: e.target.value })} className={fieldClass}>
                            {formulas.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                        </select>
                    </div>
                </>);
            }} />
    </>);
}
