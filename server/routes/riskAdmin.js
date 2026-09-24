import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { RiskEvent, RISK_KINDS, Writer, User } from '../db.js';
import { authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore } from '../permissions.js';
import { validateInput } from '../validation.js';
import { recordAudit } from '../services/audit.js';
import { refreshRiskSummary } from '../services/abuse.js';
import { maskEmail } from './writerAdmin.js';

// Trust & safety review queue (risk.review: Super Admin, HR, Finance).
const router = Router();
router.use(noStore, authenticateAdmin, requirePermission('risk.review'));

const SEVERITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

// GET /api/admin/risk/summary — open signals by severity and kind.
router.get('/summary', async (_req, res) => {
    try {
        const [bySeverity, byKind, flaggedWriters] = await Promise.all([
            RiskEvent.aggregate([{ $match: { status: 'OPEN' } }, { $group: { _id: '$severity', n: { $sum: 1 } } }]),
            RiskEvent.aggregate([{ $match: { status: 'OPEN' } }, { $group: { _id: '$kind', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
            Writer.countDocuments({ 'risk.level': { $in: ['MEDIUM', 'HIGH'] } }),
        ]);
        res.json({
            open: Object.fromEntries(bySeverity.map(r => [r._id, r.n])),
            byKind: byKind.map(r => ({ kind: r._id, n: r.n })),
            flaggedWriters,
        });
    } catch { res.status(500).json({ error: 'Could not load risk summary.' }); }
});

// GET /api/admin/risk?status=OPEN&severity=HIGH&kind=…&writerId=…&page=1
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
        const filter = {};
        if (['OPEN', 'CONFIRMED', 'DISMISSED'].includes(req.query.status)) filter.status = req.query.status;
        if (['LOW', 'MEDIUM', 'HIGH'].includes(req.query.severity)) filter.severity = req.query.severity;
        if (RISK_KINDS.includes(req.query.kind)) filter.kind = req.query.kind;
        if (mongoose.isValidObjectId(req.query.writerId)) filter.$or = [{ writerId: req.query.writerId }, { relatedWriterIds: req.query.writerId }];
        const [total, rows] = await Promise.all([
            RiskEvent.countDocuments(filter),
            RiskEvent.find(filter).sort({ lastSeenAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        ]);
        const writerIds = [...new Set(rows.flatMap(r => [r.writerId, ...(r.relatedWriterIds || [])]).filter(Boolean).map(String))];
        const writers = await Writer.find({ _id: { $in: writerIds } }).select('userId status risk').lean();
        const users = await User.find({ _id: { $in: writers.map(w => w.userId) } }).select('name email').lean();
        const userMap = new Map(users.map(u => [String(u._id), u]));
        const writerMap = new Map(writers.map(w => {
            const u = userMap.get(String(w.userId));
            return [String(w._id), { id: w._id, name: u?.name || 'Unknown', email: maskEmail(u?.email || ''), status: w.status, riskLevel: w.risk?.level || 'NONE' }];
        }));
        res.json({
            total, page, limit,
            events: rows.sort((a, b) => (a.status === 'OPEN') !== (b.status === 'OPEN') ? (a.status === 'OPEN' ? -1 : 1) : SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.lastSeenAt - a.lastSeenAt).map(r => ({
                id: r._id, kind: r.kind, severity: r.severity, status: r.status, summary: r.summary, occurrences: r.occurrences,
                firstSeenAt: r.createdAt, lastSeenAt: r.lastSeenAt,
                writer: r.writerId ? writerMap.get(String(r.writerId)) || null : null,
                related: (r.relatedWriterIds || []).map(id => writerMap.get(String(id))).filter(Boolean),
                resolution: r.status === 'OPEN' ? null : r.resolution,
            })),
        });
    } catch (err) { console.error('[Risk] list failed:', err); res.status(500).json({ error: 'Could not load risk events.' }); }
});

const resolveSchema = z.object({
    status: z.enum(['CONFIRMED', 'DISMISSED', 'OPEN']),
    note: z.string().trim().max(1000).default(''),
}).refine(v => v.status === 'OPEN' || v.note.length >= 3, { message: 'Add a short note explaining the decision.', path: ['note'] });

// POST /api/admin/risk/:id/resolve { status, note } — audited.
router.post('/:id/resolve', validateInput(resolveSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Risk event not found.' });
        const event = await RiskEvent.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Risk event not found.' });
        event.status = req.body.status;
        event.resolution = req.body.status === 'OPEN' ? { note: '' } : { note: req.body.note, by: req.admin.id, byName: req.admin.username, at: new Date() };
        await event.save();
        if (event.writerId) await refreshRiskSummary(event.writerId);
        const writer = event.writerId ? await Writer.findById(event.writerId).select('userId').lean() : null;
        await recordAudit(req, `RISK_${req.body.status}`, { targetType: 'RISK_EVENT', targetId: event._id, writerUserId: writer?.userId, reason: `${event.kind}${req.body.note ? ` — ${req.body.note}` : ''}` });
        res.json({ ok: true, status: event.status });
    } catch (err) { console.error('[Risk] resolve failed:', err); res.status(500).json({ error: 'Could not update risk event.' }); }
});

export default router;
