import { Order, OrderBid, Writer, User } from '../db.js';
import { notify } from './notifications.js';
import { ELIGIBLE_WRITER, canTakeOrders } from './orderRelease.js';

// Writer bidding on customer orders. An admin/HR opens bidding on an order with
// a writer budget (min–max); eligible writers bid within that range; the admin
// accepts one bid and the order is assigned to that writer at the bid amount.
// The customer's price (totalAmount / pricing) is never part of anything here
// that a writer can see.

export class BiddingError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

const OPEN_STATUSES = ['available', 'pending', 'Pending'];
// An order writers can bid on right now.
export const BIDDING_ORDER = { writerId: null, status: { $in: OPEN_STATUSES }, 'bidding.open': true };

const money = (n) => Math.round(Number(n) * 100) / 100;

// The brief a writer sees for a bidding project — no customer price, no customer identity.
export const writerBrief = (o) => ({
    orderId: o.orderId, service: o.service, subject: o.subject, academicLevel: o.academicLevel, topicTitle: o.topicTitle,
    description: o.description, instructions: o.instructions, pages: o.pages, wordCount: o.wordCount, deadline: o.deadline,
    turnitinReport: o.turnitinReport, topExpert: o.topExpert, abstractPage: o.abstractPage, filesCount: (o.files || []).length,
    budget: o.bidding ? { min: o.bidding.minBid, max: o.bidding.maxBid, currency: o.bidding.currency } : null,
    postedAt: o.bidding?.openedAt || o.createdAt,
});

const bidView = (b) => b && ({ id: String(b._id), amount: b.amount, currency: b.currency, note: b.note, status: b.status, updatedAt: b.updatedAt });

/** Admin/HR: open bidding or update the budget; closing keeps existing bids. */
export async function setBidding(orderId, { open, minBid, maxBid }) {
    const order = await Order.findOne({ orderId });
    if (!order) throw new BiddingError('Order not found.', 404);
    if (order.writerId || !OPEN_STATUSES.includes(order.status)) throw new BiddingError('Bidding is only for new orders that no writer has taken.', 409);
    const min = money(minBid), max = money(maxBid);
    if (!(min > 0) || !(max > 0) || min > max) throw new BiddingError('Set a writer budget: the minimum must be above 0 and not more than the maximum.');
    const wasOpen = Boolean(order.bidding?.open);
    const now = new Date();
    order.bidding = {
        open: Boolean(open), minBid: min, maxBid: max, currency: order.bidding?.currency || order.currency || 'GBP',
        openedAt: order.bidding?.openedAt || (open ? now : undefined), updatedAt: now, closedAt: open ? undefined : now,
    };
    // Opening bidding releases the order to writers.
    if (open) { order.adminApproved = true; order.adminApprovedAt = order.adminApprovedAt || now; order.status = 'available'; }
    await order.save();
    if (open && !wasOpen) notifyWriters(order).catch(err => console.error('[Bidding] notify failed:', err.message));
    return order;
}

async function notifyWriters(order) {
    const b = order.bidding;
    const writers = Writer.find(ELIGIBLE_WRITER).select('_id userId').lean().cursor();
    for await (const w of writers) {
        await notify({
            userId: w.userId, category: 'OPPORTUNITY', type: 'BIDDING_OPEN',
            title: `New project open for bids: ${order.subject}`,
            message: `“${order.topicTitle}” — ${order.pages} page${order.pages === 1 ? '' : 's'}, due ${order.deadline}. Budget ${b.currency} ${b.minBid}–${b.maxBid}. Place your bid.`,
            link: `/writer/bidding?order=${encodeURIComponent(order.orderId)}`,
            dedupeKey: `bidding-open:${order.orderId}:${w._id}`,
        }).catch(() => {});
    }
}

async function requireEligible(userId) {
    const writer = await Writer.findOne({ userId }).select('status membership').lean();
    if (!canTakeOrders(writer)) throw new BiddingError('An active membership plan is required to bid on projects.', 403);
}

/** Writer: open projects with their own bid (if any). */
export async function listForWriter(userId) {
    const writer = await Writer.findOne({ userId }).select('status membership').lean();
    if (!canTakeOrders(writer)) return { projects: [], requiresMembership: true };
    const orders = await Order.find(BIDDING_ORDER).sort({ 'bidding.openedAt': -1 }).lean();
    const bids = await OrderBid.find({ writerUserId: userId, order: { $in: orders.map(o => o._id) } }).lean();
    const mine = new Map(bids.map(b => [String(b.order), b]));
    return { projects: orders.map(o => ({ ...writerBrief(o), myBid: bidView(mine.get(String(o._id))) })), requiresMembership: false };
}

