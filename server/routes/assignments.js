import { Router } from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import {
    Writer, WriterProfile, WriterAvailability, WriterSubscription, Notification, Assignment, AssignmentOffer,
    AssignmentSubmission, WriterEarning, AssignmentRating, ACTIVE_ASSIGNMENT_STATUSES, Order,
} from '../db.js';
import { authenticateUser } from '../middleware.js';
import { validateInput, declineOfferSchema, workloadSchema } from '../validation.js';
import { getAssignmentSettings, workloadLimit } from '../services/assignmentSettings.js';
import { AssignmentError, acceptOffer, declineOffer, submitWork, DECLINE_REASONS } from '../services/assignmentService.js';
import { receiveFiles, finalizeFiles, discardTempFiles, streamAssignmentFile } from '../services/assignmentFiles.js';
import { UploadError } from '../services/writerFiles.js';
import { effectiveAvailability, loadWriterBundle, computeOnboarding } from '../services/writerService.js';
import { MEMBERSHIP_DISCLAIMER } from '../services/membershipSettings.js';
import { canTakeOrders, OPEN_ORDER } from '../services/orderRelease.js';

const router = Router();
const actionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, message: { error: 'Too many requests. Please slow down.' } });

function handleError(res, err, fallback) {
    if (err instanceof AssignmentError || err instanceof UploadError) return res.status(err.status).json({ error: err.message });
    console.error(`[Assignments] ${fallback}:`, err);
    res.status(500).json({ error: fallback });
}

async function requireWriter(req, res, next) {
    try {
        if (req.user.role !== 'WRITER') return res.status(403).json({ error: 'This area is for writer accounts.' });
        req.writer = await Writer.findOne({ userId: req.user.id });
        if (!req.writer) return res.status(404).json({ error: 'Writer account not found.' });
        next();
    } catch (err) { handleError(res, err, 'Failed to load writer account.'); }
}

// Work features need a live membership (Part 2); history and earnings stay readable.
const requireActiveMember = (req, res, next) => req.writer.status === 'ACTIVE' ? next()
    : res.status(403).json({ error: 'An active writer membership is required to take on work.' });

// What a writer may see about an assignment. Client deadline, admin rules,
// the linked customer order and other writers are never exposed.
export const writerAssignmentView = (a, { includeFiles = true } = {}) => ({
    ref: a.assignmentRef, title: a.title, service: a.service, subject: a.subject, academicLevel: a.academicLevel,
    wordCount: a.wordCount, requirements: a.requirements, instructions: a.instructions, deliverables: a.deliverables,
    requiredSkills: a.requiredSkills, writerDeadline: a.writerDeadline, payout: a.payout, status: a.status,
    assignedAt: a.assignedAt, revisionDueAt: a.revisionDueAt, revisionCount: a.revisionCount, approvedAt: a.approvedAt,
    cancelledAt: a.cancelledAt,
    referenceFiles: includeFiles ? a.referenceFiles.map(f => ({ id: f._id, name: f.originalName, size: f.size, mimeType: f.mimeType })) : [],
});

const offerView = (o, a) => ({
    offerId: o._id, status: o.status, expiresAt: o.expiresAt, respondedAt: o.respondedAt, declineCode: o.declineCode,
    declineReason: o.declineReason, withdrawnReason: o.withdrawnReason, createdAt: o.createdAt,
    assignment: a ? writerAssignmentView(a, { includeFiles: o.status === 'OFFERED' }) : null,
});

const submissionView = (s) => ({
    id: s._id, version: s.version, status: s.status, note: s.note, submittedAt: s.createdAt, dueAt: s.dueAt, minutesLate: s.minutesLate,
    reviewNote: s.reviewNote, reviewedAt: s.reviewedAt,
    files: s.files.map(f => ({ id: f._id, name: f.originalName, size: f.size, mimeType: f.mimeType })),
});

const earningView = (e) => e && ({
    id: e._id, amountMinor: e.amountMinor, baseAmountMinor: e.baseAmountMinor, currency: e.currency, status: e.status,
    adjustments: e.adjustments.map(x => ({ amountMinor: x.amountMinor, reason: x.reason, at: x.at })),
    approvedAt: e.approvedAt, paidAt: e.paidAt, payoutReference: e.payoutReference, createdAt: e.createdAt,
});

