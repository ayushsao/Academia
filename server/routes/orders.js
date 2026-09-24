import { Router } from 'express';
import { Order } from '../db.js';
import { authenticateUser } from '../middleware.js';
import { validateInput, orderSchema } from '../validation.js';
import { ownedFileNames, streamOrderFile, customerCanAccess } from '../services/orderFiles.js';

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
        res.status(500).json({ error: 'Failed to fetch orders.' });
    }
});

const getBaseRate = (srv) => {
    switch (srv) {
        case 'Take My Online Exam': return 50;
        case 'Take My Online Class': return 45;
        case 'Ghost Writer': return 30;
        case 'MBA Essay Writing Service': return 28;
        case 'Data Analysis & SPSS':
        case 'Programming Assignment Help': return 25;
        case 'Dissertation & Thesis':
        case 'Dissertation Help':
        case 'Thesis Help': return 22;
        case 'Research Proposal Writing Service': return 20;
        case 'Literature Review':
        case 'Research Paper Writing':
        case 'Assessment Help': return 18;
        case 'Case Study Analysis':
        case 'Term Paper Help': return 16;
        case 'Academic Writing':
        case 'Pay Someone To Do My Homework':
        case 'Coursework Help': return 15;
        case 'Essay Help': return 14;
        case 'Homework Help':
        case 'Powerpoint Presentation Services': return 12;
        case 'Editing & Proofreading':
        case 'Essay Editing Service': return 10;
        default: return 15;
    }
};

// POST /api/orders — place new order
router.post('/', authenticateUser, validateInput(orderSchema), async (req, res) => {
    try {
        const {
            service, subject, academicLevel, pages, deadline,
            topicTitle, instructions, files,
            turnitinReport, topExpert, abstractPage, transactionId
        } = req.body;

        const basePrice = getBaseRate(service);
        const levelMultiplier = academicLevel === 'PhD / Doctoral' ? 1.35 : academicLevel === 'Master\'s' ? 1.15 : 1.0;
        const calcPages = pages || 1;
        const subtotal = Math.round(calcPages * basePrice * levelMultiplier);

        let addOnsTotal = 0;
        if (topExpert) addOnsTotal += 15;
        if (abstractPage) addOnsTotal += 10;

        const serverComputedAmount = subtotal + addOnsTotal;

        const order = await Order.create({
            orderId: genOrderId(),
            userId: req.user.id,
            service, subject,
            academicLevel: academicLevel || 'Undergraduate',
            pages: calcPages,
            deadline, topicTitle,
            instructions: instructions || '',
            files: await ownedFileNames(files || [], req.user.id),   // only the caller's own uploads
            turnitinReport: Boolean(turnitinReport),
            topExpert: Boolean(topExpert),
            abstractPage: Boolean(abstractPage),
            totalAmount: serverComputedAmount,
            transactionId: transactionId || '',
        });

        res.status(201).json({ order });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create order.' });
    }
});

// GET /api/orders/:id — single order
// GET /api/orders/files/:name — download one of the caller's own order files.
router.get('/files/:name', authenticateUser, async (req, res) => {
    try {
        if (!await customerCanAccess(req.user.id, req.params.name)) return res.status(404).json({ error: 'File not found.' });
        await streamOrderFile(res, req.params.name);
    } catch { if (!res.headersSent) res.status(500).json({ error: 'Could not load file.' }); }
});

router.get('/:id', authenticateUser, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.id, userId: req.user.id });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        res.json({ order });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

export default router;
