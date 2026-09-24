import { Router } from 'express';
import mongoose from 'mongoose';
import {
    User, Admin, Writer, WriterProfile, WriterSkill, WriterDocument, WriterApplication, WriterAvailability, WriterSubscription,
    SubscriptionPayment, Assignment, WriterEarning, WRITER_STATUSES,
} from '../db.js';
import { authenticateAdmin } from '../middleware.js';
import { can, requirePermission, noStore } from '../permissions.js';
import { validateInput, writerAdminActionSchema, availabilityOverrideSchema, documentReviewSchema } from '../validation.js';
import { streamStoredFile } from '../services/writerFiles.js';
import { loadWriterBundle, toAdminView, applyAdminAction, notifyWriter, effectiveAvailability, WriterError } from '../services/writerService.js';
import { recordAudit } from '../services/audit.js';
import { slugify } from '../writerConstants.js';
import { prefixTerms } from '../services/writerDirectory.js';

// Mounted at /api/admin/writers. Reading requires writers.read; each action and
// each sensitive field has its own permission (see server/permissions.js).
const router = Router();
router.use(noStore, authenticateAdmin, requirePermission('writers.read'));

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const str = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Contact details are masked everywhere except the audited reveal endpoint.
export const maskEmail = (e = '') => {
    const [local, domain] = String(e).split('@');
    return domain ? `${local.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}` : '';
};
const maskPhone = (p = '') => (p ? `${p.slice(0, 3)} •••• ${p.slice(-2)}` : '');

function handleError(res, err, fallback) {
    if (err instanceof WriterError) return res.status(err.status).json({ error: err.message });
    console.error(`[WriterAdmin] ${fallback}:`, err);
    res.status(500).json({ error: fallback });
}

async function loadBundle(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.writerId)) return res.status(404).json({ error: 'Writer not found.' });
        req.bundle = await loadWriterBundle({ _id: req.params.writerId });
        if (!req.bundle) return res.status(404).json({ error: 'Writer not found.' });
        next();
    } catch (err) { handleError(res, err, 'Failed to load writer.'); }
}

const audit = (req, action, writerUserId, reason, targetId) =>
    recordAudit(req, action, { writerUserId, reason, targetType: 'WRITER', targetId });

