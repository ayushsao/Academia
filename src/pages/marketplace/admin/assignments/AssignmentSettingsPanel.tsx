import React, { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { Spinner } from '../../../../components/writer/WriterBits';
import { inputClass } from '../../../../components/writer/FormKit';
import { cn } from '../../../../lib/utils';

type S = Record<string, any>;

const MODES = [
    { v: 'MANUAL', label: 'Manual', text: 'Admins choose which writer receives each offer.' },
    { v: 'AUTOMATIC', label: 'Automatic', text: 'The best-matched eligible writer is offered first; on decline or expiry the next one is offered.' },
    { v: 'HYBRID', label: 'Hybrid', text: 'A shortlist of top matches is offered at once; the first to accept gets it. Admins can also offer directly.' },
];

function Num({ label, value, onChange, hint, step = 1 }: { label: string; value: number; onChange: (n: number) => void; hint?: string; step?: number }) {
    return (
        <label className="block text-sm">
            <span className="font-semibold text-gray-700">{label}</span>
            <input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} className={cn(inputClass, 'mt-1 py-2 tabular-nums')} />
            {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
        </label>
    );
}

function Weights({ title, hint, value, onChange, labels }: { title: string; hint?: string; value: Record<string, number>; onChange: (v: Record<string, number>) => void; labels: Record<string, string> }) {
    const total = Object.values(value).reduce((a, b) => a + b, 0) || 1;
    return (
        <div>
            <p className="text-sm font-semibold text-gray-700">{title}</p>
            {hint && <p className="text-xs text-gray-500">{hint}</p>}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {Object.entries(labels).map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                        <span className="w-28 text-gray-600">{l}</span>
                        <input type="number" min={0} max={100} value={value[k] ?? 0} onChange={e => onChange({ ...value, [k]: Number(e.target.value) })} className={cn(inputClass, 'w-20 py-1.5 tabular-nums')} aria-label={`${title}: ${l}`} />
                        <span className="w-12 text-right text-xs tabular-nums text-gray-400">{Math.round(((value[k] ?? 0) / total) * 100)}%</span>
                    </label>
                ))}
            </div>
        </div>
    );
}

