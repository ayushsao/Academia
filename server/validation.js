import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { ACADEMIC_LEVELS, EDUCATION_LEVELS, MAX_SKILLS } from './writerConstants.js';

export const signupSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name too long").regex(/^\p{L}[\p{L}\s.'-]*$/u, "Name can only contain letters, spaces, apostrophes and hyphens"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(12, "Password must be at least 12 characters"),
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required")
});

export const adminLoginSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required")
});

// An admin changing their own password.
export const adminPasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Enter your current password').max(200),
    newPassword: z.string().min(12, 'Use at least 12 characters').max(200)
        .refine(p => !/^(admin123|password|123456)/i.test(p), 'Choose a less common password'),
});

export const orderSchema = z.object({
    service: z.string().min(2),
    subject: z.string().min(2),
    academicLevel: z.string().optional(),
    pages: z.number().int().min(1).optional(),
    deadline: z.string().min(4), // date string
    topicTitle: z.string().min(2),
    instructions: z.string().optional(),
    files: z.array(z.string().max(200)).max(5).optional(),
    turnitinReport: z.boolean().optional(),
    topExpert: z.boolean().optional(),
    abstractPage: z.boolean().optional(),
    totalAmount: z.number().min(0).optional(), // ignored: the server always prices the order
    transactionId: z.string().optional(),
    // The quotation the customer accepted; the order is refused (409) if it no longer matches.
    quote: z.object({
        currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
        total: z.number().min(0).max(100_000_000),
        pages: z.number().int().min(1).max(100000),
    }).strict().optional(),
    // Orders placed from a catalogue page are priced from the admin's pricing rules.
    catalog: z.object({
        subjectId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id'),
        serviceId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id').optional(),
        projectId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id').optional(),
        words: z.number().int().min(1).max(1_000_000).optional(),
        spacing: z.string().trim().toUpperCase().max(20).optional(),
        currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
        quotedTotalMinor: z.number().int().min(0).optional(), // what the customer was shown
    }).strict().optional(),
}).strict(); // Reject extra fields

// POST /api/orders/quote — inputs that affect the price of a standard order.
export const orderQuoteSchema = z.object({
    service: z.string().trim().max(120).optional().default(''),
    pages: z.coerce.number().int().min(1, 'Enter at least 1 page').max(100000),
    academicLevel: z.string().trim().max(40).optional(),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
    topExpert: z.boolean().optional(),
    abstractPage: z.boolean().optional(),
}).strict();

export const contactSchema = z.object({
    name: z.string().min(2).max(50),
    email: z.string().email(),
    phone: z.string().max(30).optional(),
    subject: z.string().min(2).max(100),
    message: z.string().min(10).max(2000)
}).strict();

// ── Writer marketplace ─────────────────────────────────────────────────────────

// Strips control characters and collapses whitespace in short free-text fields.
const cleanText = (min, max) => z.string()
    .transform(s => s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(min).max(max));

// Multi-line free text: keeps newlines, strips other control characters.
const longText = (min, max) => z.string()
    .transform(s => s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim())
    .pipe(z.string().min(min, `Must be at least ${min} characters`).max(max, `Must be at most ${max} characters`));

const isoCountry = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Invalid country');

