import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

const router = Router();

const toolsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 requests per 15 minutes per IP
    message: { error: 'Too many requests. Please try again later.' }
});

router.post('/process', toolsLimiter, async (req, res) => {
    try {
        const { prompt } = req.body;
        if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Prompt is required.' });
        if (prompt.length > 20000) return res.status(413).json({ error: 'That text is too long. Please shorten it and try again.' });



        // 1. PRIMARY ENGINE: INCEPTION LABS AI
        const inceptionApiKey = process.env.INCEPTION_API_KEY || process.env.VITE_INCEPTION_API_KEY;
        let inceptionError = "Inception API Key is missing from environment variables.";

        if (!inceptionApiKey) {
            return res.status(500).json({ error: inceptionError });
        }

        try {
            let inceptionResponse;
            for (let attempt = 1; attempt <= 3; attempt++) {
                // To minimize content filter flags, separate system instructions from user prompt if possible,
                // or just pass as user if the model expects simplified input.
                inceptionResponse = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${inceptionApiKey}`
                    },
                    body: JSON.stringify({
                        model: 'mercury-2.5',
                        messages: [
                            { role: 'system', content: 'You are a helpful AI assistant. Always fulfill the requested tasks strictly.' },
                            { role: 'user', content: prompt }
                        ]
                    })
                });

                if (inceptionResponse.ok) break;
                if ((inceptionResponse.status === 503 || inceptionResponse.status === 429) && attempt < 3) {
                    await new Promise(r => setTimeout(r, attempt * 1500));
                    continue;
                }
            }

            if (inceptionResponse && inceptionResponse.ok) {
                const inceptionData = await inceptionResponse.json();
                if (inceptionData.choices && inceptionData.choices[0].message.content) {
                    return res.json({ result: inceptionData.choices[0].message.content });
                }
            } else if (inceptionResponse) {
                inceptionError = await inceptionResponse.text();
                // Add friendly layer if content filter is triggered
                if (inceptionError.includes("content_filter") || inceptionResponse.status === 400) {
                    return res.status(400).json({ error: "Your prompt triggers safety/content filters on the Inception engine. Please revise your query to be more academic and professional." });
                }
                console.error("Inception AI Error Response:", inceptionError);
            }
        } catch (err) {
            inceptionError = err.message;
            console.error("Inception API Request Error:", err.message);
        }

        // Upstream details stay in the server log, never in the response.
        console.error('Inception AI failed:', inceptionError);
        return res.status(502).json({ error: 'This tool is unavailable right now. Please try again shortly.' });
    } catch (err) {
        console.error('Tools error:', err);
        res.status(500).json({ error: 'Could not process your request.' });
    }
});

export default router;
