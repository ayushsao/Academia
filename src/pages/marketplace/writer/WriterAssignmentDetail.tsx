import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, X, Check, MessageSquareWarning } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatDate, formatMoney } from '../../../lib/money';
import { EARNING_STATUS_LABEL, type Earning, type Offer, type Rating, type Submission, type WriterAssignment } from '../../../lib/assignmentTypes';
import { AssignmentBadge, Countdown, FileList, StarRow } from '../../../components/writer/AssignmentBits';
import { Notice, inputClass } from '../../../components/writer/FormKit';
import { Spinner, formatBytes } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

type Detail = {
    assignment: WriterAssignment; isAssigned: boolean; offer: Offer | null; submissions: Submission[]; earning: Earning | null;
    rating: Rating | null; canSubmit: boolean; submissionRules: { allowedFormats: string[]; maxFileMB: number; maxFiles: number }; maxRevisions: number;
};

const FLOW = [
    { key: 'SUBMITTED', label: 'Submitted' }, { key: 'UNDER_REVIEW', label: 'Review' }, { key: 'REVISION_REQUESTED', label: 'Revision requested' },
    { key: 'RESUBMITTED', label: 'Resubmission' }, { key: 'APPROVED', label: 'Approved' },
];

// Where the assignment sits on Submitted → Review → Revision → Resubmission → Approved.
function Flow({ status, revisions }: { status: string; revisions: number }) {
    const idx = FLOW.findIndex(f => f.key === status);
    // A resubmission goes back into review: the revision steps behind it are already done.
    const reviewingResubmission = status === 'UNDER_REVIEW' && revisions > 0;
    return (
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs sm:text-sm">
            {FLOW.map((f, i) => {
                const revisionStep = f.key === 'REVISION_REQUESTED' || f.key === 'RESUBMITTED';
                const skipped = revisionStep && revisions === 0 && status === 'APPROVED';
                const active = idx === i;
                const done = !active && !skipped && (idx > i || status === 'APPROVED' || (reviewingResubmission && (i === 0 || revisionStep)));
                return (
                    <li key={f.key} className="flex items-center gap-2">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold',
                            active ? 'bg-[#002147] text-white' : done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400', skipped && 'line-through')}>
                            {done && !active && <Check className="h-3 w-3" strokeWidth={3} />}{f.label}
                        </span>
                        {i < FLOW.length - 1 && <span className="h-px w-3 bg-slate-200" />}
                    </li>
                );
            })}
        </ol>
    );
}