// International name: letters from any script, marks, spaces, apostrophes, dots and hyphens.
const personName = cleanText(2, 80).refine(v => /^[\p{L}\p{M}' .-]+$/u.test(v), 'Name can only contain letters, spaces, apostrophes, dots and hyphens');

const tagList = (min, max, itemMax) => z.array(cleanText(1, itemMax)).min(min).max(max)
    .transform(list => [...new Map(list.map(v => [v.toLowerCase(), v])).values()]);

// Validates a national number against the selected country and normalises to E.164.
export const phoneField = z.object({
    phoneCountry: isoCountry,
    phoneNumber: z.string().trim().min(4).max(24),
}).transform((val, ctx) => {
    const parsed = parsePhoneNumberFromString(val.phoneNumber, val.phoneCountry);
    if (!parsed || !parsed.isValid()) {
        ctx.addIssue({ code: 'custom', path: ['phoneNumber'], message: 'Enter a valid phone number for the selected country' });
        return z.NEVER;
    }
    return { phoneE164: parsed.number, phoneCountry: parsed.country || val.phoneCountry, dialCode: `+${parsed.countryCallingCode}` };
});

export const writerRegisterSchema = z.object({
    name: personName,
    email: z.string().trim().toLowerCase().email('Invalid email format').max(254),
    password: z.string().min(12, 'Password must be at least 12 characters').max(128),
    phoneCountry: isoCountry,
    phoneNumber: z.string().trim().min(4).max(24),
    country: isoCountry,
    city: cleanText(2, 80),
    acceptTerms: z.literal(true, { message: 'You must accept the writer terms' }),
}).strict();

export const writerPhoneUpdateSchema = z.object({
    phoneCountry: isoCountry,
    phoneNumber: z.string().trim().min(4).max(24),
}).strict();

export const otpVerifySchema = z.object({
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
}).strict();

const currentYear = new Date().getFullYear();

export const writerProfileSchema = z.object({
    country: isoCountry,
    city: cleanText(2, 80),
    headline: cleanText(0, 120).optional().default(''),
    bio: longText(150, 3000),
    education: z.array(z.object({
        degree: cleanText(2, 120),
        level: z.enum(EDUCATION_LEVELS),
        university: cleanText(2, 160),
        fieldOfStudy: cleanText(0, 120).optional().default(''),
        graduationYear: z.number().int().min(1950).max(currentYear + 6).optional(),
    }).strict()).min(1, 'Add at least one education entry').max(6),
    yearsExperience: z.number().int().min(0).max(60),
    writingExperience: longText(50, 2000),
    expertiseAreas: tagList(1, 12, 60),
    subjects: tagList(1, 25, 60),
    academicLevels: z.array(z.enum(ACADEMIC_LEVELS)).min(1).max(ACADEMIC_LEVELS.length).transform(l => [...new Set(l)]),
    languages: tagList(1, 10, 40),
}).strict();

export const writerSkillsSchema = z.object({
    skills: z.array(cleanText(2, 40).refine(v => /^[\p{L}\p{N} +#&./()-]+$/u.test(v), 'Skills may only contain letters, numbers and + # & . / ( ) -'))
        .min(1, 'Select at least one skill').max(MAX_SKILLS),
}).strict();

export const writerSettingsSchema = z.object({
    visibility: z.enum(['PUBLIC', 'HIDDEN']).optional(),
}).strict();

export const writerAvailabilitySchema = z.object({
    status: z.enum(['AVAILABLE', 'UNAVAILABLE']),
    note: cleanText(0, 200).optional().default(''),
}).strict();

export const writerSubmitSchema = z.object({
    response: longText(0, 2000).optional().default(''),
}).strict();

export const documentMetaSchema = z.object({
    type: z.enum(['RESUME', 'CERTIFICATE', 'WRITING_SAMPLE', 'PORTFOLIO']),
    title: cleanText(0, 120).optional().default(''),
    isPublic: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
}).strict();

export const documentVisibilitySchema = z.object({
    isPublic: z.boolean(),
}).strict();

export const WRITER_ADMIN_ACTIONS = ['start_review', 'approve', 'reject', 'request_info', 'suspend', 'reactivate', 'deactivate'];

export const writerAdminActionSchema = z.object({
    action: z.enum(WRITER_ADMIN_ACTIONS),
    reason: longText(0, 1000).optional().default(''),
}).strict().refine(
    v => !['reject', 'request_info', 'suspend', 'deactivate'].includes(v.action) || v.reason.length >= 5,
    { message: 'A reason of at least 5 characters is required for this action', path: ['reason'] },
);

export const availabilityOverrideSchema = z.object({
    active: z.boolean(),
    status: z.enum(['AVAILABLE', 'UNAVAILABLE']).optional(),
    reason: cleanText(0, 300).optional().default(''),
}).strict().refine(v => !v.active || (v.status && v.reason.length >= 5), {
    message: 'An override needs a status and a reason of at least 5 characters', path: ['reason'],
});

export const documentReviewSchema = z.object({
    reviewStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
    note: cleanText(0, 300).optional().default(''),
}).strict();

// ── Writer membership ──────────────────────────────────────────────────────────
// Clients may only choose a plan, period and currency. Anything else (amount,
// price, discount…) is rejected — the server prices every checkout itself.

const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Invalid currency');
const billingPeriod = z.enum(['MONTHLY', 'ANNUAL']);
const planCode = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,29}$/, 'Invalid plan');

export const membershipSelectionSchema = z.object({ planCode, billingPeriod, currency: currencyCode }).strict();

export const paymentStartSchema = z.object({ provider: z.enum(['RAZORPAY', 'MANUAL']) }).strict();

export const razorpayVerifySchema = z.object({
    razorpay_order_id: z.string().trim().min(1).max(64),
    razorpay_payment_id: z.string().trim().min(1).max(64),
    razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'Invalid signature'),
}).strict();

export const manualPaymentSchema = z.object({
    method: z.enum(['UPI', 'PAYPAL', 'BANK_TRANSFER', 'OTHER']),
    reference: cleanText(4, 80),
}).strict();

export const autoRenewSchema = z.object({ enabled: z.boolean() }).strict();

// Admin: prices arrive in major units (e.g. 12.99) and are converted to minor units server-side.
export const planUpsertSchema = z.object({
    code: planCode,
    name: cleanText(2, 40),
    description: cleanText(0, 200).optional().default(''),
    features: z.array(cleanText(2, 120)).max(15).default([]),
    tier: z.number().int().min(1).max(100),
    sortOrder: z.number().int().min(0).max(1000).optional().default(0),
    highlight: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(false),
    prices: z.array(z.object({
        currency: currencyCode,
        billingPeriod,
        amount: z.number().nonnegative().max(10_000_000),
        discountPercent: z.number().min(0).max(90).optional().default(0),
        isActive: z.boolean().optional().default(true),
    }).strict()).max(100),
}).strict();

export const planStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const membershipSettingsSchema = z.object({
    currencies: z.array(z.object({ code: currencyCode, isActive: z.boolean() }).strict()).min(1).max(60),
    countryCurrency: z.record(z.string().regex(/^[A-Z]{2}$/), currencyCode).optional(),
    defaultCurrency: currencyCode,
    manualPayment: z.object({
        enabled: z.boolean(),
        upiId: cleanText(0, 80).optional().default(''),
        paypalUrl: z.union([z.literal(''), z.string().trim().url().max(200).refine(u => u.startsWith('https://'), 'Must be an https link')]).optional().default(''),
        bankDetails: longText(0, 600).optional().default(''),
        instructions: longText(0, 600).optional().default(''),
    }).strict(),
    reporting: z.object({
        currency: currencyCode,
        ratesToReporting: z.record(currencyCode, z.number().positive().max(1_000_000)),
    }).strict(),
}).strict();

export const subscriptionAdminActionSchema = z.object({
    action: z.enum(['suspend', 'reinstate', 'cancel']),
    reason: longText(0, 500).optional().default(''),
}).strict().refine(v => v.action === 'reinstate' || v.reason.length >= 5, { message: 'A reason of at least 5 characters is required', path: ['reason'] });

export const paymentReviewSchema = z.object({
    decision: z.enum(['approve', 'reject']),
    note: longText(0, 500).optional().default(''),
}).strict().refine(v => v.decision === 'approve' || v.note.length >= 5, { message: 'Explain why the payment is rejected', path: ['note'] });

// ── Assignments ────────────────────────────────────────────────────────────────

const isoDate = z.string().datetime({ offset: true }).transform(s => new Date(s));
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

export const assignmentUpsertSchema = z.object({
    orderRef: z.string().trim().max(40).optional(),
    title: cleanText(3, 200),
    service: cleanText(0, 120).optional().default(''),
    subject: cleanText(2, 80),
    academicLevel: z.enum(ACADEMIC_LEVELS),
    wordCount: z.number().int().min(0).max(200000),
    requirements: longText(0, 5000).optional().default(''),
    instructions: longText(0, 10000).optional().default(''),
    deliverables: z.array(cleanText(1, 200)).max(20).optional().default([]),
    requiredSkills: z.array(cleanText(2, 40)).max(10).optional().default([]),
    writerDeadline: isoDate,
    clientDeadline: isoDate.optional().nullable(),
    payout: z.object({ amount: z.number().nonnegative().max(1_000_000), currency: currencyCode }).strict(),
    allocationMode: z.enum(['MANUAL', 'AUTOMATIC', 'HYBRID']).nullable().optional().default(null),
    rules: z.object({
        minQualityScore: z.number().min(0).max(100).nullable().optional().default(null),
        minRating: z.number().min(0).max(5).nullable().optional().default(null),
        allowedCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(250).optional().default([]),
        excludedWriterIds: z.array(objectId).max(200).optional().default([]),
        preferredTimezone: z.string().trim().max(64).optional().default(''),
    }).strict().optional().default({}),
}).strict();

export const declineOfferSchema = z.object({
    code: z.enum(['TOO_BUSY', 'OUTSIDE_EXPERTISE', 'DEADLINE', 'PAYOUT', 'UNCLEAR', 'OTHER']).optional(),
    reason: longText(0, 500).optional().default(''),
}).strict();

export const workloadSchema = z.object({
    maxConcurrent: z.number().int().min(1).max(50),
    timezone: z.string().trim().max(64).optional(),
}).strict();

export const manualOfferSchema = z.object({ writerId: objectId }).strict();

export const submissionReviewSchema = z.object({
    decision: z.enum(['start_review', 'request_revision', 'approve']),
    note: longText(0, 3000).optional().default(''),
    revisionHours: z.number().int().min(1).max(24 * 14).optional(),
    adjustment: z.object({ amount: z.number().min(-1_000_000).max(1_000_000), reason: cleanText(5, 200) }).strict().optional(),
}).strict().refine(v => v.decision !== 'request_revision' || v.note.length >= 10, { message: 'Explain what needs to change (at least 10 characters)', path: ['note'] });

const stopSchema = {
    reason: cleanText(5, 500),
    writerAtFault: z.boolean().optional().default(false),
    earningAction: z.enum(['CANCEL', 'APPROVE', 'PARTIAL']).optional().default('CANCEL'),
    partialAmount: z.number().nonnegative().max(1_000_000).optional(),
};
export const assignmentStopSchema = z.object(stopSchema).strict();

const star = z.number().int().min(1).max(5);
export const ratingSchema = z.object({
    quality: star, accuracy: star, communication: star,
    comment: longText(0, 1000).optional().default(''),
    editReason: cleanText(0, 300).optional(),
}).strict();

export const payEarningsSchema = z.object({ ids: z.array(objectId).min(1).max(500), reference: cleanText(3, 120) }).strict();
export const adjustEarningSchema = z.object({ amount: z.number().min(-1_000_000).max(1_000_000).refine(v => v !== 0, 'Amount can’t be zero'), reason: cleanText(5, 200) }).strict();
export const writerWorkloadLimitSchema = z.object({ adminLimit: z.number().int().min(0).max(50).nullable() }).strict();

const weightMap = (keys) => z.object(Object.fromEntries(keys.map(k => [k, z.number().min(0).max(100)]))).strict();
export const assignmentSettingsSchema = z.object({
    allocationMode: z.enum(['MANUAL', 'AUTOMATIC', 'HYBRID']),
    offerTtlHours: z.number().min(1).max(168),
    hybridShortlistSize: z.number().int().min(1).max(20),
    autoMaxAttempts: z.number().int().min(1).max(50),
    defaultWorkloadLimit: z.number().int().min(1).max(50),
    maxWorkloadLimit: z.number().int().min(1).max(50),
    requireSubjectMatch: z.boolean(),
    minQualityScore: z.number().min(0).max(100),
    minRating: z.number().min(0).max(5),
    newWriterGrace: z.number().int().min(0).max(100),
    weights: weightMap(['subject', 'skills', 'quality', 'rating', 'performance', 'workload', 'timezone', 'membership']),
    submission: z.object({
        allowedFormats: z.array(z.enum(['pdf', 'doc', 'docx', 'zip', 'xlsx', 'pptx', 'txt', 'csv', 'jpg', 'png'])).min(1),
        maxFileMB: z.number().int().min(1).max(100),
        maxFiles: z.number().int().min(1).max(20),
    }).strict(),
    revisionHours: z.number().int().min(1).max(24 * 14),
    maxRevisions: z.number().int().min(0).max(20),
    ratingWeights: weightMap(['quality', 'accuracy', 'timeliness', 'communication']),
    ratingEditWindowDays: z.number().int().min(0).max(90),
    ratingPrior: z.object({ mean: z.number().min(1).max(5), weight: z.number().min(0).max(100) }).strict(),
    qualityWeights: weightMap(['rating', 'onTime', 'completion', 'revisions', 'response']),
}).strict().refine(v => v.defaultWorkloadLimit <= v.maxWorkloadLimit, { message: 'Default workload can’t exceed the maximum', path: ['defaultWorkloadLimit'] })
    .refine(v => Object.values(v.weights).some(w => w > 0), { message: 'At least one matching weight must be above zero', path: ['weights'] })
    .refine(v => v.weights.membership <= 15, { message: 'Membership weight is capped at 15 so membership never dominates allocation', path: ['weights', 'membership'] });

// Middleware generator
export const validateInput = (schema, source = 'body') => (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
        const issues = result.error.issues || [];
        return res.status(400).json({
            error: issues[0]?.message || 'Validation failed',
            details: issues.map(e => `${e.path.join('.')}: ${e.message}`)
        });
    }
    req[source] = result.data;
    next();
};

// ── Admin CRM: catalogue & pricing ─────────────────────────────────────────────
const plain = (max) => z.string().trim().max(max).transform(s => s.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''));
const slugField = z.string().trim().toLowerCase().max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and single hyphens only');
const catalogStatus = z.enum(['ACTIVE', 'INACTIVE']);
const sortOrder = z.coerce.number().int().min(-100000).max(100000);

