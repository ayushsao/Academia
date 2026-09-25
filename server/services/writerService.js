import { User, Writer, WriterProfile, WriterSkill, WriterDocument, WriterApplication, WriterAvailability } from '../db.js';
import { notify } from './notifications.js';

// Approved writers become ACTIVE when their membership is live (see
// membershipService.syncWriter). Only ACTIVE writers are listed publicly and
// can access the job board; approved writers can manage availability and subscribe.
export const PUBLIC_WRITER_STATUSES = ['ACTIVE'];
export const JOB_ACCESS_STATUSES = ['ACTIVE'];
export const WORKING_WRITER_STATUSES = ['APPROVED', 'ACTIVE'];

// Profile and documents may be edited while drafting, when HR asks for more
// information, and after approval — but not while a reviewer is looking at them.
const EDITABLE_APPLICATION_STATUSES = ['DRAFT', 'INFO_REQUESTED', 'APPROVED'];

export class WriterError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

export async function loadWriterBundle(filter) {
    const writer = await Writer.findOne(filter);
    if (!writer) return null;
    const [user, profile, skills, documents, application, availability] = await Promise.all([
        User.findById(writer.userId).select('name email role createdAt lastLogin'),
        WriterProfile.findOne({ writerId: writer._id }),
        WriterSkill.find({ writerId: writer._id }).sort({ createdAt: 1 }),
        WriterDocument.find({ writerId: writer._id }).sort({ createdAt: -1 }),
        WriterApplication.findOne({ writerId: writer._id }),
        WriterAvailability.findOne({ writerId: writer._id }),
    ]);
    return { writer, user, profile, skills, documents, application, availability };
}

export const canEditProfile = (application) => EDITABLE_APPLICATION_STATUSES.includes(application?.status);

// Works out which onboarding requirements are met and what the writer should do next.
export function computeOnboarding({ writer, profile, skills, documents, application }) {
    const profileComplete = Boolean(profile && profile.bio?.length >= 150 && profile.education?.length
        && profile.subjects?.length && profile.academicLevels?.length && profile.languages?.length
        && profile.expertiseAreas?.length && profile.writingExperience?.length >= 50);
    // Email and phone one-time-code verification is not part of onboarding.
    const checks = {
        profileComplete,
        photoUploaded: Boolean(profile?.profilePhoto),
        skillsAdded: skills.length > 0,
        resumeUploaded: documents.some(d => d.type === 'RESUME'),
    };
    const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);

    let nextStep;
    if (['DRAFT', 'INFO_REQUESTED'].includes(application?.status)) nextStep = missing.length ? 'COMPLETE_PROFILE' : 'SUBMIT_APPLICATION';
    else if (['SUBMITTED', 'UNDER_REVIEW'].includes(application?.status)) nextStep = 'AWAIT_REVIEW';
    else if (writer.status === 'APPROVED') nextStep = 'CHOOSE_MEMBERSHIP';
    else if (writer.status === 'ACTIVE') nextStep = 'DASHBOARD';
    else nextStep = 'BLOCKED';

    return {
        checks,
        missing,
        nextStep,
        canSubmit: missing.length === 0 && ['DRAFT', 'INFO_REQUESTED'].includes(application?.status),
        canEdit: canEditProfile(application),
    };
}

// Only approved (or already active) writers may start a paid membership.
// The subscription module must call this before charging.
export function membershipEligibility(writer) {
    if (!WORKING_WRITER_STATUSES.includes(writer.status))
        return { eligible: false, reason: 'Your application must be approved before you can activate a membership.' };
    return { eligible: true, reason: null };
}

export const effectiveAvailability = (availability) =>
    availability?.adminOverride?.active ? availability.adminOverride.status : (availability?.status || 'UNAVAILABLE');

const maskPhone = (e164) => e164 ? `${e164.slice(0, 4)} •••• ${e164.slice(-3)}` : '';

const documentView = (d) => ({
    id: d._id, type: d.type, title: d.title, originalName: d.originalName, mimeType: d.mimeType,
    size: d.size, isPublic: d.isPublic, reviewStatus: d.reviewStatus, reviewNote: d.reviewNote, createdAt: d.createdAt,
});

const profileView = (p) => p && ({
    country: p.country, city: p.city, headline: p.headline, bio: p.bio, education: p.education,
    yearsExperience: p.yearsExperience, writingExperience: p.writingExperience, expertiseAreas: p.expertiseAreas,
    subjects: p.subjects, academicLevels: p.academicLevels, languages: p.languages, visibility: p.visibility,
    hasPhoto: Boolean(p.profilePhoto), photoVersion: p.profilePhoto ? p.updatedAt?.getTime() : null,
});

