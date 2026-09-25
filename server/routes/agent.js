import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

const router = Router();

const agentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: { error: 'Too many chat requests. Please try again shortly.' }
});

const pickReply = (payload) => {
    if (!payload) return '';
    if (typeof payload === 'string') return payload;
    if (typeof payload.output === 'string') return payload.output;
    if (typeof payload.response === 'string') return payload.response;
    if (typeof payload.text === 'string') return payload.text;
    if (typeof payload.result === 'string') return payload.result;
    if (typeof payload.message === 'string') return payload.message;
    if (payload.data) return pickReply(payload.data);
    return '';
};

router.post('/chat', agentLimiter, async (req, res) => {
    try {
        const { prompt, sessionId } = req.body;
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Prompt is required.' });
        }
        if (prompt.length > 4000) return res.status(413).json({ error: 'That message is too long.' });

        const webhookUrl = process.env.N8N_AGENT_WEBHOOK_URL;
        if (!webhookUrl) {
            return res.status(503).json({
                error: 'AI agent webhook is not configured.',
                setup: 'Set N8N_AGENT_WEBHOOK_URL to your active n8n Webhook URL.'
            });
        }

        const upstreamResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt.trim(),
                sessionId: typeof sessionId === 'string' ? sessionId.slice(0, 100) : req.ip
            })
        });

        const raw = await upstreamResponse.text();
        let payload = raw;
        try {
            payload = raw ? JSON.parse(raw) : {};
        } catch {
            payload = raw;
        }

        if (!upstreamResponse.ok) {
            console.error('n8n agent error:', upstreamResponse.status, raw);
            return res.status(502).json({ error: 'The AI agent could not answer right now.' });
        }

        const reply = pickReply(payload);
        if (!reply) {
            return res.json({ reply: 'I received the request, but the agent returned an empty response.' });
        }

        res.json({ reply, raw: payload });
    } catch (err) {
        console.error('Agent route error:', err.message);
        res.status(500).json({ error: 'Failed to contact the AI agent.' });
    }
});

export default router;
