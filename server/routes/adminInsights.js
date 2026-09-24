import { Router } from 'express';
import {
    Writer, WriterApplication, WriterAvailability, WriterProfile, WriterSubscription, Assignment, AssignmentSubmission, AssignmentRating,
    Contact, ACTIVE_ASSIGNMENT_STATUSES,
} from '../db.js';
import { authenticateAdmin } from '../middleware.js';
import { can, requirePermission, noStore } from '../permissions.js';
import { membershipAnalytics } from '../services/membershipAnalytics.js';
import { getAssignmentSettings, workloadLimit } from '../services/assignmentSettings.js';
import { effectiveAvailability } from '../services/writerService.js';

// Mounted at /api/admin/insights. Aggregated, non-personal metrics. Each dashboard
// section is only computed for roles allowed to see that area.
const router = Router();
router.use(noStore, authenticateAdmin);

const DAY = 24 * 3600 * 1000;
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
const countBy = (rows) => Object.fromEntries(rows.map(r => [r._id ?? 'NONE', r.n]));

async function writerSection() {
    const [byStatus, byMembership, newLast30] = await Promise.all([
        Writer.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        Writer.aggregate([{ $group: { _id: '$membership.status', n: { $sum: 1 } } }]),
        Writer.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * DAY) } }),
    ]);
    const s = countBy(byStatus), m = countBy(byMembership);
    const total = Object.values(s).reduce((a, b) => a + b, 0);
    return {
        total,
        active: s.ACTIVE || 0,
        paid: (m.ACTIVE || 0) + (m.PAST_DUE || 0),
        pending: (s.PENDING || 0) + (s.UNDER_REVIEW || 0),
        approvedAwaitingMembership: s.APPROVED || 0,
        suspended: s.SUSPENDED || 0,
        rejected: s.REJECTED || 0,
        inactive: s.INACTIVE || 0,
        newLast30Days: newLast30,
    };
}

async function subscriptionSection() {
    const to = new Date(), from = new Date(Date.now() - 30 * DAY);
    const [live, analytics] = await Promise.all([
        WriterSubscription.aggregate([{ $match: { status: { $in: ['ACTIVE', 'PAST_DUE'] } } }, { $group: { _id: '$billingPeriod', n: { $sum: 1 } } }]),
        membershipAnalytics({ from, to }),
    ]);
    const byPeriod = countBy(live);
    return {
        active: analytics.subscribers.active,
        pastDue: analytics.subscribers.pastDue,
        monthly: byPeriod.MONTHLY || 0,
        annual: byPeriod.ANNUAL || 0,
        mrr: analytics.mrr,
        arr: analytics.arr,
        revenueLast30Days: analytics.collected,
        revenueLast12Months: analytics.collectedLast12Months,
        cancellationsLast30Days: analytics.subscribers.cancelledInRange,
        cancellingAtPeriodEnd: analytics.subscribers.cancellingAtPeriodEnd,
        reportingCurrency: analytics.reportingCurrency,
        pendingVerification: analytics.queue.pendingVerification,
    };
}

async function operationsSection() {
    const settings = await getAssignmentSettings();
    const [byStatus, completedLast30, writers] = await Promise.all([
        Assignment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        Assignment.countDocuments({ status: 'APPROVED', approvedAt: { $gte: new Date(Date.now() - 30 * DAY) } }),
        Writer.find({ status: 'ACTIVE' }).select('workload').lean(),
    ]);
    const s = countBy(byStatus);
    const ids = writers.map(w => w._id);
    const [availability, active] = await Promise.all([
        WriterAvailability.find({ writerId: { $in: ids } }).lean(),
        Assignment.aggregate([{ $match: { assignedWriterId: { $in: ids }, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } } }, { $group: { _id: '$assignedWriterId', n: { $sum: 1 } } }]),
    ]);
    const availMap = new Map(availability.map(a => [String(a.writerId), a]));
    const activeMap = new Map(active.map(a => [String(a._id), a.n]));
    const available = writers.filter(w => effectiveAvailability(availMap.get(String(w._id))) === 'AVAILABLE' && (activeMap.get(String(w._id)) || 0) < workloadLimit(w, settings)).length;
    const sum = (keys) => keys.reduce((n, k) => n + (s[k] || 0), 0);
    return {
        active: sum(ACTIVE_ASSIGNMENT_STATUSES),
        awaitingReview: sum(['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW']),
        pending: sum(['DRAFT', 'OPEN', 'OFFERED', 'UNALLOCATED']),
        needsAllocation: s.UNALLOCATED || 0,
        completed: s.APPROVED || 0,
        completedLast30Days: completedLast30,
        cancelled: s.CANCELLED || 0,
        availableWriters: available,
        activeMemberWriters: writers.length,
    };
}

