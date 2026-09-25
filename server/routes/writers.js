import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { User, Writer, WriterProfile, WriterSkill, WriterDocument, WriterApplication, WriterAvailability } from '../db.js';
import { authenticateUser, identifyPrincipal, issueUserSession } from '../middleware.js';
import { can } from '../permissions.js';
import {
    validateInput, phoneField, writerRegisterSchema, writerPhoneUpdateSchema, otpVerifySchema, writerProfileSchema,
    writerSkillsSchema, writerSettingsSchema, writerAvailabilitySchema, writerSubmitSchema, documentMetaSchema, documentVisibilitySchema,
} from '../validation.js';
import { PREDEFINED_SKILLS, MAX_DOCUMENTS_PER_WRITER, slugify } from '../writerConstants.js';
import { prefixTerms, scheduleDirectoryRefresh } from '../services/writerDirectory.js';
import {
    AbuseError, checkRegistration, afterRegistration, canonicalEmail, fingerprint, assertNoContactDetails, bioFingerprint,
    afterProfileSaved, afterDocumentUploaded,
} from '../services/abuse.js';
import { issueOtp, verifyOtp, OtpError } from '../services/otp.js';
import { DeliveryUnavailableError } from '../services/messaging.js';
import { receiveSingleFile, finalizeUpload, removeStoredFile, streamStoredFile, UploadError } from '../services/writerFiles.js';
import {
    loadWriterBundle, toOwnerView, toPublicView, computeOnboarding, canEditProfile, isPubliclyVisible,
    membershipEligibility, PUBLIC_WRITER_STATUSES, WORKING_WRITER_STATUSES, WriterError,
} from '../services/writerService.js';

const router = Router();

const limiter = (windowMinutes, max, message) => rateLimit({ windowMs: windowMinutes * 60 * 1000, max, message: { error: message } });
const registerLimiter = limiter(60, 5, 'Too many registration attempts. Please try again later.');
const otpSendLimiter = limiter(15, 8, 'Too many verification codes requested. Please try again later.');
const otpVerifyLimiter = limiter(15, 25, 'Too many verification attempts. Please try again later.');
const uploadLimiter = limiter(15, 40, 'Too many uploads. Please try again later.');

