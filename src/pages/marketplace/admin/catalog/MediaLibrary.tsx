import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ImageOff, Inbox, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { api, fetchFileUrl } from '../../../../lib/api';
import { formatBytes, Spinner } from '../../../../components/writer/WriterBits';
import { cn } from '../../../../lib/utils';
import { BASE, ConfirmDialog, MediaThumb, Pagination, fieldClass, type CatalogFile, type Paged } from './shared';

export type MediaItem = CatalogFile & { _id: string; alt: string; createdAt: string; uploadedBy?: string };

// Image from an admin media URL (…/media/<storedName>), fetched with the token.
export function AdminImg({ src, alt, className, token }: { src: string; alt: string; className?: string; token: string }) {
    const name = src.match(/\/media\/([^/?#]+)$/)?.[1];
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        if (!name) return;
        let live = true, made: string | null = null;
        setFailed(false);
        fetchFileUrl(`${BASE}/media/${name}`, token).then(u => { made = u; if (live) setUrl(u); else URL.revokeObjectURL(u); }).catch(() => live && setFailed(true));
        return () => { live = false; if (made) URL.revokeObjectURL(made); };
    }, [name, token]);
    if (!name || failed) return <span className={cn('flex min-h-24 items-center justify-center bg-gray-100 text-gray-400', className)}><ImageOff className="h-6 w-6" /></span>;
    return url ? <img src={url} alt={alt} className={className} /> : <span className={cn('block min-h-24 animate-pulse bg-gray-100', className)} />;
}

/**
 * The catalogue media library: upload, search, alt text, delete. With
 * `onPick` it works as a picker (click a file to choose it).
 */
export function MediaLibrary({ token, kind, onPick, pickedIds = [] }: { token: string; kind?: 'IMAGE' | 'FILE'; onPick?: (item: MediaItem) => void; pickedIds?: string[] }) {
    const [data, setData] = useState<Paged<MediaItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [kindFilter, setKindFilter] = useState<string>(kind || '');
    const [uploading, setUploading] = useState(false);
    const [notice, setNotice] = useState('');
    const [confirm, setConfirm] = useState<MediaItem | null>(null);
    const [confirmError, setConfirmError] = useState('');
    const [busy, setBusy] = useState(false);
    const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
    useEffect(() => { setPage(1); }, [debounced, kindFilter]);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        const q = new URLSearchParams({ page: String(page), limit: '24' });
        if (debounced) q.set('search', debounced);
        if (kindFilter) q.set('kind', kindFilter);
        try { setData(await api<Paged<MediaItem>>(`${BASE}/media-library?${q}`, { token })); }
        catch (e) { setError((e as Error).message); } finally { setLoading(false); }
    }, [page, debounced, kindFilter, token]);
    useEffect(() => { load(); }, [load]);

    const upload = async (files: FileList | null) => {
        if (!files?.length) return;
        const form = new FormData();
        Array.from(files).forEach(f => form.append('files', f));
        setUploading(true); setError(''); setNotice('');
        try {
            const { items } = await api<{ items: MediaItem[] }>(`${BASE}/media-library`, { method: 'POST', token, body: form });
            setNotice(`${items.length} file${items.length === 1 ? '' : 's'} uploaded.`);
            setPage(1); await load();
        } catch (e) { setError((e as Error).message); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
    };

    const saveAlt = async (item: MediaItem) => {
        const alt = altDrafts[item._id];
        if (alt === undefined || alt === item.alt) return;
        try {
            const { item: saved } = await api<{ item: MediaItem }>(`${BASE}/media-library/${item._id}`, { method: 'PATCH', token, body: { alt } });
            setData(d => d && { ...d, items: d.items.map(i => (i._id === saved._id ? saved : i)) });
            setAltDrafts(({ [item._id]: _, ...rest }) => rest);
        } catch (e) { setError((e as Error).message); }
    };

    const remove = async () => {
        if (!confirm) return;
        setBusy(true); setConfirmError('');
        try { await api(`${BASE}/media-library/${confirm._id}`, { method: 'DELETE', token }); setConfirm(null); load(); }
        catch (e) { setConfirmError((e as Error).message); } finally { setBusy(false); }
    };

    const items = data?.items || [];
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by file name or alt text…" aria-label="Search media" className={cn(fieldClass, 'pl-10')} />
                </div>
                <div className="flex items-center gap-2">
                    {!kind && (
                        <select aria-label="File type" value={kindFilter} onChange={e => setKindFilter(e.target.value)} className={cn(fieldClass, 'w-auto')}>
                            <option value="">All files</option><option value="IMAGE">Images</option><option value="FILE">Documents</option>
                        </select>
                    )}
                    <button onClick={load} aria-label="Refresh media" className="rounded-xl border border-gray-200 bg-white p-2.5 hover:bg-gray-50"><RefreshCw className="h-4 w-4 text-gray-500" /></button>
                    <label className={cn('inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white', uploading && 'pointer-events-none opacity-50')}>
                        {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />} {uploading ? 'Uploading…' : 'Upload'}
                        <input ref={fileRef} type="file" multiple className="sr-only" aria-label="Upload media"
                            accept={kind === 'IMAGE' ? 'image/png,image/jpeg,image/webp,image/gif' : undefined} onChange={e => upload(e.target.files)} />
                    </label>
                </div>
            </div>
            <p className="text-xs text-gray-400">Images up to 5 MB (PNG, JPG, WebP, GIF); documents up to 25 MB. Files only become public once used on a live page.</p>
            {notice && <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{notice}</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

            {loading && !data ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>
                : items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center text-gray-400">
                        <Inbox className="mx-auto mb-3 h-10 w-10 opacity-40" />
                        <p className="font-semibold">{debounced ? 'No files match' : 'No media yet'}</p>
                        {!debounced && <p className="mt-1 text-sm">Upload images to use them in content blocks and social previews.</p>}
                    </div>
                ) : (
                    <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', onPick ? 'lg:grid-cols-4' : 'lg:grid-cols-4 2xl:grid-cols-6', loading && 'opacity-60')}>
                        {items.map(item => {
                            const picked = pickedIds.includes(item._id);
                            return (
                                <li key={item._id} className={cn('overflow-hidden rounded-2xl border bg-white shadow-sm', picked ? 'border-[#fea520] ring-2 ring-[#fea520]/40' : 'border-gray-100')}>
                                    <button type="button" disabled={!onPick} onClick={() => onPick?.(item)} aria-label={onPick ? `Choose ${item.originalName}` : item.originalName}
                                        className={cn('relative block w-full', onPick && 'cursor-pointer hover:opacity-90')}>
                                        <MediaThumb file={item} token={token} className="aspect-[4/3] w-full rounded-none" />
                                        {picked && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#fea520] text-[#000a1e]"><Check className="h-4 w-4" /></span>}
                                    </button>
                                    <div className="space-y-2 p-3">
                                        <p className="truncate text-xs font-semibold text-[#000a1e]" title={item.originalName}>{item.originalName}</p>
                                        <p className="text-[11px] text-gray-400">{item.kind === 'IMAGE' ? 'Image' : 'Document'} · {formatBytes(item.size)}</p>
                                        {item.kind === 'IMAGE' && (
                                            <input value={altDrafts[item._id] ?? item.alt} onChange={e => setAltDrafts(d => ({ ...d, [item._id]: e.target.value }))}
                                                onBlur={() => saveAlt(item)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                                                placeholder="Alt text (for SEO)" aria-label={`Alt text for ${item.originalName}`} maxLength={200}
                                                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#fea520] focus:outline-none" />
                                        )}
                                        {!onPick && (
                                            <button type="button" onClick={() => { setConfirm(item); setConfirmError(''); }} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline">
                                                <Trash2 className="h-3.5 w-3.5" /> Delete
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            {data && <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />}

            {confirm && (
                <ConfirmDialog title="Delete file?" busy={busy} error={confirmError}
                    message={<>“{confirm.originalName}” will be permanently deleted. Files still used by a block or SEO image can’t be deleted.</>}
                    onConfirm={remove} onCancel={() => setConfirm(null)} />
            )}
        </div>
    );
}

// Modal wrapper for choosing a file from the library.
export function MediaPicker({ token, kind = 'IMAGE', title = 'Choose an image', pickedIds, onPick, onClose }: {
    token: string; kind?: 'IMAGE' | 'FILE'; title?: string; pickedIds?: string[]; onPick: (item: MediaItem) => void; onClose: () => void;
}) {
    useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); }, [onClose]);
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
            <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
            <div className="relative flex max-h-full w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <h2 className="text-lg font-bold text-[#000a1e]">{title}</h2>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="overflow-y-auto p-5"><MediaLibrary token={token} kind={kind} onPick={onPick} pickedIds={pickedIds} /></div>
            </div>
        </div>
    );
}
