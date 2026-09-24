import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, RotateCcw, Save, Check, Info } from 'lucide-react';
import { api } from '../../../lib/api';
import { inputClass } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';
import { loadMarketplaceContent, type MarketplaceContent, type ContentItem, type QA } from '../../../lib/marketplaceContent';

type Section = 'recruitment' | 'faq' | 'pricing' | 'terms' | 'contact';
const SECTIONS: { id: Section; label: string; page: string }[] = [
    { id: 'recruitment', label: 'Become a Writer page', page: '/become-a-writer' },
    { id: 'faq', label: 'Applicant FAQ', page: '/become-a-writer' },
    { id: 'pricing', label: 'Pricing page', page: '/writer-membership' },
    { id: 'terms', label: 'Writer terms', page: '/writer-terms' },
    { id: 'contact', label: 'Contact details', page: '/become-a-writer' },
];

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <label className="block text-xs font-semibold text-gray-600">{label}{children}{hint && <span className="mt-1 block font-normal text-gray-400">{hint}</span>}</label>
);
const Text = ({ value, onChange, max, ...rest }: { value: string; onChange: (v: string) => void; max: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) =>
    <input {...rest} value={value} maxLength={max} onChange={e => onChange(e.target.value)} className={cn(inputClass, 'mt-1 py-2 text-sm')} />;
const Area = ({ value, onChange, max, rows = 3 }: { value: string; onChange: (v: string) => void; max: number; rows?: number }) =>
    <textarea value={value} maxLength={max} rows={rows} onChange={e => onChange(e.target.value)} className={cn(inputClass, 'mt-1 text-sm')} />;

function move<T>(list: T[], i: number, d: -1 | 1) { const j = i + d; if (j < 0 || j >= list.length) return list; const c = [...list]; [c[i], c[j]] = [c[j], c[i]]; return c; }

function ListEditor<T>({ items, onChange, max, blank, render, addLabel }: { items: T[]; onChange: (v: T[]) => void; max: number; blank: T; render: (item: T, set: (v: T) => void) => React.ReactNode; addLabel: string }) {
    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                    <div className="min-w-0 flex-1 space-y-2">{render(item, v => onChange(items.map((x, j) => (j === i ? v : x))))}</div>
                    <div className="flex shrink-0 flex-col gap-1">
                        <button type="button" aria-label="Move up" onClick={() => onChange(move(items, i, -1))} disabled={i === 0} className="rounded p-1.5 text-gray-400 hover:bg-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" aria-label="Move down" onClick={() => onChange(move(items, i, 1))} disabled={i === items.length - 1} className="rounded p-1.5 text-gray-400 hover:bg-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                </div>
            ))}
            {items.length < max && <button type="button" onClick={() => onChange([...items, structuredClone(blank)])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#002147] hover:underline"><Plus className="h-4 w-4" />{addLabel}</button>}
        </div>
    );
}

const itemEditor = (titleLabel = 'Title') => (item: ContentItem, set: (v: ContentItem) => void) => (<>
    <Field label={titleLabel}><Text value={item.title} max={80} onChange={v => set({ ...item, title: v })} /></Field>
    <Field label="Text"><Area value={item.text} max={400} rows={2} onChange={v => set({ ...item, text: v })} /></Field>
</>);
const qaEditor = (item: QA, set: (v: QA) => void) => (<>
    <Field label="Question"><Text value={item.q} max={200} onChange={v => set({ ...item, q: v })} /></Field>
    <Field label="Answer"><Area value={item.a} max={1500} rows={3} onChange={v => set({ ...item, a: v })} /></Field>
</>);

