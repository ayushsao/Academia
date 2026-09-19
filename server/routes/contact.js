import { Router } from 'express';
import { Contact } from '../db.js';

const router = Router();

// POST /api/contact
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        if (!name || !email || !subject || !message)
            return res.status(400).json({ error: 'name, email, subject, and message are required.' });

        const contact = await Contact.create({ name, email, phone: phone || '', subject, message });
        res.status(201).json({ id: contact._id, message: 'Message received. We will get back to you shortly!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