const availabilityView = (a) => ({
    status: a?.status || 'AVAILABLE',
    note: a?.note || '',
    effectiveStatus: effectiveAvailability(a),
    override: a?.adminOverride?.active ? { status: a.adminOverride.status, reason: a.adminOverride.reason, setAt: a.adminOverride.setAt } : null,
});

// What the writer sees about themselves.
export function toOwnerView(bundle) {
    const { writer, user, profile, skills, documents, application, availability } = bundle;
    return {
        id: writer._id,
        name: user?.name,
        email: user?.email,
        status: writer.status,
        phone: { e164: writer.phoneE164, country: writer.phoneCountry, dialCode: writer.dialCode, masked: maskPhone(writer.phoneE164) },
        emailVerified: writer.emailVerified,
        phoneVerified: writer.phoneVerified,
        membership: writer.membership,
        metrics: writer.metrics,
        profile: profileView(profile),
        skills: skills.map(s => ({ name: s.name, isCustom: s.isCustom })),
        documents: documents.map(documentView),
        application: application && {
            status: application.status,
            submittedAt: application.submittedAt,
            reviewedAt: application.reviewedAt,
            decisionReason: application.decisionReason,
            infoRequest: application.infoRequest?.message ? application.infoRequest : null,
            // Reviewer identities stay internal.
            history: application.history.map(h => ({ action: h.action, toStatus: h.toStatus, note: h.note, actorType: h.actorType, at: h.at })),
        },
        availability: availabilityView(availability),
        onboarding: computeOnboarding(bundle),
        membershipEligibility: membershipEligibility(writer),
        createdAt: writer.createdAt,
    };
}

// What HR/admins see: the owner view plus internal review details.
export function toAdminView(bundle) {
    const view = toOwnerView(bundle);
    return {
        ...view,
        userId: bundle.user?._id,
        lastLogin: bundle.user?.lastLogin,
        statusBeforeSuspension: bundle.writer.statusBeforeSuspension,
        documents: bundle.documents.map(d => ({ ...documentView(d), sha256: d.sha256 })),
        application: bundle.application && {
            ...view.application,
            submissionCount: bundle.application.submissionCount,
            history: bundle.application.history,
        },
        availability: { ...view.availability, override: bundle.availability?.adminOverride?.active ? bundle.availability.adminOverride : null },
    };
}

// The only shape ever returned by public endpoints. Contact details are never included.
export function toPublicView({ writer, user, profile, skills, documents, availability }) {
    return {
        id: writer._id,
        name: user?.name,
        headline: profile.headline,
        country: profile.country,
        hasPhoto: Boolean(profile.profilePhoto),
        photoVersion: profile.profilePhoto ? profile.updatedAt?.getTime() : null,
        bio: profile.bio,
        education: profile.education.map(e => ({ degree: e.degree, level: e.level, university: e.university, fieldOfStudy: e.fieldOfStudy, graduationYear: e.graduationYear })),
        yearsExperience: profile.yearsExperience,
        writingExperience: profile.writingExperience,
        expertiseAreas: profile.expertiseAreas,
        subjects: profile.subjects,
        academicLevels: profile.academicLevels,
        languages: profile.languages,
        skills: skills.map(s => s.name),
        writingSamples: documents
            .filter(d => d.type === 'WRITING_SAMPLE' && d.isPublic && d.reviewStatus !== 'REJECTED')
            .map(d => ({ id: d._id, title: d.title || d.originalName, mimeType: d.mimeType })),
        metrics: {
            rating: writer.metrics.rating,
            ratingCount: writer.metrics.ratingCount,
            completedAssignments: writer.metrics.completedAssignments,
            qualityScore: writer.metrics.qualityScore,
            responseRate: writer.metrics.responseRate,
        },
        availability: effectiveAvailability(availability),
        membershipPlan: writer.membership?.status === 'ACTIVE' ? writer.membership.plan : null,
        memberSince: writer.createdAt,
    };
}

export const isPubliclyVisible = (writer, profile) =>
    PUBLIC_WRITER_STATUSES.includes(writer.status) && profile?.visibility === 'PUBLIC';

// Application/account notices through the shared notification service.
const APPLICATION_TYPES = ['WRITER_START_REVIEW', 'WRITER_REJECT', 'WRITER_REQUEST_INFO'];
export async function notifyWriter(bundle, { type, title, message }) {
    const category = type === 'WRITER_APPROVE' ? 'APPROVAL' : APPLICATION_TYPES.includes(type) ? 'APPLICATION' : 'ACCOUNT';
    const link = category === 'ACCOUNT' ? '/writer/dashboard' : '/writer/onboarding';
    await notify({ userId: bundle.writer.userId, category, type, title, message, link })
        .catch(err => console.error('[Writer notify] failed:', err.message));
}

