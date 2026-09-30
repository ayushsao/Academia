import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Headset, PenTool, Search } from 'lucide-react';
import { api } from '../../../lib/api';
import { useLiveEvents } from '../../../lib/useLiveEvents';
import { cn } from '../../../lib/utils';
import { ChatWindow, type ChatMessage } from '../../../components/support/ChatWindow';

type Thread = {
    thread: string; kind: 'CUSTOMER' | 'WRITER'; orderId: string | null; customerId: string; customerName: string; customerEmail: string;
    lastBody: string; lastSender: 'CUSTOMER' | 'WRITER' | 'ADMIN'; lastAt: string; unread: number;
};
type Conversation = { thread: string; kind: 'CUSTOMER' | 'WRITER'; canReply: boolean; orderId: string | null; customer: { id: string; name: string; email: string }; messages: ChatMessage[] };

const ago = (d: string) => {
    const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short' });
};

// Admin console: every customer conversation, answered live.
export default function SupportTab({ token }: { token: string }) {
    const [threads, setThreads] = useState<Thread[]>([]);
    const [active, setActive] = useState<string | null>(null);
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [unreadOnly, setUnreadOnly] = useState(false);

    const loadThreads = useCallback(async () => {
        try { setThreads((await api<{ threads: Thread[] }>('/admin/support/threads', { token })).threads); }
        catch (e) { setError((e as Error).message); }
    }, [token]);

    const loadConversation = useCallback(async (key: string, quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const d = await api<Conversation>(`/admin/support/threads/${encodeURIComponent(key)}/messages`, { token });
            setConversation(d);
            setThreads(ts => ts.map(t => (t.thread === key ? { ...t, unread: 0 } : t)));
        } catch (e) { setError((e as Error).message); }
        finally { if (!quiet) setLoading(false); }
    }, [token]);

    useEffect(() => { loadThreads(); }, [loadThreads]);
    useEffect(() => { if (active) loadConversation(active); else setConversation(null); }, [active, loadConversation]);

    const live = useLiveEvents('/admin/support/stream', (type, data) => {
        if (type === 'message') {
            const m = data as ChatMessage;
            if (m.thread === active) {
                setConversation(c => (c && !c.messages.some(x => x.id === m.id) ? { ...c, messages: [...c.messages, m] } : c));
                if (m.sender === 'CUSTOMER') loadConversation(active, true);   // marks it read
            }
            loadThreads();
        } else if (type === 'read' && data?.by === 'USER' && data.thread === active) {
            const now = new Date().toISOString();
            setConversation(c => c && { ...c, messages: c.messages.map(m => (m.sender === 'ADMIN' && !m.readByCustomerAt ? { ...m, readByCustomerAt: now } : m)) });
        }
    }, () => { loadThreads(); if (active) loadConversation(active, true); });

    const send = async (body: string) => {
        if (!active) return;
        const d = await api<{ message: ChatMessage }>(`/admin/support/threads/${encodeURIComponent(active)}/messages`, { method: 'POST', body: { body }, token });
        setConversation(c => (c && !c.messages.some(x => x.id === d.message.id) ? { ...c, messages: [...c.messages, d.message] } : c));
        loadThreads();
    };

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return threads.filter(t => (!unreadOnly || t.unread > 0)
            && (!q || [t.customerName, t.customerEmail, t.orderId || '', t.lastBody].some(v => v.toLowerCase().includes(q))));
    }, [threads, query, unreadOnly]);
    const totalUnread = threads.reduce((n, t) => n + t.unread, 0);

    return (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="grid h-[75vh] min-h-[520px] md:grid-cols-[340px_1fr]">
                <aside className={cn('min-h-0 flex-col border-r border-gray-100', active ? 'hidden md:flex' : 'flex')}>
                    <div className="space-y-2 border-b border-gray-100 p-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-[#000a1e]">Conversations</h2>
                            <span className="text-xs font-semibold text-gray-500">{totalUnread} unread</span>
                        </div>
                        <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, order…" aria-label="Search conversations"
                                className="w-full bg-transparent text-sm outline-none" />
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                            <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} /> Unread only
                        </label>
                    </div>
                    {error && <p className="px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}
                    <ul data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto">
                        {shown.length === 0 && <li className="p-6 text-center text-sm text-gray-500">No conversations yet.</li>}
                        {shown.map(t => (
                            <li key={t.thread}>
                                <button onClick={() => setActive(t.thread)}
                                    className={cn('flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-gray-50', active === t.thread && 'bg-[#fff5e8]')}>
                                    <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                                        t.kind === 'WRITER' ? 'bg-[#eef3fb] text-[#1e3a5f]' : t.orderId ? 'bg-gray-100 text-gray-600' : 'bg-[#fff1e0] text-[#eb6200]')}>
                                        {t.kind === 'WRITER' ? <PenTool className="h-4 w-4" aria-hidden="true" /> : t.orderId ? <FileText className="h-4 w-4" aria-hidden="true" /> : <Headset className="h-4 w-4" aria-hidden="true" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center justify-between gap-2">
                                            <span className={cn('truncate text-sm', t.unread ? 'font-bold text-[#000a1e]' : 'font-semibold text-gray-800')}>{t.customerName}</span>
                                            <span className="shrink-0 text-[11px] text-gray-400">{ago(t.lastAt)}</span>
                                        </span>
                                        <span className="block truncate text-[11px] font-semibold text-gray-500">{t.kind === 'WRITER' ? 'Writer' : t.orderId ? `Order ${t.orderId}` : 'Customer · General support'}</span>
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="truncate text-xs text-gray-500">{t.lastSender === 'ADMIN' ? 'You: ' : ''}{t.lastBody}</span>
                                            {t.unread > 0 && <span className="shrink-0 rounded-full bg-[#eb6200] px-1.5 py-0.5 text-[10px] font-bold text-white">{t.unread}</span>}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                <section className={cn('min-h-0 flex-col', active ? 'flex' : 'hidden md:flex')}>
                    {active ? (
                        <ChatWindow
                            me="ADMIN" live={live} loading={loading} messages={conversation?.messages || []}
                            onSend={conversation?.canReply ? send : async () => { throw new Error('Your admin role can read this conversation but not reply.'); }}
                            header={(
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setActive(null)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 md:hidden" aria-label="Back to conversations">
                                        <ArrowLeft className="h-5 w-5" />
                                    </button>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-[#000a1e]">{conversation?.customer.name || '…'}</p>
                                        <p className="truncate text-xs text-gray-500">
                                            {conversation?.customer.email}{conversation?.kind === 'WRITER' ? ' · Writer' : conversation?.orderId ? ` · Order ${conversation.orderId}` : ' · General support'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        />
                    ) : (
                        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-gray-500">Choose a conversation to reply.</div>
                    )}
                </section>
            </div>
        </div>
    );
}
