import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search, RefreshCw, Pencil, Trash2, Inbox } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Spinner } from '../../../../components/writer/WriterBits';
import { cn } from '../../../../lib/utils';
import { BASE, ConfirmDialog, Drawer, Pagination, Switch, fieldClass, type Paged, type CatalogStatus } from './shared';

export type Column<T> = { key: string; header: string; render: (row: T) => React.ReactNode; className?: string };
export type FilterDef = { key: string; label: string; options: { value: string; label: string }[] };
type Row = { _id: string; status: CatalogStatus; published?: boolean };

export type FormApi<V> = {
    value: V; set: (patch: Partial<V>) => void; editing: Row | null; token: string;
    /** For sub-resources saved immediately (images/files): replace the edited item. */
    onItemChange: (item: any) => void;
};

/**
 * Generic list + editor for one catalogue entity. Handles search, filters,
 * pagination, loading/error/empty states, add/edit drawer, delete confirmation,
 * active/inactive and publish toggles. Entity specifics come in as props.
 */
export default function CrudSection<T extends Row, V extends Record<string, any>>({
    token, path, noun, publishable = true, nameOf, columns, filters = [], sorts, emptyValue, fromItem, toBody, renderForm,
    canSave = () => true, afterSave, rowActions, intro, createDisabledReason,
}: {
    token: string; path: string; noun: string; publishable?: boolean; nameOf: (row: T) => string;
    columns: Column<T>[]; filters?: FilterDef[]; sorts?: [string, string][];
    emptyValue: V; fromItem: (item: T) => V; toBody: (v: V) => Record<string, unknown>;
    renderForm: (f: FormApi<V>) => React.ReactNode; canSave?: (v: V) => boolean;
    afterSave?: () => void; rowActions?: (row: T) => React.ReactNode; intro?: React.ReactNode; createDisabledReason?: string;
}) {
    const [data, setData] = useState<Paged<T> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [status, setStatus] = useState('');
    const [published, setPublished] = useState('');
    const [sort, setSort] = useState(sorts?.[0]?.[0] || 'order');
    const [editing, setEditing] = useState<{ item: T | null; value: V } | null>(null);
    const [formError, setFormError] = useState('');
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState<T | null>(null);
    const [confirmError, setConfirmError] = useState('');
    const [busyRow, setBusyRow] = useState<string | null>(null);

    useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
    useEffect(() => { setPage(1); }, [debounced, filterValues, status, published, sort]);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        const q = new URLSearchParams({ page: String(page), limit: '20', sort });
        if (debounced) q.set('search', debounced);
        if (status) q.set('status', status);
        if (publishable && published) q.set('published', published);
        Object.entries(filterValues).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
        try { setData(await api<Paged<T>>(`${BASE}${path}?${q}`, { token })); }
        catch (e) { setError((e as Error).message); } finally { setLoading(false); }
    }, [page, sort, debounced, status, published, filterValues, path, token, publishable]);
    useEffect(() => { load(); }, [load]);

    const replaceRow = (item: T) => setData(d => d && { ...d, items: d.items.map(r => (r._id === item._id ? { ...r, ...item } : r)) });

    const toggle = async (row: T, kind: 'status' | 'publish', on: boolean) => {
        setBusyRow(row._id); setError('');
        try {
            const body = kind === 'status' ? { status: on ? 'ACTIVE' : 'INACTIVE' } : { published: on };
            replaceRow((await api<{ item: T }>(`${BASE}${path}/${row._id}/${kind}`, { method: 'PATCH', token, body })).item);
        } catch (e) { setError((e as Error).message); } finally { setBusyRow(null); }
    };

    const save = async () => {
        if (!editing) return;
        setSaving(true); setFormError(''); setNotice('');
        try {
            const body = toBody(editing.value);
            if (editing.item) {
                const { item } = await api<{ item: T }>(`${BASE}${path}/${editing.item._id}`, { method: 'PUT', token, body });
                setEditing({ item, value: fromItem(item) }); setNotice('Saved.');
            } else {
                const { item } = await api<{ item: T }>(`${BASE}${path}`, { method: 'POST', token, body });
                // Stay open in edit mode so images/files can be attached right away.
                setEditing({ item, value: fromItem(item) }); setNotice(`${noun[0].toUpperCase()}${noun.slice(1)} created.`);
            }
            load(); afterSave?.();
        } catch (e) { setFormError((e as Error).message); } finally { setSaving(false); }
    };

    const remove = async () => {
        if (!confirm) return;
        setBusyRow(confirm._id); setConfirmError('');
        try {
            await api(`${BASE}${path}/${confirm._id}`, { method: 'DELETE', token });
            setConfirm(null); load(); afterSave?.();
        } catch (e) { setConfirmError((e as Error).message); } finally { setBusyRow(null); }
    };

    const items = data?.items || [];
    const activeFilters = Object.values(filterValues).filter(Boolean).length + (status ? 1 : 0) + (published ? 1 : 0);

    const toggles = (row: T) => (
        <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><Switch checked={row.status === 'ACTIVE'} tone="green" disabled={busyRow === row._id} label={`${nameOf(row)}: active`} onChange={on => toggle(row, 'status', on)} />Active</span>
            {publishable && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Switch checked={!!row.published} disabled={busyRow === row._id} label={`${nameOf(row)}: published`} onChange={on => toggle(row, 'publish', on)} />Published</span>}
        </div>
    );
    const actions = (row: T) => (
        <div className="flex items-center justify-end gap-1">
            {rowActions?.(row)}
            <button onClick={() => { setEditing({ item: row, value: fromItem(row) }); setFormError(''); setNotice(''); }} aria-label={`Edit ${nameOf(row)}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#000a1e]"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => { setConfirm(row); setConfirmError(''); }} aria-label={`Delete ${nameOf(row)}`} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
    );

    return (
        <div className="space-y-4">
            {intro}
            {/* Toolbar */}
            <div className="flex flex-col gap-3 min-[1700px]:flex-row min-[1700px]:items-center">
                <div className="relative min-w-0 flex-1 min-[1700px]:min-w-[280px]">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${noun}s…`} aria-label={`Search ${noun}s`} className={cn(fieldClass, 'pl-10')} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {filters.map(f => (
                        <select key={f.key} aria-label={f.label} value={filterValues[f.key] || ''} onChange={e => setFilterValues(v => ({ ...v, [f.key]: e.target.value }))} className={cn(fieldClass, 'w-auto min-w-[150px] max-w-[220px]')}>
                            <option value="">All {f.label.toLowerCase()}</option>
                            {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    ))}
                    <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} className={cn(fieldClass, 'w-auto')}>
                        <option value="">Any status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
                    </select>
                    {publishable && (
                        <select aria-label="Published" value={published} onChange={e => setPublished(e.target.value)} className={cn(fieldClass, 'w-auto')}>
                            <option value="">Published & drafts</option><option value="true">Published</option><option value="false">Drafts</option>
                        </select>
                    )}
                    {sorts && (
                        <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)} className={cn(fieldClass, 'w-auto')}>
                            {sorts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    )}
                    {activeFilters > 0 && <button onClick={() => { setFilterValues({}); setStatus(''); setPublished(''); }} className="px-2 text-sm font-semibold text-[#b86e00] hover:underline">Clear</button>}
                    <button onClick={load} aria-label="Refresh" className="rounded-xl border border-gray-200 bg-white p-2.5 hover:bg-gray-50"><RefreshCw className="h-4 w-4 text-gray-500" /></button>
                    <button onClick={() => { setEditing({ item: null, value: emptyValue }); setFormError(''); setNotice(''); }} disabled={!!createDisabledReason} title={createDisabledReason}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" /> Add {noun}</button>
                </div>
            </div>
            {createDisabledReason && <p className="text-xs text-gray-500">{createDisabledReason}</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error} <button onClick={load} className="ml-2 underline">Try again</button></p>}

            {/* List */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {loading && !data ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>
                    : items.length === 0 ? (
                        <div className="py-14 text-center text-gray-400">
                            <Inbox className="mx-auto mb-3 h-10 w-10 opacity-40" />
                            <p className="font-semibold">{debounced || activeFilters ? `No ${noun}s match` : `No ${noun}s yet`}</p>
                            {!debounced && !activeFilters && !createDisabledReason && <button onClick={() => setEditing({ item: null, value: emptyValue })} className="mt-3 text-sm font-semibold text-[#002147] hover:underline">Add the first {noun}</button>}
                        </div>
                    ) : (
                        <div className={cn(loading && 'opacity-60 transition-opacity')}>
                            <div className="hidden overflow-x-auto lg:block">
                                <table className="w-full text-left text-sm">
                                    <thead><tr className="border-b border-gray-100 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-400">
                                        {columns.map(c => <th key={c.key} className={cn('px-4 py-3', c.className)}>{c.header}</th>)}
                                        <th className="px-4 py-3">{publishable ? 'Visibility' : 'Status'}</th><th className="px-4 py-3 text-right">Actions</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {items.map(row => (
                                            <tr key={row._id} className="hover:bg-gray-50/60">
                                                {columns.map(c => <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>{c.render(row)}</td>)}
                                                <td className="px-4 py-3">{toggles(row)}</td>
                                                <td className="px-4 py-3">{actions(row)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <ul className="divide-y divide-gray-100 lg:hidden">
                                {items.map(row => (
                                    <li key={row._id} className="space-y-3 p-4">
                                        <div className="space-y-1.5">{columns.map(c => <div key={c.key} className="text-sm"><span className="mr-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">{c.header}</span>{c.render(row)}</div>)}</div>
                                        <div className="flex flex-wrap items-center justify-between gap-2">{toggles(row)}{actions(row)}</div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
            </div>
            {data && <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />}

            {editing && (
                <Drawer title={editing.item ? `Edit ${noun}` : `Add ${noun}`} onClose={() => setEditing(null)}
                    footer={<div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-emerald-700">{notice}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">{editing.item ? 'Close' : 'Cancel'}</button>
                            <button onClick={save} disabled={saving || !canSave(editing.value)} className="rounded-xl bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : editing.item ? 'Save changes' : `Create ${noun}`}</button>
                        </div>
                    </div>}>
                    <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4">
                        {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</p>}
                        {renderForm({
                            value: editing.value, token, editing: editing.item,
                            set: (patch) => setEditing(e => e && { ...e, value: { ...e.value, ...patch } }),
                            onItemChange: (item) => { setEditing(e => e && { ...e, item }); load(); },
                        })}
                        <button type="submit" className="hidden" />
                    </form>
                </Drawer>
            )}

            {confirm && (
                <ConfirmDialog title={`Delete ${noun}?`} busy={busyRow === confirm._id} error={confirmError}
                    message={<>“{nameOf(confirm)}” will be permanently deleted. This can’t be undone.</>}
                    onConfirm={remove} onCancel={() => setConfirm(null)} />
            )}
        </div>
    );
}