// ── Admin lifecycle actions ────────────────────────────────────────────────────
// Each action lists the writer and application states it may start from.
const ACTIONS = {
    start_review: {
        from: { app: ['SUBMITTED'] },
        apply: () => ({ writer: 'UNDER_REVIEW', app: 'UNDER_REVIEW' }),
        notify: { title: 'Application under review', message: 'Our team has started reviewing your writer application.' },
    },
    approve: {
        from: { app: ['SUBMITTED', 'UNDER_REVIEW'] },
        apply: () => ({ writer: 'APPROVED', app: 'APPROVED' }),
        notify: { title: 'Application approved', message: 'Congratulations! Your writer application has been approved. You can now activate a writer membership from your dashboard.' },
    },
    reject: {
        from: { app: ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'] },
        apply: () => ({ writer: 'REJECTED', app: 'REJECTED' }),
        notify: { title: 'Application not approved', message: 'Unfortunately your writer application was not approved.' },
    },
    request_info: {
        from: { app: ['SUBMITTED', 'UNDER_REVIEW'] },
        apply: () => ({ writer: 'UNDER_REVIEW', app: 'INFO_REQUESTED' }),
        notify: { title: 'More information needed', message: 'Our review team needs more information about your application. Please sign in to your writer dashboard to respond.' },
    },
    suspend: {
        from: { writer: ['APPROVED', 'ACTIVE', 'INACTIVE'] },
        apply: () => ({ writer: 'SUSPENDED' }),
        notify: { title: 'Account suspended', message: 'Your writer account has been suspended.' },
    },
    deactivate: {
        from: { writer: ['APPROVED', 'ACTIVE'] },
        apply: () => ({ writer: 'INACTIVE' }),
        notify: { title: 'Account marked inactive', message: 'Your writer account has been marked inactive.' },
    },
    reactivate: {
        from: { writer: ['SUSPENDED', 'INACTIVE'] },
        apply: (writer) => {
            // An ACTIVE status is only restored if the membership is still paid up.
            const previous = writer.statusBeforeSuspension;
            const restored = previous === 'ACTIVE' && writer.membership?.status !== 'ACTIVE' ? 'APPROVED' : (previous || 'APPROVED');
            return { writer: WORKING_WRITER_STATUSES.includes(restored) ? restored : 'APPROVED' };
        },
        notify: { title: 'Account reactivated', message: 'Your writer account has been reactivated.' },
    },
};

export async function applyAdminAction(bundle, { action, reason }, admin) {
    const spec = ACTIONS[action];
    const { writer, application } = bundle;
    if (!spec) throw new WriterError('Unknown action.');
    if (spec.from.app && !spec.from.app.includes(application?.status))
        throw new WriterError(`Cannot ${action.replace('_', ' ')} an application that is ${application?.status?.toLowerCase().replace('_', ' ')}.`, 409);
    if (spec.from.writer && !spec.from.writer.includes(writer.status))
        throw new WriterError(`Cannot ${action} a writer whose status is ${writer.status.toLowerCase().replace('_', ' ')}.`, 409);

    const next = spec.apply(writer);
    const fromWriterStatus = writer.status;
    const fromAppStatus = application?.status;

    if (action === 'suspend' || action === 'deactivate') writer.statusBeforeSuspension = fromWriterStatus;
    if (action === 'reactivate') writer.statusBeforeSuspension = undefined;
    writer.status = next.writer;
    await writer.save();

    if (application) {
        if (next.app) {
            application.status = next.app;
            application.reviewedAt = new Date();
            application.reviewedBy = admin.id;
        }
        if (['approve', 'reject'].includes(action)) application.decisionReason = reason;
        if (action === 'request_info') application.infoRequest = { message: reason, requestedAt: new Date() };
        application.history.push({
            action: action.toUpperCase(), fromStatus: `${fromWriterStatus}/${fromAppStatus}`, toStatus: `${writer.status}/${application.status}`,
            note: reason, actorType: 'ADMIN', actorId: admin.id, actorName: admin.username,
        });
        await application.save();
    }

    await notifyWriter(bundle, {
        type: `WRITER_${action.toUpperCase()}`,
        title: spec.notify.title,
        message: reason ? `${spec.notify.message}\n\nNote from the review team: ${reason}` : spec.notify.message,
    });
    return { fromWriterStatus, toWriterStatus: writer.status };
}
