import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

const router = Router();

const toolsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 requests per 15 minutes per IP
    message: { error: 'Too many requests. Please try again later.' }
});

const INCEPTION_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';
// The provider's content filter sometimes flags ordinary academic requests at
// random, so a flagged request is retried, then tried on the second model.
const ATTEMPTS = [
    { model: 'mercury-2.5' },
    { model: 'mercury-2.5' },
    { model: 'mercury-2' },
];
const DEFAULT_SYSTEM = 'You are a helpful academic writing assistant.';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// One request; retries temporary errors (429/502/503/504). Returns { content } or { filtered } or { error }.
async function askInception(apiKey, model, system, prompt) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch(INCEPTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
        });
        if (res.ok) {
            const content = (await res.json())?.choices?.[0]?.message?.content;
            return content ? { content } : { error: 'empty response' };
        }
        const text = await res.text();
        if ([429, 502, 503, 504].includes(res.status) && attempt < 3) { await sleep(attempt * 1500); continue; }
        if (/content_filter/.test(text)) return { filtered: true };
        return { error: `${res.status} ${text.slice(0, 300)}` };
    }
    return { error: 'no response' };
}

router.post('/process', toolsLimiter, async (req, res) => {
    try {
        const { prompt, instructions } = req.body;
        if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Prompt is required.' });
        if (prompt.length > 20000) return res.status(413).json({ error: 'That text is too long. Please shorten it and try again.' });
        if (instructions !== undefined && (typeof instructions !== 'string' || instructions.length > 4000)) return res.status(400).json({ error: 'Invalid tool settings.' });

        const apiKey = process.env.INCEPTION_API_KEY || process.env.VITE_INCEPTION_API_KEY;
        if (!apiKey) {
            console.error('Inception AI failed: INCEPTION_API_KEY is missing.');
            return res.status(502).json({ error: 'This tool is unavailable right now. Please try again shortly.' });
        }

        // The tool's instructions go in the system message; the user message is only the user's input.
        const system = instructions?.trim() ? `${DEFAULT_SYSTEM}\n\n${instructions.trim()}` : DEFAULT_SYSTEM;
        let filtered = 0, lastError = '';
        for (const { model } of ATTEMPTS) {
            try {
                const r = await askInception(apiKey, model, system, prompt);
                if (r.content) return res.json({ result: r.content });
                if (r.filtered) { filtered++; continue; }
                lastError = r.error;
            } catch (err) { lastError = err.message; }
        }

        // Upstream details stay in the server log, never in the response.
        if (filtered === ATTEMPTS.length)
            return res.status(422).json({ error: 'We couldn’t generate a response for this topic. Please rephrase it (for example, add more detail about what the essay should cover) and try again.' });
        console.error('Inception AI failed:', lastError, filtered ? `(${filtered} filtered)` : '');
        return res.status(502).json({ error: 'This tool is unavailable right now. Please try again shortly.' });
    } catch (err) {
        console.error('Tools error:', err);
        res.status(500).json({ error: 'Could not process your request.' });
    }
});

export default router;
