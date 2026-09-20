import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Contact } from '../db.js';
import { validateInput, contactSchema } from '../validation.js';

const router = Router();

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 messages per IP per hour
    message: { error: 'Too many messages sent. Please try again later.' }
});

// POST /api/contact
router.post('/', contactLimiter, validateInput(contactSchema), async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        const contact = await Contact.create({ name, email: email.toLowerCase(), phone: phone || '', subject, message });
        res.status(201).json({ id: contact._id, message: 'Message received. We will get back to you shortly!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit contact message.' });
    }
});

export default router;