const sumBy = (rows, statusKey = 'status') => rows.reduce((acc, e) => {
    acc[e[statusKey]] = acc[e[statusKey]] || {};
    acc[e[statusKey]][e.currency] = (acc[e[statusKey]][e.currency] || 0) + e.amountMinor;
    return acc;
}, {});

// Loads an assignment the writer is allowed to see: assigned to them, or offered to them.
async function loadVisibleAssignment(req, res, next) {
    try {
        const a = await Assignment.findOne({ assignmentRef: String(req.params.ref) });
        if (!a) return res.status(404).json({ error: 'Assignment not found.' });
        const isAssigned = String(a.assignedWriterId) === String(req.writer._id);
        const offer = await AssignmentOffer.findOne({ assignmentId: a._id, writerId: req.writer._id });
        if (!isAssigned && !offer) return res.status(404).json({ error: 'Assignment not found.' });
        Object.assign(req, { assignment: a, isAssigned, offer });
        next();
    } catch (err) { handleError(res, err, 'Failed to load assignment.'); }
}

// ============================================
// DASHBOARD
// ============================================

router.get('/writer/dashboard', authenticateUser, requireWriter, async (req, res) => {
    try {
        const w = req.writer;
        const settings = await getAssignmentSettings();
        const now = new Date();
        const [bundle, openOffers, active, completed, earnings, notifications, unread, subscription, availability, clientOrders] = await Promise.all([
            loadWriterBundle({ _id: w._id }),
            AssignmentOffer.countDocuments({ writerId: w._id, status: 'OFFERED', expiresAt: { $gt: now } }),
            Assignment.find({ assignedWriterId: w._id, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } }).sort({ writerDeadline: 1 }),
            Assignment.countDocuments({ assignedWriterId: w._id, status: 'APPROVED' }),
            WriterEarning.find({ writerId: w._id, status: { $ne: 'CANCELLED' } }).select('status currency amountMinor').lean(),
            Notification.find({ userId: w.userId }).sort({ createdAt: -1 }).limit(5).lean(),
            Notification.countDocuments({ userId: w.userId, read: false }),
            WriterSubscription.findOne({ writerId: w._id, isOpen: true }).select('planName status currentPeriodEnd autoRenew billingPeriod').lean(),
            WriterAvailability.findOne({ writerId: w._id }),
            canTakeOrders(w) ? Order.countDocuments(OPEN_ORDER) : 0,   // released client orders open to every plan holder
        ]);

        // Profile completion: onboarding requirements plus optional extras that help matching.
        const checks = computeOnboarding(bundle).checks;
        const docs = bundle.documents;
        const extras = {
            headline: Boolean(bundle.profile?.headline),
            timezone: Boolean(bundle.profile?.timezone),
            writingSample: docs.some(d => d.type === 'WRITING_SAMPLE'),
            certificate: docs.some(d => d.type === 'CERTIFICATE'),
        };
        const all = { ...checks, ...extras };
        const done = Object.values(all).filter(Boolean).length;

        res.json({
            status: w.status,
            profileCompletion: { percent: Math.round((done / Object.keys(all).length) * 100), items: all },
            membership: subscription ? { plan: subscription.planName, status: subscription.status, renewsAt: subscription.currentPeriodEnd, autoRenew: subscription.autoRenew, billingPeriod: subscription.billingPeriod } : { plan: null, status: w.membership?.status || 'NONE' },
            opportunities: { available: openOffers + clientOrders, offers: openOffers, clientOrders, active: active.length, completed },
            workload: { active: active.length, limit: workloadLimit(w, settings), availability: effectiveAvailability(availability) },
            upcoming: active.slice(0, 5).map(a => ({ ref: a.assignmentRef, title: a.title, status: a.status, dueAt: a.status === 'REVISION_REQUESTED' ? a.revisionDueAt : a.writerDeadline })),
            metrics: w.metrics,
            earnings: sumBy(earnings),
            notifications: { unread, latest: notifications.map(n => ({ id: n._id, title: n.title, message: n.message, read: n.read, createdAt: n.createdAt })) },
            disclaimer: MEMBERSHIP_DISCLAIMER,
        });
    } catch (err) { handleError(res, err, 'Could not load dashboard.'); }
});