/** Writer: place or change a bid (only within the admin's budget). */
export async function placeBid(userId, orderId, { amount, note = '' }) {
    await requireEligible(userId);
    const order = await Order.findOne({ ...BIDDING_ORDER, orderId }).lean();
    if (!order) throw new BiddingError('This project is not open for bids.', 404);
    const value = money(amount);
    if (!(value >= order.bidding.minBid && value <= order.bidding.maxBid))
        throw new BiddingError(`Your bid must be between ${order.bidding.currency} ${order.bidding.minBid} and ${order.bidding.maxBid}.`);
    const existing = await OrderBid.findOne({ order: order._id, writerUserId: userId });
    if (existing && !['PENDING', 'WITHDRAWN'].includes(existing.status)) throw new BiddingError('This bid has already been decided.', 409);
    const bid = await OrderBid.findOneAndUpdate(
        { order: order._id, writerUserId: userId },
        { $set: { orderId: order.orderId, amount: value, currency: order.bidding.currency, note: String(note).slice(0, 1000), status: 'PENDING' } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return bidView(bid);
}

export async function withdrawBid(userId, orderId) {
    const bid = await OrderBid.findOneAndUpdate({ orderId, writerUserId: userId, status: 'PENDING' }, { $set: { status: 'WITHDRAWN' } }, { new: true });
    if (!bid) throw new BiddingError('No open bid to withdraw.', 404);
    return bidView(bid);
}

/** Admin: bids on one order (with writer names). */
export async function bidsForOrder(orderId) {
    const order = await Order.findOne({ orderId }).select('bidding writerId status').lean();
    if (!order) throw new BiddingError('Order not found.', 404);
    const bids = await OrderBid.find({ order: order._id }).sort({ amount: 1, createdAt: 1 }).lean();
    const users = await User.find({ _id: { $in: bids.map(b => b.writerUserId) } }).select('name').lean();
    const names = new Map(users.map(u => [String(u._id), u.name]));
    return {
        bidding: order.bidding || null,
        bids: bids.map(b => ({
            ...bidView(b), writerName: names.get(String(b.writerUserId)) || 'Writer',
            withinBudget: Boolean(order.bidding && b.amount >= order.bidding.minBid && b.amount <= order.bidding.maxBid),
            createdAt: b.createdAt,
        })),
    };
}

/** Admin: accept a bid → the order goes to that writer at the bid amount. */
export async function acceptBid(bidId) {
    const bid = await OrderBid.findById(bidId);
    if (!bid || bid.status !== 'PENDING') throw new BiddingError('This bid is no longer open.', 409);
    const writerUser = await User.findById(bid.writerUserId).select('name').lean();
    const current = await Order.findById(bid.order).select('bidding').lean();
    if (!current?.bidding || bid.amount < current.bidding.minBid || bid.amount > current.bidding.maxBid)
        throw new BiddingError('This bid is outside the current writer budget.', 409);
    // Atomic: only one bid can win, and only while the order is still open.
    const order = await Order.findOneAndUpdate(
        { _id: bid.order, writerId: null, status: { $in: OPEN_STATUSES } },
        { $set: {
            writerId: bid.writerUserId, status: 'in_progress', assignedTo: writerUser?.name || 'Writer',
            writerPayout: { amount: bid.amount, currency: bid.currency, source: 'BID' },
            'bidding.open': false, 'bidding.closedAt': new Date(),
        } },
        { new: true },
    );
    if (!order) throw new BiddingError('This order has already been assigned.', 409);
    bid.status = 'ACCEPTED'; await bid.save();
    const others = await OrderBid.find({ order: order._id, _id: { $ne: bid._id }, status: 'PENDING' }).select('writerUserId').lean();
    await OrderBid.updateMany({ order: order._id, _id: { $ne: bid._id }, status: 'PENDING' }, { $set: { status: 'REJECTED' } });
    notify({ userId: bid.writerUserId, category: 'ASSIGNMENT', type: 'BID_ACCEPTED', title: `Your bid was accepted: ${order.orderId}`,
        message: `You've been assigned “${order.topicTitle}” for ${bid.currency} ${bid.amount}. Due ${order.deadline}.`, link: '/writer/orders' }).catch(() => {});
    for (const o of others) notify({ userId: o.writerUserId, category: 'OPPORTUNITY', type: 'BID_NOT_SELECTED', title: `Project assigned: ${order.orderId}`,
        message: `“${order.topicTitle}” was assigned to another writer. Thanks for bidding.`, link: '/writer/bidding' }).catch(() => {});
    return order;
}