// Maps known error types to HTTP responses; everything else is a 500 with no detail.
function handleError(res, err, fallback) {
    if (err instanceof OtpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    if (err instanceof WriterError || err instanceof UploadError || err instanceof AbuseError) return res.status(err.status).json({ error: err.message });
    if (err instanceof DeliveryUnavailableError) return res.status(503).json({ error: 'Verification messages cannot be sent right now. Please try again later.' });
    console.error(`[Writers] ${fallback}:`, err);
    return res.status(500).json({ error: fallback });
}

const isObjectId = (id) => mongoose.isValidObjectId(id);

// Loads the calling writer's full record, or 403s if the user isn't a writer.
async function requireWriterAccount(req, res, next) {
    try {
        if (req.user.role !== 'WRITER') return res.status(403).json({ error: 'This area is for writer accounts.' });
        const bundle = await loadWriterBundle({ userId: req.user.id });
        if (!bundle) return res.status(404).json({ error: 'Writer account not found.' });
        req.bundle = bundle;
        next();
    } catch (err) {
        handleError(res, err, 'Failed to load writer account.');
    }
}

const requireEditable = (req, res, next) => {
    if (!canEditProfile(req.bundle.application))
        return res.status(409).json({ error: 'Your profile is locked while your application is being reviewed.' });
    next();
};

const sendOwnerView = async (res, writerId, status = 200) =>
    res.status(status).json({ writer: toOwnerView(await loadWriterBundle({ _id: writerId })) });

// ============================================
// REGISTRATION
// ============================================

router.post('/register', registerLimiter, validateInput(writerRegisterSchema), async (req, res) => {
    const { name, email, password, phoneCountry, phoneNumber, country, city } = req.body;
    const phone = phoneField.safeParse({ phoneCountry, phoneNumber });
    if (!phone.success) return res.status(400).json({ error: phone.error.issues[0].message });

    const created = [];
    try {
        if (await User.exists({ email }))
            return res.status(409).json({ error: 'We could not create an account with these details. If you already have an account, please sign in.' });
        // Disposable inboxes, aliases of an existing writer's email, already-verified phones.
        await checkRegistration({ email, phoneE164: phone.data.phoneE164 });

        const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), role: 'WRITER' });
        created.push(user);
        const writer = await Writer.create({
            userId: user._id, status: 'PENDING', ...phone.data,
            emailCanonical: canonicalEmail(email), signupIpHash: fingerprint(req.ip),
        });
        created.push(writer);
        created.push(await WriterProfile.create({ writerId: writer._id, userId: user._id, country, city }));
        created.push(await WriterApplication.create({
            writerId: writer._id, userId: user._id, status: 'DRAFT',
            history: [{ action: 'REGISTERED', toStatus: 'PENDING/DRAFT', actorType: 'WRITER', actorId: user._id }],
        }));
        created.push(await WriterAvailability.create({ writerId: writer._id }));

        const token = issueUserSession(res, user);
        scheduleDirectoryRefresh(writer._id);
        afterRegistration(writer, { ip: req.ip }).catch(err => console.error('[Writers] risk checks failed:', err.message));


        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        // No multi-document transactions without a replica set — roll back manually.
        await Promise.all(created.map(doc => doc.deleteOne().catch(() => {})));
        if (err?.code === 11000) return res.status(409).json({ error: 'We could not create an account with these details. If you already have an account, please sign in.' });
        handleError(res, err, 'Registration failed. Please try again.');
    }
});

// ============================================
// CURRENT WRITER
// ============================================

router.get('/me', authenticateUser, requireWriterAccount, (req, res) => {
    res.json({ writer: toOwnerView(req.bundle) });
});

// ── Email & phone verification ────────────────────────────────────────────────

router.post('/verify/email/send', otpSendLimiter, authenticateUser, requireWriterAccount, async (req, res) => {
    try {
        const { writer, user } = req.bundle;
        if (writer.emailVerified) return res.status(409).json({ error: 'Your email is already verified.' });
        const info = await issueOtp({ userId: user._id, channel: 'EMAIL', target: user.email });
        res.json({ message: 'A verification code has been sent to your email.', ...info });
    } catch (err) { handleError(res, err, 'Could not send verification code.'); }
});

router.post('/verify/email/confirm', otpVerifyLimiter, authenticateUser, requireWriterAccount, validateInput(otpVerifySchema), async (req, res) => {
    try {
        const { writer, user } = req.bundle;
        if (!writer.emailVerified) {
            await verifyOtp({ userId: user._id, channel: 'EMAIL', target: user.email, code: req.body.code });
            writer.emailVerified = true;
            writer.emailVerifiedAt = new Date();
            await writer.save();
        }
        await sendOwnerView(res, writer._id);
    } catch (err) { handleError(res, err, 'Could not verify email.'); }
});

router.post('/verify/phone/send', otpSendLimiter, authenticateUser, requireWriterAccount, async (req, res) => {
    try {
        const { writer, user } = req.bundle;
        if (!writer.emailVerified) return res.status(409).json({ error: 'Please verify your email first.' });
        if (writer.phoneVerified) return res.status(409).json({ error: 'Your phone number is already verified.' });
        if (await Writer.exists({ phoneE164: writer.phoneE164, phoneVerified: true, _id: { $ne: writer._id } }))
            return res.status(409).json({ error: 'This phone number is already verified on another writer account.' });
        const info = await issueOtp({ userId: user._id, channel: 'PHONE', target: writer.phoneE164 });
        res.json({ message: 'A verification code has been sent by SMS.', ...info });
    } catch (err) { handleError(res, err, 'Could not send verification code.'); }
});

