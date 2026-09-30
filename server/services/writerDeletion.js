import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
    User, Writer, WriterProfile, WriterSkill, WriterDocument, WriterAvailability, WriterApplication, WriterSubscription,
    Assignment, WriterEarning, Order, OrderBid, OtpToken, ACTIVE_ASSIGNMENT_STATUSES,
} from '../db.js';
import { removeFile } from './fileStore.js';
import { cacheDel, cacheDelPattern } from './cache.js';
import { WriterError } from './writerService.js';

// A writer deleting their own account. Personal data is erased: documents and
// photo are removed from storage, and the profile, application, user and writer
// records are stripped of anything that identifies them. The anonymised records
// stay so past assignments, payments and ratings keep their history.

const OPEN_ORDER_STATUSES = ['assigned', 'in_progress', 'submitted', 'revision_required', 'In Progress'];

/** Why the account can't be deleted yet, or null when it can. */
export async function deletionBlocker(bundle) {
    const { writer } = bundle;
    const [activeAssignment, openOrder, unpaid] = await Promise.all([
        Assignment.exists({ assignedWriterId: writer._id, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } }),
        Order.exists({ writerId: writer.userId, status: { $in: OPEN_ORDER_STATUSES } }),
        WriterEarning.exists({ writerId: writer._id, status: { $in: ['PENDING', 'APPROVED'] } }),
    ]);
    if (activeAssignment || openOrder) return 'You have work in progress. Finish or hand back your current assignments and orders first, then delete your account.';
    if (unpaid) return 'You have earnings that haven’t been paid yet. Please contact support so we can pay you before your account is deleted.';
    return null;
}

export async function deleteWriterAccount(bundle) {
    const blocker = await deletionBlocker(bundle);
    if (blocker) throw new WriterError(blocker, 409);

    const { writer, profile, documents } = bundle;
    const writerId = writer._id;
    const userId = writer.userId;

    // Files first: documents and the profile photo.
    await Promise.all([
        ...(documents || []).map(d => removeFile('writers', d.storedName)),
        profile?.profilePhoto ? removeFile('writers', profile.profilePhoto) : null,
    ]);

    const scrambled = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    await Promise.all([
        WriterDocument.deleteMany({ writerId }),
        WriterSkill.deleteMany({ writerId }),
        WriterAvailability.deleteMany({ writerId }),
        OtpToken.deleteMany({ userId }),
        OrderBid.updateMany({ writerUserId: userId, status: 'PENDING' }, { $set: { status: 'WITHDRAWN' } }),
        WriterSubscription.updateMany({ writerId, isOpen: true }, { $set: { status: 'CANCELLED', isOpen: false, autoRenew: false } }),
        WriterProfile.updateOne({ writerId }, { $set: {
            city: 'Deleted', profilePhoto: null, headline: '', bio: '', education: [], writingExperience: '',
            expertiseAreas: [], subjects: [], academicLevels: [], languages: [], timezone: '', visibility: 'HIDDEN', bioHash: '',
        } }),
        WriterApplication.updateOne({ writerId }, { $set: { 'infoRequest.response': '' } }),
        User.updateOne({ _id: userId }, {
            $set: { name: 'Deleted writer', email: `deleted-${userId}@deleted.invalid`, password: scrambled },
        }),
        Writer.updateOne({ _id: writerId }, { $set: {
            status: 'INACTIVE', deletedAt: new Date(),
            phoneE164: `deleted-${writerId}`, phoneCountry: 'XX', dialCode: '', phoneVerified: false, emailVerified: false,
            emailCanonical: '', signupIpHash: '', searchKeys: [],
            'membership.status': 'CANCELLED',
            directory: { visible: false, available: false, country: '', subjects: [], levels: [], skills: [], tokens: [], yearsExperience: 0, refreshedAt: new Date() },
        } }),
    ]);

    await Promise.all([
        cacheDel(`writers:profile:${writerId}`).catch(() => {}),
        cacheDelPattern('writers:public:*').catch(() => {}),
    ]);
}
