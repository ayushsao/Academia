import React, { useState } from 'react';
import { FileText, Upload, Trash2, ExternalLink, Globe, Lock, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { api, openProtectedFile } from '../../../lib/api';
import type { WriterDocumentData, WriterMe } from '../../../lib/writerTypes';
import { DOCUMENT_TYPES, type DocumentType } from '../../../lib/writerOptions';
import { Notice, inputClass } from '../../../components/writer/FormKit';
import { Spinner, formatBytes } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

const REVIEW_META = {
    PENDING: { label: 'Awaiting check', icon: Clock, className: 'text-slate-500' },
    VERIFIED: { label: 'Verified', icon: CheckCircle2, className: 'text-emerald-600' },
    REJECTED: { label: 'Not accepted', icon: XCircle, className: 'text-red-600' },
};

function DocumentRow({ doc, locked, onUpdate }: { doc: WriterDocumentData; locked: boolean; onUpdate: (w: WriterMe) => void }) {
    const [busy, setBusy] = useState<'open' | 'delete' | 'visibility' | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState('');
    const review = REVIEW_META[doc.reviewStatus];

    const run = async (kind: 'open' | 'delete' | 'visibility') => {
        setBusy(kind); setError('');
        try {
            if (kind === 'open') await openProtectedFile(`/writers/documents/${doc.id}/file`);
            if (kind === 'delete') onUpdate((await api<{ writer: WriterMe }>(`/writers/documents/${doc.id}`, { method: 'DELETE' })).writer);
            if (kind === 'visibility') onUpdate((await api<{ writer: WriterMe }>(`/writers/documents/${doc.id}`, { method: 'PATCH', body: { isPublic: !doc.isPublic } })).writer);
        } catch (err) { setError((err as Error).message); } finally { setBusy(null); setConfirming(false); }
    };

    return (
        <li className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#002147]" />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#0b1b33]" title={doc.originalName}>{doc.title || doc.originalName}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{formatBytes(doc.size)}</span>
                        <span className={cn('inline-flex items-center gap-1 font-medium', review.className)}><review.icon className="h-3.5 w-3.5" />{review.label}</span>
                        {doc.type === 'WRITING_SAMPLE' && (doc.isPublic
                            ? <span className="inline-flex items-center gap-1 font-medium text-sky-700"><Globe className="h-3.5 w-3.5" />Shown on profile</span>
                            : <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" />Private</span>)}
                    </p>
                    {doc.reviewNote && <p className="mt-1 text-xs text-red-700">{doc.reviewNote}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => run('open')} disabled={busy !== null} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#002147]" aria-label="Open document">
                        {busy === 'open' ? <Spinner className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                    </button>
                    {!locked && !confirming && (
                        <button type="button" onClick={() => setConfirming(true)} disabled={busy !== null} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete document"><Trash2 className="h-4 w-4" /></button>
                    )}
                </div>
            </div>
            {confirming && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm">
                    <span className="font-medium text-red-800">Delete this file?</span>
                    <button type="button" onClick={() => run('delete')} className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white">{busy === 'delete' ? 'Deleting…' : 'Delete'}</button>
                    <button type="button" onClick={() => setConfirming(false)} className="rounded-md px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-white">Cancel</button>
                </div>
            )}
            {doc.type === 'WRITING_SAMPLE' && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                    <input type="checkbox" checked={doc.isPublic} disabled={busy !== null} onChange={() => run('visibility')} className="h-4 w-4 accent-[#002147]" />
                    Show this sample on my public profile
                </label>
            )}
            {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        </li>
    );
}

function UploadCard({ type, docs, locked, onUpdate }: {
    type: typeof DOCUMENT_TYPES[number]; docs: WriterDocumentData[]; locked: boolean; onUpdate: (w: WriterMe) => void;
}) {
    const [title, setTitle] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const inputId = `doc-${type.value}`;

    const upload = async (file?: File) => {
        if (!file) return;
        const form = new FormData();
        form.append('type', type.value);
        if (title.trim()) form.append('title', title.trim());
        if (type.value === 'WRITING_SAMPLE') form.append('isPublic', String(isPublic));
        form.append('file', file);
        setBusy(true); setError('');
        try {
            onUpdate((await api<{ writer: WriterMe }>('/writers/documents', { method: 'POST', body: form })).writer);
            setTitle('');
        } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    };

    return (
        <div className={cn('rounded-2xl border p-4 sm:p-5', type.required && docs.length === 0 ? 'border-[#fea520]/60 bg-[#fea520]/[0.04]' : 'border-slate-200')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h4 className="font-bold text-[#0b1b33]">{type.label}{type.required && <span className="ml-2 rounded-full bg-[#fea520]/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#8a5200]">Required</span>}</h4>
                    <p className="mt-0.5 text-xs text-slate-500">{type.hint}</p>
                </div>
            </div>

            {docs.length > 0 && <ul className="mt-4 space-y-2">{docs.map(d => <React.Fragment key={d.id}><DocumentRow doc={d} locked={locked} onUpdate={onUpdate} /></React.Fragment>)}</ul>}

            {!locked && (
                <div className="mt-4 space-y-3">
                    {type.value !== 'RESUME' && (
                        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Title (optional), e.g. “Literature review — nursing ethics”" className={cn(inputClass, 'py-2.5 text-sm')} />
                    )}
                    {type.value === 'WRITING_SAMPLE' && (
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="h-4 w-4 accent-[#002147]" />
                            Show on my public profile once I’m approved
                        </label>
                    )}
                    <input id={inputId} type="file" accept={type.accept} className="sr-only" disabled={busy}
                        onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
                    <label htmlFor={inputId} className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-4 text-sm font-semibold text-[#002147] transition hover:border-[#002147] hover:bg-slate-50', busy && 'pointer-events-none opacity-60')}>
                        {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />} {busy ? 'Uploading…' : docs.length ? 'Upload another file' : 'Choose a file'}
                    </label>
                    {error && <p className="text-xs font-medium text-red-600">{error}</p>}
                </div>
            )}
        </div>
    );
}

export default function DocumentsManager({ writer, onUpdate }: { writer: WriterMe; onUpdate: (w: WriterMe) => void }) {
    const locked = !writer.onboarding.canEdit;
    const byType = (t: DocumentType) => writer.documents.filter(d => d.type === t);
    return (
        <div className="space-y-5">
            {locked && <Notice tone="warning">Documents can’t be changed while your application is in review.</Notice>}
            <p className="text-sm text-slate-600">Files are stored privately and are only visible to you and our review team, except writing samples you choose to publish. Only upload work you own the rights to.</p>
            <div className="grid gap-4 lg:grid-cols-2">
                {DOCUMENT_TYPES.map(t => <React.Fragment key={t.value}><UploadCard type={t} docs={byType(t.value)} locked={locked} onUpdate={onUpdate} /></React.Fragment>)}
            </div>
        </div>
    );
}
