import { Router } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';

const router = Router();

/**
 * Returns a configured Razorpay instance or null if credentials are missing.
 */
function getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        return null;
    }
    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret
    });
}

/**
 * STEP 1: BACKEND - Create Order
 * Endpoint: POST /api/create-order
 * Request: { amount (paise), currency, receipt, notes }
 * Return: { order_id, amount, currency, key_id }
 * Minimum amount: 100 paise
 */
router.post(['/create-order', '/api/create-order', '/orders/create-order', '/payments/create-order'], async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt, notes } = req.body;

        // Check credentials / auth
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) {
            return res.status(401).json({
                error: 'Razorpay credentials not configured or unauthorized.'
            });
        }

        // Validate amount >= 100 paise
        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount < 100) {
            return res.status(400).json({
                error: 'Invalid amount. Minimum amount is 100 paise (₹1).'
            });
        }

        const razorpay = getRazorpayClient();
        if (!razorpay) {
            return res.status(401).json({
                error: 'Failed to initialize Razorpay client. Check credentials.'
            });
        }

        const options = {
            amount: Math.round(numericAmount),
            currency: String(currency || 'INR').toUpperCase(),
            receipt: receipt || `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            ...(notes && typeof notes === 'object' ? { notes } : {})
        };

        const order = await razorpay.orders.create(options);

        return res.status(200).json({
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: keyId
        });
    } catch (err) {
        console.error('[Razorpay Create Order Error]:', err);
        // Handle auth failures (return 401)
        if (
            err.statusCode === 401 ||
            err.status === 401 ||
            (err.error?.code === 'BAD_REQUEST_ERROR' && err.error?.description?.toLowerCase().includes('auth'))
        ) {
            return res.status(401).json({ error: 'Razorpay authentication failed.' });
        }
        // Handle Razorpay API errors (return 500)
        return res.status(500).json({
            error: err.error?.description || err.message || 'Failed to create Razorpay order.'
        });
    }
});

/**
 * STEP 3: BACKEND - Verify Signature
 * Endpoint: POST /api/verify-payment
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Compare generated signature with razorpay_signature
 * Return success only if signatures match
 */
router.post(['/verify-payment', '/api/verify-payment', '/orders/verify-payment', '/payments/verify-payment'], (req, res) => {
    try {
        const order_id = req.body.razorpay_order_id || req.body.order_id;
        const payment_id = req.body.razorpay_payment_id || req.body.payment_id;
        const razorpay_signature = req.body.razorpay_signature || req.body.signature;

        // Check missing fields
        if (!order_id || !payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required payment verification fields (order_id, payment_id, razorpay_signature).'
            });
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
            return res.status(500).json({
                success: false,
                error: 'Razorpay key secret is not configured on server.'
            });
        }

        // HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
        const generatedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(`${order_id}|${payment_id}`)
            .digest('hex');

        // Timing-safe comparison to prevent timing attacks
        const expectedBuffer = Buffer.from(generatedSignature, 'utf8');
        const receivedBuffer = Buffer.from(razorpay_signature, 'utf8');

        const isMatch =
            expectedBuffer.length === receivedBuffer.length &&
            crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                error: 'Signature mismatch: payment could not be verified.',
                message: 'Invalid signature'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            order_id,
            payment_id
        });
    } catch (err) {
        console.error('[Razorpay Verify Payment Error]:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error verifying payment.'
        });
    }
});

export default router;
