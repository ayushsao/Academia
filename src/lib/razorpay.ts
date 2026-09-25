import { api } from './api';

export interface RazorpayOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id?: string;
}

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayPaymentFailedResponse {
  error: {
    code: string;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: Record<string, any>;
  };
}

export interface OpenRazorpayOptions {
  amountPaise: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess: (paymentResult: RazorpayPaymentSuccessResponse) => void | Promise<void>;
  onError?: (errorMessage: string) => void;
  onDismiss?: () => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

/**
 * Loads the Razorpay checkout.js script if not already present on window.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay SDK');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * STEP 1: Calls backend endpoint POST /api/create-order (with automatic fallback)
 * Minimum amount: 100 minor units
 */
export async function createOrder(
  amountPaise: number,
  currency = 'INR',
  receipt?: string,
  notes?: Record<string, string>
): Promise<RazorpayOrderResponse> {
  const payload = {
    amount: amountPaise,
    currency,
    receipt,
    notes
  };

  try {
    return await api<RazorpayOrderResponse>('/create-order', {
      method: 'POST',
      body: payload
    });
  } catch (err: any) {
    if (err?.status === 404) {
      try {
        return await api<RazorpayOrderResponse>('/orders/create-order', {
          method: 'POST',
          body: payload
        });
      } catch {
        return await api<RazorpayOrderResponse>('/payments/create-order', {
          method: 'POST',
          body: payload
        });
      }
    }
    throw err;
  }
}

/**
 * STEP 3: Calls backend endpoint POST /api/verify-payment (with automatic fallback)
 */
export async function verifyPayment(
  paymentData: RazorpayPaymentSuccessResponse
): Promise<{ success: boolean; message: string; order_id: string; payment_id: string }> {
  try {
    return await api('/verify-payment', {
      method: 'POST',
      body: paymentData
    });
  } catch (err: any) {
    if (err?.status === 404) {
      try {
        return await api('/orders/verify-payment', {
          method: 'POST',
          body: paymentData
        });
      } catch {
        return await api('/payments/verify-payment', {
          method: 'POST',
          body: paymentData
        });
      }
    }
    throw err;
  }
}

/**
 * STEP 2: Front-end Standard Checkout Modal
 * Coordinates order creation, modal display, event handling (dismiss, failure),
 * and backend signature verification.
 */
export async function openRazorpayCheckout({
  amountPaise,
  currency = 'INR',
  receipt,
  notes,
  name = 'AcademiaPro',
  description = 'Academic Support & Consultation Services',
  prefill,
  onSuccess,
  onError,
  onDismiss
}: OpenRazorpayOptions): Promise<void> {
  try {
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded || !window.Razorpay) {
      const msg = 'Unable to load Razorpay payment gateway. Please check your internet connection.';
      onError?.(msg);
      return;
    }

    if (amountPaise < 100) {
      const msg = 'Payment amount must be at least ₹1 (100 paise).';
      onError?.(msg);
      return;
    }

    // 1. Create order on backend
    const orderData = await createOrder(amountPaise, currency, receipt, notes);
    const keyId =
      (import.meta as any).env.VITE_RAZORPAY_KEY_ID ||
      orderData.key_id ||
      'rzp_test_TgEfa8vYkz7zoV';

    // 2. Open Razorpay modal with order_id
    const options = {
      key: keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name,
      description,
      order_id: orderData.order_id,
      prefill: {
        name: prefill?.name || '',
        email: prefill?.email || '',
        contact: prefill?.contact || ''
      },
      theme: {
        color: '#002147'
      },
      handler: async (response: RazorpayPaymentSuccessResponse) => {
        try {
          // 3. Verify signature on backend
          const verification = await verifyPayment(response);
          if (verification && verification.success) {
            await onSuccess(response);
          } else {
            const msg = verification?.message || 'Payment signature verification failed.';
            onError?.(msg);
          }
        } catch (err: any) {
          const msg = err?.message || 'Payment verification failed on the server.';
          onError?.(msg);
        }
      },
      modal: {
        ondismiss: () => {
          onDismiss?.();
        }
      }
    };

    const rzp = new window.Razorpay(options);

    // Handle payment.failed event
    rzp.on('payment.failed', (response: RazorpayPaymentFailedResponse) => {
      const reason =
        response?.error?.description ||
        response?.error?.reason ||
        'Payment failed. Please try again.';
      onError?.(reason);
    });

    rzp.open();
  } catch (err: any) {
    console.error('[Razorpay Checkout Error]:', err);
    onError?.(err?.message || 'Failed to initiate payment.');
  }
}