export default function AssignmentSettingsPanel({ token }: { token: string }) {
    const [s, setS] = useState<S | null>(null);
    const [formats, setFormats] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    useEffect(() => { api<{ settings: S; supportedFormats: string[] }>('/admin/assignments/settings', { token }).then(d => { setS(d.settings); setFormats(d.supportedFormats); }).catch(e => setMsg({ ok: false, text: e.message })); }, [token]);
    if (!s) return msg ? <p className="text-sm text-red-600">{msg.text}</p> : <div className="flex justify-center py-12"><Spinner className="h-7 w-7 text-[#fea520]" /></div>;
    const set = (k: string, v: any) => { setS({ ...s, [k]: v }); setMsg(null); };
    const save = async () => {
        setBusy(true); setMsg(null);
        try { setS((await api<{ settings: S }>('/admin/assignments/settings', { method: 'PUT', token, body: s })).settings); setMsg({ ok: true, text: 'Settings saved.' }); }
        catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
    };
    const card = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm';

    return (
        <div className="space-y-5">
            <section className={card}>
                <h3 className="font-bold text-[#000a1e]">Allocation mode</h3>
                <p className="text-sm text-gray-500">Default for new assignments; each assignment can override it.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {MODES.map(m => (
                        <button key={m.v} onClick={() => set('allocationMode', m.v)} aria-pressed={s.allocationMode === m.v}
                            className={cn('rounded-xl border p-4 text-left', s.allocationMode === m.v ? 'border-[#000a1e] ring-2 ring-[#000a1e]/10' : 'border-gray-200')}>
                            <span className="block font-semibold text-[#000a1e]">{m.label}</span><span className="text-sm text-gray-500">{m.text}</span>
                        </button>
                    ))}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Num label="Offer response window (hours)" value={s.offerTtlHours} onChange={v => set('offerTtlHours', v)} />
                    <Num label="Hybrid shortlist size" value={s.hybridShortlistSize} onChange={v => set('hybridShortlistSize', v)} />
                    <Num label="Allocation rounds before hand-back" value={s.autoMaxAttempts} onChange={v => set('autoMaxAttempts', v)} />
                </div>
            </section>

            <section className={card}>
                <h3 className="font-bold text-[#000a1e]">Eligibility rules</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <Num label="Default workload (concurrent)" value={s.defaultWorkloadLimit} onChange={v => set('defaultWorkloadLimit', v)} />
                    <Num label="Maximum workload a writer can choose" value={s.maxWorkloadLimit} onChange={v => set('maxWorkloadLimit', v)} />
                    <Num label="New-writer grace (completed jobs)" value={s.newWriterGrace} onChange={v => set('newWriterGrace', v)} hint="Quality/rating floors apply after this many completions." />
                    <Num label="Minimum quality score" value={s.minQualityScore} onChange={v => set('minQualityScore', v)} />
                    <Num label="Minimum rating" step={0.1} value={s.minRating} onChange={v => set('minRating', v)} />
                    <label className="flex items-center gap-2 self-center text-sm"><input type="checkbox" checked={s.requireSubjectMatch} onChange={e => set('requireSubjectMatch', e.target.checked)} className="h-4 w-4 accent-[#000a1e]" /> Require subject match</label>
                </div>
            </section>

            <section className={card}>
                <Weights title="Matching weights" hint="Membership weight is capped at 15 — it can influence ordering but never replaces eligibility or guarantees work." value={s.weights} onChange={v => set('weights', v)}
                    labels={{ subject: 'Subject', skills: 'Skills', quality: 'Quality', rating: 'Rating', performance: 'Performance', workload: 'Workload', timezone: 'Time zone', membership: 'Membership' }} />
            </section>

            <section className={card}>
                <h3 className="font-bold text-[#000a1e]">Submissions & revisions</h3>
                <p className="mt-2 text-sm font-semibold text-gray-700">Accepted formats</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {formats.map(f => {
                        const on = s.submission.allowedFormats.includes(f);
                        return <button key={f} aria-pressed={on} onClick={() => set('submission', { ...s.submission, allowedFormats: on ? s.submission.allowedFormats.filter((x: string) => x !== f) : [...s.submission.allowedFormats, f] })}
                            className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold uppercase', on ? 'border-[#000a1e] bg-[#000a1e] text-white' : 'border-gray-200 text-gray-600')}>{f}</button>;
                    })}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-4">
                    <Num label="Max file size (MB)" value={s.submission.maxFileMB} onChange={v => set('submission', { ...s.submission, maxFileMB: v })} />
                    <Num label="Max files per submission" value={s.submission.maxFiles} onChange={v => set('submission', { ...s.submission, maxFiles: v })} />
                    <Num label="Default revision time (hours)" value={s.revisionHours} onChange={v => set('revisionHours', v)} />
                    <Num label="Max revision rounds" value={s.maxRevisions} onChange={v => set('maxRevisions', v)} />
                </div>
            </section>

            <section className={cn(card, 'space-y-5')}>
                <h3 className="font-bold text-[#000a1e]">Ratings & quality score</h3>
                <Weights title="Overall rating weights" hint="Timeliness is always computed from submission times." value={s.ratingWeights} onChange={v => set('ratingWeights', v)}
                    labels={{ quality: 'Quality', accuracy: 'Accuracy', timeliness: 'Timeliness', communication: 'Communication' }} />
                <div className="grid gap-4 sm:grid-cols-3">
                    <Num label="Rating prior mean" step={0.1} value={s.ratingPrior.mean} onChange={v => set('ratingPrior', { ...s.ratingPrior, mean: v })} hint="Bayesian smoothing target" />
                    <Num label="Rating prior weight" value={s.ratingPrior.weight} onChange={v => set('ratingPrior', { ...s.ratingPrior, weight: v })} hint="Ratings needed to outweigh the prior" />
                    <Num label="Rating edit window (days)" value={s.ratingEditWindowDays} onChange={v => set('ratingEditWindowDays', v)} />
                </div>
                <Weights title="Internal quality score weights" value={s.qualityWeights} onChange={v => set('qualityWeights', v)}
                    labels={{ rating: 'Rating', onTime: 'On-time', completion: 'Completion', revisions: 'Few revisions', response: 'Response rate' }} />
            </section>

            <div className="flex items-center gap-3">
                <button onClick={save} disabled={busy} className="rounded-xl bg-[#000a1e] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save settings'}</button>
                {msg && <p className={cn('text-sm font-medium', msg.ok ? 'text-emerald-700' : 'text-red-600')}>{msg.text}</p>}
            </div>
        </div>
    );
}
