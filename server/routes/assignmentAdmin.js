import { Router } from 'express';
import mongoose from 'mongoose';
import {
    User, Writer, Order, Assignment, AssignmentOffer, AssignmentSubmission, WriterEarning, AssignmentRating, ASSIGNMENT_STATUSES,
} from '../db.js';
import { authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore } from '../permissions.js';
import { recordAudit } from '../services/audit.js';
import {
    validateInput, assignmentUpsertSchema, manualOfferSchema, submissionReviewSchema, assignmentStopSchema, ratingSchema,
    payEarningsSchema, adjustEarningSchema, writerWorkloadLimitSchema, assignmentSettingsSchema,
} from '../validation.js';
import { getAssignmentSettings, saveAssignmentSettings, SUPPORTED_SUBMISSION_FORMATS } from '../services/assignmentSettings.js';
import {
    AssignmentError, createAssignment, updateAssignment, publish, manualOffer, reviewSubmission, cancelAssignment, releaseAssignment,
    rateAssignment, markEarningsPaid, adjustEarning, orderPrefill, allocate, runAssignmentLifecycle,
} from '../services/assignmentService.js';
import { rankCandidates } from '../services/assignmentMatching.js';
import { recomputeWriterMetrics } from '../services/assignmentMetrics.js';
import { receiveFiles, finalizeFiles, discardTempFiles, streamAssignmentFile, removeAssignmentFile } from '../services/assignmentFiles.js';
import { UploadError } from '../services/writerFiles.js';
import { isIsoCurrency, toMinor } from '../services/money.js';

// Mounted at /api/admin/assignments. Allocation, reviews and payouts are for full admins.
const router = Router();
router.use(noStore, authenticateAdmin);

// Operations run assignments; writer payouts belong to Finance; workload limits
// can be set by anyone allowed to manage writer availability.
router.use((req, res, next) => {
    if (req.path.startsWith('/earnings')) return requirePermission('payouts.manage')(req, res, next);
    if (req.path.startsWith('/writers/')) return requirePermission('writers.availability')(req, res, next);
    return requirePermission('assignments.manage')(req, res, next);
});

function handleError(res, err, fallback) {
    if (err instanceof AssignmentError || err instanceof UploadError) return res.status(err.status).json({ error: err.message });
    console.error(`[AssignmentAdmin] ${fallback}:`, err);
    res.status(500).json({ error: fallback });
}
const audit = (req, action, reason, writerUserId) =>
    recordAudit(req, action, { reason, writerUserId, targetType: /EARNING/.test(action) ? 'PAYOUT' : /WORKLOAD/.test(action) ? 'WRITER' : 'ASSIGNMENT' });
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function loadAssignment(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Assignment not found.' });
        req.assignment = await Assignment.findById(req.params.id);
        if (!req.assignment) return res.status(404).json({ error: 'Assignment not found.' });
        next();
    } catch (err) { handleError(res, err, 'Failed to load assignment.'); }
}

// Converts the validated body's major-unit payout into stored minor units.
function toStored(body) {
    if (!isIsoCurrency(body.payout.currency)) throw new AssignmentError('Unknown payout currency.');
    const { payout, ...rest } = body;
    return { ...rest, payout: { amountMinor: toMinor(payout.amount, payout.currency), currency: payout.currency } };
}

async function writerNames(writerIds) {
    const writers = await Writer.find({ _id: { $in: writerIds } }).select('userId');
    const users = await User.find({ _id: { $in: writers.map(w => w.userId) } }).select('name email');
    const u = new Map(users.map(x => [String(x._id), x]));
    return new Map(writers.map(w => [String(w._id), { name: u.get(String(w.userId))?.name, email: u.get(String(w.userId))?.email, userId: w.userId }]));
}

async function detailView(a) {
    const [offers, submissions, earnings, rating, order] = await Promise.all([
        AssignmentOffer.find({ assignmentId: a._id }).sort({ createdAt: -1 }).lean(),
        AssignmentSubmission.find({ assignmentId: a._id }).sort({ createdAt: -1 }).lean(),
        WriterEarning.find({ assignmentId: a._id }).lean(),
        AssignmentRating.findOne({ assignmentId: a._id }).lean(),
        a.orderId ? Order.findById(a.orderId).select('orderId status assignedTo').lean() : null,
    ]);
    const names = await writerNames([...offers.map(o => o.writerId), ...(a.assignedWriterId ? [a.assignedWriterId] : [])]);
    return {
        ...a.toObject(),
        id: a._id,
        order,
        assignedWriter: a.assignedWriterId ? { id: a.assignedWriterId, ...names.get(String(a.assignedWriterId)) } : null,
        offers: offers.map(o => ({ ...o, writer: names.get(String(o.writerId)) || null })),
        submissions: submissions.map(s => ({ ...s, writer: names.get(String(s.writerId))?.name })),
        earnings: earnings.map(e => ({ ...e, writer: names.get(String(e.writerId))?.name })),
        rating,
    };
}

// ── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', async (_req, res) => {
    try { res.json({ settings: await getAssignmentSettings(), supportedFormats: SUPPORTED_SUBMISSION_FORMATS }); }
    catch (err) { handleError(res, err, 'Failed to load settings.'); }
});

router.put('/settings', validateInput(assignmentSettingsSchema), async (req, res) => {
    try {
        const settings = await saveAssignmentSettings(req.body);
        await audit(req, 'ASSIGNMENT_SETTINGS_UPDATED', `Mode ${settings.allocationMode}; formats ${settings.submission.allowedFormats.join(',')}`);
        res.json({ settings, supportedFormats: SUPPORTED_SUBMISSION_FORMATS });
    } catch (err) { handleError(res, err, 'Failed to save settings.'); }
});

// ── Listing & creation ────────────────────────────────────────────────────────

router.get('/summary', async (_req, res) => {
    try {
        const rows = await Assignment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
        const approvedEarnings = await WriterEarning.countDocuments({ status: 'APPROVED' });
        res.json({ byStatus: Object.fromEntries(rows.map(r => [r._id, r.n])), payoutsDue: approvedEarnings });
    } catch (err) { handleError(res, err, 'Failed to load summary.'); }
});

router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
        const filter = {};
        const statuses = String(req.query.status || '').split(',').filter(s => ASSIGNMENT_STATUSES.includes(s));
        if (statuses.length) filter.status = { $in: statuses };
        if (typeof req.query.search === 'string' && req.query.search.trim()) {
            const rgx = new RegExp(escapeRegex(req.query.search.trim().slice(0, 80)), 'i');
            filter.$or = [{ title: rgx }, { assignmentRef: rgx }, { subject: rgx }];
        }
        const [total, rows] = await Promise.all([
            Assignment.countDocuments(filter),
            Assignment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        ]);
        const names = await writerNames(rows.map(r => r.assignedWriterId).filter(Boolean));
        const pending = await AssignmentOffer.aggregate([{ $match: { assignmentId: { $in: rows.map(r => r._id) }, status: 'OFFERED' } }, { $group: { _id: '$assignmentId', n: { $sum: 1 } } }]);
        const pendingMap = new Map(pending.map(p => [String(p._id), p.n]));
        res.json({
            total, page, limit,
            assignments: rows.map(r => ({
                id: r._id, ref: r.assignmentRef, title: r.title, subject: r.subject, academicLevel: r.academicLevel, wordCount: r.wordCount,
                status: r.status, writerDeadline: r.writerDeadline, payout: r.payout, allocationMode: r.allocation?.mode || r.allocationMode,
                assignedWriter: r.assignedWriterId ? names.get(String(r.assignedWriterId))?.name : null, pendingOffers: pendingMap.get(String(r._id)) || 0,
                orderLinked: Boolean(r.orderId), note: r.allocation?.note || '', createdAt: r.createdAt,
            })),
        });
    } catch (err) { handleError(res, err, 'Failed to load assignments.'); }
});

router.get('/orders/:orderRef/prefill', async (req, res) => {
    try { res.json(await orderPrefill(String(req.params.orderRef))); }
    catch (err) { handleError(res, err, 'Failed to load order.'); }
});

router.post('/', validateInput(assignmentUpsertSchema), async (req, res) => {
    try {
        const a = await createAssignment(toStored(req.body), req.admin);
        await audit(req, 'ASSIGNMENT_CREATED', `${a.assignmentRef}${req.body.orderRef ? ` from order ${req.body.orderRef}` : ''}`);
        res.status(201).json({ assignment: await detailView(a) });
    } catch (err) { handleError(res, err, 'Failed to create assignment.'); }
});

router.get('/:id', loadAssignment, async (req, res) => {
    try { res.json({ assignment: await detailView(req.assignment) }); }
    catch (err) { handleError(res, err, 'Failed to load assignment.'); }
});

router.put('/:id', loadAssignment, validateInput(assignmentUpsertSchema), async (req, res) => {
    try {
        const a = await updateAssignment(req.assignment, toStored(req.body), req.admin);
        res.json({ assignment: await detailView(a) });
    } catch (err) { handleError(res, err, 'Failed to update assignment.'); }
});

// ── Allocation ────────────────────────────────────────────────────────────────

router.post('/:id/publish', loadAssignment, async (req, res) => {
    try {
        const a = await publish(req.assignment, req.admin);
        await audit(req, 'ASSIGNMENT_PUBLISHED', `${a.assignmentRef} (${a.allocation.mode})`);
        res.json({ assignment: await detailView(a) });
    } catch (err) { handleError(res, err, 'Failed to publish assignment.'); }
});

