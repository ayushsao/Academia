import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, CheckCheck, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ChatMessage = {
    id: string; thread: string; orderId: string | null; sender: 'CUSTOMER' | 'ADMIN'; senderName: string;
    body: string; createdAt: string; readByAdminAt: string | null; readByCustomerAt: string | null;
};

const time = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const day = (d: string) => new Date(d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

// A conversation: messages (own on the right) and a composer. Shared by the
// customer dashboard and the admin console; `me` says which side is "own".
export function ChatWindow({ header, messages, me, loading, onSend, live, emptyText }: {
    header: React.ReactNode;
    messages: ChatMessage[];
    me: 'CUSTOMER' | 'ADMIN';
    loading?: boolean;
    onSend: (body: string) => Promise<void>;
    live?: boolean;
    emptyText?: string;
}) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages.length, loading]);

    const send = async () => {
        const body = text.trim();
        if (!body || sending) return;
        setSending(true); setError('');
        try { await onSend(body); setText(''); }
        catch (e) { setError((e as Error).message || 'Could not send.'); }
        finally { setSending(false); }
    };

    let lastDay = '';
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">{header}</div>
                <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold', live ? 'text-emerald-600' : 'text-slate-400')}>
                    <span className={cn('h-2 w-2 rounded-full', live ? 'bg-emerald-500' : 'bg-slate-300')} aria-hidden="true" />
                    {live ? 'Live' : 'Updating'}
                </span>
            </div>

            <div ref={listRef} data-lenis-prevent className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#f7f8fa] px-4 py-4" aria-live="polite">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading messages" /></div>
                ) : messages.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500">{emptyText || 'No messages yet.'}</p>
                ) : messages.map(m => {
                    const own = m.sender === me;
                    const d = day(m.createdAt);
                    const showDay = d !== lastDay; lastDay = d;
                    const read = me === 'CUSTOMER' ? m.readByAdminAt : m.readByCustomerAt;
                    return (
                        <React.Fragment key={m.id}>
                            {showDay && <p className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{d}</p>}
                            <div className={cn('flex', own ? 'justify-end' : 'justify-start')}>
                                <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed shadow-sm',
                                    own ? 'rounded-br-md bg-[#000a1e] text-white' : 'rounded-bl-md bg-white text-[#1d1d1f] ring-1 ring-slate-200')}>
                                    {!own && <p className="mb-0.5 text-[11px] font-semibold text-[#c2570c]">{m.senderName}</p>}
                                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                    <p className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', own ? 'text-white/60' : 'text-slate-400')}>
                                        {time(m.createdAt)}
                                        {own && (read ? <CheckCheck className="h-3.5 w-3.5" aria-label="Read" /> : <Check className="h-3.5 w-3.5" aria-label="Sent" />)}
                                    </p>
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>

            <div className="border-t border-slate-100 bg-white p-3">
                {error && <p role="alert" className="mb-2 text-xs font-semibold text-red-600">{error}</p>}
                <div className="flex items-end gap-2">
                    <textarea
                        value={text} onChange={e => setText(e.target.value)} rows={1} maxLength={2000}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                        placeholder="Write a message…" aria-label="Message"
                        className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-[#f5f5f7] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#eb6200] focus:bg-white"
                    />
                    <button onClick={send} disabled={!text.trim() || sending} aria-label="Send message"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eb6200] text-white transition hover:bg-[#c2570c] disabled:opacity-40">
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">Enter to send · Shift + Enter for a new line</p>
            </div>
        </div>
    );
}
