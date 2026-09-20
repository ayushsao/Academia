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
        let inceptionError = "Inception API Key is missing from environment variables.";

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
                    inceptionError = await inceptionResponse.text();
                    console.error("Inception AI Error Response:", inceptionError);
                }
            } catch (err) {
                inceptionError = err.message;
                console.error("Inception API Request Error:", err.message);
            }
        }

        // 2. FALLBACK ENGINE: GROQ AI
        const groqApiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
        let groqError = "Groq API Key is missing from environment variables.";

        if (groqApiKey) {
            try {
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

                if (groqResponse && groqResponse.ok) {
                    const groqData = await groqResponse.json();
                    if (groqData.choices && groqData.choices[0].message.content) {
                        return res.json({ result: groqData.choices[0].message.content });
                    }
                } else if (groqResponse) {
                    groqError = await groqResponse.text();
                    console.error("Groq AI Error Response:", groqError);
                }
            } catch (err) {
                groqError = err.message;
            }
        }

        return res.status(500).json({ error: `All AI Engines Failed.\nInception Error: ${inceptionError}\nGroq Error: ${groqError}` });
    } catch (err) {
        console.error('Tools error:', err);
        res.status(500).json({ error: 'Failed to process AI request.' });
    }
});

export default router;