// Builds the admin view of a writer, including only what the caller's role may see.
async function detailFor(req, bundle) {
    const role = req.admin.adminRole;
    const view = toAdminView(bundle);
    const w = bundle.writer;
    const [subs, assignmentRows, earnings, payments, reviewer] = await Promise.all([
        WriterSubscription.find({ writerId: w._id }).sort({ createdAt: -1 }).limit(10).lean(),
        Assignment.find({ assignedWriterId: w._id }).sort({ createdAt: -1 }).select('assignmentRef title status writerDeadline approvedAt payout').lean(),
        can(role, 'payouts.manage') ? WriterEarning.find({ writerId: w._id }).select('status currency amountMinor').lean() : null,
        can(role, 'payments.read') ? SubscriptionPayment.find({ writerId: w._id, status: 'PAID' }).select('currency amountMinor paidAt').lean() : null,
        bundle.application?.reviewedBy ? Admin.findById(bundle.application.reviewedBy).select('username').lean() : null,
    ]);

    const byStatus = assignmentRows.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});
    const sumByCurrency = (rows) => rows.reduce((acc, r) => { acc[r.currency] = (acc[r.currency] || 0) + r.amountMinor; return acc; }, {});

    return {
        ...view,
        // Sensitive contact data: masked unless revealed through the audited endpoint.
        email: maskEmail(view.email),
        phone: { ...view.phone, e164: maskPhone(view.phone?.e164), masked: maskPhone(view.phone?.e164) },
        contactMasked: true,
        canRevealContact: can(role, 'writers.contact'),
        permissions: {
            review: can(role, 'writers.review'), documents: can(role, 'writers.documents'), availability: can(role, 'writers.availability'),
            performance: can(role, 'writers.performance'), earnings: can(role, 'payouts.manage'), payments: can(role, 'payments.read'),
        },
        metrics: can(role, 'writers.performance') ? view.metrics : null,
        risk: can(role, 'risk.review') ? { level: w.risk?.level || 'NONE', score: w.risk?.score || 0, flags: w.risk?.flags || [] } : null,
        documents: can(role, 'writers.documents') ? view.documents : view.documents.map(d => ({ id: d.id, type: d.type, title: d.title, reviewStatus: d.reviewStatus, createdAt: d.createdAt })),
        lastReview: bundle.application?.reviewedAt ? { by: reviewer?.username || 'Admin', at: bundle.application.reviewedAt } : null,
        subscriptions: subs.map(s => ({
            subscriptionId: s.subscriptionId, planName: s.planName, billingPeriod: s.billingPeriod, status: s.status, autoRenew: s.autoRenew,
            startDate: s.startDate, currentPeriodEnd: s.currentPeriodEnd, endedAt: s.endedAt, endReason: s.endReason,
            // Price is financial data.
            ...(can(role, 'payments.read') ? { amountMinor: s.amountMinor, currency: s.currency } : {}),
        })),
        revenue: payments ? { byCurrency: sumByCurrency(payments), payments: payments.length } : null,
        assignments: {
            byStatus,
            total: assignmentRows.length,
            recent: assignmentRows.slice(0, 10).map(a => ({ ref: a.assignmentRef, title: a.title, status: a.status, writerDeadline: a.writerDeadline, approvedAt: a.approvedAt })),
        },
        earnings: earnings ? earnings.reduce((acc, e) => {
            acc[e.status] = acc[e.status] || {};
            acc[e.status][e.currency] = (acc[e.status][e.currency] || 0) + e.amountMinor;
            return acc;
        }, {}) : null,
    };
}

// ── Summary ──────────────────────────────────────────────────────────────────

router.get('/summary', async (_req, res) => {
    try {
        const [byStatus, byApplication, byMembership] = await Promise.all([
            Writer.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
            WriterApplication.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
            Writer.aggregate([{ $group: { _id: '$membership.status', n: { $sum: 1 } } }]),
        ]);
        const toMap = (rows) => Object.fromEntries(rows.map(r => [r._id || 'NONE', r.n]));
        res.json({ writers: toMap(byStatus), applications: toMap(byApplication), memberships: toMap(byMembership) });
    } catch (err) { handleError(res, err, 'Failed to load summary.'); }
});

