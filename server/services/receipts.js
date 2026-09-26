import { Order, SiteSettings, User } from '../db.js';

// Payment receipts. A receipt is issued only for a confirmed payment: an online
// payment verified with Razorpay, or a manual payment an admin has marked as
// received. Each receipt gets a unique, sequential number.

export const BUSINESS = {
    name: 'AssignmentMinds',
    email: 'assignmentminds@gmail.com',
    phone: '+91 92636 06941',
    website: (process.env.APP_URL || 'https://academia-wheat-eta.vercel.app').replace(/\/+$/, ''),
};

export const isPaid = (order) => order?.payment?.status === 'PAID';

async function nextNumber(issuedAt) {
    const counter = await SiteSettings.findOneAndUpdate({ key: 'receipt_counter' }, { $inc: { value: 1 } }, { upsert: true, new: true }).lean();
    return `AM-${issuedAt.getFullYear()}-${String(counter.value).padStart(6, '0')}`;
}

/** Gives a paid order its receipt number (once). Returns the order with `receipt`, or null if not paid. */
export async function issueReceipt(orderId) {
    const order = await Order.findById(orderId).select('payment receipt').lean();
    if (!isPaid(order)) return null;
    if (order.receipt?.number) return order;
    const issuedAt = new Date();
    const number = await nextNumber(issuedAt);
    return Order.findOneAndUpdate({ _id: orderId, 'receipt.number': { $exists: false } }, { $set: { receipt: { number, issuedAt } } }, { new: true }).lean()
        .then(o => o || Order.findById(orderId).lean());   // another request issued it first
}

const money = (n) => Math.round(Number(n || 0) * 100) / 100;

/** Everything the receipt shows — built only from what was saved with the order. */
export async function receiptView(order) {
    const customer = await User.findById(order.userId).select('name email').lean();
    const currency = order.payment?.currency || order.pricing?.currency || order.currency || 'GBP';
    const paid = order.payment?.amountMinor != null ? order.payment.amountMinor / 100 : money(order.totalAmount);
    const words = order.wordCount || order.pricing?.words;
    const lines = [];
    if (order.pricing?.total != null) {
        lines.push({ label: `${order.service} — ${order.pricing.pages ?? order.pages} page${(order.pricing.pages ?? order.pages) === 1 ? '' : 's'}${words ? `, ${Number(words).toLocaleString('en-GB')} words` : ''} (${order.academicLevel})`, amount: money(order.pricing.subtotal) });
        for (const a of order.pricing.addOns || []) lines.push({ label: a.label, amount: money(a.price) });
        if (order.pricing.discount) lines.push({ label: `Discount${order.pricing.discountPercent ? ` (${order.pricing.discountPercent}%)` : ''}`, amount: -money(order.pricing.discount) });
    } else if (order.catalog?.totalMinor != null) {
        lines.push({ label: `${order.catalog.projectTitle || order.service} — ${order.pages} page${order.pages === 1 ? '' : 's'}`, amount: order.catalog.totalMinor / 100 });
    } else {
        lines.push({ label: `${order.service} — ${order.pages} page${order.pages === 1 ? '' : 's'}`, amount: money(order.totalAmount) });
    }
    const online = order.payment?.provider === 'RAZORPAY';
    return {
        number: order.receipt.number,
        issuedAt: order.receipt.issuedAt,
        paidAt: order.payment?.paidAt || order.receipt.issuedAt,
        status: 'PAID',
        business: BUSINESS,
        billedTo: { name: customer?.name || '', email: customer?.email || '' },
        order: {
            orderId: order.orderId, topicTitle: order.topicTitle, service: order.service, subject: order.subject,
            academicLevel: order.academicLevel, pages: order.pages, wordCount: words || null, deadline: order.deadline, placedAt: order.createdAt,
        },
        lines,
        total: paid,
        currency,
        method: online ? 'Online payment (card / UPI via Razorpay)' : 'Manual payment (UPI / PayPal / bank transfer)',
        reference: order.payment?.providerPaymentId || order.transactionId || '',
    };
}