export const catalogSubjectSchema = z.object({
    name: plain(120).pipe(z.string().min(2, 'Name must be at least 2 characters')),
    slug: slugField.optional().or(z.literal('')),
    description: plain(5000).default(''),
    status: catalogStatus.default('ACTIVE'),
    published: z.boolean().default(false),
    sortOrder: sortOrder.default(0),
}).strict();

export const catalogServiceSchema = catalogSubjectSchema.extend({ subjectId: objectId }).strict();

export const catalogProjectSchema = z.object({
    subjectId: objectId.optional(),      // derived from the service; must match if sent
    serviceId: objectId,
    title: plain(160).pipe(z.string().min(2, 'Title must be at least 2 characters')),
    slug: slugField.optional().or(z.literal('')),
    description: plain(10000).default(''),
    status: catalogStatus.default('ACTIVE'),
    published: z.boolean().default(false),
    sortOrder: sortOrder.default(0),
}).strict();

export const catalogStatusSchema = z.object({ status: catalogStatus }).strict();
export const catalogPublishSchema = z.object({ published: z.boolean() }).strict();

export const pricingRuleSchema = z.object({
    subjectId: objectId,
    serviceId: objectId.nullable().optional().or(z.literal('')),
    projectId: objectId.nullable().optional().or(z.literal('')),
    label: plain(120).default(''),
    wordsPerPage: z.coerce.number().int().min(50, 'Words per page must be at least 50').max(2000).nullable().optional(),
    basePrice: z.coerce.number().min(0, 'Base price cannot be negative').max(1_000_000),   // major units, per page
    multiplier: z.coerce.number().min(0, 'Multiplier cannot be negative').max(100)
        .refine(v => Math.round(v * 10000) === v * 10000 || Math.abs(Math.round(v * 10000) - v * 10000) < 1e-6, 'Use at most 4 decimal places'),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code'),
    formula: z.string().trim().max(40).default('BASE_X_MULTIPLIER'),
    effectiveDate: z.coerce.date({ message: 'Enter a valid effective date' }),
    status: catalogStatus.default('ACTIVE'),
}).strict();

