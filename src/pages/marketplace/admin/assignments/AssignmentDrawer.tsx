import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Upload, Trash2, Send, RefreshCw, Info } from 'lucide-react';
import { api } from '../../../../lib/api';
import { formatDate, formatMoney } from '../../../../lib/money';
import { AssignmentBadge, FileList, StarRow } from '../../../../components/writer/AssignmentBits';
import { Spinner } from '../../../../components/writer/WriterBits';
import { inputClass } from '../../../../components/writer/FormKit';
import { cn } from '../../../../lib/utils';
import type { AdminAssignment } from './AssignmentForm';

const TABS = ['Details', 'Allocation', 'Submissions', 'Rating', 'Earnings', 'History'] as const;
const SIGNAL_LABEL: Record<string, string> = { subject: 'Subject', skills: 'Skills', quality: 'Quality', rating: 'Rating', performance: 'Performance', workload: 'Workload', timezone: 'Time zone', membership: 'Membership' };
const files = (list: any[]) => list.map(f => ({ id: f._id, name: f.originalName, size: f.size, mimeType: f.mimeType }));

function Candidates({ a, token, onChanged }: { a: AdminAssignment; token: string; onChanged: (x: AdminAssignment) => void }) {
    const [data, setData] = useState<{ eligible: any[]; ineligible: any[]; totals: any } | null>(null);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [open, setOpen] = useState<string | null>(null);
    const canOffer = !a.assignedWriterId && ['OPEN', 'OFFERED', 'UNALLOCATED'].includes(a.status);
    useEffect(() => { api<typeof data>(`/admin/assignments/${a.id}/candidates`, { token }).then(setData).catch(e => setError(e.message)); }, [a.id, a.status, token]);

    const offer = async (writerId: string) => {
        setBusy(writerId); setError('');
        try { onChanged((await api<{ assignment: AdminAssignment }>(`/admin/assignments/${a.id}/offer`, { method: 'POST', token, body: { writerId } })).assignment); }
        catch (e) { setError((e as Error).message); } finally { setBusy(''); }
    };

    if (!data) return error ? <p className="text-sm text-red-600">{error}</p> : <Spinner className="h-6 w-6 text-[#fea520]" />;
    return (
        <div className="space-y-4">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <p className="flex items-start gap-2 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Ranking uses subject, skills, level, availability, workload, quality, rating, performance, time zone and a capped membership signal. Membership never overrides eligibility.</p>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Eligible · {data.totals.eligible}</h4>
            {data.eligible.length === 0 && <p className="text-sm text-gray-500">No eligible writers right now.</p>}
            <ul className="space-y-2">
                {data.eligible.map((c, i) => (
                    <li key={c.writerId} className="rounded-xl border border-gray-100 p-3">
                        <div className="flex items-center gap-3">
                            <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-[#000a1e]">{c.name} <span className="text-xs font-normal text-gray-400">{c.country}</span></p>
                                <p className="text-xs text-gray-500">Workload {c.active}/{c.limit} · {c.metrics.completed || 0} completed · {c.metrics.ratingCount ? `★ ${c.metrics.rating}` : 'unrated'} · quality {c.metrics.completed ? c.metrics.qualityScore : '—'}</p>
                            </div>
                            <button onClick={() => setOpen(o => (o === c.writerId ? null : c.writerId))} className="text-right" aria-expanded={open === c.writerId}>
                                <span className="block text-lg font-bold tabular-nums text-[#000a1e]">{c.score}</span><span className="text-[11px] text-gray-400">score</span>
                            </button>
                            {canOffer && <button onClick={() => offer(c.writerId)} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-[#000a1e] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy === c.writerId ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />} Offer</button>}
                        </div>
                        {open === c.writerId && (
                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3 text-xs sm:grid-cols-4">
                                {Object.entries(c.breakdown).map(([k, v]: any) => (
                                    <div key={k}><dt className="text-gray-400">{SIGNAL_LABEL[k] || k} <span className="text-gray-300">×{v.weight}</span></dt>
                                        <dd className="mt-0.5 h-1.5 rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#2f6db5]" style={{ width: `${v.value * 100}%` }} /></dd></div>
                                ))}
                            </dl>
                        )}
                    </li>
                ))}
            </ul>
            <details className="rounded-xl border border-gray-100 p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-gray-400">Not eligible · {data.totals.ineligible}</summary>
                <ul className="mt-2 space-y-1.5 text-sm">
                    {data.ineligible.map(c => <li key={c.writerId}><span className="font-medium">{c.name}</span> <span className="text-gray-500">— {c.reasons.join('; ')}</span></li>)}
                </ul>
            </details>
        </div>
    );
}

function Review({ a, token, onChanged }: { a: AdminAssignment; token: string; onChanged: (x: AdminAssignment) => void }) {
    const [mode, setMode] = useState<'request_revision' | 'approve' | null>(null);
    const [note, setNote] = useState('');
    const [hours, setHours] = useState('48');
    const [adj, setAdj] = useState({ amount: '', reason: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const act = async (decision: string) => {
        setBusy(true); setError('');
        try {
            const body: any = { decision, note };
            if (decision === 'request_revision') body.revisionHours = Number(hours) || undefined;
            if (decision === 'approve' && adj.amount) body.adjustment = { amount: Number(adj.amount), reason: adj.reason };
            onChanged((await api<{ assignment: AdminAssignment }>(`/admin/assignments/${a.id}/review`, { method: 'POST', token, body })).assignment);
            setMode(null); setNote(''); setAdj({ amount: '', reason: '' });
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const current = a.submissions.filter((s: any) => String(s.writerId) === String(a.assignedWriterId));
    const reviewable = ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(a.status);

    return (
        <div className="space-y-4">
            {reviewable && (
                <div className="rounded-xl border border-gray-200 p-4">
                    {!mode ? (
                        <div className="flex flex-wrap gap-2">
                            {a.status !== 'UNDER_REVIEW' && <button onClick={() => act('start_review')} disabled={busy} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">Start review</button>}
                            <button onClick={() => setMode('request_revision')} className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">Request revision</button>
                            <button onClick={() => setMode('approve')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Approve</button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={3000} className={cn(inputClass, 'text-sm')}
                                placeholder={mode === 'approve' ? 'Optional note to the writer' : 'What needs to change? (sent to the writer)'} />
                            {mode === 'request_revision' && <label className="flex items-center gap-2 text-sm">Due in <input value={hours} onChange={e => setHours(e.target.value.replace(/\D/g, ''))} className={cn(inputClass, 'w-20 py-1.5')} /> hours</label>}
                            {mode === 'approve' && (
                                <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                                    <input value={adj.amount} onChange={e => setAdj(x => ({ ...x, amount: e.target.value.replace(/[^\d.-]/g, '') }))} placeholder={`± ${a.payout.currency}`} className={cn(inputClass, 'py-1.5 text-sm')} aria-label="Payout adjustment" />
                                    <input value={adj.reason} onChange={e => setAdj(x => ({ ...x, reason: e.target.value }))} placeholder="Adjustment reason (bonus or deduction), optional" className={cn(inputClass, 'py-1.5 text-sm')} />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button onClick={() => act(mode)} disabled={busy} className={cn('rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50', mode === 'approve' ? 'bg-emerald-600' : 'bg-amber-600')}>{busy ? 'Saving…' : mode === 'approve' ? 'Confirm approval' : 'Send revision request'}</button>
                                <button onClick={() => setMode(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                            </div>
                        </div>
                    )}
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
            )}
            {current.length === 0 && <p className="text-sm text-gray-500">No submissions yet.</p>}
            {current.map((s: any) => (
                <div key={s._id} className="rounded-xl border border-gray-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-semibold">Version {s.version} · {new Date(s.createdAt).toLocaleString()}</span>
                        <span className={cn('text-xs font-semibold', s.minutesLate ? 'text-red-600' : 'text-emerald-700')}>{s.minutesLate ? `${Math.ceil(s.minutesLate / 60)}h late` : 'On time'} · {s.status.toLowerCase().replace('_', ' ')}</span>
                    </div>
                    {s.note && <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{s.note}</p>}
                    <div className="mt-3"><FileList files={files(s.files)} basePath={`/admin/assignments/${a.id}/submissions/${s._id}/files`} token={token} /></div>
                    {s.reviewNote && <p className="mt-2 text-sm text-gray-500">Review: {s.reviewNote}</p>}
                </div>
            ))}
        </div>
    );
}

function RatingPanel({ a, token, onChanged }: { a: AdminAssignment; token: string; onChanged: (x: AdminAssignment) => void }) {
    const r = a.rating;
    const [s, setS] = useState({ quality: r?.quality || 0, accuracy: r?.accuracy || 0, communication: r?.communication || 0, comment: r?.comment || '', editReason: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    if (a.status !== 'APPROVED') return <p className="text-sm text-gray-500">Ratings open once the work is approved.</p>;
    const save = async () => {
        setBusy(true); setError('');
        try {
            const body: any = { quality: s.quality, accuracy: s.accuracy, communication: s.communication, comment: s.comment };
            if (r) body.editReason = s.editReason;
            onChanged((await api<{ assignment: AdminAssignment }>(`/admin/assignments/${a.id}/rating`, { method: 'POST', token, body })).assignment);
            setS(x => ({ ...x, editReason: '' }));
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const Stars = ({ k }: { k: 'quality' | 'accuracy' | 'communication' }) => (
        <div className="flex items-center justify-between gap-3 text-sm">
            <span className="capitalize text-gray-600">{k}</span>
            <span className="flex gap-1" role="radiogroup" aria-label={k}>
                {[1, 2, 3, 4, 5].map(i => <button key={i} type="button" role="radio" aria-checked={s[k] === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => setS(x => ({ ...x, [k]: i }))}
                    className={cn('text-2xl leading-none', i <= s[k] ? 'text-[#f39200]' : 'text-gray-200 hover:text-gray-300')}>★</button>)}
            </span>
        </div>
    );
    return (
        <div className="space-y-4">
            {r && <div className="space-y-1 rounded-xl bg-gray-50 p-4"><StarRow label="Overall (weighted)" value={r.overall} /><StarRow label="Timeliness (automatic)" value={r.timeliness} />{r.edits?.length > 0 && <p className="pt-1 text-xs text-gray-500">Edited {r.edits.length}× · last reason: {r.edits[r.edits.length - 1].reason}</p>}</div>}
            <div className="space-y-2"><Stars k="quality" /><Stars k="accuracy" /><Stars k="communication" /></div>
            <p className="text-xs text-gray-500">Timeliness is calculated from the submission time and can’t be set manually.</p>
            <textarea rows={2} maxLength={1000} value={s.comment} onChange={e => setS(x => ({ ...x, comment: e.target.value }))} placeholder="Comment shown to the writer (optional)" className={cn(inputClass, 'text-sm')} />
            {r && <input value={s.editReason} onChange={e => setS(x => ({ ...x, editReason: e.target.value }))} placeholder="Reason for changing this rating (required)" className={cn(inputClass, 'py-2 text-sm')} />}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={save} disabled={busy || !s.quality || !s.accuracy || !s.communication || (r && s.editReason.trim().length < 5)} className="rounded-lg bg-[#000a1e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{r ? 'Update rating' : 'Save rating'}</button>
        </div>
    );
}

function StopDialog({ a, kind, token, onDone, onCancel }: { a: AdminAssignment; kind: 'cancel' | 'release'; token: string; onDone: (x: AdminAssignment) => void; onCancel: () => void }) {
    const [reason, setReason] = useState('');
    const [fault, setFault] = useState(false);
    const [earningAction, setEarningAction] = useState('CANCEL');
    const [partial, setPartial] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submit = async () => {
        setBusy(true); setError('');
        try {
            const body: any = { reason, writerAtFault: fault, earningAction, ...(earningAction === 'PARTIAL' ? { partialAmount: Number(partial) || 0 } : {}) };
            onDone((await api<{ assignment: AdminAssignment }>(`/admin/assignments/${a.id}/${kind}`, { method: 'POST', token, body })).assignment);
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    return (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/40 p-4">
            <p className="font-semibold text-[#000a1e]">{kind === 'cancel' ? 'Cancel assignment' : 'Release from writer and re-allocate'}</p>
            <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="Reason (sent to the writer)" className={cn(inputClass, 'text-sm')} />
            {a.assignedWriterId && (
                <>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fault} onChange={e => setFault(e.target.checked)} className="h-4 w-4 accent-[#000a1e]" /> Writer at fault (counts against their completion rate)</label>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span>Writer payout:</span>
                        <select value={earningAction} onChange={e => setEarningAction(e.target.value)} className={cn(inputClass, 'w-auto py-1.5')}>
                            <option value="CANCEL">No payout</option><option value="APPROVE">Full payout</option><option value="PARTIAL">Partial payout</option>
                        </select>
                        {earningAction === 'PARTIAL' && <input value={partial} onChange={e => setPartial(e.target.value.replace(/[^\d.]/g, ''))} placeholder={a.payout.currency} className={cn(inputClass, 'w-28 py-1.5')} aria-label="Partial amount" />}
                    </div>
                </>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
                <button onClick={submit} disabled={busy || reason.trim().length < 5} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Working…' : kind === 'cancel' ? 'Confirm cancel' : 'Confirm release'}</button>
                <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-white">Back</button>
            </div>
        </div>
    );
}

export default function AssignmentDrawer({ id, token, onClose, onChanged, onEdit }: { id: string; token: string; onClose: () => void; onChanged: () => void; onEdit: (a: AdminAssignment) => void }) {
    const [a, setA] = useState<AdminAssignment | null>(null);
    const [tab, setTab] = useState<typeof TABS[number]>('Details');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [stop, setStop] = useState<'cancel' | 'release' | null>(null);
    const upload = useRef<HTMLInputElement>(null);

    const load = useCallback(() => api<{ assignment: AdminAssignment }>(`/admin/assignments/${id}`, { token }).then(d => setA(d.assignment)).catch(e => setError(e.message)), [id, token]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    const update = (x: AdminAssignment) => { setA(x); setStop(null); onChanged(); };
    const run = async (key: string, fn: () => Promise<{ assignment: AdminAssignment }>) => {
        setBusy(key); setError('');
        try { update((await fn()).assignment); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
    };
    const uploadFiles = (list: FileList | null) => {
        if (!list?.length || !a) return;
        const form = new FormData();
        Array.from(list).forEach(f => form.append('files', f));
        run('upload', () => api(`/admin/assignments/${a.id}/reference-files`, { method: 'POST', token, body: form }));
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Assignment">
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
            <div className="relative flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
                <div className="flex items-start gap-3 border-b border-gray-100 p-5">
                    {a ? (
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{a.assignmentRef}{a.order ? ` · order ${a.order.orderId}` : ''}</p>
                            <h2 className="truncate text-lg font-bold text-[#000a1e]">{a.title}</h2>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                <AssignmentBadge status={a.status} />
                                <span>{formatMoney(a.payout.amountMinor, a.payout.currency)}</span>
                                <span>· {a.allocation?.mode || a.allocationMode || 'default'} allocation</span>
                                {a.assignedWriter && <span>· {a.assignedWriter.name}</span>}
                            </div>
                        </div>
                    ) : <div className="flex-1" />}
                    <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                {!a ? <div className="flex flex-1 items-center justify-center">{error ? <p className="text-sm text-red-600">{error}</p> : <Spinner className="h-7 w-7 text-[#fea520]" />}</div> : (
                    <>
                        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-4">
                            {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={cn('whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold', tab === t ? 'border-[#fea520] text-[#000a1e]' : 'border-transparent text-gray-500')}>{t}</button>)}
                        </div>
                        <div className="flex-1 space-y-5 overflow-y-auto p-5">
                            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                            {a.allocation?.note && ['UNALLOCATED', 'OPEN'].includes(a.status) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{a.allocation.note}</p>}
                            {stop && <StopDialog a={a} kind={stop} token={token} onDone={update} onCancel={() => setStop(null)} />}

                            {tab === 'Details' && (
                                <div className="space-y-5 text-sm">
                                    <dl className="grid grid-cols-2 gap-4">
                                        {[['Subject', a.subject], ['Level', a.academicLevel], ['Words', a.wordCount.toLocaleString()], ['Service', a.service || '—'],
                                          ['Writer deadline', new Date(a.writerDeadline).toLocaleString()], ['Client deadline', a.clientDeadline ? new Date(a.clientDeadline).toLocaleString() : '—'],
                                          ['Required skills', a.requiredSkills.join(', ') || '—'], ['Revisions', `${a.revisionCount}`]].map(([k, v]) => (
                                            <div key={k}><dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">{k}</dt><dd className="mt-0.5 text-gray-800">{v}</dd></div>
                                        ))}
                                    </dl>
                                    {a.requirements && <div><h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Requirements</h4><p className="mt-1 whitespace-pre-line">{a.requirements}</p></div>}
                                    {a.instructions && <div><h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Instructions</h4><p className="mt-1 whitespace-pre-line">{a.instructions}</p></div>}
                                    {a.deliverables.length > 0 && <div><h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Deliverables</h4><ul className="mt-1 list-disc pl-5">{a.deliverables.map((d: string) => <li key={d}>{d}</li>)}</ul></div>}
                                    <div>
                                        <div className="mb-2 flex items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Reference files</h4>
                                            {!['APPROVED', 'CANCELLED'].includes(a.status) && <>
                                                <input ref={upload} type="file" multiple className="sr-only" id="ref-upload" onChange={e => { uploadFiles(e.target.files); e.target.value = ''; }} />
                                                <label htmlFor="ref-upload" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold">{busy === 'upload' ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />} Upload</label></>}
                                        </div>
                                        <FileList files={files(a.referenceFiles)} basePath={`/admin/assignments/${a.id}/files`} token={token} onError={setError} />
                                        {a.referenceFiles.length > 0 && !['APPROVED', 'CANCELLED'].includes(a.status) && (
                                            <div className="mt-2 flex flex-wrap gap-2">{a.referenceFiles.map((f: any) => (
                                                <button key={f._id} onClick={() => run(`del-${f._id}`, () => api(`/admin/assignments/${a.id}/reference-files/${f._id}`, { method: 'DELETE', token }))}
                                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3 w-3" /> {f.originalName}{f.source === 'ORDER' ? ' (order)' : ''}</button>
                                            ))}</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {tab === 'Allocation' && (
                                <div className="space-y-6">
                                    <Candidates a={a} token={token} onChanged={update} />
                                    <div>
                                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Offer log</h4>
                                        {a.offers.length === 0 ? <p className="text-sm text-gray-500">No offers yet.</p> : (
                                            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm">
                                                {a.offers.map((o: any) => (
                                                    <li key={o._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                                                        <span><span className="font-medium">{o.writer?.name || 'Writer'}</span> <span className="text-xs text-gray-400">{o.source.toLowerCase()} · {o.score ?? '—'} · {new Date(o.createdAt).toLocaleString()}</span>
                                                            {(o.declineReason || o.declineCode) && <span className="block text-xs text-gray-500">Declined: {[o.declineCode, o.declineReason].filter(Boolean).join(' — ')}</span>}
                                                            {o.releasedAt && <span className="block text-xs text-red-600">Released {o.releasedAtFault ? '(at fault)' : ''}</span>}</span>
                                                        <span className="text-xs font-semibold text-gray-600">{o.status.toLowerCase()}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}
                            {tab === 'Submissions' && <Review a={a} token={token} onChanged={update} />}
                            {tab === 'Rating' && <RatingPanel a={a} token={token} onChanged={update} />}
                            {tab === 'Earnings' && (a.earnings.length === 0 ? <p className="text-sm text-gray-500">Earnings are created when a writer accepts.</p> : (
                                <ul className="space-y-2 text-sm">
                                    {a.earnings.map((e: any) => (
                                        <li key={e._id} className="rounded-xl border border-gray-100 p-3">
                                            <div className="flex justify-between"><span className="font-medium">{e.writer}</span><span className="font-semibold tabular-nums">{formatMoney(e.amountMinor, e.currency)} · {e.status.toLowerCase()}</span></div>
                                            {e.adjustments.map((x: any, i: number) => <p key={i} className="text-xs text-gray-500">{x.amountMinor > 0 ? '+' : ''}{formatMoney(x.amountMinor, e.currency)} — {x.reason}</p>)}
                                            {e.payoutReference && <p className="text-xs text-gray-500">Paid {formatDate(e.paidAt)} · {e.payoutReference}</p>}
                                        </li>
                                    ))}
                                </ul>
                            ))}
                            {tab === 'History' && (
                                <ol className="space-y-2 text-sm">
                                    {[...a.history].reverse().map((h: any, i: number) => (
                                        <li key={i}><span className="font-medium">{h.type.replace(/_/g, ' ').toLowerCase()}</span> <span className="text-xs text-gray-400">{new Date(h.at).toLocaleString()} · {h.actorType.toLowerCase()}</span>{h.note && <span className="block text-gray-600">{h.note}</span>}</li>
                                    ))}
                                </ol>
                            )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 p-4 pr-24">
                            {['DRAFT', 'OPEN', 'OFFERED', 'UNALLOCATED'].includes(a.status) && <button onClick={() => onEdit(a)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold">Edit</button>}
                            {['DRAFT', 'UNALLOCATED'].includes(a.status) && <button onClick={() => run('publish', () => api(`/admin/assignments/${a.id}/publish`, { method: 'POST', token }))} disabled={!!busy} className="rounded-lg bg-[#000a1e] px-4 py-2 text-sm font-semibold text-white">{busy === 'publish' ? 'Publishing…' : 'Publish'}</button>}
                            {['OPEN', 'UNALLOCATED'].includes(a.status) && a.allocation?.mode && a.allocation.mode !== 'MANUAL' && <button onClick={() => run('realloc', () => api(`/admin/assignments/${a.id}/reallocate`, { method: 'POST', token }))} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Re-run allocation</button>}
                            {['ASSIGNED', 'REVISION_REQUESTED'].includes(a.status) && <button onClick={() => setStop('release')} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Release</button>}
                            {!['APPROVED', 'CANCELLED'].includes(a.status) && <button onClick={() => setStop('cancel')} className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">Cancel</button>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
