import React, { useState } from 'react';
import { HelpCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';
import { BASE, ConfirmDialog, Label, StatusPill, Switch, fieldClass } from './shared';
import RichTextEditor from './RichTextEditor';
import { MoveControls, useReorder, type AdminFaq, type ContentEntity } from './cmsShared';

type Draft = { id: string | 'new'; question: string; answer: string; active: boolean };

// FAQs for one subject/service/project: inline add/edit, drag reorder, toggle, delete.
export default function FaqManager({ token, entity, faqs, setFaqs }: { token: string; entity: ContentEntity; faqs: AdminFaq[]; setFaqs: (f: AdminFaq[]) => void }) {
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<AdminFaq | null>(null);
    const [confirmError, setConfirmError] = useState('');

    const commitOrder = async (next: AdminFaq[]) => {
        const prev = faqs;
        setFaqs(next); setError('');
        try {
            const r = await api<{ faqs: AdminFaq[] }>(`${BASE}/faqs/reorder`, { method: 'PUT', token, body: { entityType: entity.type, entityId: entity.id, ids: next.map(f => f._id) } });
            setFaqs(r.faqs);
        } catch (e) { setFaqs(prev); setError((e as Error).message); }
    };
    const { move, rowProps, drag, over } = useReorder(faqs, commitOrder);

    const save = async () => {
        if (!draft) return;
        setSaving(true); setFormError('');
        const body = { entityType: entity.type, entityId: entity.id, question: draft.question, answer: draft.answer, status: draft.active ? 'ACTIVE' : 'INACTIVE' };
        try {
            const { faq } = await api<{ faq: AdminFaq }>(draft.id === 'new' ? `${BASE}/faqs` : `${BASE}/faqs/${draft.id}`, { method: draft.id === 'new' ? 'POST' : 'PUT', token, body });
            setFaqs(draft.id === 'new' ? [...faqs, faq] : faqs.map(f => (f._id === faq._id ? faq : f)));
            setDraft(null);
        } catch (e) { setFormError((e as Error).message); } finally { setSaving(false); }
    };
    const toggle = async (f: AdminFaq, on: boolean) => {
        setBusyId(f._id); setError('');
        try {
            const { faq } = await api<{ faq: AdminFaq }>(`${BASE}/faqs/${f._id}/status`, { method: 'PATCH', token, body: { status: on ? 'ACTIVE' : 'INACTIVE' } });
            setFaqs(faqs.map(x => (x._id === faq._id ? faq : x)));
        } catch (e) { setError((e as Error).message); } finally { setBusyId(null); }
    };
    const remove = async () => {
        if (!confirm) return;
        setBusyId(confirm._id); setConfirmError('');
        try { await api(`${BASE}/faqs/${confirm._id}`, { method: 'DELETE', token }); setFaqs(faqs.filter(f => f._id !== confirm._id)); setConfirm(null); }
        catch (e) { setConfirmError((e as Error).message); } finally { setBusyId(null); }
    };

    const editor = (
        <div className="space-y-3 rounded-2xl border border-[#fea520]/40 bg-white p-4 shadow-sm">
            {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</p>}
            <div><Label htmlFor="faq-q">Question</Label><input id="faq-q" autoFocus value={draft?.question || ''} onChange={e => setDraft(d => d && { ...d, question: e.target.value })} maxLength={300} placeholder="e.g. How quickly can you deliver?" className={fieldClass} /></div>
            <div><Label>Answer</Label><RichTextEditor label="Answer" value={draft?.answer || ''} onChange={answer => setDraft(d => d && { ...d, answer })} minHeight={120} /></div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700"><Switch checked={!!draft?.active} tone="green" label="FAQ visible" onChange={active => setDraft(d => d && { ...d, active })} />Visible</label>
                <div className="flex gap-2">
                    <button type="button" onClick={() => { setDraft(null); setFormError(''); }} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button type="button" onClick={save} disabled={saving || (draft?.question.trim().length || 0) < 3} className="rounded-xl bg-[#000a1e] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : draft?.id === 'new' ? 'Add FAQ' : 'Save FAQ'}</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">Visible FAQs show on the page (or where you place an FAQ block) and are marked up for Google as FAQ rich results.</p>
                <button onClick={() => { setDraft({ id: 'new', question: '', answer: '', active: true }); setFormError(''); }} disabled={draft?.id === 'new'} className="inline-flex items-center gap-1.5 rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" /> Add FAQ</button>
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
            {draft?.id === 'new' && editor}

            {faqs.length === 0 && draft?.id !== 'new' ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center text-gray-400">
                    <HelpCircle className="mx-auto mb-3 h-10 w-10 opacity-40" />
                    <p className="font-semibold">No FAQs yet</p>
                </div>
            ) : (
                <ol className="space-y-2" aria-label="FAQs">
                    {faqs.map((f, i) => draft?.id === f._id ? <li key={f._id}>{editor}</li> : (
                        <li key={f._id} {...rowProps(i, !draft)} data-testid="faq-row"
                            className={cn('flex items-start gap-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4', drag === i && 'opacity-40', over === i && drag !== i ? 'border-[#fea520] ring-2 ring-[#fea520]/30' : 'border-gray-100', f.status !== 'ACTIVE' && 'bg-gray-50')}>
                            <MoveControls index={i} count={faqs.length} onMove={move} label={f.question} />
                            <div className="min-w-0 flex-1">
                                <p className={cn('font-semibold', f.status === 'ACTIVE' ? 'text-[#000a1e]' : 'text-gray-500')}>{f.question} {f.status !== 'ACTIVE' && <StatusPill status={f.status} />}</p>
                                <p className="mt-1 line-clamp-2 text-sm text-gray-500">{f.answer.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <Switch checked={f.status === 'ACTIVE'} tone="green" disabled={busyId === f._id} label={`${f.question}: visible`} onChange={on => toggle(f, on)} />
                                <button onClick={() => { setDraft({ id: f._id, question: f.question, answer: f.answer, active: f.status === 'ACTIVE' }); setFormError(''); }} aria-label={`Edit FAQ: ${f.question}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#000a1e]"><Pencil className="h-4 w-4" /></button>
                                <button onClick={() => { setConfirm(f); setConfirmError(''); }} aria-label={`Delete FAQ: ${f.question}`} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            {confirm && (
                <ConfirmDialog title="Delete FAQ?" busy={busyId === confirm._id} error={confirmError}
                    message={<>“{confirm.question}” will be permanently deleted.</>} onConfirm={remove} onCancel={() => setConfirm(null)} />
            )}
        </div>
    );
}
