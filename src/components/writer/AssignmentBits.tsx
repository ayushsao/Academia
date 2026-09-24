import React from 'react';
import { Clock, FileText, Download } from 'lucide-react';
import { ASSIGNMENT_STATUS_META, timeLeft, type AssignmentStatus, type FileRef } from '../../lib/assignmentTypes';
import { openProtectedFile } from '../../lib/api';
import { formatBytes } from './WriterBits';
import { cn } from '../../lib/utils';

export function AssignmentBadge({ status, className }: { status: AssignmentStatus; className?: string }) {
    const m = ASSIGNMENT_STATUS_META[status] || { label: status, className: 'bg-slate-100 text-slate-600 ring-slate-200' };
    return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', m.className, className)}>{m.label}</span>;
}

export function Countdown({ iso, label = 'Due' }: { iso?: string; label?: string }) {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    const tone = ms < 0 ? 'text-red-700' : ms < 24 * 3_600_000 ? 'text-amber-700' : 'text-slate-600';
    return (
        <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', tone)} title={new Date(iso).toLocaleString()}>
            <Clock className="h-4 w-4" /> {label} {new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {timeLeft(iso)}
        </span>
    );
}

// File list whose links fetch with auth headers (files are never public).
export function FileList({ files, basePath, token, onError }: { files: FileRef[]; basePath: string; token?: string; onError?: (m: string) => void }) {
    if (!files.length) return <p className="text-sm text-slate-500">No files.</p>;
    return (
        <ul className="space-y-2">
            {files.map(f => (
                <li key={f.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-[#002147]" />
                    <span className="min-w-0 flex-1 truncate font-medium text-[#0b1b33]" title={f.name}>{f.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatBytes(f.size)}</span>
                    <button type="button" aria-label={`Download ${f.name}`} onClick={() => openProtectedFile(`${basePath}/${f.id}?download=1`, token).catch(e => onError?.(e.message))}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#002147]"><Download className="h-4 w-4" /></button>
                </li>
            ))}
        </ul>
    );
}

export function StarRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600">{label}</span>
            <span className="flex items-center gap-2">
                <span className="flex" aria-hidden>{[1, 2, 3, 4, 5].map(i => <span key={i} className={cn('text-base leading-none', i <= Math.round(value) ? 'text-[#f39200]' : 'text-slate-200')}>★</span>)}</span>
                <span className="w-8 text-right font-semibold tabular-nums text-[#0b1b33]">{value.toFixed(value % 1 ? 2 : 0)}</span>
            </span>
        </div>
    );
}
