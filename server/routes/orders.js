import { Router } from 'express';
import { Order } from '../db.js';
import { authenticateUser } from '../middleware.js';

const router = Router();

function genOrderId() {
    return 'ACAD-' + Math.floor(100000 + Math.random() * 900000);
}

// GET /api/orders — user's own orders
router.get('/', authenticateUser, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json({ orders });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/orders — place new order
router.post('/', authenticateUser, async (req, res) => {
    try {
        const {
            service, subject, academicLevel, pages, deadline,
            topicTitle, instructions, files,
            turnitinReport, topExpert, abstractPage, totalAmount
        } = req.body;

        if (!service || !subject || !deadline || !topicTitle)
            return res.status(400).json({ error: 'service, subject, deadline, and topicTitle are required.' });

        const order = await Order.create({
            orderId: genOrderId(),
            userId: req.user.id,
            service, subject,
            academicLevel: academicLevel || 'Undergraduate',
            pages: pages || 1,
            deadline, topicTitle,
            instructions: instructions || '',
            files: files || [],
            turnitinReport: Boolean(turnitinReport),
            topExpert: Boolean(topExpert),
            abstractPage: Boolean(abstractPage),
            totalAmount: totalAmount || 0,
        });

        res.status(201).json({ order });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/orders/:id — single order
router.get('/:id', authenticateUser, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.id, userId: req.user.id });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        res.json({ order });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
