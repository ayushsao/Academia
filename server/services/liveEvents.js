// Live updates to browsers over Server-Sent Events (SSE). Each open dashboard
// keeps one long-lived GET request; publish() writes an event to every
// connection on a channel (e.g. "customer:<userId>", "writer:<userId>",
// "admins:customers", "admins:writers").
//
// Connections live in this server process. That's right for a single
// instance; running several instances would need a shared pub/sub (e.g.
// Redis) so an event published on one reaches browsers connected to another.

const channels = new Map();   // channel -> Set<res>
const HEARTBEAT_MS = 25 * 1000;   // keeps proxies (Render, Cloudflare) from closing idle streams
const MAX_PER_CHANNEL = 20;

/** Turns this response into an event stream on `channel` (or several) until the browser disconnects. */
export function openStream(req, res, channel) {
    const list = Array.isArray(channel) ? channel : [channel];
    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');
    res.write('event: ready\ndata: {}\n\n');

    for (const name of list) {
        let set = channels.get(name);
        if (!set) channels.set(name, (set = new Set()));
        // A runaway client opening many tabs: drop the oldest connection.
        if (set.size >= MAX_PER_CHANNEL) { const oldest = set.values().next().value; oldest.end(); set.delete(oldest); }
        set.add(res);
    }

    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    req.on('close', () => {
        clearInterval(heartbeat);
        for (const name of list) {
            const set = channels.get(name);
            if (!set) continue;
            set.delete(res);
            if (!set.size) channels.delete(name);
        }
    });
}

/** Sends `data` as event `event` to everyone connected on `channel`. */
export function publish(channel, event, data) {
    const set = channels.get(channel);
    if (!set) return;
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) {
        try { res.write(frame); } catch { set.delete(res); }
    }
}