router.post('/:id/reallocate', loadAssignment, async (req, res) => {
    try {
        const a = req.assignment;
        if (a.status !== 'UNALLOCATED' && a.status !== 'OPEN') throw new AssignmentError('Only open or unallocated assignments can be re-run.', 409);
        a.allocation.attempts = 0;
        a.status = 'OPEN';
        await a.save();
        res.json({ assignment: await detailView(await allocate(a)) });
    } catch (err) { handleError(res, err, 'Failed to re-run allocation.'); }
});

router.get('/:id/candidates', loadAssignment, async (req, res) => {
    try {
        const { eligible, ineligible } = await rankCandidates(req.assignment, await getAssignmentSettings());
        res.json({ eligible: eligible.slice(0, 50), ineligible: ineligible.slice(0, 100), totals: { eligible: eligible.length, ineligible: ineligible.length } });
    } catch (err) { handleError(res, err, 'Failed to rank writers.'); }
});

router.post('/:id/offer', loadAssignment, validateInput(manualOfferSchema), async (req, res) => {
    try {
        const a = await manualOffer(req.assignment, req.body.writerId, req.admin);
        const w = await Writer.findById(req.body.writerId).select('userId');
        await audit(req, 'ASSIGNMENT_OFFERED', a.assignmentRef, w?.userId);
        res.json({ assignment: await detailView(a) });
    } catch (err) { handleError(res, err, 'Failed to send offer.'); }
});

// ── Files ─────────────────────────────────────────────────────────────────────

router.post('/:id/reference-files', loadAssignment, receiveFiles(10, 50 * 1024 * 1024), async (req, res) => {
    try {
        const a = req.assignment;
        if (['APPROVED', 'CANCELLED'].includes(a.status)) { await discardTempFiles(req.files); return res.status(409).json({ error: 'This assignment is closed.' }); }
        const stored = await finalizeFiles(req.files, SUPPORTED_SUBMISSION_FORMATS);
        a.referenceFiles.push(...stored);
        await a.save();
        res.status(201).json({ assignment: await detailView(a) });
    } catch (err) { handleError(res, err, 'Failed to upload files.'); }
});

router.delete('/:id/reference-files/:fileId', loadAssignment, async (req, res) => {
    try {
        const a = req.assignment;
        const file = a.referenceFiles.id(req.params.fileId);
        if (!file) return res.status(404).json({ error: 'File not found.' });
        const { storedName, source } = file;
        file.deleteOne();
        await a.save();
        if (source === 'UPLOAD') await removeAssignmentFile(storedName);
        res.json({ assignment: await detailView(a) });
    } catch (err) { handleError(res, err, 'Failed to remove file.'); }
});

router.get('/:id/files/:fileId', loadAssignment, (req, res) => {
    const file = req.assignment.referenceFiles.id(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found.' });
    streamAssignmentFile(res, file, { download: req.query.download === '1' });
});

router.get('/:id/submissions/:subId/files/:fileId', loadAssignment, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.subId)) return res.status(404).json({ error: 'File not found.' });
        const sub = await AssignmentSubmission.findOne({ _id: req.params.subId, assignmentId: req.assignment._id });
        const file = sub?.files.id(req.params.fileId);
        if (!file) return res.status(404).json({ error: 'File not found.' });
        streamAssignmentFile(res, file, { download: req.query.download === '1' });
    } catch (err) { handleError(res, err, 'Failed to load file.'); }
});

// ── Review, stop, rate ────────────────────────────────────────────────────────

router.post('/:id/review', loadAssignment, validateInput(submissionReviewSchema), async (req, res) => {
    try {
        const a = req.assignment;
        const { decision, note, revisionHours, adjustment } = req.body;
        const adj = adjustment ? { amountMinor: toMinor(adjustment.amount, a.payout.currency), reason: adjustment.reason } : undefined;
        await reviewSubmission(a, decision, req.admin, { note, revisionHours, adjustment: adj });
        const w = await Writer.findById(a.assignedWriterId).select('userId');
        await audit(req, `ASSIGNMENT_${decision.toUpperCase()}`, `${a.assignmentRef}${note ? ` — ${note.slice(0, 200)}` : ''}`, w?.userId);
        res.json({ assignment: await detailView(a) });
    } catch (err) { handleError(res, err, 'Failed to review submission.'); }
});

const stopOptions = (a, body) => ({
    reason: body.reason, writerAtFault: body.writerAtFault, earningAction: body.earningAction,
    partialAmountMinor: body.partialAmount !== undefined ? toMinor(body.partialAmount, a.payout.currency) : 0,
});