function SubmitForm({ detail, onSubmitted }: { detail: Detail; onSubmitted: () => void }) {
    const { assignment: a, submissionRules: rules } = detail;
    const input = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const accept = rules.allowedFormats.map(f => `.${f}`).join(',');

    const add = (list: FileList | null) => {
        if (!list) return;
        const next = [...files];
        for (const f of Array.from(list)) {
            const ext = f.name.split('.').pop()?.toLowerCase() || '';
            if (!rules.allowedFormats.includes(ext === 'jpeg' ? 'jpg' : ext)) { setError(`“${f.name}” isn’t an accepted format.`); continue; }
            if (f.size > rules.maxFileMB * 1024 * 1024) { setError(`“${f.name}” is larger than ${rules.maxFileMB} MB.`); continue; }
            if (next.length < rules.maxFiles && !next.some(x => x.name === f.name && x.size === f.size)) next.push(f);
        }
        setFiles(next);
        if (input.current) input.current.value = '';
    };

    const submit = async () => {
        setBusy(true); setError('');
        const form = new FormData();
        files.forEach(f => form.append('files', f));
        if (note.trim()) form.append('note', note.trim());
        try {
            await api(`/assignments/writer/assignments/${a.ref}/submissions`, { method: 'POST', body: form });
            setFiles([]); setNote('');
            onSubmitted();
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };

    const isRevision = a.status === 'REVISION_REQUESTED';
    return (
        <section className="rounded-2xl border-2 border-[#002147]/15 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold text-[#0b1b33]">{isRevision ? 'Submit your revision' : 'Submit your work'}</h2>
            <p className="mt-1 text-sm text-slate-600">Accepted: {rules.allowedFormats.map(f => f.toUpperCase()).join(', ')} · up to {rules.maxFiles} files · {rules.maxFileMB} MB each.</p>
            <div className="mt-3"><Countdown iso={isRevision ? a.revisionDueAt : a.writerDeadline} label={isRevision ? 'Revision due' : 'Due'} /></div>
            <input ref={input} id="sub-files" type="file" multiple accept={accept} className="sr-only" onChange={e => add(e.target.files)} />
            <label htmlFor="sub-files" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); add(e.dataTransfer.files); }}
                className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600 hover:border-[#002147]">
                <Upload className="h-6 w-6 text-[#002147]" />
                <span><span className="font-semibold text-[#002147]">Choose files</span> or drop them here</span>
            </label>
            {files.length > 0 && (
                <ul className="mt-3 space-y-2">
                    {files.map(f => (
                        <li key={f.name + f.size} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            <span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-slate-400">{formatBytes(f.size)}</span>
                            <button onClick={() => setFiles(list => list.filter(x => x !== f))} aria-label={`Remove ${f.name}`} className="rounded p-1 text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                        </li>
                    ))}
                </ul>
            )}
            <label htmlFor="sub-note" className="mt-4 block text-sm font-semibold text-[#0b1b33]">Note to the reviewer <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea id="sub-note" rows={3} maxLength={3000} value={note} onChange={e => setNote(e.target.value)} className={cn(inputClass, 'mt-1.5 text-sm')}
                placeholder={isRevision ? 'Summarise what you changed.' : 'Anything the reviewer should know.'} />
            {error && <Notice tone="error" className="mt-3">{error}</Notice>}
            <button onClick={submit} disabled={busy || !files.length} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white disabled:opacity-50">
                {busy && <Spinner className="h-4 w-4" />} {isRevision ? 'Submit revision' : 'Submit work'}
            </button>
        </section>
    );
}

