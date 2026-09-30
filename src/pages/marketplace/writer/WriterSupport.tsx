import React, { useCallback, useEffect, useState } from 'react';
import { Headset } from 'lucide-react';
import { api } from '../../../lib/api';
import { useLiveEvents } from '../../../lib/useLiveEvents';
import { ChatWindow, type ChatMessage } from '../../../components/support/ChatWindow';

// The writer's chat with the AssignmentMinds team (accounts, payments, onboarding…).
export default function WriterSupport() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const d = await api<{ messages: ChatMessage[] }>('/writers/support/messages');
            setMessages(d.messages);
            window.dispatchEvent(new Event('support-changed'));   // clears the sidebar badge
        } catch (e) { setError((e as Error).message); }
        finally { if (!quiet) setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const live = useLiveEvents('/writers/support/stream', (type, data) => {
        if (type === 'message') {
            const m = data as ChatMessage;
            setMessages(ms => (ms.some(x => x.id === m.id) ? ms : [...ms, m]));
            if (m.sender === 'ADMIN') load(true);   // marks it read
        } else if (type === 'read') {
            const now = new Date().toISOString();
            setMessages(ms => ms.map(m => (m.sender === 'WRITER' && !m.readByAdminAt ? { ...m, readByAdminAt: now } : m)));
        }
    }, () => load(true));

    const send = async (body: string) => {
        const d = await api<{ message: ChatMessage }>('/writers/support/messages', { method: 'POST', body: { body } });
        setMessages(ms => (ms.some(x => x.id === d.message.id) ? ms : [...ms, d.message]));
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Support</h1>
                <p className="mt-1 text-slate-600">Questions about your application, membership, payments or assignments? Chat with our team.</p>
            </div>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <div className="h-[65vh] min-h-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <ChatWindow
                    me="WRITER" messages={messages} loading={loading} live={live} onSend={send}
                    emptyText="Send us a message and our team will reply here."
                    header={(
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff1e0] text-[#eb6200]"><Headset className="h-4 w-4" aria-hidden="true" /></span>
                            <div>
                                <p className="text-sm font-bold text-[#000a1e]">AssignmentMinds team</p>
                                <p className="text-xs text-slate-500">Usually replies within a few hours</p>
                            </div>
                        </div>
                    )}
                />
            </div>
        </div>
    );
}
