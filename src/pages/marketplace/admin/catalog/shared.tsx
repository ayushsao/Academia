import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import { api, fetchFileUrl } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';

// ── Types (mirror /api/admin/catalog responses) ────────────────────────────────
export type CatalogStatus = 'ACTIVE' | 'INACTIVE';
export type CatalogFile = { _id?: string; storedName: string; originalName: string; mimeType: string; size: number; kind: 'IMAGE' | 'FILE' };
export type Ref = { id: string; name: string; status: CatalogStatus; published?: boolean } | null;
type Base = { _id: string; slug: string; description: string; status: CatalogStatus; published: boolean; publishedAt?: string; sortOrder: number; createdAt: string; updatedAt: string };
export type Subject = Base & { name: string; image: CatalogFile | null; servicesCount?: number; projectsCount?: number };
export type Service = Base & { name: string; subjectId: string; subject?: Ref; projectsCount?: number };
export type Project = Base & { title: string; subjectId: string; serviceId: string; subject?: Ref; service?: Ref; files: CatalogFile[] };
export type PricingRule = {
    _id: string; subjectId: string; serviceId: string | null; projectId: string | null; label: string; wordsPerPage: number | null;
    basePriceMinor: number; basePrice: number; multiplier: number; currency: string; formula: string; effectiveDate: string; status: CatalogStatus;
    unitPriceMinor: number; subject: Ref; service: Ref; project: Ref; state: 'IN_EFFECT' | 'SCHEDULED' | 'SUPERSEDED' | 'INACTIVE'; updatedAt: string;
};
export type Options = {
    subjects: { _id: string; name: string; status: CatalogStatus; published: boolean }[];
    services: { _id: string; name: string; subjectId: string; status: CatalogStatus; published: boolean }[];
    projects: { _id: string; title: string; subjectId: string; serviceId: string; status: CatalogStatus; published: boolean }[];
};
export type Paged<T> = { total: number; page: number; limit: number; items: T[] };

export const BASE = '/admin/catalog';

// Dropdown data shared by the sections; `reload` after creating parents.
export function useCatalogOptions(token: string) {
    const [options, setOptions] = useState<Options>({ subjects: [], services: [], projects: [] });
    const reload = useCallback(() => api<Options>(`${BASE}/options`, { token }).then(setOptions).catch(() => {}), [token]);
    useEffect(() => { reload(); }, [reload]);
    return { options, reload };
}

// ── Small UI pieces ────────────────────────────────────────────────────────────

export function Switch({ checked, onChange, label, disabled, tone = 'navy' }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; tone?: 'navy' | 'green' }) {
    return (
        <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled} onClick={() => onChange(!checked)}
            className={cn('relative inline-block h-6 w-11 shrink-0 rounded-full transition', checked ? (tone === 'green' ? 'bg-emerald-500' : 'bg-[#000a1e]') : 'bg-gray-300', disabled && 'opacity-50')}>
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
        </button>
    );
}

export const StatusPill = ({ status }: { status: CatalogStatus }) => (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200')}>
        {status === 'ACTIVE' ? 'Active' : 'Inactive'}
    </span>
);

export const PublishPill = ({ published }: { published: boolean }) => (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', published ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200')}>
        {published ? 'Published' : 'Draft'}
    </span>
);

// Shows why an item is hidden publicly even though it's published (parent off).
export function visibilityNote(item: { status: CatalogStatus; published: boolean }, parents: Ref[] = []) {
    if (item.status !== 'ACTIVE') return 'Inactive — hidden from the site';
    if (!item.published) return 'Draft — not on the site yet';
    const off = parents.find(p => p && (p.status !== 'ACTIVE' || p.published === false));
    return off ? `Hidden: “${off.name}” is ${off.status !== 'ACTIVE' ? 'inactive' : 'unpublished'}` : 'Live on the site';
}

export function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
    const pages = Math.max(1, Math.ceil(total / limit));
    if (total <= limit) return <p className="px-1 text-xs text-gray-400">{total} {total === 1 ? 'item' : 'items'}</p>;
    return (
        <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
            <span className="text-xs text-gray-400">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
            <div className="flex items-center gap-2">
                <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page" className="rounded-lg border border-gray-200 bg-white p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <span className="tabular-nums">Page {page} of {pages}</span>
                <button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page" className="rounded-lg border border-gray-200 bg-white p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
        </div>
    );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', busy, error, onConfirm, onCancel }: {
    title: string; message: React.ReactNode; confirmLabel?: string; busy?: boolean; error?: string; onConfirm: () => void; onCancel: () => void;
}) {
    useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onCancel]);
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
            <div className="absolute inset-0 bg-slate-900/40" onClick={onCancel} />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-[#000a1e]">{title}</h2>
                <div className="mt-2 text-sm text-gray-600">{message}</div>
                {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="mt-5 flex justify-end gap-2">
                    <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button onClick={onConfirm} disabled={busy} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Working…' : confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

export function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
    useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
            <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <h2 className="text-lg font-bold text-[#000a1e]">{title}</h2>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
                {footer && <div className="border-t border-gray-100 px-5 py-4">{footer}</div>}
            </div>
        </div>
    );
}

// Catalogue media behind admin auth (drafts included): fetched as a blob.
export function MediaThumb({ file, token, className }: { file: CatalogFile; token: string; className?: string }) {
    const [url, setUrl] = useState<string | null>(null);
    const [broken, setBroken] = useState(false);
    useEffect(() => {
        if (file.kind !== 'IMAGE' || broken) return;
        let live = true, made: string | null = null;
        fetchFileUrl(`${BASE}/media/${file.storedName}`, token).then(u => { made = u; if (live) setUrl(u); else URL.revokeObjectURL(u); }).catch(() => {});
        return () => { live = false; if (made) URL.revokeObjectURL(made); };
    }, [file.storedName, file.kind, token]);
    if (file.kind !== 'IMAGE') return <span className={cn('flex items-center justify-center rounded-lg bg-gray-100 text-gray-400', className)}><FileText className="h-5 w-5" /></span>;
    return url ? <img src={url} alt={file.originalName} onError={() => setBroken(true)} className={cn('rounded-lg object-cover', className)} /> : <span className={cn('block animate-pulse rounded-lg bg-gray-100', className)} />;
}

export const fieldClass = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-[#000a1e] placeholder:text-gray-400 focus:border-[#fea520] focus:outline-none focus:ring-2 focus:ring-[#fea520]/20 disabled:bg-gray-50';
export const Label = ({ children, hint, htmlFor }: { children: React.ReactNode; hint?: string; htmlFor?: string }) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-gray-600">{children}{hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}</label>
);
