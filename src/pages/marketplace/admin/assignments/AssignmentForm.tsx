import React, { useState } from 'react';
import { api } from '../../../../lib/api';
import { fromMinor } from '../../../../lib/money';
import { ACADEMIC_LEVELS } from '../../../../lib/writerOptions';
import { CountrySelect, inputClass } from '../../../../components/writer/FormKit';
import { cn } from '../../../../lib/utils';

export type AdminAssignment = Record<string, any> & { id: string; assignmentRef: string; status: string };

const toLocalInput = (d?: string | Date | null) => {
    if (!d) return '';
    const x = new Date(d);
    return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
    return <span className="mb-1 block text-sm font-semibold text-gray-700">{children}{hint && <span className="font-normal text-gray-400"> — {hint}</span>}</span>;
}

export default function AssignmentForm({ token, existing, currencies, onSaved, onCancel }: {
    token: string; existing?: AdminAssignment; currencies: string[]; onSaved: (a: AdminAssignment) => void; onCancel: () => void;
}) {
    const e = existing;
    const [f, setF] = useState({
        orderRef: '', title: e?.title || '', service: e?.service || '', subject: e?.subject || '', academicLevel: e?.academicLevel || "Master's",
        wordCount: String(e?.wordCount ?? ''), requirements: e?.requirements || '', instructions: e?.instructions || '',
        deliverables: (e?.deliverables || []).join('\n'), requiredSkills: (e?.requiredSkills || []).join(', '),
        writerDeadline: toLocalInput(e?.writerDeadline), clientDeadline: toLocalInput(e?.clientDeadline),
        payoutAmount: e ? String(fromMinor(e.payout.amountMinor, e.payout.currency)) : '', payoutCurrency: e?.payout.currency || currencies[0] || 'USD',
        allocationMode: e?.allocationMode || '', minQualityScore: e?.rules?.minQualityScore ?? '', minRating: e?.rules?.minRating ?? '',
        allowedCountries: (e?.rules?.allowedCountries || []) as string[], preferredTimezone: e?.rules?.preferredTimezone || '',
    });
    const [orderInfo, setOrderInfo] = useState<{ orderId: string; files: { name: string }[] } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const set = (k: keyof typeof f, v: any) => setF(x => ({ ...x, [k]: v }));
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];

    const importOrder = async () => {
        setError('');
        try {
            const r = await api<{ order: { orderId: string }; prefill: any }>(`/admin/assignments/orders/${encodeURIComponent(f.orderRef.trim())}/prefill`, { token });
            const p = r.prefill;
            setF(x => ({ ...x, title: p.title, service: p.service, subject: p.subject, academicLevel: p.academicLevel, wordCount: String(p.wordCount),
                instructions: p.instructions, writerDeadline: toLocalInput(p.writerDeadline), clientDeadline: toLocalInput(p.clientDeadline) }));
            setOrderInfo({ orderId: r.order.orderId, files: p.files });
        } catch (err) { setError((err as Error).message); setOrderInfo(null); }
    };

    const save = async () => {
        setBusy(true); setError('');
        try {
            if (!f.writerDeadline) throw new Error('Set a writer deadline.');
            const body = {
                ...(orderInfo && !e ? { orderRef: orderInfo.orderId } : {}),
                title: f.title, service: f.service, subject: f.subject, academicLevel: f.academicLevel, wordCount: Number(f.wordCount) || 0,
                requirements: f.requirements, instructions: f.instructions,
                deliverables: f.deliverables.split('\n').map(s => s.trim()).filter(Boolean),
                requiredSkills: f.requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
                writerDeadline: new Date(f.writerDeadline).toISOString(),
                clientDeadline: f.clientDeadline ? new Date(f.clientDeadline).toISOString() : null,
                payout: { amount: Number(f.payoutAmount), currency: f.payoutCurrency },
                allocationMode: f.allocationMode || null,
                rules: {
                    minQualityScore: f.minQualityScore === '' ? null : Number(f.minQualityScore),
                    minRating: f.minRating === '' ? null : Number(f.minRating),
                    allowedCountries: f.allowedCountries, preferredTimezone: f.preferredTimezone,
                    excludedWriterIds: (e?.rules?.excludedWriterIds || []).map(String),
                },
            };
            const r = await api<{ assignment: AdminAssignment }>(e ? `/admin/assignments/${e.id}` : '/admin/assignments', { method: e ? 'PUT' : 'POST', token, body });
            onSaved(r.assignment);
        } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    };

    return (
        <div className="space-y-5 rounded-2xl border border-[#fea520]/50 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-[#000a1e]">{e ? `Edit ${e.assignmentRef}` : 'New assignment'}</h3>
            {!e && (
                <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 sm:flex-row sm:items-end">
                    <label className="flex-1"><Label hint="optional">Create from customer order</Label>
                        <input className={cn(inputClass, 'py-2')} value={f.orderRef} onChange={x => set('orderRef', x.target.value)} placeholder="e.g. ACAD-123456" /></label>
                    <button onClick={importOrder} disabled={!f.orderRef.trim()} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Import order</button>
                </div>
            )}
            {orderInfo && <p className="text-sm text-emerald-700">Linked to order {orderInfo.orderId}{orderInfo.files.length ? ` · ${orderInfo.files.length} customer file(s) will be attached` : ''}. Accepting the assignment will move the order to In Progress.</p>}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="sm:col-span-2"><Label>Title</Label><input className={cn(inputClass, 'py-2')} maxLength={200} value={f.title} onChange={x => set('title', x.target.value)} /></label>
                <label><Label>Service</Label><input className={cn(inputClass, 'py-2')} maxLength={120} value={f.service} onChange={x => set('service', x.target.value)} /></label>
                <label><Label>Subject</Label><input className={cn(inputClass, 'py-2')} maxLength={80} value={f.subject} onChange={x => set('subject', x.target.value)} /></label>
                <label><Label>Academic level</Label><select className={cn(inputClass, 'py-2')} value={f.academicLevel} onChange={x => set('academicLevel', x.target.value)}>{ACADEMIC_LEVELS.map(l => <option key={l}>{l}</option>)}</select></label>
                <label><Label>Word count</Label><input className={cn(inputClass, 'py-2')} inputMode="numeric" value={f.wordCount} onChange={x => set('wordCount', x.target.value.replace(/\D/g, ''))} /></label>
                <label><Label hint="shown to writers">Writer deadline</Label><input type="datetime-local" className={cn(inputClass, 'py-2')} value={f.writerDeadline} onChange={x => set('writerDeadline', x.target.value)} /></label>
                <label><Label hint="internal">Client deadline</Label><input type="datetime-local" className={cn(inputClass, 'py-2')} value={f.clientDeadline} onChange={x => set('clientDeadline', x.target.value)} /></label>
                <label className="sm:col-span-2"><Label>Requirements</Label><textarea rows={3} className={cn(inputClass, 'text-sm')} maxLength={5000} value={f.requirements} onChange={x => set('requirements', x.target.value)} /></label>
                <label className="sm:col-span-2"><Label>Instructions</Label><textarea rows={3} className={cn(inputClass, 'text-sm')} maxLength={10000} value={f.instructions} onChange={x => set('instructions', x.target.value)} /></label>
                <label className="sm:col-span-2"><Label hint="one per line">Deliverables</Label><textarea rows={2} className={cn(inputClass, 'text-sm')} value={f.deliverables} onChange={x => set('deliverables', x.target.value)} /></label>
                <label className="sm:col-span-2"><Label hint="comma separated; writers must have all">Required skills</Label><input className={cn(inputClass, 'py-2')} value={f.requiredSkills} onChange={x => set('requiredSkills', x.target.value)} /></label>
                <label><Label>Writer payout</Label><input className={cn(inputClass, 'py-2 tabular-nums')} inputMode="decimal" value={f.payoutAmount} onChange={x => set('payoutAmount', x.target.value.replace(/[^\d.]/g, ''))} /></label>
                <label><Label>Currency</Label><select className={cn(inputClass, 'py-2')} value={f.payoutCurrency} onChange={x => set('payoutCurrency', x.target.value)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
                <label><Label>Allocation</Label><select className={cn(inputClass, 'py-2')} value={f.allocationMode} onChange={x => set('allocationMode', x.target.value)}>
                    <option value="">Default (settings)</option><option value="MANUAL">Manual</option><option value="AUTOMATIC">Automatic</option><option value="HYBRID">Hybrid</option></select></label>
                <label><Label hint="optional">Preferred time zone</Label><select className={cn(inputClass, 'py-2')} value={f.preferredTimezone} onChange={x => set('preferredTimezone', x.target.value)}>
                    <option value="">Any</option>{zones.map(z => <option key={z} value={z}>{z}</option>)}</select></label>
                <label><Label hint="overrides default">Min quality score</Label><input className={cn(inputClass, 'py-2')} inputMode="numeric" value={f.minQualityScore} onChange={x => set('minQualityScore', x.target.value.replace(/[^\d.]/g, ''))} /></label>
                <label><Label hint="overrides default">Min rating</Label><input className={cn(inputClass, 'py-2')} inputMode="decimal" value={f.minRating} onChange={x => set('minRating', x.target.value.replace(/[^\d.]/g, ''))} /></label>
                <div className="sm:col-span-2"><Label hint="optional; leave empty for any">Restrict to countries</Label>
                    <div className="flex flex-wrap items-center gap-2">
                        {f.allowedCountries.map(c => <button key={c} onClick={() => set('allowedCountries', f.allowedCountries.filter(x => x !== c))} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold">{c} ✕</button>)}
                        <div className="w-56"><CountrySelect value="" placeholder="Add country" onChange={c => c && !f.allowedCountries.includes(c) && set('allowedCountries', [...f.allowedCountries, c])} /></div>
                    </div>
                </div>
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
            <div className="flex gap-2">
                <button onClick={save} disabled={busy} className="rounded-xl bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : e ? 'Save changes' : 'Create draft'}</button>
                <button onClick={onCancel} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
            </div>
        </div>
    );
}
