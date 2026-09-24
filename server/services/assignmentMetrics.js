import { Writer, Assignment, AssignmentOffer, AssignmentSubmission, AssignmentRating, WriterPerformance, ACTIVE_ASSIGNMENT_STATUSES } from '../db.js';
import { getAssignmentSettings } from './assignmentSettings.js';

const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : 0);
const round2 = (n) => Math.round(n * 100) / 100;

// Timeliness is derived from submission timestamps so it can't be entered by hand.
export function timelinessFromLateness(minutesLate) {
    if (minutesLate <= 0) return 5;
    if (minutesLate <= 12 * 60) return 4;
    if (minutesLate <= 24 * 60) return 3;
    if (minutesLate <= 72 * 60) return 2;
    return 1;
}

export function weightedOverall(r, weights) {
    const keys = ['quality', 'accuracy', 'timeliness', 'communication'];
    const total = keys.reduce((s, k) => s + (weights[k] || 0), 0) || 1;
    return round2(keys.reduce((s, k) => s + r[k] * (weights[k] || 0), 0) / total);
}

// Rebuilds every metric from source records. Nothing is incremented in place,
// so repeated events, retries or edits can't inflate a writer's numbers.
export async function recomputeWriterMetrics(writerId, settings) {
    settings = settings || await getAssignmentSettings();
    const [offers, assignments, ratings] = await Promise.all([
        AssignmentOffer.find({ writerId, status: { $in: ['ACCEPTED', 'DECLINED', 'EXPIRED'] } }).select('status releasedAtFault').lean(),
        Assignment.find({ assignedWriterId: writerId }).select('status writerAtFault revisionCount').lean(),
        AssignmentRating.find({ writerId }).select('overall').lean(),
    ]);

    const accepted = offers.filter(o => o.status === 'ACCEPTED').length;
    const declined = offers.filter(o => o.status === 'DECLINED').length;
    const expired = offers.filter(o => o.status === 'EXPIRED').length;

    const approved = assignments.filter(a => a.status === 'APPROVED');
    // Work the writer failed to finish: cancelled or taken back with the writer at fault.
    const faultCancels = assignments.filter(a => a.status === 'CANCELLED' && a.writerAtFault).length
        + offers.filter(o => o.releasedAtFault).length;
    const active = assignments.filter(a => ACTIVE_ASSIGNMENT_STATUSES.includes(a.status)).length;

    const firstSubs = approved.length
        ? await AssignmentSubmission.find({ assignmentId: { $in: approved.map(a => a._id) }, writerId, version: 1 }).select('minutesLate').lean()
        : [];
    const onTime = firstSubs.filter(s => (s.minutesLate || 0) <= 0).length;
    const revised = approved.filter(a => a.revisionCount > 0).length;

    const { mean, weight } = settings.ratingPrior;
    const n = ratings.length;
    const sum = ratings.reduce((s, r) => s + r.overall, 0);
    const bayesian = n ? round2((mean * weight + sum) / (weight + n)) : 0;

    const metrics = {
        rating: bayesian,
        ratingCount: n,
        completedAssignments: approved.length,
        responseRate: pct(accepted + declined, accepted + declined + expired),
        acceptanceRate: pct(accepted, accepted + declined),
        completionRate: pct(approved.length, approved.length + faultCancels),
        onTimeRate: pct(onTime, approved.length),
        revisionRate: pct(revised, approved.length),
        activeAssignments: active,
    };

    // Internal quality score: only meaningful once the writer has completed work.
    const w = settings.qualityWeights;
    const parts = {
        rating: n ? bayesian / 5 : (mean / 5),
        onTime: metrics.onTimeRate / 100,
        completion: metrics.completionRate / 100,
        revisions: 1 - metrics.revisionRate / 100,
        response: metrics.responseRate / 100,
    };
    const totalW = Object.keys(parts).reduce((s, k) => s + (w[k] || 0), 0) || 1;
    metrics.qualityScore = approved.length
        ? Math.round((Object.entries(parts).reduce((s, [k, v]) => s + v * (w[k] || 0), 0) / totalW) * 1000) / 10
        : 0;
    metrics.updatedAt = new Date();

    await Writer.updateOne({ _id: writerId }, { $set: { metrics } });
    // Daily history for trends (WriterPerformance); the latest value of the day wins.
    const { updatedAt, ...snapshot } = metrics;
    await WriterPerformance.updateOne({ writerId, day: new Date().toISOString().slice(0, 10) }, { $set: snapshot }, { upsert: true })
        .catch(err => console.error('[Metrics] snapshot failed:', err.message));
    return metrics;
}
