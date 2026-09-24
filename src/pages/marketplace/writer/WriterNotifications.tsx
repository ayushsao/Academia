import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, ChevronRight, Settings2, Mail, MessageSquare, Smartphone, Lock } from 'lucide-react';
import { api } from '../../../lib/api';
import { Notice } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

type Category = 'APPLICATION' | 'APPROVAL' | 'SUBSCRIPTION' | 'PAYMENT' | 'OPPORTUNITY' | 'ASSIGNMENT' | 'DEADLINE' | 'REVISION' | 'ACCOUNT';
type N = { id: string; type: string; category: Category; title: string; message: string; link: string; read: boolean; createdAt: string };
type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP';
type Pref = { key: Category; label: string; description: string; channels: Record<Channel, { enabled: boolean; locked: boolean; available: boolean }> };

const CATEGORY_STYLE: Record<Category, { label: string; dot: string }> = {
    APPLICATION: { label: 'Application', dot: 'bg-sky-500' },
    APPROVAL: { label: 'Approval', dot: 'bg-emerald-500' },
    SUBSCRIPTION: { label: 'Membership', dot: 'bg-violet-500' },
    PAYMENT: { label: 'Payment', dot: 'bg-teal-500' },
    OPPORTUNITY: { label: 'Opportunity', dot: 'bg-[#fea520]' },
    ASSIGNMENT: { label: 'Assignment', dot: 'bg-[#002147]' },
    DEADLINE: { label: 'Deadline', dot: 'bg-rose-500' },
    REVISION: { label: 'Revision', dot: 'bg-orange-500' },
    ACCOUNT: { label: 'Account', dot: 'bg-slate-400' },
};
const FILTERS: (Category | 'ALL')[] = ['ALL', 'OPPORTUNITY', 'ASSIGNMENT', 'DEADLINE', 'REVISION', 'APPROVAL', 'APPLICATION', 'SUBSCRIPTION', 'PAYMENT', 'ACCOUNT'];
const CHANNELS: { key: Channel; label: string; icon: React.ElementType }[] = [
    { key: 'EMAIL', label: 'Email', icon: Mail },
    { key: 'SMS', label: 'SMS', icon: Smartphone },
    { key: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
];
const changed = () => window.dispatchEvent(new Event('notifications-changed'));

function Preferences() {
    const [prefs, setPrefs] = useState<Pref[] | null>(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState<string | null>(null);
    useEffect(() => { api<{ categories: Pref[] }>('/notifications/preferences').then(d => setPrefs(d.categories)).catch(e => setError(e.message)); }, []);

    const toggle = async (cat: Category, ch: Channel, on: boolean) => {
        setSaving(`${cat}:${ch}`); setError('');
        setPrefs(list => list?.map(p => (p.key === cat ? { ...p, channels: { ...p.channels, [ch]: { ...p.channels[ch], enabled: on } } } : p)) || null);
        try { setPrefs((await api<{ categories: Pref[] }>('/notifications/preferences', { method: 'PUT', body: { channels: { [cat]: { [ch]: on } } } })).categories); }
        catch (e) { setError((e as Error).message); setPrefs(list => list?.map(p => (p.key === cat ? { ...p, channels: { ...p.channels, [ch]: { ...p.channels[ch], enabled: !on } } } : p)) || null); }
        finally { setSaving(null); }
    };

    if (!prefs) return error ? <Notice tone="error">{error}</Notice> : <div className="flex justify-center py-10"><Spinner className="h-6 w-6 text-[#002147]" /></div>;
    const unavailable = CHANNELS.filter(c => !prefs[0]?.channels[c.key].available);
    return (
        <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-5 sm:p-6">
                <h2 className="font-bold text-[#0b1b33]">Where we notify you</h2>
                <p className="mt-1 text-sm text-slate-600">Every notification appears here in your dashboard. Choose which updates also reach you by email, SMS or WhatsApp.</p>
                {unavailable.length > 0 && <p className="mt-2 text-xs text-slate-500">{unavailable.map(c => c.label).join(' and ')} {unavailable.length === 1 ? 'isn’t' : 'aren’t'} available yet{unavailable.some(c => c.key !== 'EMAIL') ? ' — they need a verified phone number and are being rolled out gradually' : ''}.</p>}
            </div>
            {error && <div className="px-5 pt-4 sm:px-6"><Notice tone="error">{error}</Notice></div>}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                            <th className="px-5 py-3 font-semibold sm:px-6">Update</th>
                            {CHANNELS.map(c => <th key={c.key} className="w-24 px-2 py-3 text-center font-semibold"><span className="inline-flex items-center gap-1"><c.icon className="h-3.5 w-3.5" />{c.label}</span></th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {prefs.map(p => (
                            <tr key={p.key}>
                                <td className="px-5 py-3.5 sm:px-6"><p className="font-semibold text-[#0b1b33]">{p.label}</p><p className="text-xs text-slate-500">{p.description}</p></td>
                                {CHANNELS.map(c => {
                                    const s = p.channels[c.key];
                                    const disabled = s.locked || !s.available || saving === `${p.key}:${c.key}`;
                                    return (
                                        <td key={c.key} className="px-2 py-3.5 text-center">
                                            {s.locked ? <span className="inline-flex items-center gap-1 text-xs text-slate-400" title="Always on for account security"><Lock className="h-3.5 w-3.5" /> On</span> : (
                                                <button type="button" role="switch" aria-checked={s.enabled && s.available} aria-label={`${p.label} by ${c.label}`} disabled={disabled} onClick={() => toggle(p.key, c.key, !s.enabled)}
                                                    className={cn('relative inline-block h-6 w-11 rounded-full transition', s.enabled && s.available ? 'bg-[#002147]' : 'bg-slate-300', disabled && 'cursor-not-allowed opacity-40')}>
                                                    <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', s.enabled && s.available ? 'left-[22px]' : 'left-0.5')} />
                                                </button>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default function WriterNotifications() {
    const navigate = useNavigate();
    const [items, setItems] = useState<N[] | null>(null);
    const [unread, setUnread] = useState(0);
    const [byCategory, setByCategory] = useState<Partial<Record<Category, number>>>({});
    const [filter, setFilter] = useState<Category | 'ALL'>('ALL');
    const [error, setError] = useState('');
    const [more, setMore] = useState(true);
    const [showPrefs, setShowPrefs] = useState(false);

    const load = useCallback(async (before?: string) => {
        try {
            const q = new URLSearchParams({ limit: '30', ...(before ? { before } : {}), ...(filter !== 'ALL' ? { category: filter } : {}) });
            const d = await api<{ notifications: N[]; unread: number; unreadByCategory: Partial<Record<Category, number>> }>(`/notifications?${q}`);
            setItems(prev => (before ? [...(prev || []), ...d.notifications] : d.notifications));
            setUnread(d.unread); setByCategory(d.unreadByCategory || {}); setMore(d.notifications.length === 30);
        } catch (e) { setError((e as Error).message); }
    }, [filter]);
    useEffect(() => { setItems(null); load(); }, [load]);

    const open = async (n: N) => {
        if (!n.read) {
            setItems(list => list?.map(x => (x.id === n.id ? { ...x, read: true } : x)) || null);
            setByCategory(c => ({ ...c, [n.category]: Math.max(0, (c[n.category] || 1) - 1) }));
            try { setUnread((await api<{ unread: number }>(`/notifications/${n.id}/read`, { method: 'POST' })).unread); changed(); } catch { /* optimistic */ }
        }
        if (n.link) navigate(n.link);
    };
    const markAll = async () => {
        const d = await api<{ unread: number }>('/notifications/read-all', { method: 'POST', body: filter !== 'ALL' ? { category: filter } : {} });
        setItems(list => list?.map(x => ({ ...x, read: true })) || null);
        setUnread(d.unread); setByCategory(c => (filter === 'ALL' ? {} : { ...c, [filter]: 0 })); changed();
    };
    const filterUnread = filter === 'ALL' ? unread : byCategory[filter] || 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Notifications</h1>
                    <p className="mt-1 text-slate-600">{unread ? `${unread} unread` : 'You’re all caught up.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {filterUnread > 0 && <button onClick={markAll} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#002147]"><CheckCheck className="h-4 w-4" /> Mark {filter === 'ALL' ? 'all' : 'these'} as read</button>}
                    <button onClick={() => setShowPrefs(s => !s)} aria-expanded={showPrefs} className={cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold', showPrefs ? 'border-[#002147] bg-[#002147] text-white' : 'border-slate-300 bg-white text-[#002147]')}><Settings2 className="h-4 w-4" /> Settings</button>
                </div>
            </div>

            {showPrefs && <Preferences />}

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filter notifications">
                {FILTERS.map(f => {
                    const n = f === 'ALL' ? unread : byCategory[f] || 0;
                    return (
                        <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                            className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition', filter === f ? 'border-[#002147] bg-[#002147] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
                            {f !== 'ALL' && <span className={cn('h-2 w-2 rounded-full', CATEGORY_STYLE[f].dot)} />}
                            {f === 'ALL' ? 'All' : CATEGORY_STYLE[f].label}
                            {n > 0 && <span className={cn('rounded-full px-1.5 text-[11px]', filter === f ? 'bg-white/20' : 'bg-slate-100')}>{n}</span>}
                        </button>
                    );
                })}
            </div>

            {error && <Notice tone="error">{error}</Notice>}
            {!items && !error && <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#002147]" /></div>}
            {items && items.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">No notifications{filter !== 'ALL' ? ' in this category' : ' yet'}.</p>}
            {items && items.length > 0 && (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {items.map(n => {
                        const style = CATEGORY_STYLE[n.category] || CATEGORY_STYLE.ACCOUNT;
                        return (
                            <li key={n.id}>
                                <button onClick={() => open(n)} className={cn('flex w-full gap-3 p-4 text-left transition hover:bg-slate-50 sm:p-5', !n.read && 'bg-[#fff9ee]')}>
                                    <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.read ? 'bg-slate-200' : style.dot)} aria-hidden />
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                            <span className={cn('font-semibold', n.read ? 'text-slate-700' : 'text-[#0b1b33]')}>{n.title}</span>
                                            <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                        </span>
                                        <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{style.label}{!n.read && <span className="sr-only"> · unread</span>}</span>
                                        <span className="mt-1.5 block whitespace-pre-line text-sm leading-relaxed text-slate-600">{n.message}</span>
                                    </span>
                                    {n.link && <ChevronRight className="mt-1 h-4 w-4 shrink-0 self-start text-slate-300" aria-hidden />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            {items && more && items.length > 0 && <button onClick={() => load(items[items.length - 1].createdAt)} className="mx-auto block rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#002147]">Load older</button>}
        </div>
    );
}