router.post('/verify/phone/confirm', otpVerifyLimiter, authenticateUser, requireWriterAccount, validateInput(otpVerifySchema), async (req, res) => {
    try {
        const { writer, user } = req.bundle;
        if (!writer.phoneVerified) {
            await verifyOtp({ userId: user._id, channel: 'PHONE', target: writer.phoneE164, code: req.body.code });
            writer.phoneVerified = true;
            writer.phoneVerifiedAt = new Date();
            try {
                await writer.save();
            } catch (err) {
                if (err?.code === 11000) return res.status(409).json({ error: 'This phone number is already verified on another writer account.' });
                throw err;
            }
        }
        await sendOwnerView(res, writer._id);
    } catch (err) { handleError(res, err, 'Could not verify phone number.'); }
});

// Lets a writer fix a mistyped number. Changing the number clears phone verification.
router.patch('/phone', authenticateUser, requireWriterAccount, validateInput(writerPhoneUpdateSchema), async (req, res) => {
    try {
        const { writer, application } = req.bundle;
        if (!['DRAFT', 'INFO_REQUESTED', 'APPROVED'].includes(application?.status))
            return res.status(409).json({ error: 'Your phone number cannot be changed while your application is under review.' });
        const phone = phoneField.safeParse(req.body);
        if (!phone.success) return res.status(400).json({ error: phone.error.issues[0].message });
        if (phone.data.phoneE164 !== writer.phoneE164) {
            // One writer account per phone number.
            if (await Writer.exists({ phoneE164: phone.data.phoneE164, _id: { $ne: writer._id } }))
                return res.status(409).json({ error: 'This phone number is already used by another account.' });
            Object.assign(writer, phone.data, { phoneVerified: false, phoneVerifiedAt: undefined });
            await writer.save();
        }
        await sendOwnerView(res, writer._id);
    } catch (err) { handleError(res, err, 'Could not update phone number.'); }
});

// ── Profile ──────────────────────────────────────────────────────────────────

router.put('/profile', authenticateUser, requireWriterAccount, requireEditable, validateInput(writerProfileSchema), async (req, res) => {
    try {
        // validateInput has already reduced the body to whitelisted fields only.
        const merged = { ...(req.bundle.profile?.toObject?.() || req.bundle.profile || {}), ...req.body };
        assertNoContactDetails(merged);
        const update = { ...req.body, ...(req.body.bio !== undefined ? { bioHash: bioFingerprint(req.body.bio) } : {}) };
        await WriterProfile.updateOne({ writerId: req.bundle.writer._id }, { $set: update }, { runValidators: true });
        afterProfileSaved(req.bundle.writer, { ...merged, bioHash: update.bioHash ?? merged.bioHash })
            .catch(err => console.error('[Writers] profile checks failed:', err.message));
        await sendOwnerView(res, req.bundle.writer._id);
    } catch (err) { handleError(res, err, 'Could not save profile.'); }
});

router.put('/skills', authenticateUser, requireWriterAccount, requireEditable, validateInput(writerSkillsSchema), async (req, res) => {
    try {
        const writerId = req.bundle.writer._id;
        const canonical = new Map(PREDEFINED_SKILLS.map(s => [slugify(s), s]));
        const bySlug = new Map();
        for (const raw of req.body.skills) {
            const slug = slugify(raw);
            if (!slug || bySlug.has(slug)) continue;
            bySlug.set(slug, { writerId, slug, name: canonical.get(slug) || raw, isCustom: !canonical.has(slug) });
        }
        await WriterSkill.deleteMany({ writerId, slug: { $nin: [...bySlug.keys()] } });
        await WriterSkill.bulkWrite([...bySlug.values()].map(skill => ({
            updateOne: { filter: { writerId, slug: skill.slug }, update: { $set: skill }, upsert: true },
        })));
        await scheduleDirectoryRefresh(writerId);   // bulkWrite doesn't trigger the model hooks
        await sendOwnerView(res, writerId);
    } catch (err) { handleError(res, err, 'Could not save skills.'); }
});

