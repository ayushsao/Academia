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
                let inceptionResponse;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    inceptionResponse = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${inceptionApiKey}`
                        },
                        body: JSON.stringify({
                            model: 'mercury-2.5',
                            reasoning_effort: 'high',
                            messages: [{ role: 'user', content: prompt }]
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
                    const errText = await inceptionResponse.text();
                    console.error("Inception AI Error:", errText);
                }
            } catch (err) {
                console.error("Inception API Request Error:", err.message);
            }
        }

        // 2. FALLBACK ENGINE: GROQ AI
        const groqApiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
        if (!groqApiKey) {
            return res.status(500).json({ error: 'Alternative API Key is not configured.' });
        }

        let groqResponse;
        for (let attempt = 1; attempt <= 3; attempt++) {
            groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${groqApiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.1-70b-versatile',
                    max_tokens: 6000,
                    temperature: 0.7,
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            if (groqResponse.ok) break;
            if ((groqResponse.status === 503 || groqResponse.status === 429) && attempt < 3) {
                await new Promise(r => setTimeout(r, attempt * 1500));
                continue;
            }
        }

        if (!groqResponse || !groqResponse.ok) {
            if (groqResponse) {
                const errorBody = await groqResponse.text();
                console.error("Groq API Error:", errorBody);
            }
            return res.status(500).json({ error: "All AI Engines Failed." });
        }

        const data = await groqResponse.json();
        if (data.choices && data.choices[0].message.content) {
            return res.json({ result: data.choices[0].message.content });
        } else {
            return res.status(500).json({ error: 'Fallback response format invalid.' });
        }
    } catch (err) {
        console.error('Tools error:', err);
        res.status(500).json({ error: 'Failed to process AI request.' });
    }
});

export default router;
