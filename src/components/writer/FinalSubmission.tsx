import React, { useRef, useState } from 'react';
import { CheckCircle2, XCircle, Upload, Loader2, Trash2, Send } from 'lucide-react';
import { API } from '../../lib/api';
import { SUBMISSION_KINDS, type SubmissionKind } from '../../lib/submissionKinds';
import { showConfirm } from '../../lib/dialog';

export type DraftFile = { _id: string; kind: SubmissionKind; originalName: string; size: number; uploadedAt: string };

const sizeLabel = (bytes: number) => (bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

// Writer's final submission for a customer order: each of the three required
// files is uploaded on its own; "Submit to Client" is enabled only when all
// three are on the server (which checks this again when submitting).
export function FinalSubmission({ orderId, token, draft, onDraft, onSubmitted }: {
    orderId: string;
    token?: string | null;
    draft: DraftFile[];
    onDraft: (files: DraftFile[]) => void;
    onSubmitted: () => void;
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState('');
    const inputs = useRef<Record<string, HTMLInputElement | null>>({});
    const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});
    const has = (kind: SubmissionKind) => draft.find(f => f.kind === kind);
    const complete = SUBMISSION_KINDS.every(k => has(k.kind));

    const call = async (method: string, path: string, body?: BodyInit) => {
        const res = await fetch(`${API}/order-workflow${path}`, { method, headers: headers(), credentials: 'include', body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
        return data;
    };

    const upload = async (slug: string, file?: File) => {
        if (!file) return;
        setBusy(slug); setError('');
        try {
            const form = new FormData();
            form.append('file', file);
            const data = await call('POST', `/writer/submission/${encodeURIComponent(orderId)}/${slug}`, form);
            onDraft(data.draftDelivery || []);
        } catch (e: any) { setError(e.message); }
        finally { setBusy(null); if (inputs.current[slug]) inputs.current[slug]!.value = ''; }
    };
    const remove = async (slug: string) => {
        setBusy(slug); setError('');
        try { onDraft((await call('DELETE', `/writer/submission/${encodeURIComponent(orderId)}/${slug}`)).draftDelivery || []); }
        catch (e: any) { setError(e.message); }
        finally { setBusy(null); }
    };
    const submit = async () => {
        if (!complete) { setError('Please upload all 3 required files before submitting the order.'); return; }
        if (!(await showConfirm('Submit these 3 files? Our team checks them and then sends them to the client.'))) return;
        setBusy('submit'); setError('');
        try { await call('POST', `/writer/submit/${encodeURIComponent(orderId)}`); onSubmitted(); }
        catch (e: any) { setError(e.message); }
        finally { setBusy(null); }
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-bold text-[#0b1b33]">Final Submission</h4>
            <p className="mt-0.5 text-xs text-slate-500">Upload all three files. You can replace a file until you submit.</p>

            <div className="mt-4 space-y-3">
                {SUBMISSION_KINDS.map(k => {
                    const file = has(k.kind);
                    return (
                        <div key={k.kind} className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center ${file ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[#0b1b33]">{k.label} <span className="text-red-600" aria-hidden>*</span> <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600">Required</span></p>
                                <p className="truncate text-xs text-slate-500">{file ? `${file.originalName} · ${sizeLabel(file.size)}` : k.formats}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <input ref={el => { inputs.current[k.slug] = el; }} type="file" accept={k.accept} className="hidden" aria-label={`Upload ${k.label}`}
                                    onChange={e => upload(k.slug, e.target.files?.[0])} />
                                <button type="button" disabled={busy !== null} onClick={() => inputs.current[k.slug]?.click()}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#002147] hover:bg-slate-50 disabled:opacity-50">
                                    {busy === k.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                    {file ? 'Replace' : `Upload ${k.label}`}
                                </button>
                                {file && (
                                    <button type="button" disabled={busy !== null} onClick={() => remove(k.slug)} aria-label={`Remove ${k.label}`}
                                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Status */}
            <ul className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm" aria-label="Upload status">
                {SUBMISSION_KINDS.map(k => (
                    <li key={k.kind} className="flex items-center justify-between">
                        <span className="text-slate-700">{k.short}</span>
                        {has(k.kind)
                            ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Uploaded</span>
                            : <span className="inline-flex items-center gap-1 font-semibold text-red-600"><XCircle className="h-4 w-4" /> Required</span>}
                    </li>
                ))}
            </ul>

            {!complete && <p className="mt-3 text-xs font-semibold text-red-600">Please upload all 3 required files before submitting the order.</p>}
            {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}

            <button type="button" onClick={submit} disabled={!complete || busy !== null}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit to Client
            </button>
        </section>
    );
}