// ============================================
// OPPORTUNITIES & OFFERS
// ============================================

router.get('/writer/opportunities', authenticateUser, requireWriter, async (req, res) => {
    try {
        const offers = await AssignmentOffer.find({ writerId: req.writer._id, status: 'OFFERED', expiresAt: { $gt: new Date() } }).sort({ expiresAt: 1 });
        const assignments = await Assignment.find({ _id: { $in: offers.map(o => o.assignmentId) } });
        const map = new Map(assignments.map(a => [String(a._id), a]));
        res.json({
            offers: offers.map(o => offerView(o, map.get(String(o.assignmentId)))).filter(o => o.assignment),
            declineReasons: DECLINE_REASONS,
            disclaimer: MEMBERSHIP_DISCLAIMER,
        });
    } catch (err) { handleError(res, err, 'Could not load opportunities.'); }
});

router.post('/writer/offers/:offerId/accept', actionLimiter, authenticateUser, requireWriter, requireActiveMember, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.offerId)) return res.status(404).json({ error: 'Offer not found.' });
        const a = await acceptOffer(req.params.offerId, req.writer);
        res.json({ assignment: writerAssignmentView(a) });
    } catch (err) { handleError(res, err, 'Could not accept offer.'); }
});

router.post('/writer/offers/:offerId/decline', actionLimiter, authenticateUser, requireWriter, validateInput(declineOfferSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.offerId)) return res.status(404).json({ error: 'Offer not found.' });
        const offer = await declineOffer(req.params.offerId, req.writer, req.body);
        res.json({ offer: offerView(offer, null) });
    } catch (err) { handleError(res, err, 'Could not decline offer.'); }
});

// ============================================
// ASSIGNMENTS
// ============================================

// ?view=active | history. History includes declined/expired offers, completed and cancelled work.
router.get('/writer/assignments', authenticateUser, requireWriter, async (req, res) => {
    try {
        const w = req.writer;
        if (req.query.view === 'history') {
            const [assignments, offers] = await Promise.all([
                Assignment.find({ assignedWriterId: w._id, status: { $in: ['APPROVED', 'CANCELLED'] } }).sort({ updatedAt: -1 }).limit(200),
                AssignmentOffer.find({ writerId: w._id, status: { $in: ['DECLINED', 'EXPIRED', 'WITHDRAWN'] } }).sort({ updatedAt: -1 }).limit(200),
            ]);
            const offerAssignments = await Assignment.find({ _id: { $in: offers.map(o => o.assignmentId) } }).select('assignmentRef title subject academicLevel wordCount payout writerDeadline');
            const oa = new Map(offerAssignments.map(a => [String(a._id), a]));
            const released = await AssignmentOffer.find({ writerId: w._id, status: 'ACCEPTED', releasedAt: { $ne: null } }).select('assignmentId releasedAt');
            const releasedAssignments = await Assignment.find({ _id: { $in: released.map(r => r.assignmentId) } }).select('assignmentRef title subject academicLevel wordCount payout writerDeadline');
            const ratings = await AssignmentRating.find({ writerId: w._id, assignmentId: { $in: assignments.map(a => a._id) } }).select('assignmentId overall').lean();
            const ratingMap = new Map(ratings.map(r => [String(r.assignmentId), r.overall]));
            const items = [
                ...assignments.map(a => ({ outcome: a.status === 'APPROVED' ? 'COMPLETED' : 'CANCELLED', at: a.approvedAt || a.cancelledAt || a.updatedAt, rating: ratingMap.get(String(a._id)) ?? null, assignment: writerAssignmentView(a, { includeFiles: false }) })),
                ...offers.filter(o => oa.get(String(o.assignmentId))).map(o => ({ outcome: o.status, at: o.respondedAt || o.updatedAt, reason: o.declineReason || o.withdrawnReason || '', assignment: writerAssignmentView(oa.get(String(o.assignmentId)), { includeFiles: false }) })),
                ...released.filter(r => releasedAssignments.find(a => String(a._id) === String(r.assignmentId))).map(r => ({ outcome: 'RELEASED', at: r.releasedAt, assignment: writerAssignmentView(releasedAssignments.find(a => String(a._id) === String(r.assignmentId)), { includeFiles: false }) })),
            ].sort((x, y) => new Date(y.at) - new Date(x.at));
            const accepted = await AssignmentOffer.countDocuments({ writerId: w._id, status: 'ACCEPTED' });
            return res.json({ items, counts: { accepted, declined: offers.filter(o => o.status === 'DECLINED').length, expired: offers.filter(o => o.status === 'EXPIRED').length, completed: assignments.filter(a => a.status === 'APPROVED').length, cancelled: assignments.filter(a => a.status === 'CANCELLED').length } });
        }
        const active = await Assignment.find({ assignedWriterId: w._id, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } }).sort({ writerDeadline: 1 });
        res.json({ assignments: active.map(a => writerAssignmentView(a, { includeFiles: false })) });
    } catch (err) { handleError(res, err, 'Could not load assignments.'); }
});

