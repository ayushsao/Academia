import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

const router = Router();

const toolsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 requests per 15 minutes per IP
    message: { error: 'Too many AI requests. Please try again later.' }
});

router.post('/process', toolsLimiter, async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

        // 1. PRIMARY ENGINE: INCEPTION LABS AI
        const inceptionApiKey = process.env.INCEPTION_API_KEY || process.env.VITE_INCEPTION_API_KEY;
        if (inceptionApiKey) {
            try {
                const inceptionResponse = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${inceptionApiKey}`
                    },
                    body: JSON.stringify({
                        model: 'mercury-2.5',
                        reasoning_effort: 'low',
                        messages: [{ role: 'user', content: prompt }]
                    })
                });

                if (inceptionResponse.ok) {
                    const inceptionData = await inceptionResponse.json();
                    if (inceptionData.choices && inceptionData.choices[0].message.content) {
                        return res.json({ result: inceptionData.choices[0].message.content });
                    }
                }
            } catch (err) {
                console.error("Inception AI Error:", err.message);
            }
        }

        // 2. FALLBACK ENGINE: GOOGLE GEMINI
        const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!geminiApiKey) {
            return res.status(500).json({ error: 'Gemini API Key is not configured.' });
        }

        let response;
        for (let attempt = 1; attempt <= 3; attempt++) {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (response.ok) break;

            if ((response.status === 503 || response.status === 429) && attempt < 3) {
                await new Promise(r => setTimeout(r, attempt * 1500));
                continue;
            }
        }

        if (!response || !response.ok) return res.status(500).json({ error: "Gemini Fallback Connection Failed." });

        const data = await response.json();
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            return res.json({ result: data.candidates[0].content.parts[0].text });
        } else {
            return res.status(500).json({ error: 'Gemini fallback response format invalid.' });
        }
    } catch (err) {
        console.error('Tools error:', err);
        res.status(500).json({ error: 'Failed to process AI request.' });
    }
});

export default router;