export const wordConfigSchema = z.object({
    defaultWordsPerPage: z.coerce.number().int().min(50).max(2000),
    rounding: z.enum(['CEIL', 'ROUND', 'EXACT']),
    minPages: z.coerce.number().min(0).max(1000),
    maxPages: z.coerce.number().min(1).max(100000),
    spacingOptions: z.array(z.object({
        key: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/, 'Spacing keys use capital letters, digits and _'),
        label: plain(40).pipe(z.string().min(1)),
        factor: z.coerce.number().min(0.1).max(10),
    }).strict()).min(1, 'Add at least one spacing option').max(6),
    defaultSpacing: z.string().trim().toUpperCase(),
}).strict()
    .refine(c => c.maxPages >= c.minPages, { message: 'Maximum pages must be at least the minimum', path: ['maxPages'] })
    .refine(c => c.spacingOptions.some(s => s.key === c.defaultSpacing), { message: 'Default spacing must be one of the options', path: ['defaultSpacing'] })
    .refine(c => new Set(c.spacingOptions.map(s => s.key)).size === c.spacingOptions.length, { message: 'Spacing keys must be unique', path: ['spacingOptions'] });

export const quoteSchema = z.object({
    subjectId: objectId,
    serviceId: objectId.optional().or(z.literal('')),
    projectId: objectId.optional().or(z.literal('')),
    words: z.coerce.number().min(0).max(1_000_000).optional(),
    pages: z.coerce.number().min(0).max(100000).optional(),
    spacing: z.string().trim().toUpperCase().max(20).optional(),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
}).strict();