router.post('/:id/cancel', loadAssignment, validateInput(assignmentStopSchema), async (req, res) => {
    try {
        const a = await cancelAssignment(req.assignment, req.admin, stopOptions(req.assignment, req.body));
        await audit(req, 'ASSIGNMENT_CANCELLED', `${a.assignmentRef} — ${req.body.reason}`);
        res.json({ assignment: await detailView(a) });
    } catch (err) { handleError(res, err, 'Failed to cancel assignment.'); }
});

router.post('/:id/release', loadAssignment, validateInput(assignmentStopSchema), async (req, res) => {
    try {
        const previous = req.assignment.assignedWriterId;
        const a = await releaseAssignment(req.assignment, req.admin, stopOptions(req.assignment, req.body));
        const w = await Writer.findById(previous).select('userId');
        await audit(req, 'ASSIGNMENT_RELEASED', `${a.assignmentRef} — ${req.body.reason}`, w?.userId);
        res.json({ assignment: await detailView(a) });
    } catch (err) { handleError(res, err, 'Failed to release assignment.'); }
});

router.post('/:id/rating', loadAssignment, validateInput(ratingSchema), async (req, res) => {
    try {
        const { editReason, ...scores } = req.body;
        const rating = await rateAssignment(req.assignment, req.admin, scores, editReason);
        const w = await Writer.findById(req.assignment.assignedWriterId).select('userId');
        await audit(req, editReason ? 'RATING_EDITED' : 'RATING_CREATED', `${req.assignment.assignmentRef}: ${rating.overall}${editReason ? ` — ${editReason}` : ''}`, w?.userId);
        res.json({ assignment: await detailView(req.assignment) });
    } catch (err) { handleError(res, err, 'Failed to save rating.'); }
});

// ── Earnings & payouts ────────────────────────────────────────────────────────

router.get('/earnings/list', async (req, res) => {
    try {
        const status = ['PENDING', 'APPROVED', 'PAID', 'CANCELLED'].includes(req.query.status) ? req.query.status : 'APPROVED';
        const earnings = await WriterEarning.find({ status }).sort({ approvedAt: 1, createdAt: 1 }).limit(500).lean();
        const [names, assignments] = await Promise.all([
            writerNames(earnings.map(e => e.writerId)),
            Assignment.find({ _id: { $in: earnings.map(e => e.assignmentId) } }).select('assignmentRef title').lean(),
        ]);
        const am = new Map(assignments.map(a => [String(a._id), a]));
        res.json({ earnings: earnings.map(e => ({ ...e, id: e._id, writer: names.get(String(e.writerId)) || null, assignment: am.get(String(e.assignmentId)) ? { ref: am.get(String(e.assignmentId)).assignmentRef, title: am.get(String(e.assignmentId)).title } : null })) });
    } catch (err) { handleError(res, err, 'Failed to load earnings.'); }
});

router.post('/earnings/pay', validateInput(payEarningsSchema), async (req, res) => {
    try {
        const count = await markEarningsPaid(req.body.ids, req.body.reference, req.admin);
        await audit(req, 'EARNINGS_PAID', `${count} earnings · ${req.body.reference}`);
        res.json({ paid: count });
    } catch (err) { handleError(res, err, 'Failed to record payout.'); }
});

router.post('/earnings/:earningId/adjust', validateInput(adjustEarningSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.earningId)) return res.status(404).json({ error: 'Earning not found.' });
        const earning = await WriterEarning.findById(req.params.earningId);
        if (!earning) return res.status(404).json({ error: 'Earning not found.' });
        await adjustEarning(earning, req.admin, toMinor(req.body.amount, earning.currency), req.body.reason);
        const w = await Writer.findById(earning.writerId).select('userId');
        await audit(req, 'EARNING_ADJUSTED', `${req.body.amount} ${earning.currency} — ${req.body.reason}`, w?.userId);
        res.json({ earning });
    } catch (err) { handleError(res, err, 'Failed to adjust earning.'); }
});

router.post('/lifecycle/run', async (req, res) => {
    try { res.json({ summary: await runAssignmentLifecycle() }); }
    catch (err) { handleError(res, err, 'Lifecycle run failed.'); }
});

// ── Writer workload overrides ─────────────────────────────────────────────────

router.patch('/writers/:writerId/workload-limit', validateInput(writerWorkloadLimitSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.writerId)) return res.status(404).json({ error: 'Writer not found.' });
        const w = await Writer.findByIdAndUpdate(req.params.writerId, { $set: { 'workload.adminLimit': req.body.adminLimit } }, { new: true });
        if (!w) return res.status(404).json({ error: 'Writer not found.' });
        await audit(req, 'WORKLOAD_LIMIT_SET', `${req.body.adminLimit ?? 'cleared'}`, w.userId);
        await recomputeWriterMetrics(w._id);
        res.json({ workload: w.workload });
    } catch (err) { handleError(res, err, 'Failed to update workload limit.'); }
});

export default router;
