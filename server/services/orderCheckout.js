import crypto from 'crypto';
import { Order, OrderCheckout } from '../db.js';
import { createRazorpayOrder, confirmRazorpayPayment, PaymentProviderError } from './paymentProviders.js';

// Online (Razorpay) payment for customer orders. The amount is always the
// server's own price for the order; the browser only ever receives a provider
// order for that amount. An order is created only once Razorpay confirms a
// captured payment of exactly that amount and currency — from the checkout
// callback or, if the browser was closed first, from the payment webhook.

export const newOrderId = () => `ACAD-${crypto.randomInt(100000, 1000000)}`;

// Creates the order record, retrying on the (rare) order-number collision.
export async function createOrderRecord(fields) {
    for (let attempt = 0; ; attempt++) {
        try { return await Order.create({ ...fields, orderId: newOrderId() }); }
        catch (err) { if (err?.code !== 11000 || attempt >= 4 || !/orderId/.test(err.message)) throw err; }
    }
}

/** Opens a Razorpay order for the server-priced order `fields`. */
export async function startCheckout({ userId, fields, amountMinor, currency }) {
    const checkout = await OrderCheckout.create({ userId, fields, amountMinor, currency, status: 'CREATED' });
    try {
        const rzp = await createRazorpayOrder({ amountMinor, currency, receipt: `order_${checkout._id}`, notes: { checkoutId: String(checkout._id) } });
        checkout.providerOrderId = rzp.id;
        await checkout.save();
        return checkout;
    } catch (err) {
        await OrderCheckout.deleteOne({ _id: checkout._id }).catch(() => {});
        throw err;
    }
}

/**
 * Turns a paid checkout into an order, exactly once. `payment` is the Razorpay
 * payment entity when it's already known (webhook); otherwise it's fetched and
 * checked (and captured if only authorised). Returns the order.
 */
export async function completeCheckout({ providerOrderId, paymentId, userId, payment }) {
    const scope = { providerOrderId, ...(userId && { userId }) };
    const claimed = await OrderCheckout.findOneAndUpdate({ ...scope, status: 'CREATED' }, { $set: { status: 'CONFIRMING' } }, { new: true });
    if (!claimed) {
        const done = await OrderCheckout.findOne({ ...scope, status: 'PAID' }).lean();
        if (done?.orderRef) return Order.findById(done.orderRef);        // already completed (retry / webhook + callback)
        throw new PaymentProviderError('This checkout was not found or is already being processed.', 404);
    }
    try {
        if (payment) {
            if (payment.order_id !== providerOrderId || payment.status !== 'captured' || payment.amount !== claimed.amountMinor || payment.currency !== claimed.currency)
                throw new PaymentProviderError('Payment does not match this order.', 400);
        } else {
            payment = await confirmRazorpayPayment({ paymentId, orderId: providerOrderId, amountMinor: claimed.amountMinor, currency: claimed.currency });
        }
        const order = await createOrderRecord({
            ...claimed.fields,
            userId: claimed.userId,
            transactionId: payment.id,
            payment: {
                provider: 'RAZORPAY', status: 'PAID',
                providerOrderId, providerPaymentId: payment.id,
                amountMinor: claimed.amountMinor, currency: claimed.currency, paidAt: new Date(),
            },
        });
        await OrderCheckout.updateOne({ _id: claimed._id }, { $set: { status: 'PAID', orderRef: order._id, providerPaymentId: payment.id } });
        return order;
    } catch (err) {
        // Let the customer (or the webhook) try again.
        await OrderCheckout.updateOne({ _id: claimed._id, status: 'CONFIRMING' }, { $set: { status: 'CREATED' } });
        throw err;
    }
}

// Webhook path: a captured payment for a customer-order checkout. Returns true
// when the event belonged to an order checkout.
export async function settleCheckoutFromWebhook(entity) {
    if (!entity?.order_id || !await OrderCheckout.exists({ providerOrderId: entity.order_id })) return false;
    if (entity.status !== 'captured') return true;
    try { await completeCheckout({ providerOrderId: entity.order_id, payment: entity }); }
    catch (err) {
        await OrderCheckout.updateOne({ providerOrderId: entity.order_id }, { $set: { needsAttention: err.message } });
        console.error('[Orders] webhook could not settle checkout', entity.order_id, err.message);
    }
    return true;
}
