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

// Released and not yet taken by a writer.
export const OPEN_ORDER = { adminApproved: true, writerId: null, status: { $in: ['available', 'pending', 'Pending'] } };

// What a writer may see of an order: the brief. Never the client's contact
// details, payment references, pricing breakdown or internal admin notes.
export const WRITER_HIDDEN_FIELDS = '-userId -transactionId -payment -pricing -catalog -adminNotes -feedback';

/**
 * Approves an order and releases it to eligible writers. Returns the released
 * order, or null when it is no longer awaiting release (already released,
 * taken by a writer, or closed) — so writers are never notified twice.
 */
export async function releaseOrder(orderId) {
    const order = await Order.findOneAndUpdate(
        { orderId, adminApproved: { $ne: true }, writerId: null, status: { $in: ['pending', 'Pending'] } },
        { $set: { adminApproved: true, adminApprovedAt: new Date(), status: 'available' } },
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
            title: `New client order: ${order.subject}`,
            message: `“${order.topicTitle}” — ${order.pages} page${order.pages === 1 ? '' : 's'}, due ${order.deadline}. The first writer to accept gets it.`,
            link: '/writer/opportunities',
            dedupeKey: `order-available:${order.orderId}:${w._id}`,
        }).catch(() => {});
    }
}