const Card = ({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) => (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div><h3 className="font-bold text-[#000a1e]">{title}</h3>{hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}</div>
        {children}
    </section>
);

// Marketing edits public marketplace copy. Plan names, prices and features live
// in Memberships → Plans. The membership disclaimer is fixed and always shown.
export default function SiteContentTab({ token }: { token: string }) {
    const [saved, setSaved] = useState<MarketplaceContent | null>(null);
    const [draft, setDraft] = useState<MarketplaceContent | null>(null);
    const [defaults, setDefaults] = useState<MarketplaceContent | null>(null);
    const [meta, setMeta] = useState<{ updatedAt: string | null; disclaimer: string }>({ updatedAt: null, disclaimer: '' });
    const [planCodes, setPlanCodes] = useState<{ code: string; name: string }[]>([]);
    const [section, setSection] = useState<Section>('recruitment');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        api<{ content: MarketplaceContent; defaults: MarketplaceContent; updatedAt: string | null; disclaimer: string }>('/admin/content/marketplace', { token })
            .then(d => { setSaved(d.content); setDraft(structuredClone(d.content)); setDefaults(d.defaults); setMeta({ updatedAt: d.updatedAt, disclaimer: d.disclaimer }); })
            .catch(e => setError(e.message));
        api<{ plans: { code: string; name: string }[] }>('/membership/plans').then(d => setPlanCodes(d.plans.map(p => ({ code: p.code, name: p.name })))).catch(() => {});
    }, [token]);

    const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
    useEffect(() => {
        const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    if (!draft || !defaults) return error ? <p className="text-sm text-red-600">{error}</p> : <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>;

    const set = <K extends Section>(k: K, v: MarketplaceContent[K]) => { setDraft(d => d && { ...d, [k]: v }); setDone(false); };
    const r = draft.recruitment;
    const setR = (patch: Partial<MarketplaceContent['recruitment']>) => set('recruitment', { ...r, ...patch });
    const current = SECTIONS.find(s => s.id === section)!;
    const notes = draft.pricing.planNotes;
    const noteCodes = [...new Set([...planCodes.map(p => p.code), ...Object.keys(notes)])];

    const save = async () => {
        setBusy(true); setError(''); setDone(false);
        try {
            const d = await api<{ content: MarketplaceContent; updatedAt: string }>('/admin/content/marketplace', { method: 'PUT', token, body: { content: { ...draft, recruitment: { ...draft.recruitment, cta: { ...draft.recruitment.cta, points: draft.recruitment.cta.points.map(s => s.trim()).filter(Boolean) } } } } });
            setSaved(d.content); setDraft(structuredClone(d.content)); setMeta(m => ({ ...m, updatedAt: d.updatedAt })); setDone(true);
            loadMarketplaceContent(true).catch(() => {});
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3">
                <nav className="flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Content sections">
                    {SECTIONS.map(s => (
                        <button key={s.id} onClick={() => setSection(s.id)} aria-current={section === s.id ? 'page' : undefined}
                            className={cn('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold', section === s.id ? 'border-[#fea520] text-[#000a1e]' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                            {s.label}{JSON.stringify(saved?.[s.id]) !== JSON.stringify(draft[s.id]) && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#fea520] align-middle" aria-label="unsaved" />}
                        </button>
                    ))}
                </nav>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <a href={current.page} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700"><ExternalLink className="h-4 w-4" /> View page</a>
                    <button onClick={() => { set(section, structuredClone(defaults[section])); }} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700"><RotateCcw className="h-4 w-4" /> Default text</button>
                    <button onClick={save} disabled={!dirty || busy} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#000a1e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                        {done && !dirty ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save changes'}</>}
                    </button>
                </div>
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-xs text-sky-900"><Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Plain text only. Copy can’t promise guaranteed work, income or earnings — the server rejects it. This disclaimer is always shown and can’t be edited: “{meta.disclaimer}”{meta.updatedAt ? ` Last saved ${new Date(meta.updatedAt).toLocaleString()}.` : ''}</span></p>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

            {section === 'recruitment' && (<div className="grid gap-5 xl:grid-cols-2">
                <Card title="Hero">
                    <Field label="Eyebrow"><Text value={r.hero.eyebrow} max={60} onChange={v => setR({ hero: { ...r.hero, eyebrow: v } })} /></Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Headline"><Text value={r.hero.title} max={80} onChange={v => setR({ hero: { ...r.hero, title: v } })} /></Field>
                        <Field label="Highlighted line"><Text value={r.hero.highlight} max={80} onChange={v => setR({ hero: { ...r.hero, highlight: v } })} /></Field>
                    </div>
                    <Field label="Introduction"><Area value={r.hero.subtitle} max={500} onChange={v => setR({ hero: { ...r.hero, subtitle: v } })} /></Field>
                    <Field label="Small print under the buttons"><Text value={r.hero.note} max={200} onChange={v => setR({ hero: { ...r.hero, note: v } })} /></Field>
                </Card>
                <Card title="How it works" hint="The eight steps and their order are fixed; you can change the wording.">
                    {r.steps.map((s, i) => (
                        <div key={s.key} className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                            <Field label={`${i + 1}. ${s.key.charAt(0) + s.key.slice(1).toLowerCase()}`}><Text value={s.title} max={60} onChange={v => setR({ steps: r.steps.map((x, j) => (j === i ? { ...x, title: v } : x)) })} /></Field>
                            <Field label="Description"><Text value={s.text} max={240} onChange={v => setR({ steps: r.steps.map((x, j) => (j === i ? { ...x, text: v } : x)) })} /></Field>
                        </div>
                    ))}
                </Card>
                <Card title="Benefits" hint="Up to 9. Describe what the platform offers — not outcomes it can’t promise.">
                    <ListEditor items={r.benefits} onChange={v => setR({ benefits: v })} max={9} blank={{ title: '', text: '' }} render={itemEditor()} addLabel="Add benefit" />
                </Card>
                <Card title="Requirements">
                    <ListEditor items={r.requirements} onChange={v => setR({ requirements: v })} max={8} blank={{ title: '', text: '' }} render={itemEditor('Requirement')} addLabel="Add requirement" />
                </Card>
                <Card title="Documents to have ready">
                    <ListEditor items={r.documents} onChange={v => setR({ documents: v })} max={8} blank={{ title: '', required: false }} addLabel="Add document"
                        render={(d, s) => (<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <div className="flex-1"><Field label="Document"><Text value={d.title} max={80} onChange={v => s({ ...d, title: v })} /></Field></div>
                            <label className="flex items-center gap-2 pb-2 text-sm text-gray-700"><input type="checkbox" checked={d.required} onChange={e => s({ ...d, required: e.target.checked })} className="h-4 w-4 accent-[#002147]" />Required</label>
                        </div>)} />
                </Card>
                <Card title="Closing call to action">
                    <Field label="Heading"><Text value={r.cta.title} max={80} onChange={v => setR({ cta: { ...r.cta, title: v } })} /></Field>
                    <Field label="Points" hint="One per line, up to 5."><Area value={r.cta.points.join('\n')} max={250} onChange={v => setR({ cta: { ...r.cta, points: v.split('\n').slice(0, 5) } })} /></Field>
                </Card>
            </div>)}

            {section === 'faq' && (
                <Card title="Questions from applicants" hint="Shown on the Become a Writer page. Up to 25.">
                    <ListEditor items={draft.faq} onChange={v => set('faq', v)} max={25} blank={{ q: '', a: '' }} render={qaEditor} addLabel="Add question" />
                </Card>
            )}

            {section === 'pricing' && (<div className="grid gap-5 xl:grid-cols-2">
                <Card title="Page heading" hint="Plan names, prices and features are edited in Memberships → Plans.">
                    <Field label="Title"><Text value={draft.pricing.title} max={80} onChange={v => set('pricing', { ...draft.pricing, title: v })} /></Field>
                    <Field label="Introduction"><Area value={draft.pricing.subtitle} max={400} onChange={v => set('pricing', { ...draft.pricing, subtitle: v })} /></Field>
                    <Field label="Footnote under the plans"><Area value={draft.pricing.footnote} max={400} rows={2} onChange={v => set('pricing', { ...draft.pricing, footnote: v })} /></Field>
                </Card>
                <Card title="Plan descriptions">
                    {noteCodes.map(code => {
                        const n = notes[code] || { tagline: '', bestFor: '' };
                        const setNote = (patch: Partial<typeof n>) => set('pricing', { ...draft.pricing, planNotes: { ...notes, [code]: { ...n, ...patch } } });
                        return (
                            <div key={code} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                                <Field label={`${planCodes.find(p => p.code === code)?.name || code} · badge`}><Text value={n.tagline} max={40} onChange={v => setNote({ tagline: v })} /></Field>
                                <Field label="Best for"><Text value={n.bestFor} max={120} onChange={v => setNote({ bestFor: v })} /></Field>
                            </div>
                        );
                    })}
                </Card>
                <div className="xl:col-span-2">
                    <Card title="Membership questions">
                        <ListEditor items={draft.pricing.faq} onChange={v => set('pricing', { ...draft.pricing, faq: v })} max={15} blank={{ q: '', a: '' }} render={qaEditor} addLabel="Add question" />
                    </Card>
                </div>
            </div>)}

            {section === 'terms' && (
                <Card title="Writer terms" hint="Shown at /writer-terms and linked from registration. Separate paragraphs with a blank line. Have your legal adviser review changes; writers see the “last updated” date.">
                    <Field label="Title"><Text value={draft.terms.title} max={80} onChange={v => set('terms', { ...draft.terms, title: v })} /></Field>
                    <Field label="Terms"><Area value={draft.terms.body} max={20000} rows={18} onChange={v => set('terms', { ...draft.terms, body: v })} /></Field>
                </Card>
            )}

            {section === 'contact' && (
                <Card title="Contact details for writers" hint="Shown on the recruitment, pricing and terms pages. Leave a field empty to hide it.">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Email"><Text type="email" value={draft.contact.email} max={120} onChange={v => set('contact', { ...draft.contact, email: v })} /></Field>
                        <Field label="Phone"><Text value={draft.contact.phone} max={30} onChange={v => set('contact', { ...draft.contact, phone: v })} /></Field>
                        <Field label="WhatsApp number" hint="International format, e.g. +44 7700 900123"><Text value={draft.contact.whatsapp} max={30} onChange={v => set('contact', { ...draft.contact, whatsapp: v })} /></Field>
                        <Field label="Support hours"><Text value={draft.contact.hours} max={120} onChange={v => set('contact', { ...draft.contact, hours: v })} /></Field>
                    </div>
                    <Field label="Postal address (optional)"><Area value={draft.contact.address} max={300} rows={2} onChange={v => set('contact', { ...draft.contact, address: v })} /></Field>
                </Card>
            )}
        </div>
    );
}
