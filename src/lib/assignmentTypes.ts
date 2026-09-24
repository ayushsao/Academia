export type AssignmentStatus = 'DRAFT' | 'OPEN' | 'OFFERED' | 'ASSIGNED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'REVISION_REQUESTED' | 'RESUBMITTED' | 'APPROVED' | 'CANCELLED' | 'UNALLOCATED';
export type Money = { amountMinor: number; currency: string };
export type ByStatusCurrency = Partial<Record<'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED', Record<string, number>>>;

export interface FileRef { id: string; name: string; size: number; mimeType: string }

export interface WriterAssignment {
    ref: string;
    title: string;
    service: string;
    subject: string;
    academicLevel: string;
    wordCount: number;
    requirements: string;
    instructions: string;
    deliverables: string[];
    requiredSkills: string[];
    writerDeadline: string;
    payout: Money;
    status: AssignmentStatus;
    assignedAt?: string;
    revisionDueAt?: string;
    revisionCount: number;
    approvedAt?: string;
    cancelledAt?: string;
    referenceFiles: FileRef[];
}

export interface Offer {
    offerId: string;
    status: 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN';
    expiresAt: string;
    declineReason?: string;
    assignment: WriterAssignment | null;
}

export interface Submission {
    id: string;
    version: number;
    status: 'SUBMITTED' | 'UNDER_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED';
    note: string;
    submittedAt: string;
    dueAt: string;
    minutesLate: number;
    reviewNote: string;
    reviewedAt?: string;
    files: FileRef[];
}

export interface Earning {
    id: string;
    amountMinor: number;
    baseAmountMinor: number;
    currency: string;
    status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
    adjustments: { amountMinor: number; reason: string; at: string }[];
    approvedAt?: string;
    paidAt?: string;
    payoutReference?: string;
    createdAt: string;
    assignment?: { ref: string; title: string } | null;
}

export interface Rating { quality: number; accuracy: number; timeliness: number; communication: number; overall: number; comment: string }

export const ASSIGNMENT_STATUS_META: Record<AssignmentStatus, { label: string; className: string }> = {
    DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
    OPEN: { label: 'Open', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
    OFFERED: { label: 'Offered', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
    ASSIGNED: { label: 'In progress', className: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
    SUBMITTED: { label: 'Submitted', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
    UNDER_REVIEW: { label: 'Under review', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
    REVISION_REQUESTED: { label: 'Revision requested', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
    RESUBMITTED: { label: 'Resubmitted', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
    APPROVED: { label: 'Approved', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
    CANCELLED: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
    UNALLOCATED: { label: 'Needs allocation', className: 'bg-red-50 text-red-700 ring-red-200' },
};

export const EARNING_STATUS_LABEL = { PENDING: 'Pending', APPROVED: 'Approved', PAID: 'Paid', CANCELLED: 'Cancelled' } as const;

// Human-readable time remaining, e.g. "2d 4h" or "overdue by 3h".
export function timeLeft(iso?: string) {
    if (!iso) return '';
    const ms = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(ms), h = Math.floor(abs / 3_600_000), d = Math.floor(h / 24);
    const text = d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${Math.floor((abs % 3_600_000) / 60000)}m` : `${Math.max(1, Math.floor(abs / 60000))}m`;
    return ms < 0 ? `overdue by ${text}` : text;
}