// Distinct values for filter dropdowns.
router.get('/facets', async (_req, res) => {
    try {
        const [countries, subjects, skills, plans] = await Promise.all([
            WriterProfile.distinct('country'),
            WriterProfile.aggregate([{ $unwind: '$subjects' }, { $group: { _id: { $toLower: '$subjects' }, label: { $first: '$subjects' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 200 }]),
            WriterSkill.aggregate([{ $group: { _id: '$slug', label: { $first: '$name' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 200 }]),
            Writer.distinct('membership.plan'),
        ]);
        res.json({
            countries: countries.filter(Boolean).sort(),
            subjects: subjects.map(s => s.label),
            skills: skills.map(s => ({ slug: s._id, label: s.label })),
            plans: plans.filter(Boolean).sort(),
        });
    } catch (err) { handleError(res, err, 'Failed to load filters.'); }
});

// ── Search / list ────────────────────────────────────────────────────────────
// Query: status (comma list), application (comma list), search, country, subject,
// skill, level, membership (status), plan, minRating, minExperience, joinedFrom,
// joinedTo, sort (newest|oldest|rating|completed|quality|experience), page, limit.

const SORTS = {
    newest: { createdAt: -1 }, oldest: { createdAt: 1 },
    rating: { 'metrics.rating': -1, 'metrics.ratingCount': -1 },
    completed: { 'metrics.completedAssignments': -1 },
    quality: { 'metrics.qualityScore': -1 },
    experience: { 'directory.yearsExperience': -1 },
    risk: { 'risk.score': -1 },
};

router.get('/', async (req, res) => {
    try {
        const role = req.admin.adminRole;
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
        const statuses = str(req.query.status, 200).split(',').filter(s => WRITER_STATUSES.includes(s));
        const applicationStatuses = str(req.query.application, 200).split(',').filter(Boolean);
        const search = str(req.query.search);
        const country = str(req.query.country, 2).toUpperCase();
        const subject = str(req.query.subject);
        const skill = str(req.query.skill, 40);
        const level = str(req.query.level, 40);
        const membership = str(req.query.membership, 20).toUpperCase();
        const plan = str(req.query.plan, 40);
        const minRating = Number(req.query.minRating);
        const minExperience = Number(req.query.minExperience);
        const joinedFrom = req.query.joinedFrom ? new Date(String(req.query.joinedFrom)) : null;
        const joinedTo = req.query.joinedTo ? new Date(String(req.query.joinedTo)) : null;
        const sortKey = String(req.query.sort || 'newest');

        const filter = {};
        const idConstraints = [];
        if (statuses.length) filter.status = { $in: statuses };
        if (membership) filter['membership.status'] = membership;
        if (plan) filter['membership.plan'] = plan;
        if (Number.isFinite(minRating) && minRating > 0) { filter['metrics.rating'] = { $gte: minRating }; filter['metrics.ratingCount'] = { $gt: 0 }; }
        if ((joinedFrom && !Number.isNaN(joinedFrom.getTime())) || (joinedTo && !Number.isNaN(joinedTo.getTime()))) {
            filter.createdAt = {};
            if (joinedFrom && !Number.isNaN(joinedFrom.getTime())) filter.createdAt.$gte = joinedFrom;
            if (joinedTo && !Number.isNaN(joinedTo.getTime())) filter.createdAt.$lte = new Date(joinedTo.getTime() + 24 * 3600 * 1000 - 1);
        }
        if (applicationStatuses.length) {
            const apps = await WriterApplication.find({ status: { $in: applicationStatuses } }).select('writerId').lean();
            idConstraints.push({ _id: { $in: apps.map(a => a.writerId) } });
        }
        // Profile, skill and text filters run on the indexed directory snapshot
        // (services/writerDirectory.js) rather than joining other collections.
        if (/^[A-Z]{2}$/.test(country)) filter['directory.country'] = country;
        if (subject) filter['directory.subjects'] = subject.toLowerCase();
        if (level) filter['directory.levels'] = level;
        if (Number.isFinite(minExperience) && minExperience > 0) filter['directory.yearsExperience'] = { $gte: minExperience };
        if (skill) filter['directory.skills'] = slugify(skill);
        const risk = str(req.query.risk, 10).toUpperCase();
        if (can(role, 'risk.review') && ['LOW', 'MEDIUM', 'HIGH'].includes(risk)) filter['risk.level'] = risk === 'LOW' ? { $in: ['LOW', 'MEDIUM', 'HIGH'] } : risk === 'MEDIUM' ? { $in: ['MEDIUM', 'HIGH'] } : 'HIGH';
        if (search) {
            const or = [];
            if (search.includes('@')) or.push({ searchKeys: new RegExp(`^${escapeRegex(search.toLowerCase())}`) });
            const terms = prefixTerms(search);
            if (terms.length) or.push({ searchKeys: { $all: terms } }, { 'directory.tokens': { $all: terms } });
            // Phone search only for roles allowed to see phone numbers.
            const digits = search.replace(/\D/g, '');
            if (can(role, 'writers.contact') && digits.length >= 4) or.push({ phoneE164: new RegExp(digits) });
            idConstraints.push(or.length ? { $or: or } : { _id: null });
        }
        if (idConstraints.length) filter.$and = idConstraints;

        const sort = (sortKey === 'risk' && !can(role, 'risk.review') ? null : SORTS[sortKey]) || SORTS.newest;
        let writers, total;
        [total, writers] = await Promise.all([
            Writer.countDocuments(filter),
            Writer.find(filter).sort({ ...sort, _id: 1 }).skip((page - 1) * limit).limit(limit).select('-searchKeys -signupIpHash -emailCanonical').lean(),
        ]);

        const ids = writers.map(w => w._id);
        const [users, profiles, applications, availabilities] = await Promise.all([
            User.find({ _id: { $in: writers.map(w => w.userId) } }).select('name email').lean(),
            WriterProfile.find({ writerId: { $in: ids } }).select('writerId country city subjects academicLevels yearsExperience profilePhoto updatedAt').lean(),
            WriterApplication.find({ writerId: { $in: ids } }).select('writerId status submittedAt').lean(),
            WriterAvailability.find({ writerId: { $in: ids } }).lean(),
        ]);
        const byWriter = (rows) => new Map(rows.map(r => [String(r.writerId), r]));
        const userMap = new Map(users.map(u => [String(u._id), u]));
        const profileMap = byWriter(profiles), appMap = byWriter(applications), availMap = byWriter(availabilities);
        const showPerf = can(role, 'writers.performance');
        const showContact = can(role, 'writers.contact');

        res.json({
            total, page, limit,
            writers: writers.map(w => {
                const user = userMap.get(String(w.userId));
                const profile = profileMap.get(String(w._id));
                const app = appMap.get(String(w._id));
                return {
                    id: w._id, name: user?.name,
                    // Even contact-permitted roles get a masked value in lists; full details via the audited reveal.
                    email: showContact ? maskEmail(user?.email) : null,
                    status: w.status, emailVerified: w.emailVerified, phoneVerified: w.phoneVerified,
                    country: profile?.country, city: profile?.city, subjects: profile?.subjects?.slice(0, 4) || [],
                    academicLevels: profile?.academicLevels || [], yearsExperience: profile?.yearsExperience ?? null,
                    hasPhoto: Boolean(profile?.profilePhoto), photoVersion: profile?.updatedAt ? new Date(profile.updatedAt).getTime() : null,
                    applicationStatus: app?.status, submittedAt: app?.submittedAt,
                    availability: effectiveAvailability(availMap.get(String(w._id))),
                    membership: w.membership?.status || 'NONE', plan: w.membership?.plan || null,
                    risk: can(role, 'risk.review') ? { level: w.risk?.level || 'NONE', score: w.risk?.score || 0, flags: w.risk?.flags || [] } : undefined,
                    metrics: showPerf ? { rating: w.metrics?.rating, ratingCount: w.metrics?.ratingCount, completed: w.metrics?.completedAssignments, qualityScore: w.metrics?.qualityScore, onTimeRate: w.metrics?.onTimeRate } : null,
                    createdAt: w.createdAt,
                };
            }),
        });
    } catch (err) { handleError(res, err, 'Failed to load writers.'); }
});

// ── Detail & sensitive reads ─────────────────────────────────────────────────

router.get('/:writerId', loadBundle, async (req, res) => {
    try { res.json({ writer: await detailFor(req, req.bundle) }); }
    catch (err) { handleError(res, err, 'Failed to load writer.'); }
});

// POST /api/admin/writers/:writerId/contact — reveals email & phone; every reveal is audited.
router.post('/:writerId/contact', requirePermission('writers.contact'), loadBundle, async (req, res) => {
    try {
        const { writer, user } = req.bundle;
        await audit(req, 'WRITER_CONTACT_VIEWED', writer.userId, '', writer._id);
        res.json({ email: user?.email, phone: writer.phoneE164, emailVerified: writer.emailVerified, phoneVerified: writer.phoneVerified });
    } catch (err) { handleError(res, err, 'Failed to load contact details.'); }
});

// ── Review actions ───────────────────────────────────────────────────────────

// POST /api/admin/writers/:writerId/actions  { action, reason }
router.post('/:writerId/actions', requirePermission('writers.review'), loadBundle, validateInput(writerAdminActionSchema), async (req, res) => {
    try {
        const { action, reason } = req.body;
        const result = await applyAdminAction(req.bundle, { action, reason }, req.admin);
        await audit(req, `WRITER_${action.toUpperCase()}`, req.bundle.writer.userId, reason || `${result.fromWriterStatus} → ${result.toWriterStatus}`, req.bundle.writer._id);
        res.json({ writer: await detailFor(req, await loadWriterBundle({ _id: req.bundle.writer._id })) });
    } catch (err) { handleError(res, err, 'Failed to update writer.'); }
});

// PUT /api/admin/writers/:writerId/availability-override  { active, status?, reason? }
router.put('/:writerId/availability-override', requirePermission('writers.availability'), loadBundle, validateInput(availabilityOverrideSchema), async (req, res) => {
    try {
        const { active, status, reason } = req.body;
        const adminOverride = active
            ? { active: true, status, reason, setBy: req.admin.id, setAt: new Date() }
            : { active: false };
        await WriterAvailability.updateOne({ writerId: req.bundle.writer._id }, { $set: { adminOverride } }, { upsert: true });
        await audit(req, active ? `AVAILABILITY_OVERRIDE_${status}` : 'AVAILABILITY_OVERRIDE_CLEARED', req.bundle.writer.userId, reason || 'Override cleared', req.bundle.writer._id);
        await notifyWriter(req.bundle, {
            type: 'WRITER_AVAILABILITY_OVERRIDE',
            title: active ? 'Availability updated by admin' : 'Availability control restored',
            message: active
                ? `Your availability has been set to ${status.toLowerCase()} by the admin team. Reason: ${reason}`
                : 'You can manage your availability yourself again.',
        });
        res.json({ writer: await detailFor(req, await loadWriterBundle({ _id: req.bundle.writer._id })) });
    } catch (err) { handleError(res, err, 'Failed to update availability.'); }
});

// ── Documents ────────────────────────────────────────────────────────────────

// PATCH /api/admin/writers/documents/:docId  { reviewStatus, note? }
router.patch('/documents/:docId', requirePermission('writers.documents'), validateInput(documentReviewSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.docId)) return res.status(404).json({ error: 'Document not found.' });
        const doc = await WriterDocument.findByIdAndUpdate(req.params.docId,
            { $set: { reviewStatus: req.body.reviewStatus, reviewNote: req.body.note } }, { new: true });
        if (!doc) return res.status(404).json({ error: 'Document not found.' });
        const writer = await Writer.findById(doc.writerId).select('userId');
        await audit(req, `DOCUMENT_${req.body.reviewStatus}`, writer?.userId, `${doc.type}: ${doc.originalName}${req.body.note ? ` — ${req.body.note}` : ''}`, doc.writerId);
        res.json({ writer: await detailFor(req, await loadWriterBundle({ _id: doc.writerId })) });
    } catch (err) { handleError(res, err, 'Failed to update document.'); }
});

// Every document opened by an admin is audited.
router.get('/documents/:docId/file', requirePermission('writers.documents'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.docId)) return res.status(404).json({ error: 'File not found.' });
        const doc = await WriterDocument.findById(req.params.docId);
        if (!doc) return res.status(404).json({ error: 'File not found.' });
        const writer = await Writer.findById(doc.writerId).select('userId');
        await audit(req, 'WRITER_DOCUMENT_VIEWED', writer?.userId, `${doc.type}: ${doc.originalName}`, doc.writerId);
        streamStoredFile(res, doc, { download: req.query.download === '1' });
    } catch (err) { handleError(res, err, 'Failed to load file.'); }
});

export default router;