export default function WriterAssignmentDetail() {
    const { ref } = useParams();
    const [d, setD] = useState<Detail | null>(null);
    const [error, setError] = useState('');
    const [flash, setFlash] = useState('');
    const load = useCallback(() => api<Detail>(`/assignments/writer/assignments/${ref}`).then(setD).catch(e => setError(e.message)), [ref]);
    useEffect(() => { load(); }, [load]);

    if (error && !d) return <Notice tone="error">{error}</Notice>;
    if (!d) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8 text-[#002147]" /></div>;
    const a = d.assignment;
    const latest = d.submissions[0];

    return (
        <div className="space-y-6">
            <Link to={d.isAssigned ? '/writer/assignments' : '/writer/opportunities'} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#002147]"><ArrowLeft className="h-4 w-4" /> Back</Link>
            <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{a.ref}{a.service ? ` · ${a.service}` : ''}</p>
                        <h1 className="mt-1 text-xl font-extrabold text-[#0b1b33] sm:text-2xl">{a.title}</h1>
                        <p className="mt-1 text-sm text-slate-600">{a.subject} · {a.academicLevel} · {a.wordCount.toLocaleString()} words</p>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                        <AssignmentBadge status={a.status} />
                        <p className="text-2xl font-extrabold text-[#0b1b33]">{formatMoney(d.earning?.amountMinor ?? a.payout.amountMinor, a.payout.currency)}</p>
                    </div>
                </div>
                {d.isAssigned && ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'RESUBMITTED', 'APPROVED'].includes(a.status) && (
                    <div className="mt-5 border-t border-slate-100 pt-4"><Flow status={a.status} revisions={a.revisionCount} /></div>
                )}
                {!d.isAssigned && d.offer?.status !== 'OFFERED' && <Notice tone="info" className="mt-4">This opportunity is no longer available to you ({d.offer?.status.toLowerCase()}).</Notice>}
            </header>

            {flash && <Notice tone="success">{flash}</Notice>}
            {a.status === 'REVISION_REQUESTED' && latest?.reviewNote && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <p className="flex items-center gap-2 font-semibold text-amber-900"><MessageSquareWarning className="h-5 w-5" /> Revision requested ({a.revisionCount}/{d.maxRevisions})</p>
                    <p className="mt-2 whitespace-pre-line text-sm text-amber-900/90">{latest.reviewNote}</p>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                <div className="space-y-6">
                    {d.canSubmit && <SubmitForm detail={d} onSubmitted={() => { setFlash('Submitted. We’ll notify you when it’s reviewed.'); load(); }} />}

                    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 sm:p-6">
                        {a.requirements && <div><h2 className="font-bold text-[#0b1b33]">Requirements</h2><p className="mt-1 whitespace-pre-line">{a.requirements}</p></div>}
                        {a.instructions && <div><h2 className="font-bold text-[#0b1b33]">Instructions</h2><p className="mt-1 whitespace-pre-line">{a.instructions}</p></div>}
                        {a.deliverables.length > 0 && <div><h2 className="font-bold text-[#0b1b33]">Deliverables</h2><ul className="mt-1 list-disc pl-5">{a.deliverables.map(x => <li key={x}>{x}</li>)}</ul></div>}
                        {a.requiredSkills.length > 0 && <p><span className="font-bold text-[#0b1b33]">Required skills:</span> {a.requiredSkills.join(', ')}</p>}
                        <div><h2 className="mb-2 font-bold text-[#0b1b33]">Reference files</h2>
                            {a.referenceFiles.length ? <FileList files={a.referenceFiles} basePath={`/assignments/writer/assignments/${a.ref}/files`} onError={setError} /> : <p className="text-slate-500">No reference files.</p>}
                        </div>
                    </section>

                    {d.submissions.length > 0 && (
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                            <h2 className="font-bold text-[#0b1b33]">Submissions</h2>
                            <ol className="mt-4 space-y-4">
                                {d.submissions.map(s => (
                                    <li key={s.id} className="rounded-xl border border-slate-200 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                            <span className="font-semibold text-[#0b1b33]">Version {s.version} · {formatDate(s.submittedAt)}</span>
                                            <span className={cn('text-xs font-semibold', s.minutesLate ? 'text-red-600' : 'text-emerald-700')}>{s.minutesLate ? `${Math.ceil(s.minutesLate / 60)}h late` : 'On time'} · {s.status.replace('_', ' ').toLowerCase()}</span>
                                        </div>
                                        {s.note && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{s.note}</p>}
                                        <div className="mt-3"><FileList files={s.files} basePath={`/assignments/writer/assignments/${a.ref}/submissions/${s.id}/files`} onError={setError} /></div>
                                        {s.reviewNote && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-semibold">Reviewer:</span> {s.reviewNote}</p>}
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}
                </div>

                <aside className="space-y-6">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Deadline</h2>
                        <p className="mt-2 font-semibold text-[#0b1b33]">{new Date(a.writerDeadline).toLocaleString()}</p>
                        {!['APPROVED', 'CANCELLED'].includes(a.status) && <div className="mt-1"><Countdown iso={a.writerDeadline} label="" /></div>}
                    </section>
                    {d.earning && (
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Payout</h2>
                            <p className="mt-2 text-xl font-bold text-[#0b1b33]">{formatMoney(d.earning.amountMinor, d.earning.currency)}</p>
                            <p className="text-slate-600">{EARNING_STATUS_LABEL[d.earning.status]}{d.earning.paidAt ? ` · ${formatDate(d.earning.paidAt)}` : ''}</p>
                            {d.earning.adjustments.map((x, i) => <p key={i} className="mt-1 text-xs text-slate-500">{x.amountMinor > 0 ? '+' : ''}{formatMoney(x.amountMinor, d.earning!.currency)} — {x.reason}</p>)}
                        </section>
                    )}
                    {d.rating && (
                        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Rating</h2>
                            <StarRow label="Overall" value={d.rating.overall} />
                            <div className="space-y-1 border-t border-slate-100 pt-2">
                                <StarRow label="Quality" value={d.rating.quality} /><StarRow label="Accuracy" value={d.rating.accuracy} />
                                <StarRow label="Timeliness" value={d.rating.timeliness} /><StarRow label="Communication" value={d.rating.communication} />
                            </div>
                            {d.rating.comment && <p className="pt-2 text-sm text-slate-600">“{d.rating.comment}”</p>}
                        </section>
                    )}
                </aside>
            </div>
        </div>
    );
}
