import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { Field, Notice, inputClass } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { useWriter } from '../onboarding/WriterContext';
import { cn } from '../../../lib/utils';

type Workload = { maxConcurrent: number; adminLimit: number | null; effectiveLimit: number; platformMax: number; active: number; timezone: string };

export default function WriterSettings() {
    const { writer } = useWriter();
    const [w, setW] = useState<Workload | null>(null);
    const [capacity, setCapacity] = useState(1);
    const [timezone, setTimezone] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const zones = useMemo(() => (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []), []);

    useEffect(() => {
        api<Workload>('/assignments/writer/workload').then(d => {
            setW(d); setCapacity(d.maxConcurrent);
            setTimezone(d.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '');
        }).catch(e => setMsg({ tone: 'error', text: e.message }));
    }, []);

    const save = async () => {
        setBusy(true); setMsg(null);
        try {
            const r = await api<{ effectiveLimit: number }>('/assignments/writer/workload', { method: 'PATCH', body: { maxConcurrent: capacity, timezone } });
            setW(x => x && { ...x, maxConcurrent: capacity, effectiveLimit: r.effectiveLimit, timezone });
            setMsg({ tone: 'success', text: 'Settings saved.' });
        } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(false); }
    };

    if (!w) return msg ? <Notice tone="error">{msg.text}</Notice> : <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#002147]" /></div>;
    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Settings</h1>
                <p className="mt-1 text-slate-600">Control how much work you’re offered.</p>
            </div>
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <Field label="Maximum assignments at once" htmlFor="cap" hint={`You currently have ${w.active} active. Up to ${w.platformMax}.${w.adminLimit !== null ? ` Our team has set a limit of ${w.adminLimit} for your account.` : ''}`}>
                    <div className="flex items-center gap-3">
                        <input id="cap" type="range" min={1} max={w.platformMax} value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="flex-1 accent-[#002147]" />
                        <span className="w-10 text-center text-xl font-bold text-[#0b1b33]">{capacity}</span>
                    </div>
                </Field>
                {w.adminLimit !== null && capacity > w.adminLimit && <Notice tone="info">Your effective limit is {w.adminLimit} because of an admin setting.</Notice>}
                <Field label="Time zone" htmlFor="tz" hint="Used to match you with work that suits your working hours.">
                    <select id="tz" value={timezone} onChange={e => setTimezone(e.target.value)} className={inputClass}>
                        <option value="">Not set</option>
                        {zones.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
                    </select>
                </Field>
                <p className="text-sm text-slate-600">To pause new offers completely, switch yourself to <strong>Unavailable</strong> using the toggle in the sidebar{writer?.availability.override ? ' (currently set by our team)' : ''}.</p>
                {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
                <button onClick={save} disabled={busy} className={cn('rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white disabled:opacity-50')}>{busy ? 'Saving…' : 'Save settings'}</button>
            </section>
        </div>
    );
}
