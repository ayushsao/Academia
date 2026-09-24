export type BillingPeriod = 'MONTHLY' | 'ANNUAL';
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED';
export type PaymentStatus = 'CREATED' | 'PENDING_VERIFICATION' | 'PAID' | 'FAILED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface PlanPrice {
    currency: string;
    billingPeriod: BillingPeriod;
    listAmountMinor: number;
    discountPercent: number;
    amountMinor: number;
}

export interface PublicPlan {
    code: string;
    name: string;
    description: string;
    features: string[];
    tier: number;
    highlight: boolean;
    prices: PlanPrice[];
}

export interface Subscription {
    subscriptionId: string;
    planCode: string;
    planName: string;
    tier: number;
    billingPeriod: BillingPeriod;
    currency: string;
    amountMinor: number;
    listAmountMinor: number;
    discountPercent: number;
    status: SubscriptionStatus;
    autoRenew: boolean;
    startDate?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    graceEndsAt?: string;
    cancelledAt?: string;
    endedAt?: string;
    endReason?: string;
    createdAt: string;
    scheduledChange: { planCode: string; planName: string; billingPeriod: BillingPeriod; effectiveAt: string } | null;
}

export interface MembershipPayment {
    paymentRef: string;
    kind: 'NEW' | 'RENEWAL' | 'UPGRADE';
    planCode: string;
    planName: string;
    billingPeriod: BillingPeriod;
    currency: string;
    amountMinor: number;
    listAmountMinor: number;
    discountPercent: number;
    creditMinor: number;
    periodStart?: string;
    status: PaymentStatus;
    provider: 'RAZORPAY' | 'MANUAL' | 'NONE';
    manual: { method: string; reference: string; submittedAt: string } | null;
    reviewNote?: string;
    failureReason?: string;
    paidAt?: string;
    expiresAt?: string;
    createdAt: string;
}

export interface Quote {
    type: 'NEW' | 'UPGRADE' | 'DOWNGRADE';
    planCode: string;
    planName: string;
    billingPeriod: BillingPeriod;
    currency: string;
    listAmountMinor: number;
    discountPercent: number;
    periodAmountMinor: number;
    creditMinor: number;
    amountDueMinor: number;
    effectiveAt: string;
    renewsAt: string;
}

export interface Providers {
    razorpay: { enabled: boolean; minAmountMinor: number };
    manual: { enabled: boolean; upiId?: string; paypalUrl?: string; bankDetails?: string; instructions?: string };
}

export interface MembershipMe {
    writerStatus: string;
    eligibility: { eligible: boolean; reason: string | null };
    subscription: Subscription | null;
    openPayments: MembershipPayment[];
    providers: Providers;
    disclaimer: string;
}

export const SUBSCRIPTION_STATUS_META: Record<SubscriptionStatus, { label: string; className: string }> = {
    PENDING: { label: 'Pending', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
    ACTIVE: { label: 'Active', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
    PAST_DUE: { label: 'Past due', className: 'bg-orange-50 text-orange-800 ring-orange-200' },
    CANCELLED: { label: 'Cancelled', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
    EXPIRED: { label: 'Expired', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
    SUSPENDED: { label: 'Suspended', className: 'bg-red-50 text-red-700 ring-red-200' },
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
    CREATED: 'Awaiting payment', PENDING_VERIFICATION: 'Verifying', PAID: 'Paid', FAILED: 'Failed',
    REJECTED: 'Rejected', EXPIRED: 'Expired', CANCELLED: 'Cancelled',
};

export const PERIOD_LABEL: Record<BillingPeriod, string> = { MONTHLY: 'Monthly', ANNUAL: 'Annual' };
