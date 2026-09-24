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

        // Spam: link-stuffed or markup-laden messages are refused; an identical
        // message resent within a day is acknowledged without storing it again.
        const text = `${subject}\n${message}`;
        const links = (text.match(/https?:\/\/|www\./gi) || []).length;
        if (links > 3 || /\[url=|<a\s+href|\[link=/i.test(text)) return res.status(400).json({ error: 'Please remove links from your message and try again.' });
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const duplicate = await Contact.findOne({ email: email.toLowerCase(), message, createdAt: { $gte: since } }).select('_id').lean();
        if (duplicate) return res.status(201).json({ id: duplicate._id, message: 'Message received. We will get back to you shortly!' });

        const contact = await Contact.create({ name, email: email.toLowerCase(), phone: phone || '', subject, message });
        res.status(201).json({ id: contact._id, message: 'Message received. We will get back to you shortly!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit contact message.' });
    }
});

export default router;