async function performanceSection() {
    const [ratingAgg, approved, faultCancels, qualityAgg] = await Promise.all([
        AssignmentRating.aggregate([{ $group: { _id: null, avg: { $avg: '$overall' }, n: { $sum: 1 } } }]),
        Assignment.find({ status: 'APPROVED', assignedWriterId: { $ne: null } }).select('_id assignedWriterId').lean(),
        Assignment.countDocuments({ status: 'CANCELLED', writerAtFault: true }),
        Writer.aggregate([{ $match: { 'metrics.completedAssignments': { $gt: 0 } } }, { $group: { _id: null, avg: { $avg: '$metrics.qualityScore' } } }]),
    ]);
    // First submission by the writer who completed the work (a released writer's drafts don't count).
    const completedBy = new Map(approved.map(a => [String(a._id), String(a.assignedWriterId)]));
    const firstSubs = approved.length
        ? (await AssignmentSubmission.find({ assignmentId: { $in: approved.map(a => a._id) }, version: 1 }).select('assignmentId writerId minutesLate').lean())
            .filter(s => completedBy.get(String(s.assignmentId)) === String(s.writerId))
        : [];
    return {
        averageRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 100) / 100 : null,
        ratedAssignments: ratingAgg[0]?.n || 0,
        completionRate: pct(approved.length, approved.length + faultCancels),
        onTimeRate: pct(firstSubs.filter(s => (s.minutesLate || 0) <= 0).length, firstSubs.length),
        averageQualityScore: qualityAgg[0] ? Math.round(qualityAgg[0].avg * 10) / 10 : null,
    };
}

// GET /api/admin/insights/dashboard
router.get('/dashboard', requirePermission('dashboard.view'), async (req, res) => {
    try {
        const role = req.admin.adminRole;
        const tasks = {};
        if (can(role, 'writers.read') || can(role, 'recruitment.read')) tasks.writers = writerSection();
        if (can(role, 'subscriptions.read')) tasks.subscriptions = subscriptionSection();
        if (can(role, 'assignments.manage')) tasks.operations = operationsSection();
        if (can(role, 'writers.performance')) tasks.performance = performanceSection();
        const entries = await Promise.all(Object.entries(tasks).map(async ([k, p]) => [k, await p]));
        res.json({ generatedAt: new Date(), role, sections: Object.fromEntries(entries) });
    } catch (err) {
        console.error('[Insights] dashboard failed:', err);
        res.status(500).json({ error: 'Failed to load dashboard.' });
    }
});

// GET /api/admin/insights/recruitment — writer acquisition funnel (no personal data).
router.get('/recruitment', requirePermission('recruitment.read'), async (req, res) => {
    try {
        const since = new Date(Date.now() - 84 * DAY);
        const [registered, emailVerified, phoneVerified, submitted, approved, active, byCountry, weekly, leads] = await Promise.all([
            Writer.countDocuments(),
            Writer.countDocuments({ emailVerified: true }),
            Writer.countDocuments({ phoneVerified: true }),
            WriterApplication.countDocuments({ submittedAt: { $ne: null } }),
            Writer.countDocuments({ status: { $in: ['APPROVED', 'ACTIVE'] } }),
            Writer.countDocuments({ status: 'ACTIVE' }),
            WriterProfile.aggregate([
                { $lookup: { from: 'writers', localField: 'writerId', foreignField: '_id', as: 'w' } },
                { $unwind: '$w' },
                { $group: { _id: '$country', registered: { $sum: 1 }, approved: { $sum: { $cond: [{ $in: ['$w.status', ['APPROVED', 'ACTIVE']] }, 1, 0] } } } },
                { $sort: { registered: -1 } }, { $limit: 15 },
            ]),
            Writer.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%G-W%V', date: '$createdAt' } }, n: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
            Promise.all([Contact.countDocuments(), Contact.countDocuments({ status: 'unread' }), Contact.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * DAY) } })]),
        ]);
        const stages = [
            { key: 'registered', label: 'Registered', n: registered },
            { key: 'emailVerified', label: 'Email verified', n: emailVerified },
            { key: 'phoneVerified', label: 'Phone verified', n: phoneVerified },
            { key: 'submitted', label: 'Application submitted', n: submitted },
            { key: 'approved', label: 'Approved', n: approved },
            { key: 'active', label: 'Active member', n: active },
        ].map((s, i, all) => ({ ...s, ofPrevious: i ? pct(s.n, all[i - 1].n) : null, ofRegistered: pct(s.n, registered) }));
        res.json({
            funnel: stages,
            byCountry: byCountry.map(c => ({ country: c._id, registered: c.registered, approved: c.approved })),
            weeklyRegistrations: weekly.map(w => ({ week: w._id, registrations: w.n })),
            leads: { total: leads[0], unread: leads[1], last30Days: leads[2] },
        });
    } catch (err) {
        console.error('[Insights] recruitment failed:', err);
        res.status(500).json({ error: 'Failed to load recruitment data.' });
    }
});

export default router;
