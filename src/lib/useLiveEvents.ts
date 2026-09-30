import { useEffect, useRef, useState } from 'react';
import { API } from './api';

// Subscribes to a Server-Sent Events stream on the API (e.g. /support/stream).
// Streams authenticate with the session cookie. Where the browser blocks that
// cookie (the API is on another domain), the stream can't connect, so `poll`
// runs every 10 seconds instead and the page still stays up to date.
export function useLiveEvents(
    path: string | null,
    onEvent: (type: string, data: any) => void,
    poll: () => void,
) {
    const [live, setLive] = useState(false);
    const onEventRef = useRef(onEvent);
    const pollRef = useRef(poll);
    onEventRef.current = onEvent;
    pollRef.current = poll;

    useEffect(() => {
        if (!path) return;
        let source: EventSource | null = null;
        let failures = 0;
        let timer: ReturnType<typeof setInterval> | null = null;
        const startPolling = () => { if (!timer) timer = setInterval(() => pollRef.current(), 10000); };
        const stopPolling = () => { if (timer) { clearInterval(timer); timer = null; } };

        if (typeof EventSource === 'undefined') { startPolling(); return stopPolling; }
        source = new EventSource(`${API}${path}`, { withCredentials: true });
        const handle = (type: string) => (e: MessageEvent) => {
            try { onEventRef.current(type, JSON.parse(e.data)); } catch { /* ignore malformed frames */ }
        };
        source.addEventListener('ready', () => {
            failures = 0; setLive(true); stopPolling();
            pollRef.current();   // catch up on anything sent while disconnected
        });
        source.addEventListener('message', handle('message'));
        source.addEventListener('read', handle('read'));
        source.onerror = () => {
            setLive(false);
            startPolling();
            // Repeated failures (e.g. the session cookie is blocked): stop retrying the stream.
            if (++failures >= 3) source?.close();
        };
        return () => { source?.close(); stopPolling(); setLive(false); };
    }, [path]);

    return live;
}
