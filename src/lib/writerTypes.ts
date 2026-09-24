import type { WriterStatus, DocumentType } from './writerOptions';

export interface Education {
    degree: string;
    level: string;
    university: string;
    fieldOfStudy?: string;
    graduationYear?: number;
}

export interface WriterProfileData {
    country: string;
    city: string;
    headline: string;
    bio: string;
    education: Education[];
    yearsExperience: number;
    writingExperience: string;
    expertiseAreas: string[];
    subjects: string[];
    academicLevels: string[];
    languages: string[];
    visibility: 'PUBLIC' | 'HIDDEN';
    hasPhoto: boolean;
    photoVersion: number | null;
}

export interface WriterDocumentData {
    id: string;
    type: DocumentType;
    title: string;
    originalName: string;
    mimeType: string;
    size: number;
    isPublic: boolean;
    reviewStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
    reviewNote: string;
    createdAt: string;
    sha256?: string;
}

export interface ApplicationEvent {
    action: string;
    toStatus?: string;
    fromStatus?: string;
    note?: string;
    actorType: 'WRITER' | 'ADMIN' | 'SYSTEM';
    actorName?: string;
    at: string;
}

export type OnboardingStep = 'VERIFY_EMAIL' | 'VERIFY_PHONE' | 'COMPLETE_PROFILE' | 'SUBMIT_APPLICATION' | 'AWAIT_REVIEW' | 'CHOOSE_MEMBERSHIP' | 'DASHBOARD' | 'BLOCKED';

export interface WriterMe {
    id: string;
    name: string;
    email: string;
    status: WriterStatus;
    phone: { e164: string; country: string; dialCode: string; masked: string };
    emailVerified: boolean;
    phoneVerified: boolean;
    membership: { plan: string | null; status: string };
    metrics: { rating: number; ratingCount: number; completedAssignments: number; qualityScore: number; responseRate: number };
    profile: WriterProfileData;
    skills: { name: string; isCustom: boolean }[];
    documents: WriterDocumentData[];
    application: {
        status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED';
        submittedAt?: string;
        reviewedAt?: string;
        decisionReason?: string;
        infoRequest: { message: string; requestedAt: string; response?: string; respondedAt?: string } | null;
        history: ApplicationEvent[];
        submissionCount?: number;
    };
    availability: {
        status: 'AVAILABLE' | 'UNAVAILABLE';
        note: string;
        effectiveStatus: 'AVAILABLE' | 'UNAVAILABLE';
        override: { status: string; reason: string; setAt: string; setBy?: string } | null;
    };
    onboarding: {
        checks: Record<'emailVerified' | 'phoneVerified' | 'profileComplete' | 'photoUploaded' | 'skillsAdded' | 'resumeUploaded', boolean>;
        missing: string[];
        nextStep: OnboardingStep;
        canSubmit: boolean;
        canEdit: boolean;
    };
    membershipEligibility: { eligible: boolean; reason: string | null };
    createdAt: string;
}

// Admin view adds internal fields; blocks the caller's role may not see are null.
export interface WriterAdminView extends Omit<WriterMe, 'metrics'> {
    userId: string;
    lastLogin?: string;
    statusBeforeSuspension?: WriterStatus;
    metrics: WriterMe['metrics'] & { onTimeRate?: number; completionRate?: number; acceptanceRate?: number; revisionRate?: number; activeAssignments?: number } | null;
    contactMasked: boolean;
    canRevealContact: boolean;
    permissions: { review: boolean; documents: boolean; availability: boolean; performance: boolean; earnings: boolean; payments: boolean };
    lastReview: { by: string; at: string } | null;
    risk: { level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'; score: number; flags: string[] } | null;
    subscriptions: { subscriptionId: string; planName: string; billingPeriod: string; status: string; autoRenew: boolean; startDate?: string; currentPeriodEnd?: string; endedAt?: string; endReason?: string; amountMinor?: number; currency?: string }[];
    revenue: { byCurrency: Record<string, number>; payments: number } | null;
    assignments: { byStatus: Record<string, number>; total: number; recent: { ref: string; title: string; status: string; writerDeadline: string; approvedAt?: string }[] };
    earnings: Partial<Record<'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED', Record<string, number>>> | null;
}

export interface PublicWriter {
    id: string;
    name: string;
    headline: string;
    country: string;
    hasPhoto: boolean;
    photoVersion: number | null;
    bio?: string;
    education?: Education[];
    topDegree?: string | null;
    yearsExperience: number;
    writingExperience?: string;
    expertiseAreas: string[];
    subjects: string[];
    academicLevels: string[];
    languages: string[];
    skills: string[];
    writingSamples?: { id: string; title: string; mimeType: string }[];
    metrics: { rating: number; ratingCount: number; completedAssignments: number; qualityScore: number; responseRate: number };
    availability: 'AVAILABLE' | 'UNAVAILABLE';
    membershipPlan: string | null;
    memberSince: string;
}