// ── Dynamic content CMS (blocks, FAQs, SEO, media) ─────────────────────────────
const contentEntity = z.enum(['SUBJECT', 'SERVICE', 'PROJECT']);
export const contentBlockSchema = z.object({
    entityType: contentEntity,
    entityId: objectId,
    type: z.enum(['HEADING', 'RICH_TEXT', 'INTRODUCTION', 'FEATURES', 'AVAILABLE_PROJECTS', 'PROGRAMMING_LANGUAGES', 'FAQ', 'CTA', 'IMAGE', 'CUSTOM_HTML', 'SEO_CONTENT']),
    title: z.string().max(400).default(''),
    content: z.record(z.string(), z.any()).default({}),   // per-type rules in services/contentBlocks.js
    mediaIds: z.array(objectId).max(12).default([]),
    status: catalogStatus.default('ACTIVE'),
    sortOrder: sortOrder.optional(),
}).strict();

export const reorderSchema = z.object({
    entityType: contentEntity,
    entityId: objectId,
    ids: z.array(objectId).min(1).max(500),
}).strict();

export const faqSchema = z.object({
    entityType: contentEntity,
    entityId: objectId,
    question: plain(300).pipe(z.string().min(3, 'Write a question')),
    answer: z.string().max(20000),
    status: catalogStatus.default('ACTIVE'),
    sortOrder: sortOrder.optional(),
}).strict();

const absoluteOrEmpty = z.string().trim().max(500).refine(v => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Use a full URL starting with https://');
export const seoInputSchema = z.object({
    slug: slugField.optional().or(z.literal('')),
    metaTitle: plain(120).default(''),
    metaDescription: plain(320).default(''),
    keywords: z.array(plain(60)).max(30).default([]),
    canonicalUrl: absoluteOrEmpty.default(''),
    ogTitle: plain(120).default(''),
    ogDescription: plain(320).default(''),
    ogImageMediaId: objectId.nullable().optional(),
    robots: z.enum(['index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow']).default('index,follow'),
}).strict();

export const mediaAltSchema = z.object({ alt: plain(200) }).strict();
