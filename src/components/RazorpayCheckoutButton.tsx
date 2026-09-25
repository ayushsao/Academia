import React, { useState } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  openRazorpayCheckout,
  RazorpayPaymentSuccessResponse
} from '../lib/razorpay';

export interface RazorpayCheckoutButtonProps {
  /** Amount in rupees / major units (converted to paise automatically if amountPaise is omitted) */
  amount?: number;
  /** Explicit amount in paise (minimum 100 paise) */
  amountPaise?: number;
  currency?: string;
  name?: string;
  description?: string;
  receipt?: string;
  notes?: Record<string, string>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  buttonText?: string;
  className?: string;
  disabled?: boolean;
  onSuccess: (paymentData: RazorpayPaymentSuccessResponse) => void | Promise<void>;
  onError?: (errorMessage: string) => void;
  onDismiss?: () => void;
}

export const RazorpayCheckoutButton: React.FC<RazorpayCheckoutButtonProps> = ({
  amount = 0,
  amountPaise,
  currency = 'INR',
  name = 'AcademiaPro',
  description = 'Academic Support & Consultation Services',
  receipt,
  notes,
  prefill,
  buttonText,
  className = '',
  disabled = false,
  onSuccess,
  onError,
  onDismiss
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [paymentSuccess, setPaymentSuccess] = useState<RazorpayPaymentSuccessResponse | null>(null);

  const calculatedPaise =
    amountPaise !== undefined
      ? amountPaise
      : Math.max(100, Math.round(Number(amount) * 100));

  const handlePay = async () => {
    if (disabled || loading) return;
    setLoading(true);
    setErrorMessage('');

    await openRazorpayCheckout({
      amountPaise: calculatedPaise,
      currency,
      name,
      description,
      receipt,
      notes,
      prefill,
      onSuccess: async (data) => {
        setPaymentSuccess(data);
        setLoading(false);
        try {
          await onSuccess(data);
        } catch (e: any) {
          console.error('[Payment callback error]:', e);
        }
      },
      onError: (msg) => {
        setLoading(false);
        setErrorMessage(msg);
        onError?.(msg);
      },
      onDismiss: () => {
        setLoading(false);
        onDismiss?.();
      }
    });
  };

  if (paymentSuccess) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 text-emerald-800 text-xs font-semibold animate-in fade-in">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <div>
          <span>Payment Verified Successfully!</span>
          <div className="font-mono text-[11px] text-emerald-700 mt-0.5">
            ID: {paymentSuccess.razorpay_payment_id}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handlePay}
        disabled={disabled || loading}
        className={
          className ||
          'w-full bg-[#002147] hover:bg-[#000a1e] text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.99]'
        }
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-[#fea520]" />
            <span>Processing with Razorpay...</span>
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 text-[#fea520]" />
            <span>
              {buttonText ||
                `Pay ₹${(calculatedPaise / 100).toLocaleString('en-IN')} with Razorpay`}
            </span>
          </>
        )}
      </button>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-center gap-2 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

export default RazorpayCheckoutButton;
