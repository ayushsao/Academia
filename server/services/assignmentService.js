import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
    User, Order, WriterAvailability, Assignment, AssignmentOffer, AssignmentSubmission, WriterEarning, AssignmentRating,
    ACTIVE_ASSIGNMENT_STATUSES,
} from '../db.js';
import { getAssignmentSettings, workloadLimit } from './assignmentSettings.js';
import { rankCandidates } from './assignmentMatching.js';
import { recomputeWriterMetrics, timelinessFromLateness, weightedOverall } from './assignmentMetrics.js';
import { effectiveAvailability } from './writerService.js';
import { notify } from './notifications.js';
import { afterRating } from './abuse.js';
import { ORDER_UPLOADS_DIR, mimeForName, removeAssignmentFile } from './assignmentFiles.js';

const HOUR = 60 * 60 * 1000;

export class AssignmentError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

const genRef = () => `ASG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const event = (type, actorType, note = '', actorId) => ({ type, actorType, note, actorId, at: new Date() });

// In-app + preferred channels via the shared notification service.
const notifyWriter = (writerId, title, message, { category = 'ASSIGNMENT', type, link } = {}) =>
    notify({ writerId, category, type: type || `ASSIGNMENT_${category}`, title, message, link }).catch(err => console.error('[Assignments] notify failed:', err.message));
const assignmentLink = (a) => `/writer/assignments/${a.assignmentRef}`;

// ── Creation ──────────────────────────────────────────────────────────────────

// Maps the customer order form's academic levels onto writer academic levels.
const ORDER_LEVEL_MAP = { 'High School': 'High School', Undergraduate: 'Undergraduate', "Master's": "Master's", 'PhD / Doctoral': 'PhD', PhD: 'PhD' };
export const WORDS_PER_PAGE = 275;

// Suggested fields for an assignment created from an existing customer order.
export async function orderPrefill(orderRef) {
    const order = await Order.findOne({ orderId: orderRef });
    if (!order) throw new AssignmentError('Order not found.', 404);
    const deadline = new Date(order.deadline);
    const writerDeadline = Number.isNaN(deadline.getTime()) ? null : new Date(Math.max(Date.now() + 6 * HOUR, deadline.getTime() - 24 * HOUR));
    return {
        order: { orderId: order.orderId, status: order.status, assignedTo: order.assignedTo },
        prefill: {
            title: order.topicTitle, service: order.service, subject: order.subject,
            academicLevel: ORDER_LEVEL_MAP[order.academicLevel] || 'Undergraduate',
            wordCount: (order.pages || 1) * WORDS_PER_PAGE, instructions: order.instructions || '',
            clientDeadline: Number.isNaN(deadline.getTime()) ? null : deadline, writerDeadline,
            files: (order.files || []).map(f => ({ name: f.replace(/^\d+-/, '') })),
        },
    };
}

function orderFiles(order) {
    return (order.files || []).map(f => {
        const full = path.join(ORDER_UPLOADS_DIR, path.basename(f));
        const size = fs.existsSync(full) ? fs.statSync(full).size : 0;
        return { storedName: path.basename(f), originalName: f.replace(/^\d+-/, ''), mimeType: mimeForName(f), size, source: 'ORDER' };
    }).filter(f => f.size > 0);
}

export async function createAssignment(data, admin) {
    let order = null;
    if (data.orderRef) {
        order = await Order.findOne({ orderId: data.orderRef });
        if (!order) throw new AssignmentError('Linked order not found.', 404);
        if (await Assignment.exists({ orderId: order._id, status: { $ne: 'CANCELLED' } }))
            throw new AssignmentError('This order already has an assignment.', 409);
    }
    const { orderRef, ...fields } = data;
    return Assignment.create({
        ...fields,
        assignmentRef: genRef(),
        orderId: order?._id || null,
        source: order ? 'ORDER' : 'ADMIN',
        referenceFiles: order ? orderFiles(order) : [],
        status: 'DRAFT',
        createdBy: admin.id,
        history: [event('CREATED', 'ADMIN', order ? `From order ${order.orderId}` : '', admin.id)],
    });
}

const EDITABLE = ['DRAFT', 'OPEN', 'OFFERED', 'UNALLOCATED'];

export async function updateAssignment(a, data, admin) {
    if (!EDITABLE.includes(a.status)) throw new AssignmentError('Assignments can’t be edited once a writer has accepted them.', 409);
    const { orderRef, ...fields } = data;
    Object.assign(a, fields);
    a.history.push(event('UPDATED', 'ADMIN', '', admin.id));
    await a.save();
    return a;
}

// ── Allocation ────────────────────────────────────────────────────────────────

function offerExpiry(a, settings) {
    const byTtl = Date.now() + settings.offerTtlHours * HOUR;
    // Leave the writer at least half the remaining time to do the work.
    const byDeadline = Date.now() + Math.max(HOUR, (a.writerDeadline - Date.now()) / 2);
    return new Date(Math.min(byTtl, byDeadline));
}

async function createOffer(a, candidate, source, settings) {
    const offer = await AssignmentOffer.create({
        assignmentId: a._id, writerId: candidate.writerId, source, score: candidate.score ?? null,
        scoreBreakdown: candidate.breakdown || null, expiresAt: offerExpiry(a, settings),
    });
    await notifyWriter(candidate.writerId, 'New assignment opportunity',
        `You’ve been offered “${a.title}” (${a.subject}, ${a.wordCount.toLocaleString()} words). Respond by ${offer.expiresAt.toUTCString()} from your writer dashboard.`, { category: 'OPPORTUNITY', type: 'OFFER_RECEIVED', link: '/writer/opportunities' });
    return offer;
}

const pendingOffers = (assignmentId) => AssignmentOffer.countDocuments({ assignmentId, status: 'OFFERED' });

// Runs one allocation step for the assignment's mode. Safe to call repeatedly.
export async function allocate(a, settings) {
    settings = settings || await getAssignmentSettings();
    if (a.assignedWriterId || !['OPEN', 'OFFERED', 'UNALLOCATED'].includes(a.status)) return a;
    const mode = a.allocation.mode;
    a.allocation.lastRunAt = new Date();

    if (mode === 'MANUAL') {
        a.status = (await pendingOffers(a._id)) ? 'OFFERED' : 'OPEN';
        await a.save();
        return a;
    }
    if (await pendingOffers(a._id)) { await a.save(); return a; } // wait for current offers to resolve

    if (a.allocation.attempts >= settings.autoMaxAttempts) {
        a.status = 'UNALLOCATED';
        a.allocation.note = `No writer accepted after ${a.allocation.attempts} allocation round${a.allocation.attempts === 1 ? '' : 's'}.`;
        a.history.push(event('UNALLOCATED', 'SYSTEM', a.allocation.note));
        await a.save();
        return a;
    }
    const { eligible } = await rankCandidates(a, settings);
    const picks = eligible.slice(0, mode === 'HYBRID' ? settings.hybridShortlistSize : 1);
    if (!picks.length) {
        a.status = 'UNALLOCATED';
        a.allocation.note = 'No eligible writers are available right now.';
        a.history.push(event('UNALLOCATED', 'SYSTEM', a.allocation.note));
        await a.save();
        return a;
    }
    for (const c of picks) await createOffer(a, c, mode, settings);
    a.allocation.attempts += 1;
    a.status = mode === 'HYBRID' ? 'OPEN' : 'OFFERED';
    a.history.push(event(mode === 'HYBRID' ? 'SHORTLIST_OFFERED' : 'AUTO_OFFERED', 'SYSTEM', picks.map(p => `${p.name} (${p.score})`).join(', ')));
    await a.save();
    return a;
}

export async function publish(a, admin) {
    if (!['DRAFT', 'UNALLOCATED'].includes(a.status)) throw new AssignmentError('Only draft or unallocated assignments can be published.', 409);
    if (a.writerDeadline <= new Date()) throw new AssignmentError('Set a writer deadline in the future before publishing.');
    if (!a.payout?.amountMinor) throw new AssignmentError('Set a payout before publishing.');
    const settings = await getAssignmentSettings();
    a.allocation.mode = a.allocationMode || settings.allocationMode;
    if (a.status === 'UNALLOCATED') a.allocation.attempts = 0;
    a.status = 'OPEN';
    a.history.push(event('PUBLISHED', 'ADMIN', `Allocation: ${a.allocation.mode}`, admin.id));
    await a.save();
    return allocate(a, settings);
}

// Admin sends an offer to a specific writer (any mode). The writer must still be eligible.
export async function manualOffer(a, writerId, admin) {
    if (a.assignedWriterId || !['OPEN', 'OFFERED', 'UNALLOCATED'].includes(a.status))
        throw new AssignmentError('This assignment isn’t open for offers.', 409);
    const settings = await getAssignmentSettings();
    const { eligible, ineligible } = await rankCandidates(a, settings);
    const candidate = eligible.find(c => String(c.writerId) === String(writerId));
    if (!candidate) {
        const why = ineligible.find(c => String(c.writerId) === String(writerId));
        throw new AssignmentError(why ? `This writer isn’t eligible: ${why.reasons.join('; ')}.` : 'Writer not found or not an active member.', 409);
    }
    if (!a.allocation.mode) a.allocation.mode = a.allocationMode || settings.allocationMode;
    await createOffer(a, candidate, 'MANUAL', settings);
    a.status = a.allocation.mode === 'HYBRID' ? 'OPEN' : 'OFFERED';
    a.history.push(event('MANUAL_OFFER', 'ADMIN', candidate.name, admin.id));
    await a.save();
    return a;
}

// ── Writer responses ──────────────────────────────────────────────────────────

async function expireOffer(offer) {
    const res = await AssignmentOffer.updateOne({ _id: offer._id, status: 'OFFERED' }, { $set: { status: 'EXPIRED', respondedAt: new Date() } });
    return res.modifiedCount > 0;
}

export async function acceptOffer(offerId, writer) {
    const settings = await getAssignmentSettings();
    const offer = await AssignmentOffer.findOne({ _id: offerId, writerId: writer._id });
    if (!offer) throw new AssignmentError('Offer not found.', 404);
    if (offer.status !== 'OFFERED') throw new AssignmentError(`This offer is ${offer.status.toLowerCase()}.`, 409);
    if (offer.expiresAt <= new Date()) {
        await expireOffer(offer);
        await continueAllocation(offer.assignmentId, settings);
        throw new AssignmentError('This offer has expired.', 410);
    }
    // Re-check capacity and availability at the moment of acceptance.
    if (writer.status !== 'ACTIVE') throw new AssignmentError('An active membership is required to accept work.', 403);
    const availability = await WriterAvailability.findOne({ writerId: writer._id });
    if (effectiveAvailability(availability) !== 'AVAILABLE') throw new AssignmentError('Set yourself as available before accepting work.', 409);
    const active = await Assignment.countDocuments({ assignedWriterId: writer._id, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } });
    const limit = workloadLimit(writer, settings);
    if (active >= limit) throw new AssignmentError(`You’re at your workload limit (${active}/${limit}). Finish or submit current work first.`, 409);

    // First writer to accept wins; the atomic filter prevents double assignment.
    const now = new Date();
    const a = await Assignment.findOneAndUpdate(
        { _id: offer.assignmentId, assignedWriterId: null, status: { $in: ['OPEN', 'OFFERED'] } },
        { $set: { status: 'ASSIGNED', assignedWriterId: writer._id, assignedAt: now }, $push: { history: event('ACCEPTED', 'WRITER', '', writer.userId) } },
        { new: true },
    );
    if (!a) {
        await AssignmentOffer.updateOne({ _id: offer._id, status: 'OFFERED' }, { $set: { status: 'WITHDRAWN', withdrawnReason: 'Assigned to another writer' } });
        throw new AssignmentError('Sorry — this assignment has just been taken by another writer.', 409);
    }
    await AssignmentOffer.updateOne({ _id: offer._id }, { $set: { status: 'ACCEPTED', respondedAt: now } });

    const others = await AssignmentOffer.find({ assignmentId: a._id, status: 'OFFERED', _id: { $ne: offer._id } });
    await AssignmentOffer.updateMany({ _id: { $in: others.map(o => o._id) } }, { $set: { status: 'WITHDRAWN', withdrawnReason: 'Assigned to another writer' } });
    for (const o of others) await notifyWriter(o.writerId, 'Opportunity no longer available', `“${a.title}” has been assigned to another writer.`, { category: 'OPPORTUNITY', type: 'OFFER_CLOSED', link: '/writer/opportunities' });

    await WriterEarning.create({ assignmentId: a._id, writerId: writer._id, baseAmountMinor: a.payout.amountMinor, amountMinor: a.payout.amountMinor, currency: a.payout.currency, status: 'PENDING' });

    // Keep the linked customer order in step with the existing order workflow.
    if (a.orderId) {
        const user = await User.findById(writer.userId).select('name');
        await Order.updateOne({ _id: a.orderId }, { $set: { assignedTo: `${user?.name || 'Writer'} · ${a.assignmentRef}` } });
        await Order.updateOne({ _id: a.orderId, status: 'Pending' }, { $set: { status: 'In Progress' } });
    }
    await recomputeWriterMetrics(writer._id, settings);
    return a;
}

export const DECLINE_REASONS = { TOO_BUSY: 'Too busy right now', OUTSIDE_EXPERTISE: 'Outside my expertise', DEADLINE: 'Deadline too tight', PAYOUT: 'Payout too low', UNCLEAR: 'Requirements unclear', OTHER: 'Other' };

export async function declineOffer(offerId, writer, { code, reason }) {
    const offer = await AssignmentOffer.findOneAndUpdate(
        { _id: offerId, writerId: writer._id, status: 'OFFERED' },
        { $set: { status: 'DECLINED', respondedAt: new Date(), declineCode: code || '', declineReason: reason || '' } },
        { new: true },
    );
    if (!offer) throw new AssignmentError('This offer is no longer open.', 409);
    const settings = await getAssignmentSettings();
    const a = await Assignment.findById(offer.assignmentId);
    a?.history.push(event('DECLINED', 'WRITER', [DECLINE_REASONS[code], reason].filter(Boolean).join(' — '), writer.userId));
    await a?.save();
    await continueAllocation(offer.assignmentId, settings);
    await recomputeWriterMetrics(writer._id, settings);
    return offer;
}

async function continueAllocation(assignmentId, settings) {
    const a = await Assignment.findById(assignmentId);
    if (a && !a.assignedWriterId) await allocate(a, settings);
}

// ── Submissions & revision flow ─────────────────────────────────────────────
// Submitted → Under review → Revision requested → Resubmitted → Approved

export async function submitWork(a, writer, files, note) {
    if (String(a.assignedWriterId) !== String(writer._id)) throw new AssignmentError('Assignment not found.', 404);
    if (!['ASSIGNED', 'REVISION_REQUESTED'].includes(a.status)) throw new AssignmentError('This assignment isn’t waiting for a submission.', 409);
    const now = new Date();
    const version = (await AssignmentSubmission.countDocuments({ assignmentId: a._id, writerId: writer._id })) + 1;
    const dueAt = a.status === 'REVISION_REQUESTED' ? a.revisionDueAt : a.writerDeadline;
    const minutesLate = Math.max(0, Math.ceil((now - dueAt) / 60000));
    const submission = await AssignmentSubmission.create({ assignmentId: a._id, writerId: writer._id, version, files, note, dueAt, minutesLate });
    const isRevision = a.status === 'REVISION_REQUESTED';
    a.status = isRevision ? 'RESUBMITTED' : 'SUBMITTED';
    if (!a.firstSubmittedAt) a.firstSubmittedAt = now;
    a.history.push(event(isRevision ? 'RESUBMITTED' : 'SUBMITTED', 'WRITER', `Version ${version}${minutesLate ? ` · ${Math.round(minutesLate / 60)}h late` : ''}`, writer.userId));
    await a.save();
    return submission;
}

export async function reviewSubmission(a, decision, admin, { note = '', revisionHours, adjustment } = {}) {
    const settings = await getAssignmentSettings();
    const latest = await AssignmentSubmission.findOne({ assignmentId: a._id, writerId: a.assignedWriterId }).sort({ version: -1 });
    if (!latest) throw new AssignmentError('There is no submission to review.', 409);
    const reviewable = ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'];
    const now = new Date();

    if (decision === 'start_review') {
        if (!['SUBMITTED', 'RESUBMITTED'].includes(a.status)) throw new AssignmentError('This submission is not awaiting review.', 409);
        a.status = 'UNDER_REVIEW';
        latest.status = 'UNDER_REVIEW';
    } else if (decision === 'request_revision') {
        if (!reviewable.includes(a.status)) throw new AssignmentError('This submission can’t be sent back now.', 409);
        if (a.revisionCount >= settings.maxRevisions) throw new AssignmentError(`The revision limit (${settings.maxRevisions}) has been reached. Approve or cancel the assignment.`, 409);
        a.status = 'REVISION_REQUESTED';
        a.revisionCount += 1;
        a.revisionDueAt = new Date(now.getTime() + (revisionHours || settings.revisionHours) * HOUR);
        latest.status = 'REVISION_REQUESTED';
        await notifyWriter(a.assignedWriterId, 'Revision requested', `Please revise “${a.title}” by ${a.revisionDueAt.toUTCString()}.\n\n${note}`, { category: 'REVISION', type: 'REVISION_REQUESTED', link: assignmentLink(a) });
    } else if (decision === 'approve') {
        if (!reviewable.includes(a.status)) throw new AssignmentError('This submission can’t be approved now.', 409);
        a.status = 'APPROVED';
        a.approvedAt = now;
        latest.status = 'APPROVED';
        const earning = await WriterEarning.findOne({ assignmentId: a._id, writerId: a.assignedWriterId });
        if (earning && earning.status === 'PENDING') {
            if (adjustment?.amountMinor) {
                earning.adjustments.push({ amountMinor: adjustment.amountMinor, reason: adjustment.reason, by: admin.id });
                earning.amountMinor = Math.max(0, earning.amountMinor + adjustment.amountMinor);
            }
            earning.status = 'APPROVED';
            earning.approvedAt = now;
            await earning.save();
        }
        await notifyWriter(a.assignedWriterId, 'Work approved', `Your submission for “${a.title}” has been approved. The payout is now approved for payment.${note ? `\n\n${note}` : ''}`, { category: 'APPROVAL', type: 'WORK_APPROVED', link: assignmentLink(a) });
    } else {
        throw new AssignmentError('Unknown decision.');
    }
    latest.reviewNote = note;
    latest.reviewedBy = admin.id;
    latest.reviewedAt = now;
    await latest.save();
    a.history.push(event(decision.toUpperCase(), 'ADMIN', note, admin.id));
    await a.save();
    if (decision !== 'start_review') await recomputeWriterMetrics(a.assignedWriterId, settings);
    return a;
}

// ── Cancellation & release ────────────────────────────────────────────────────

async function withdrawOpenOffers(a, reason) {
    const open = await AssignmentOffer.find({ assignmentId: a._id, status: 'OFFERED' });
    await AssignmentOffer.updateMany({ _id: { $in: open.map(o => o._id) } }, { $set: { status: 'WITHDRAWN', withdrawnReason: reason } });
    for (const o of open) await notifyWriter(o.writerId, 'Opportunity withdrawn', `“${a.title}” is no longer available.`, { category: 'OPPORTUNITY', type: 'OFFER_WITHDRAWN', link: '/writer/opportunities' });
}

// earningAction: CANCEL (no payout), APPROVE (full), PARTIAL (partialAmountMinor)
async function settleEarningOnStop(a, admin, { earningAction = 'CANCEL', partialAmountMinor = 0, reason }) {
    const earning = await WriterEarning.findOne({ assignmentId: a._id, writerId: a.assignedWriterId });
    if (!earning || earning.status !== 'PENDING') return;
    if (earningAction === 'CANCEL') earning.status = 'CANCELLED';
    else {
        if (earningAction === 'PARTIAL') {
            const delta = Math.max(0, Math.min(partialAmountMinor, earning.amountMinor)) - earning.amountMinor;
            earning.adjustments.push({ amountMinor: delta, reason: `Partial payout: ${reason}`, by: admin.id });
            earning.amountMinor += delta;
        }
        earning.status = 'APPROVED';
        earning.approvedAt = new Date();
    }
    await earning.save();
}

export async function cancelAssignment(a, admin, { reason, writerAtFault = false, earningAction, partialAmountMinor }) {
    if (['APPROVED', 'CANCELLED'].includes(a.status)) throw new AssignmentError(`This assignment is already ${a.status.toLowerCase()}.`, 409);
    await withdrawOpenOffers(a, 'Assignment cancelled');
    if (a.assignedWriterId) {
        await settleEarningOnStop(a, admin, { earningAction, partialAmountMinor, reason });
        await notifyWriter(a.assignedWriterId, 'Assignment cancelled', `“${a.title}” has been cancelled.\n\nReason: ${reason}`, { type: 'ASSIGNMENT_CANCELLED', link: assignmentLink(a) });
    }
    a.status = 'CANCELLED';
    a.cancelledAt = new Date();
    a.cancelReason = reason;
    a.writerAtFault = Boolean(a.assignedWriterId) && writerAtFault;
    a.history.push(event('CANCELLED', 'ADMIN', `${reason}${a.writerAtFault ? ' (writer at fault)' : ''}`, admin.id));
    await a.save();
    if (a.assignedWriterId) await recomputeWriterMetrics(a.assignedWriterId);
    return a;
}

// Takes an in-progress assignment away from its writer and re-allocates it.
export async function releaseAssignment(a, admin, { reason, writerAtFault = false, earningAction, partialAmountMinor }) {
    if (!a.assignedWriterId || !['ASSIGNED', 'REVISION_REQUESTED'].includes(a.status))
        throw new AssignmentError('Only assignments in progress (not under review) can be released.', 409);
    const previousWriter = a.assignedWriterId;
    await settleEarningOnStop(a, admin, { earningAction, partialAmountMinor, reason });
    await AssignmentOffer.updateOne({ assignmentId: a._id, writerId: previousWriter, status: 'ACCEPTED' },
        { $set: { releasedAt: new Date(), releasedAtFault: Boolean(writerAtFault) } });
    await notifyWriter(previousWriter, 'Assignment reassigned', `“${a.title}” has been reassigned.\n\nReason: ${reason}`, { type: 'ASSIGNMENT_REASSIGNED', link: '/writer/assignments' });
    a.assignedWriterId = null;
    a.assignedAt = undefined;
    a.firstSubmittedAt = undefined;
    a.revisionDueAt = undefined;
    a.revisionCount = 0;
    a.status = 'OPEN';
    a.allocation.attempts = 0;
    a.rules.excludedWriterIds = [...(a.rules.excludedWriterIds || []), previousWriter];
    a.history.push(event('RELEASED', 'ADMIN', `${reason}${writerAtFault ? ' (writer at fault)' : ''}`, admin.id));
    await a.save();
    await recomputeWriterMetrics(previousWriter);
    return allocate(a);
}

// ── Ratings ───────────────────────────────────────────────────────────────────

export async function rateAssignment(a, admin, { quality, accuracy, communication, comment = '' }, editReason) {
    if (a.status !== 'APPROVED' || !a.assignedWriterId) throw new AssignmentError('Only approved assignments can be rated.', 409);
    const settings = await getAssignmentSettings();
    const first = await AssignmentSubmission.findOne({ assignmentId: a._id, writerId: a.assignedWriterId, version: 1 }).select('minutesLate');
    const timeliness = timelinessFromLateness(first?.minutesLate || 0);
    const scores = { quality, accuracy, timeliness, communication };
    const overall = weightedOverall(scores, settings.ratingWeights);

    let rating = await AssignmentRating.findOne({ assignmentId: a._id });
    let previous = null;
    if (rating) {
        previous = { overall: rating.overall };
        const ageDays = (Date.now() - rating.createdAt) / (24 * HOUR);
        if (ageDays > settings.ratingEditWindowDays) throw new AssignmentError(`Ratings can only be changed within ${settings.ratingEditWindowDays} days.`, 409);
        if (!editReason || editReason.trim().length < 5) throw new AssignmentError('Give a reason for changing this rating.', 400);
        rating.edits.push({ by: admin.id, at: new Date(), reason: editReason, previous: { quality: rating.quality, accuracy: rating.accuracy, communication: rating.communication, overall: rating.overall, comment: rating.comment } });
        Object.assign(rating, scores, { overall, comment });
        await rating.save();
    } else {
        try {
            rating = await AssignmentRating.create({ assignmentId: a._id, writerId: a.assignedWriterId, ratedBy: admin.id, ...scores, overall, comment });
        } catch (err) {
            if (err?.code === 11000) throw new AssignmentError('This assignment has already been rated.', 409);
            throw err;
        }
    }
    await recomputeWriterMetrics(a.assignedWriterId, settings);
    afterRating(rating, { previous }).catch(err => console.error('[Assignments] rating checks failed:', err.message));
    return rating;
}

// ── Earnings ─────────────────────────────────────────────────────────────────

export async function markEarningsPaid(ids, reference, admin) {
    const earnings = await WriterEarning.find({ _id: { $in: ids }, status: 'APPROVED' });
    if (!earnings.length) throw new AssignmentError('No approved earnings selected.', 409);
    const now = new Date();
    await WriterEarning.updateMany({ _id: { $in: earnings.map(e => e._id) }, status: 'APPROVED' },
        { $set: { status: 'PAID', paidAt: now, payoutReference: reference, paidBy: admin.id } });
    const byWriter = new Map();
    for (const e of earnings) byWriter.set(String(e.writerId), [...(byWriter.get(String(e.writerId)) || []), e]);
    for (const [writerId, list] of byWriter) {
        const totals = list.reduce((acc, e) => { acc[e.currency] = (acc[e.currency] || 0) + e.amountMinor; return acc; }, {});
        const summary = Object.entries(totals).map(([c, v]) => new Intl.NumberFormat('en', { style: 'currency', currency: c }).format(v / 10 ** (new Intl.NumberFormat('en', { style: 'currency', currency: c }).resolvedOptions().maximumFractionDigits))).join(', ');
        await notifyWriter(writerId, 'Payout sent', `We’ve paid ${summary} for ${list.length} assignment${list.length === 1 ? '' : 's'}. Reference: ${reference}.`, { category: 'PAYMENT', type: 'PAYOUT_SENT', link: '/writer/earnings' });
    }
    return earnings.length;
}

export async function adjustEarning(earning, admin, amountMinor, reason) {
    if (!['PENDING', 'APPROVED'].includes(earning.status)) throw new AssignmentError('Only unpaid earnings can be adjusted.', 409);
    if (earning.amountMinor + amountMinor < 0) throw new AssignmentError('An adjustment can’t make the payout negative.');
    earning.adjustments.push({ amountMinor, reason, by: admin.id });
    earning.amountMinor += amountMinor;
    await earning.save();
    await notifyWriter(earning.writerId, 'Payout adjusted', `A payout was adjusted: ${reason}`, { category: 'PAYMENT', type: 'PAYOUT_ADJUSTED', link: '/writer/earnings' });
    return earning;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

export async function runAssignmentLifecycle(now = new Date()) {
    const settings = await getAssignmentSettings();
    const summary = { expiredOffers: 0, unallocated: 0 };
    const stale = await AssignmentOffer.find({ status: 'OFFERED', expiresAt: { $lte: now } }).limit(500);
    const touched = new Set(), writers = new Set();
    for (const o of stale) {
        if (await expireOffer(o)) { summary.expiredOffers++; touched.add(String(o.assignmentId)); writers.add(String(o.writerId)); }
    }
    for (const id of touched) await continueAllocation(id, settings);
    for (const w of writers) await recomputeWriterMetrics(w, settings);

    // Unassigned work whose writer deadline has passed goes back to admins.
    const overdue = await Assignment.find({ assignedWriterId: null, status: { $in: ['OPEN', 'OFFERED'] }, writerDeadline: { $lte: now } }).limit(200);
    for (const a of overdue) {
        await withdrawOpenOffers(a, 'Deadline passed');
        a.status = 'UNALLOCATED';
        a.allocation.note = 'Writer deadline passed before anyone accepted.';
        a.history.push(event('UNALLOCATED', 'SYSTEM', a.allocation.note));
        await a.save();
        summary.unallocated++;
    }
    return summary;
}

let timer = null;
export function startAssignmentScheduler(intervalMs = 5 * 60 * 1000) {
    if (timer) return;
    const tick = () => runAssignmentLifecycle().then(s => { if (s.expiredOffers || s.unallocated) console.log('[Assignments] lifecycle:', s); })
        .catch(err => console.error('[Assignments] lifecycle failed:', err));
    tick();
    timer = setInterval(tick, intervalMs);
    timer.unref?.();
}

export { removeAssignmentFile };