router.get('/writer/assignments/:ref', authenticateUser, requireWriter, loadVisibleAssignment, async (req, res) => {
    try {
        const { assignment: a, isAssigned, offer } = req;
        const [submissions, earning, rating, settings] = await Promise.all([
            isAssigned ? AssignmentSubmission.find({ assignmentId: a._id, writerId: req.writer._id }).sort({ version: -1 }) : [],
            WriterEarning.findOne({ assignmentId: a._id, writerId: req.writer._id }),
            isAssigned ? AssignmentRating.findOne({ assignmentId: a._id }).lean() : null,
            getAssignmentSettings(),
        ]);
        const canSeeFiles = isAssigned || offer?.status === 'OFFERED';
        res.json({
            assignment: writerAssignmentView(a, { includeFiles: canSeeFiles }),
            isAssigned,
            offer: offer ? offerView(offer, null) : null,
            submissions: submissions.map(submissionView),
            earning: earningView(earning),
            rating: rating && { quality: rating.quality, accuracy: rating.accuracy, timeliness: rating.timeliness, communication: rating.communication, overall: rating.overall, comment: rating.comment },
            canSubmit: isAssigned && ['ASSIGNED', 'REVISION_REQUESTED'].includes(a.status),
            submissionRules: settings.submission,
            maxRevisions: settings.maxRevisions,
        });
    } catch (err) { handleError(res, err, 'Could not load assignment.'); }
});