router.patch('/settings', authenticateUser, requireWriterAccount, validateInput(writerSettingsSchema), async (req, res) => {
    try {
        if (req.body.visibility) await WriterProfile.updateOne({ writerId: req.bundle.writer._id }, { $set: { visibility: req.body.visibility } });
        await sendOwnerView(res, req.bundle.writer._id);
    } catch (err) { handleError(res, err, 'Could not save settings.'); }
});

// ── Profile photo ────────────────────────────────────────────────────────────

router.post('/photo', uploadLimiter, authenticateUser, requireWriterAccount, requireEditable, receiveSingleFile, async (req, res) => {
    try {
        const stored = await finalizeUpload(req.file, 'PHOTO');
        const previous = req.bundle.profile.profilePhoto;
        await WriterProfile.updateOne({ writerId: req.bundle.writer._id }, { $set: { profilePhoto: stored.storedName } });
        if (previous) await removeStoredFile(previous);
        await sendOwnerView(res, req.bundle.writer._id);
    } catch (err) { handleError(res, err, 'Could not upload photo.'); }
});

// Public for listed writers; otherwise only the owner or an admin.
router.get('/:writerId/photo', identifyPrincipal, async (req, res) => {
    try {
        if (!isObjectId(req.params.writerId)) return res.status(404).end();
        const writer = await Writer.findById(req.params.writerId).select('status userId');
        const profile = writer && await WriterProfile.findOne({ writerId: writer._id }).select('profilePhoto visibility');
        if (!profile?.profilePhoto) return res.status(404).end();
        const allowed = isPubliclyVisible(writer, profile) || can(req.admin?.adminRole, 'writers.read') || String(req.user?.id) === String(writer.userId);
        if (!allowed) return res.status(404).end();
        const ext = profile.profilePhoto.split('.').pop();
        const mimeType = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] || 'application/octet-stream';
        streamStoredFile(res, { storedName: profile.profilePhoto, mimeType, originalName: `photo.${ext}` });
    } catch (err) { handleError(res, err, 'Could not load photo.'); }
});

// ── Documents ────────────────────────────────────────────────────────────────

router.post('/documents', uploadLimiter, authenticateUser, requireWriterAccount, requireEditable, receiveSingleFile, async (req, res) => {
    const meta = documentMetaSchema.safeParse(req.body);
    if (!meta.success) {
        if (req.file) await removeStoredFile(req.file.filename);
        return res.status(400).json({ error: meta.error.issues[0].message });
    }
    try {
        if (req.bundle.documents.length >= MAX_DOCUMENTS_PER_WRITER) {
            await removeStoredFile(req.file?.filename || '');
            return res.status(409).json({ error: `You can upload at most ${MAX_DOCUMENTS_PER_WRITER} documents. Remove one first.` });
        }
        const stored = await finalizeUpload(req.file, meta.data.type);
        const doc = await WriterDocument.create({
            writerId: req.bundle.writer._id,
            type: meta.data.type,
            title: meta.data.title,
            isPublic: meta.data.type === 'WRITING_SAMPLE' && meta.data.isPublic,
            ...stored,
        });
        afterDocumentUploaded(req.bundle.writer, doc).catch(err => console.error('[Writers] document checks failed:', err.message));
        await sendOwnerView(res, req.bundle.writer._id, 201);
    } catch (err) { handleError(res, err, 'Could not upload document.'); }
});

