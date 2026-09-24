import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type RiskSummary = { level: RiskLevel; score: number; flags: string[] };

export const RISK_KIND_LABEL: Record<string, string> = {
    DUPLICATE_EMAIL: 'Duplicate email', DUPLICATE_PHONE: 'Shared phone number', SHARED_SIGNUP_IP: 'Many sign-ups from one network',
    DISPOSABLE_EMAIL: 'Disposable email', DUPLICATE_DOCUMENT: 'Duplicate document', DUPLICATE_BIO: 'Copied profile bio',
    CONTACT_DETAILS_IN_PROFILE: 'Contact details in profile', LINKS_IN_PROFILE: 'Links in profile', PAYMENT_REFERENCE_REUSED: 'Reused payment reference',
    CHECKOUT_CHURN: 'Repeated checkouts', RATING_ANOMALY: 'Unusual rating pattern', LOGIN_LOCKOUT: 'Sign-in lockout', SPAM_CONTENT: 'Spam content',
};

const STYLE: Record<Exclude<RiskLevel, 'NONE'>, string> = {
    HIGH: 'bg-red-50 text-red-700 ring-red-200',
    MEDIUM: 'bg-amber-50 text-amber-800 ring-amber-200',
    LOW: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function RiskBadge({ risk, className }: { risk?: RiskSummary | null; className?: string }) {
    if (!risk || risk.level === 'NONE') return null;
    const title = risk.flags.map(f => RISK_KIND_LABEL[f] || f).join(', ');
    return (
        <span title={title} className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset', STYLE[risk.level], className)}>
            <ShieldAlert className="h-3 w-3" />{risk.level.toLowerCase()} risk
        </span>
    );
}
