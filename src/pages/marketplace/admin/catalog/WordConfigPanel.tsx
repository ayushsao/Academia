import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Spinner } from '../../../../components/writer/WriterBits';
import { BASE, Label, fieldClass } from './shared';

type Spacing = { key: string; label: string; factor: number };
type Config = { defaultWordsPerPage: number; rounding: 'CEIL' | 'ROUND' | 'EXACT'; minPages: number; maxPages: number; spacingOptions: Spacing[]; defaultSpacing: string };

// Words → billable pages settings used by every price calculation.
export default function WordConfigPanel({ token }: { token: string }) {
    const [config, setConfig] = useState<Config | null>(null);
    const [saved, setSaved] = useState<string>('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        api<{ config: Config }>(`${BASE}/word-config`, { token }).then(d => { setConfig(d.config); setSaved(JSON.stringify(d.config)); }).catch(e => setError(e.message));
    }, [token]);
    if (!config) return error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>;

    const set = (patch: Partial<Config>) => { setConfig(c => c && { ...c, ...patch }); setDone(false); };
    const setSpacing = (i: number, patch: Partial<Spacing>) => set({ spacingOptions: config.spacingOptions.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
    const dirty = JSON.stringify(config) !== saved;
    const save = async () => {
        setBusy(true); setError('');
        try { const d = await api<{ config: Config }>(`${BASE}/word-config`, { method: 'PUT', token, body: config }); setConfig(d.config); setSaved(JSON.stringify(d.config)); setDone(true); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const example = Math.max(config.minPages, Math.min(config.maxPages, ({ CEIL: Math.ceil, ROUND: Math.round, EXACT: (x: number) => Math.round(x * 100) / 100 }[config.rounding])(1000 / (config.defaultWordsPerPage || 1))));

    return (
        <div className="space-y-5">
            <p className="text-sm text-gray-500">How words turn into billable pages. A pricing rule can override words-per-page for its own subject, service or project.</p>
            <div className="grid gap-5 xl:grid-cols-2">
                <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <h3 className="font-bold text-[#000a1e]">Pages</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div><Label htmlFor="w-wpp">Default words per page *</Label><input id="w-wpp" type="number" min={50} max={2000} value={config.defaultWordsPerPage} onChange={e => set({ defaultWordsPerPage: Number(e.target.value) })} className={fieldClass} /></div>
                        <div>
                            <Label htmlFor="w-round">Rounding</Label>
                            <select id="w-round" value={config.rounding} onChange={e => set({ rounding: e.target.value as Config['rounding'] })} className={fieldClass}>
                                <option value="CEIL">Round up to a whole page</option><option value="ROUND">Round to the nearest page</option><option value="EXACT">Exact (fractional pages)</option>
                            </select>
                        </div>
                        <div><Label htmlFor="w-min">Minimum pages</Label><input id="w-min" type="number" min={0} value={config.minPages} onChange={e => set({ minPages: Number(e.target.value) })} className={fieldClass} /></div>
                        <div><Label htmlFor="w-max">Maximum pages</Label><input id="w-max" type="number" min={1} value={config.maxPages} onChange={e => set({ maxPages: Number(e.target.value) })} className={fieldClass} /></div>
                    </div>
                    <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">Example: 1,000 words → <strong className="text-[#000a1e]">{example} {example === 1 ? 'page' : 'pages'}</strong> ({config.defaultSpacing.toLowerCase()} spacing).</p>
                </section>
                <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <h3 className="font-bold text-[#000a1e]">Spacing options</h3>
                    <p className="-mt-2 text-xs text-gray-500">The factor multiplies billable pages (e.g. single spacing fits twice the words, so factor 2).</p>
                    <ul className="space-y-2">
                        {config.spacingOptions.map((s, i) => (
                            <li key={i} className="grid grid-cols-[1fr_1.4fr_5rem_auto] items-end gap-2">
                                <div><Label htmlFor={`sk-${i}`}>Key</Label><input id={`sk-${i}`} value={s.key} maxLength={20} onChange={e => setSpacing(i, { key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} className={fieldClass} /></div>
                                <div><Label htmlFor={`sl-${i}`}>Label</Label><input id={`sl-${i}`} value={s.label} maxLength={40} onChange={e => setSpacing(i, { label: e.target.value })} className={fieldClass} /></div>
                                <div><Label htmlFor={`sf-${i}`}>Factor</Label><input id={`sf-${i}`} type="number" step="0.1" min={0.1} max={10} value={s.factor} onChange={e => setSpacing(i, { factor: Number(e.target.value) })} className={fieldClass} /></div>
                                <button type="button" onClick={() => set({ spacingOptions: config.spacingOptions.filter((_, j) => j !== i) })} disabled={config.spacingOptions.length <= 1} aria-label={`Remove ${s.label}`} className="mb-1 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                            </li>
                        ))}
                    </ul>
                    {config.spacingOptions.length < 6 && <button type="button" onClick={() => set({ spacingOptions: [...config.spacingOptions, { key: '', label: '', factor: 1 }] })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#002147] hover:underline"><Plus className="h-4 w-4" /> Add spacing option</button>}
                    <div>
                        <Label htmlFor="w-def">Default spacing</Label>
                        <select id="w-def" value={config.defaultSpacing} onChange={e => set({ defaultSpacing: e.target.value })} className={fieldClass}>
                            {config.spacingOptions.filter(s => s.key).map(s => <option key={s.key} value={s.key}>{s.label || s.key}</option>)}
                        </select>
                    </div>
                </section>
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
            <button onClick={save} disabled={!dirty || busy} className="inline-flex items-center gap-2 rounded-xl bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? 'Saving…' : done && !dirty ? <><Check className="h-4 w-4" /> Saved</> : 'Save settings'}
            </button>
        </div>
    );
}