router.patch('/documents/:docId', authenticateUser, requireWriterAccount, validateInput(documentVisibilitySchema), async (req, res) => {
    try {
        const doc = req.bundle.documents.find(d => String(d._id) === req.params.docId);
        if (!doc) return res.status(404).json({ error: 'Document not found.' });
        if (doc.type !== 'WRITING_SAMPLE') return res.status(400).json({ error: 'Only writing samples can be shown on your public profile.' });
        doc.isPublic = req.body.isPublic;
        await doc.save();
        await sendOwnerView(res, req.bundle.writer._id);
    } catch (err) { handleError(res, err, 'Could not update document.'); }
});

router.delete('/documents/:docId', authenticateUser, requireWriterAccount, requireEditable, async (req, res) => {
    try {
        const { documents, application, writer } = req.bundle;
        const doc = documents.find(d => String(d._id) === req.params.docId);
        if (!doc) return res.status(404).json({ error: 'Document not found.' });
        if (application.status === 'APPROVED' && doc.type === 'RESUME' && documents.filter(d => d.type === 'RESUME').length === 1)
            return res.status(409).json({ error: 'Upload a replacement resume before removing your only one.' });
        await doc.deleteOne();
        await removeStoredFile(doc.storedName);
        await sendOwnerView(res, writer._id);
    } catch (err) { handleError(res, err, 'Could not delete document.'); }
});

// Owner and admins can open any document; the public can open writing samples
// that the writer published on a listed profile.
router.get('/documents/:docId/file', identifyPrincipal, async (req, res) => {
    try {
        if (!isObjectId(req.params.docId)) return res.status(404).json({ error: 'File not found.' });
        const doc = await WriterDocument.findById(req.params.docId);
        if (!doc) return res.status(404).json({ error: 'File not found.' });
        const writer = await Writer.findById(doc.writerId).select('status userId');
        let allowed = can(req.admin?.adminRole, 'writers.documents') || String(req.user?.id) === String(writer?.userId);
        if (!allowed && doc.type === 'WRITING_SAMPLE' && doc.isPublic && doc.reviewStatus !== 'REJECTED') {
            const profile = await WriterProfile.findOne({ writerId: doc.writerId }).select('visibility');
            allowed = isPubliclyVisible(writer, profile);
        }
        if (!allowed) return res.status(404).json({ error: 'File not found.' });
        streamStoredFile(res, doc, { download: req.query.download === '1' });
    } catch (err) { handleError(res, err, 'Could not load file.'); }
});

// ── Availability ─────────────────────────────────────────────────────────────

router.patch('/availability', authenticateUser, requireWriterAccount, validateInput(writerAvailabilitySchema), async (req, res) => {
    try {
        const { writer, availability } = req.bundle;
        if (!WORKING_WRITER_STATUSES.includes(writer.status))
            return res.status(409).json({ error: 'Availability can be set once your account is approved.' });
        if (availability?.adminOverride?.active)
            return res.status(409).json({ error: 'Your availability is currently set by the admin team. Contact support to change it.' });
        await WriterAvailability.updateOne({ writerId: writer._id }, { $set: req.body }, { upsert: true });
        await sendOwnerView(res, writer._id);
    } catch (err) { handleError(res, err, 'Could not update availability.'); }
});

// ── Application submission ───────────────────────────────────────────────────

router.post('/application/submit', authenticateUser, requireWriterAccount, validateInput(writerSubmitSchema), async (req, res) => {
    try {
        const { writer, application } = req.bundle;
        const onboarding = computeOnboarding(req.bundle);
        if (!onboarding.canSubmit)
            return res.status(409).json({ error: 'Complete all onboarding steps before submitting.', missing: onboarding.missing });

        const wasInfoRequest = application.status === 'INFO_REQUESTED';
        if (wasInfoRequest) {
            if (req.body.response.length < 5) return res.status(400).json({ error: 'Please reply to the review team’s request.' });
            application.infoRequest.response = req.body.response;
            application.infoRequest.respondedAt = new Date();
        }
        const from = `${writer.status}/${application.status}`;
        application.status = 'SUBMITTED';
        application.submittedAt = new Date();
        application.submissionCount += 1;
        application.history.push({
            action: wasInfoRequest ? 'INFO_PROVIDED' : 'SUBMITTED', fromStatus: from, toStatus: `${writer.status}/SUBMITTED`,
            note: req.body.response, actorType: 'WRITER', actorId: writer.userId,
        });
        await application.save();
        await sendOwnerView(res, writer._id);
    } catch (err) { handleError(res, err, 'Could not submit application.'); }
});

