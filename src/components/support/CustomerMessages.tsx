import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Headset, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { useLiveEvents } from '../../lib/useLiveEvents';
import { cn } from '../../lib/utils';
import { ChatWindow, type ChatMessage } from './ChatWindow';

type Thread = { thread: string; title: string; orderId: string | null; status?: string; lastBody: string; lastSender: string | null; lastAt: string | null; unread: number };

// Server thread keys ("g:<userId>", "o:<orderId>") → the customer's thread ids ("general", "<orderId>").
const threadOf = (key: string) => (key.startsWith('o:') ? key.slice(2) : 'general');

// The customer's messages with the support team: a general chat plus one per order.
export function CustomerMessages({ initialThread, onUnreadChange }: { initialThread?: string; onUnreadChange?: (n: number) => void }) {
    const [threads, setThreads] = useState<Thread[]>([]);
    const [active, setActive] = useState<string | null>(initialThread || null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadThreads = useCallback(async () => {
        try {
            const d = await api<{ threads: Thread[] }>('/support/threads');
            setThreads(d.threads);
            onUnreadChange?.(d.threads.reduce((n, t) => n + t.unread, 0));
        } catch (e) { setError((e as Error).message); }
    }, [onUnreadChange]);

    const loadMessages = useCallback(async (thread: string, quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const d = await api<{ messages: ChatMessage[] }>(`/support/messages?thread=${encodeURIComponent(thread)}`);
            setMessages(d.messages);
            setThreads(ts => {
                const next = ts.map(t => (t.thread === thread ? { ...t, unread: 0 } : t));
                onUnreadChange?.(next.reduce((n, t) => n + t.unread, 0));
                return next;
            });
        } catch (e) { setError((e as Error).message); }
        finally { if (!quiet) setLoading(false); }
    }, [onUnreadChange]);

    useEffect(() => { loadThreads(); }, [loadThreads]);
    useEffect(() => { if (initialThread) setActive(initialThread); }, [initialThread]);
    useEffect(() => { if (active) loadMessages(active); }, [active, loadMessages]);

    const live = useLiveEvents('/support/stream', (type, data) => {
        if (type === 'message') {
            const m = data as ChatMessage;
            if (threadOf(m.thread) === active) {
                setMessages(ms => (ms.some(x => x.id === m.id) ? ms : [...ms, m]));
                if (m.sender === 'ADMIN') loadMessages(active, true);   // marks it read
            }
            loadThreads();
        } else if (type === 'read' && data?.thread === active) {
            const now = new Date().toISOString();
            setMessages(ms => ms.map(m => (m.sender === 'CUSTOMER' && !m.readByAdminAt ? { ...m, readByAdminAt: now } : m)));
        }
    }, () => { loadThreads(); if (active) loadMessages(active, true); });

    const send = async (body: string) => {
        if (!active) return;
        const d = await api<{ message: ChatMessage }>('/support/messages', { method: 'POST', body: { thread: active, body } });
        setMessages(ms => (ms.some(x => x.id === d.message.id) ? ms : [...ms, d.message]));
        loadThreads();
    };

    const current = threads.find(t => t.thread === active);

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid h-[70vh] min-h-[480px] md:grid-cols-[300px_1fr]">
                {/* Conversations */}
                <aside className={cn('min-h-0 flex-col border-r border-slate-100', active ? 'hidden md:flex' : 'flex')}>
                    <div className="border-b border-slate-100 px-4 py-3">
                        <h2 className="text-base font-bold text-[#000a1e]">Messages</h2>
                        <p className="text-xs text-slate-500">Chat with our support team</p>
                    </div>
                    {error && <p className="px-4 py-2 text-xs font-semibold text-red-600">{error}</p>}
                    <ul data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto">
                        {threads.map(t => (
                            <li key={t.thread}>
                                <button onClick={() => setActive(t.thread)}
                                    className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50', active === t.thread && 'bg-[#fff5e8]')}>
                                    <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', t.orderId ? 'bg-slate-100 text-slate-600' : 'bg-[#fff1e0] text-[#eb6200]')}>
                                        {t.orderId ? <FileText className="h-4 w-4" aria-hidden="true" /> : <Headset className="h-4 w-4" aria-hidden="true" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="truncate text-sm font-semibold text-[#1d1d1f]">{t.orderId ? t.orderId : t.title}</span>
                                            {t.unread > 0 && <span className="rounded-full bg-[#eb6200] px-1.5 py-0.5 text-[10px] font-bold text-white">{t.unread}</span>}
                                        </span>
                                        <span className="block truncate text-xs text-slate-500">{t.lastBody || (t.orderId ? t.title : 'Ask us anything')}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* Conversation */}
                <section className={cn('min-h-0 flex-col', active ? 'flex' : 'hidden md:flex')}>
                    {active ? (
                        <ChatWindow
                            me="CUSTOMER" messages={messages} loading={loading} live={live} onSend={send}
                            emptyText={current?.orderId ? 'Questions about this order? Send us a message.' : 'Send us a message. We usually reply within a few minutes during working hours.'}
                            header={(
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setActive(null)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Back to conversations">
                                        <ArrowLeft className="h-5 w-5" />
                                    </button>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-[#000a1e]">{current?.orderId ? `Order ${current.orderId}` : 'Support team'}</p>
                                        {current?.orderId && <p className="truncate text-xs text-slate-500">{current.title}</p>}
                                    </div>
                                </div>
                            )}
                        />
                    ) : (
                        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">Choose a conversation to start chatting.</div>
                    )}
                </section>
            </div>
        </div>
    );
}
