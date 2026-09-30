import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { Field, Notice, inputClass } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { useWriter } from '../onboarding/WriterContext';
import { cn } from '../../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { showAlert, showConfirm } from '../../../lib/dialog';

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

    if (!w) return (
        <div className="space-y-6">
            {msg ? <Notice tone="error">{msg.text}</Notice> : <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#002147]" /></div>}
            {msg && <DeleteAccount />}
        </div>
    );
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Settings</h1>
                <p className="mt-1 text-slate-600">Control how much work you’re offered.</p>
            </div>
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="grid gap-6 lg:grid-cols-2">
                <Field label="Maximum assignments at once" htmlFor="cap" hint={`You currently have ${w.active} active. Up to ${w.platformMax}.${w.adminLimit !== null ? ` Our team has set a limit of ${w.adminLimit} for your account.` : ''}`}>
                    <div className="flex items-center gap-3">
                        <input id="cap" type="range" min={1} max={w.platformMax} value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="flex-1 accent-[#002147]" />
                        <span className="w-10 text-center text-xl font-bold text-[#0b1b33]">{capacity}</span>
                    </div>
                </Field>
                <Field label="Time zone" htmlFor="tz" hint="Used to match you with work that suits your working hours.">
                    <select id="tz" value={timezone} onChange={e => setTimezone(e.target.value)} className={inputClass}>
                        <option value="">Not set</option>
                        {zones.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
                    </select>
                </Field>
                </div>
                {w.adminLimit !== null && capacity > w.adminLimit && <Notice tone="info">Your effective limit is {w.adminLimit} because of an admin setting.</Notice>}
                <p className="text-sm text-slate-600">To pause new offers completely, switch yourself to <strong>Unavailable</strong> using the toggle in the sidebar{writer?.availability.override ? ' (currently set by our team)' : ''}.</p>
                {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
                <button onClick={save} disabled={busy} className={cn('rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white disabled:opacity-50')}>{busy ? 'Saving…' : 'Save settings'}</button>
            </section>
            <DeleteAccount />
        </div>
    );
}

// Permanently deletes the writer's account after they type DELETE.
function DeleteAccount() {
    const navigate = useNavigate();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const ready = text === 'DELETE';

    const remove = async () => {
        if (!ready) return;
        if (!(await showConfirm('This permanently deletes your writer profile, documents and personal details. You won’t be able to sign in or recover it.', { title: 'Delete your account?', confirmText: 'Delete account', tone: 'danger' }))) return;
        setBusy(true); setError('');
        try {
            await api('/writers/account/delete', { method: 'POST', body: { confirm: 'DELETE' } });
            useStore.setState({ writer: null, writerToken: null });
            await showAlert('Your writer account has been deleted.', { tone: 'success', title: 'Account deleted' });
            navigate('/', { replace: true });
        } catch (e) { setError((e as Error).message); setBusy(false); }
    };

    return (
        <section className="space-y-4 rounded-2xl border border-red-200 bg-white p-5 sm:p-6">
            <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-red-700"><Trash2 className="h-5 w-5" aria-hidden="true" /> Delete account</h2>
                <p className="mt-1 text-sm text-slate-600">
                    Your profile is removed from the website straight away, and your documents, photo and personal details are erased.
                    Records of completed work and payments are kept without your name. You can’t undo this.
                </p>
            </div>
            <Field label="Type DELETE to confirm" htmlFor="delete-confirm">
                <input id="delete-confirm" value={text} onChange={e => setText(e.target.value)} autoComplete="off" spellCheck={false} placeholder="DELETE" className={inputClass} />
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
            <button onClick={remove} disabled={!ready || busy}
                className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? 'Deleting…' : 'Delete my account'}
            </button>
        </section>
    );
}
