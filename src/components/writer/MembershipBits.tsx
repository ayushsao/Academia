import React from 'react';
import { Info } from 'lucide-react';
import { SUBSCRIPTION_STATUS_META, type SubscriptionStatus } from '../../lib/membershipTypes';
import { cn } from '../../lib/utils';

// Required notice: membership is access, not guaranteed work.
export const MEMBERSHIP_DISCLAIMER =
    'Membership provides access to platform features and opportunities. Assignments depend on eligibility, requirements, availability and platform allocation.';

export function MembershipDisclaimer({ className, text = MEMBERSHIP_DISCLAIMER }: { className?: string; text?: string }) {
    return (
        <p role="note" className={cn('flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700', className)}>
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span>{text}</span>
        </p>
    );
}

export function SubscriptionBadge({ status, className }: { status: SubscriptionStatus; className?: string }) {
    const meta = SUBSCRIPTION_STATUS_META[status];
    return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', meta.className, className)}>{meta.label}</span>;
}

export function BillingToggle({ value, onChange, annualSavingPercent }: { value: 'MONTHLY' | 'ANNUAL'; onChange: (v: 'MONTHLY' | 'ANNUAL') => void; annualSavingPercent?: number }) {
    return (
        <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            {(['MONTHLY', 'ANNUAL'] as const).map(p => (
                <button key={p} type="button" role="radio" aria-checked={value === p} onClick={() => onChange(p)}
                    className={cn('rounded-lg px-4 py-2 text-sm font-semibold transition', value === p ? 'bg-[#002147] text-white' : 'text-slate-600 hover:text-[#002147]')}>
                    {p === 'MONTHLY' ? 'Monthly' : 'Annual'}
                    {p === 'ANNUAL' && annualSavingPercent ? <span className={cn('ml-1.5 rounded-md px-1.5 py-0.5 text-[11px]', value === p ? 'bg-white/15' : 'bg-emerald-50 text-emerald-700')}>save {annualSavingPercent}%</span> : null}
                </button>
            ))}
        </div>
    );
}
