// Razorpay Standard Checkout for customer orders.
//
// The browser never decides the amount: the server prices the order and opens
// a Razorpay order for exactly that amount (POST /api/orders/checkout). This
// module only shows Razorpay's payment window for that server order and hands
// the callback back to the caller, which confirms it with the server
// (POST /api/orders/checkout/confirm) before any order exists.

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayPaymentFailedResponse {
  error: { code: string; description: string; source?: string; step?: string; reason?: string };
}

/** What POST /api/orders/checkout returns. */
export interface ServerCheckout {
  keyId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
}

export interface OpenRazorpayOptions {
  checkout: ServerCheckout;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (paymentResult: RazorpayPaymentSuccessResponse) => void | Promise<void>;
  onError?: (errorMessage: string) => void;
  onDismiss?: () => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

/** Loads Razorpay's checkout.js on demand (only when a customer pays). */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/** Opens Razorpay's payment window for a server-created order. */
export async function openRazorpayCheckout({
  checkout,
  name = 'AssignmentMinds',
  description = 'Academic Support & Consultation Services',
  prefill,
  onSuccess,
  onError,
  onDismiss,
}: OpenRazorpayOptions): Promise<void> {
  try {
    if (!(await loadRazorpayScript()) || !window.Razorpay) {
      onError?.('Unable to load the payment window. Please check your internet connection.');
      return;
    }
    const rzp = new window.Razorpay({
      key: checkout.keyId,
      order_id: checkout.orderId,
      amount: checkout.amountMinor,
      currency: checkout.currency,
      name,
      description,
      prefill: { name: prefill?.name || '', email: prefill?.email || '', contact: prefill?.contact || '' },
      theme: { color: '#002147' },
      handler: (response: RazorpayPaymentSuccessResponse) => { void onSuccess(response); },
      modal: { ondismiss: () => onDismiss?.() },
    });
    rzp.on('payment.failed', (response: RazorpayPaymentFailedResponse) => {
      onError?.(response?.error?.description || response?.error?.reason || 'Payment failed. Please try again.');
    });
    rzp.open();
  } catch (err: any) {
    onError?.(err?.message || 'Failed to start the payment.');
  }
}
