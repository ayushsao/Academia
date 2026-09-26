import { Order, Writer, SiteSettings } from '../db.js';
import { remember, cacheDel } from './cache.js';
import { notify } from './notifications.js';

// Releasing customer orders to the writer marketplace. An admin approves an
// order (or, with auto-approve on, a paid order is approved as soon as it is
// placed); it then shows under Opportunities for every writer with a live
// membership plan, whatever their subject. The first writer to accept gets it.

const KEY = 'orders';
export const DEFAULT_ORDER_SETTINGS = {
    // Approve and release new orders automatically. Only orders whose online
    // payment the server confirmed qualify; manual (UPI/PayPal/bank) payments
    // still wait for an admin to check the payment and approve.
    autoRelease: false,
};

export async function getOrderSettings() {
    return remember('settings:orders', 900, async () => {
        const doc = await SiteSettings.findOne({ key: KEY }).lean();
        return { ...DEFAULT_ORDER_SETTINGS, ...(doc?.value || {}) };
    });
}

export async function saveOrderSettings(changes) {
    const value = { ...await getOrderSettings(), ...changes };
    await SiteSettings.findOneAndUpdate({ key: KEY }, { $set: { value } }, { upsert: true });
    await cacheDel('settings:orders');
    return getOrderSettings();
}

// Writers who can see and accept client orders: approved, with a live plan.
export const ELIGIBLE_WRITER = { status: { $in: ['APPROVED', 'ACTIVE'] }, 'membership.status': 'ACTIVE' };
export const canTakeOrders = (writer) => Boolean(writer && ['APPROVED', 'ACTIVE'].includes(writer.status) && writer.membership?.status === 'ACTIVE');

// Released and not yet taken by a writer — open for writers' bids unless an
// admin has closed bidding on it.
export const OPEN_ORDER = { adminApproved: true, writerId: null, status: { $in: ['available', 'pending', 'Pending'] }, 'bidding.open': { $ne: false } };

// What a writer may see of an order: the brief. Never the client's contact
// details, payment references, pricing breakdown or internal admin notes.
export const WRITER_HIDDEN_FIELDS = '-userId -transactionId -payment -pricing -catalog -adminNotes -feedback -totalAmount -paymentStatus -bidding';

/**
 * A customer's view of their own order: everything about their order and the
 * delivered work, but not the admins' internal notes, the writer's account ID
 * or where files are stored on the server.
 */
export const isCompleted = (status) => status === 'completed' || status === 'Completed';

export function clientOrderView(order) {
    const o = typeof order?.toObject === 'function' ? order.toObject() : { ...order };
    delete o.adminNotes;
    delete o.revisionNote;
    delete o.writerId;
    if (o.feedback) delete o.feedback.writerId;
    // Word-priced orders: the customer sees words, pages, spacing, delivery type,
    // deadline and the final price — never the multiplier, the INR amount or the exchange rate.
    if (o.pricing?.model === 'WORDS') {
        const { words, spacing, wordsPerPage, pages, deadlineAt, deliveryType, total, currency, quotedAt, model } = o.pricing;
        o.pricing = { model, words, spacing, wordsPerPage, pages, deadlineAt, deliveryType, total, subtotal: total, currency, quotedAt };
    }
    // The customer receives the work after an admin has approved it.
    o.deliveryFiles = isCompleted(o.status) ? (o.deliveryFiles || []).map(({ filePath, uploadedBy, ...file }) => file) : [];
    return o;
}

/**
 * Approves an order and releases it to eligible writers. Returns the released
 * order, or null when it is no longer awaiting release (already released,
 * taken by a writer, or closed) — so writers are never notified twice.
 */
export async function releaseOrder(orderId) {
    // The bid limit comes from the admin's rates for this kind of work and its word count.
    const pending = await Order.findOne({ orderId }).select('service wordCount pages currency pricing').lean();
    const { budgetFor } = await import('./bidLimits.js');
    const budget = pending ? await budgetFor(pending).catch(() => null) : null;
    const now = new Date();
    const order = await Order.findOneAndUpdate(
        { orderId, adminApproved: { $ne: true }, writerId: null, status: { $in: ['pending', 'Pending'] } },
        { $set: {
            adminApproved: true, adminApprovedAt: now, status: 'available', 'bidding.open': true, 'bidding.openedAt': now,
            ...(budget && { 'bidding.minBid': budget.minBid, 'bidding.maxBid': budget.maxBid, 'bidding.currency': budget.currency }),
        } },
        { new: true },
    );
    if (order) notifyEligibleWriters(order).catch(err => console.error('[Orders] writer notifications failed:', err.message));
    return order;
}

/** Called when an order is placed: releases it straight away if auto-approve is on and it is paid. */
export async function autoReleaseIfEnabled(order) {
    try {
        if (order?.payment?.status !== 'PAID') return null;
        if (!(await getOrderSettings()).autoRelease) return null;
        return await releaseOrder(order.orderId);
    } catch (err) {
        console.error('[Orders] auto-approve failed:', err.message);   // the admin can still approve it by hand
        return null;
    }
}

async function notifyEligibleWriters(order) {
    const writers = Writer.find(ELIGIBLE_WRITER).select('_id userId').lean().cursor();
    for await (const w of writers) {
        await notify({
            userId: w.userId,
            category: 'OPPORTUNITY',
            type: 'ORDER_AVAILABLE',
            title: `New project open for bids: ${order.subject}`,
            message: `“${order.topicTitle}” — ${order.pages} page${order.pages === 1 ? '' : 's'}, due ${order.deadline}.${order.bidding?.minBid != null ? ` Bid limit ${order.bidding.currency} ${order.bidding.minBid}–${order.bidding.maxBid}.` : ''} Place your bid.`,
            link: `/writer/bidding?order=${encodeURIComponent(order.orderId)}`,
            dedupeKey: `order-available:${order.orderId}:${w._id}`,
        }).catch(() => {});
    }
}