router.get('/membership/eligibility', authenticateUser, requireWriterAccount, (req, res) => {
    res.json(membershipEligibility(req.bundle.writer));
});

// ============================================
// PUBLIC DIRECTORY
// ============================================

const queryString = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

router.get('/public', async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
        const search = queryString(req.query.search);
        const subject = queryString(req.query.subject);
        const level = queryString(req.query.level);
        const skill = queryString(req.query.skill);
        const country = queryString(req.query.country, 2).toUpperCase();
        const availableOnly = req.query.available === '1';

        // One indexed query on the directory snapshot (see services/writerDirectory.js).
        const filter = { status: { $in: PUBLIC_WRITER_STATUSES }, 'directory.visible': true };
        if (subject) filter['directory.subjects'] = subject.toLowerCase();
        if (level) filter['directory.levels'] = level;
        if (/^[A-Z]{2}$/.test(country)) filter['directory.country'] = country;
        if (skill) filter['directory.skills'] = slugify(skill);
        if (availableOnly) filter['directory.available'] = true;
        const terms = prefixTerms(search);
        if (terms.length) filter['directory.tokens'] = { $all: terms };

        const [total, pageWriters] = await Promise.all([
            Writer.countDocuments(filter),
            Writer.find(filter)
                .sort({ 'membership.tier': -1, 'metrics.rating': -1, 'metrics.completedAssignments': -1, _id: 1 })
                .skip((page - 1) * limit).limit(limit).select('-phoneE164 -searchKeys -signupIpHash -emailCanonical -risk').lean(),
        ]);
        const ids = pageWriters.map(w => w._id);
        const [users, profiles, availabilities, skills] = await Promise.all([
            User.find({ _id: { $in: pageWriters.map(w => w.userId) } }).select('name').lean(),
            WriterProfile.find({ writerId: { $in: ids } }).lean(),
            WriterAvailability.find({ writerId: { $in: ids } }).lean(),
            WriterSkill.find({ writerId: { $in: ids } }).select('writerId name').lean(),
        ]);
        const byWriter = (rows) => new Map(rows.map(r => [String(r.writerId), r]));
        const userMap = new Map(users.map(u => [String(u._id), u]));
        const profileMap = byWriter(profiles), availMap = byWriter(availabilities);

        const writers = pageWriters.filter(w => profileMap.has(String(w._id))).map(w => {
            const view = toPublicView({
                writer: w, user: userMap.get(String(w.userId)), profile: profileMap.get(String(w._id)), availability: availMap.get(String(w._id)),
                skills: skills.filter(s => String(s.writerId) === String(w._id)), documents: [],
            });
            // Cards only need a summary.
            const { bio, education, writingExperience, writingSamples, ...card } = view;
            return { ...card, topDegree: education[0] ? `${education[0].level} · ${education[0].degree}` : null };
        });
        res.json({ writers, total, page, limit });
    } catch (err) { handleError(res, err, 'Could not load writers.'); }
});

router.get('/public/:writerId', async (req, res) => {
    try {
        if (!isObjectId(req.params.writerId)) return res.status(404).json({ error: 'Writer not found.' });
        const bundle = await loadWriterBundle({ _id: req.params.writerId });
        if (!bundle || !isPubliclyVisible(bundle.writer, bundle.profile)) return res.status(404).json({ error: 'Writer not found.' });
        res.json({ writer: toPublicView(bundle) });
    } catch (err) { handleError(res, err, 'Could not load writer.'); }
});

export default router;