router.get('/writer/assignments/:ref/files/:fileId', authenticateUser, requireWriter, loadVisibleAssignment, (req, res) => {
    const { assignment: a, isAssigned, offer } = req;
    if (!isAssigned && offer?.status !== 'OFFERED') return res.status(404).json({ error: 'File not found.' });
    const file = a.referenceFiles.id(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found.' });
    streamAssignmentFile(res, file, { download: req.query.download === '1' });
});

router.get('/writer/assignments/:ref/submissions/:subId/files/:fileId', authenticateUser, requireWriter, loadVisibleAssignment, async (req, res) => {
    try {
        if (!req.isAssigned || !mongoose.isValidObjectId(req.params.subId)) return res.status(404).json({ error: 'File not found.' });
        const sub = await AssignmentSubmission.findOne({ _id: req.params.subId, assignmentId: req.assignment._id, writerId: req.writer._id });
        const file = sub?.files.id(req.params.fileId);
        if (!file) return res.status(404).json({ error: 'File not found.' });
        streamAssignmentFile(res, file, { download: req.query.download === '1' });
    } catch (err) { handleError(res, err, 'Could not load file.'); }
});

// Multipart: files[] + note. Formats and limits come from admin settings.
router.post('/writer/assignments/:ref/submissions', actionLimiter, authenticateUser, requireWriter, requireActiveMember, loadVisibleAssignment,
    async (req, res, next) => {
        const s = (await getAssignmentSettings()).submission;
        req.submissionRules = s;
        receiveFiles(s.maxFiles, s.maxFileMB * 1024 * 1024)(req, res, next);
    },
    async (req, res) => {
        try {
            if (!req.isAssigned) { await discardTempFiles(req.files); return res.status(404).json({ error: 'Assignment not found.' }); }
            const note = typeof req.body.note === 'string' ? req.body.note.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim().slice(0, 3000) : '';
            if (!['ASSIGNED', 'REVISION_REQUESTED'].includes(req.assignment.status)) {
                await discardTempFiles(req.files);
                return res.status(409).json({ error: 'This assignment isn’t waiting for a submission.' });
            }
            const files = await finalizeFiles(req.files, req.submissionRules.allowedFormats);
            const submission = await submitWork(req.assignment, req.writer, files, note);
            res.status(201).json({ submission: submissionView(submission), assignment: writerAssignmentView(req.assignment) });
        } catch (err) { handleError(res, err, 'Could not submit work.'); }
    });

// ============================================
// EARNINGS, RATINGS, WORKLOAD
// ============================================

router.get('/writer/earnings', authenticateUser, requireWriter, async (req, res) => {
    try {
        const earnings = await WriterEarning.find({ writerId: req.writer._id }).sort({ createdAt: -1 }).limit(300);
        const assignments = await Assignment.find({ _id: { $in: earnings.map(e => e.assignmentId) } }).select('assignmentRef title');
        const map = new Map(assignments.map(a => [String(a._id), a]));
        res.json({
            totals: sumBy(earnings.filter(e => e.status !== 'CANCELLED')),
            earnings: earnings.map(e => ({ ...earningView(e), assignment: map.get(String(e.assignmentId)) ? { ref: map.get(String(e.assignmentId)).assignmentRef, title: map.get(String(e.assignmentId)).title } : null })),
        });
    } catch (err) { handleError(res, err, 'Could not load earnings.'); }
});

router.get('/writer/ratings', authenticateUser, requireWriter, async (req, res) => {
    try {
        const ratings = await AssignmentRating.find({ writerId: req.writer._id }).sort({ createdAt: -1 }).limit(100).lean();
        const assignments = await Assignment.find({ _id: { $in: ratings.map(r => r.assignmentId) } }).select('assignmentRef title');
        const map = new Map(assignments.map(a => [String(a._id), a]));
        res.json({
            metrics: req.writer.metrics,
            ratings: ratings.map(r => ({ quality: r.quality, accuracy: r.accuracy, timeliness: r.timeliness, communication: r.communication, overall: r.overall, comment: r.comment, at: r.createdAt, assignment: map.get(String(r.assignmentId)) && { ref: map.get(String(r.assignmentId)).assignmentRef, title: map.get(String(r.assignmentId)).title } })),
        });
    } catch (err) { handleError(res, err, 'Could not load ratings.'); }
});

router.get('/writer/workload', authenticateUser, requireWriter, async (req, res) => {
    try {
        const settings = await getAssignmentSettings();
        const profile = await WriterProfile.findOne({ writerId: req.writer._id }).select('timezone');
        const active = await Assignment.countDocuments({ assignedWriterId: req.writer._id, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } });
        res.json({
            maxConcurrent: req.writer.workload?.maxConcurrent || settings.defaultWorkloadLimit,
            adminLimit: req.writer.workload?.adminLimit ?? null,
            effectiveLimit: workloadLimit(req.writer, settings),
            platformMax: settings.maxWorkloadLimit, active, timezone: profile?.timezone || '',
        });
    } catch (err) { handleError(res, err, 'Could not load workload.'); }
});

router.patch('/writer/workload', authenticateUser, requireWriter, validateInput(workloadSchema), async (req, res) => {
    try {
        const settings = await getAssignmentSettings();
        if (req.body.maxConcurrent > settings.maxWorkloadLimit) return res.status(400).json({ error: `The maximum is ${settings.maxWorkloadLimit} concurrent assignments.` });
        if (req.body.timezone !== undefined && req.body.timezone && !Intl.supportedValuesOf('timeZone').includes(req.body.timezone))
            return res.status(400).json({ error: 'Unknown time zone.' });
        await Writer.updateOne({ _id: req.writer._id }, { $set: { 'workload.maxConcurrent': req.body.maxConcurrent } });
        if (req.body.timezone !== undefined) await WriterProfile.updateOne({ writerId: req.writer._id }, { $set: { timezone: req.body.timezone } });
        const writer = await Writer.findById(req.writer._id);
        res.json({ maxConcurrent: writer.workload.maxConcurrent, effectiveLimit: workloadLimit(writer, settings), timezone: req.body.timezone });
    } catch (err) { handleError(res, err, 'Could not save workload.'); }
});

export default router;
