import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/academiapro';

let connected = false;

export async function connectDB() {
  if (connected) return;
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    console.log(`[DB] MongoDB connected successfully.`);
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, default: 'CUSTOMER', enum: ['student', 'admin', 'CUSTOMER', 'WRITER', 'ADMIN'] },
  status: { type: String, default: 'ACTIVE', enum: ['ACTIVE', 'SUSPENDED'] },
  lastLogin: { type: Date },
}, { timestamps: true });
userSchema.index({ role: 1, createdAt: -1 });
// A writer's name/email feed the directory search snapshot (services/writerDirectory.js).
const refreshWriterForUser = (doc) => { if (doc?.role === 'WRITER') import('./services/writerDirectory.js').then(m => m.refreshForUser(doc._id)).catch(() => {}); };
userSchema.post('save', refreshWriterForUser);
userSchema.post('findOneAndUpdate', refreshWriterForUser);

const orderDeliveryFileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
}, { _id: true });

const orderFeedbackSchema = new mongoose.Schema({
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, default: '' },
  writerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // the writer who delivered the order
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  writerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  service: { type: String, required: true },
  subject: { type: String, required: true },
  academicLevel: { type: String, default: 'Undergraduate' },
  pages: { type: Number, default: 1 },
  wordCount: { type: Number, default: 0 },
  deadline: { type: String, required: true },
  topicTitle: { type: String, required: true },
  description: { type: String, default: '' },
  instructions: { type: String, default: '' },
  files: { type: [String], default: [] },
  turnitinReport: { type: Boolean, default: false },
  topExpert: { type: Boolean, default: false },
  abstractPage: { type: Boolean, default: false },
  totalAmount: { type: Number, default: 0 },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'available', 'assigned', 'in_progress', 'submitted', 'revision_required', 'completed', 'cancelled',
           // Legacy values (existing orders before the workflow update)
           'Pending', 'In Progress', 'Completed', 'Cancelled'],
  },
  adminApproved: { type: Boolean, default: false },
  adminApprovedAt: { type: Date },
  paymentStatus: { type: String, default: 'pending', enum: ['pending', 'paid', 'refunded'] },
  assignedTo: { type: String, default: '' },
  adminNotes: { type: String, default: '' },
  // What the admin asked the writer to change (shown to the writer; adminNotes stay internal).
  revisionNote: { type: String, default: '' },
  transactionId: { type: String, default: '' },
  currency: { type: String, default: 'GBP' },
  // Writer-delivered files (final work submissions)
  deliveryFiles: { type: [orderDeliveryFileSchema], default: [] },
  submittedAt: { type: Date },
  completedAt: { type: Date },
  // Client feedback on completed work
  feedback: { type: orderFeedbackSchema, default: undefined },
  // How the order was paid. RAZORPAY + PAID only after the server confirmed the
  // payment with Razorpay; MANUAL references (UPI/PayPal/UTR) need admin checks.
  payment: {
    type: new mongoose.Schema({
      provider: { type: String, enum: ['RAZORPAY', 'MANUAL'], default: 'MANUAL' },
      status: { type: String, enum: ['PAID', 'PENDING_VERIFICATION'], default: 'PENDING_VERIFICATION' },
      providerOrderId: String, providerPaymentId: String,
      amountMinor: Number, currency: String, paidAt: Date,
    }, { _id: false }),
    default: undefined,
  },
  // Standard orders: the accepted quotation (same numbers the customer saw).
  pricing: {
    type: new mongoose.Schema({
      words: Number, pages: Number, wordsPerPage: Number,
      baseCurrency: String, basePrice: Number, exchangeRate: Number, levelMultiplier: Number,
      subtotal: Number, addOns: [{ _id: false, key: String, label: String, price: Number }], addOnsTotal: Number,
      discountPercent: Number, discount: Number, total: Number, currency: String,
    }, { _id: false }),
    default: undefined,
  },
  // Set for orders placed from a catalogue page: the selection and the server-side quote.
  catalog: {
    type: new mongoose.Schema({
      subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogSubject' },
      serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogService', default: null },
      projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'CatalogProject', default: null },
      projectTitle: { type: String, default: '' },
      words: Number, spacing: String, wordsPerPage: Number,
      unitPriceMinor: Number, totalMinor: Number,
      pricingRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'PricingRule' },
    }, { _id: false }),
    default: undefined,
  },
}, { timestamps: true });
orderSchema.index({ writerId: 1, status: 1 });

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, default: 'unread', enum: ['unread', 'read'] },
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String, required: true },
  // See server/permissions.js. 'ADMIN' is the legacy value for a full admin (= SUPER_ADMIN).
  role: { type: String, default: 'SUPER_ADMIN', enum: ['SUPER_ADMIN', 'ADMIN', 'HR', 'OPERATIONS', 'FINANCE', 'MARKETING'] },
  lastLoginAt: { type: Date },
  // Two-factor authentication (services/twoFactor.js). Secrets are encrypted;
  // recovery codes are stored as hashes only. Never sent to clients.
  twoFactor: {
    enabled: { type: Boolean, default: false },
    secretEnc: { type: String, select: false },
    pendingSecretEnc: { type: String, select: false },   // being set up, not yet confirmed
    recoveryHashes: { type: [String], default: [], select: false },
    lastUsedStep: { type: Number, default: -1 },         // stops a code being used twice
    enabledAt: Date,
  },
}, { timestamps: true });

const siteSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

const pageViewSchema = new mongoose.Schema({
  page: { type: String, required: true },
  userAgent: { type: String, default: '' },
  referrer: { type: String, default: '' },
  country: { type: String, default: 'Unknown' },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Order = mongoose.model('Order', orderSchema);

// An online payment in progress for a customer order: the server-priced order
// fields and the exact amount Razorpay must confirm before the order exists.
const orderCheckoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fields: { type: mongoose.Schema.Types.Mixed, required: true },
  amountMinor: { type: Number, required: true },
  currency: { type: String, required: true },
  providerOrderId: { type: String, index: { unique: true, sparse: true } },
  providerPaymentId: String,
  status: { type: String, enum: ['CREATED', 'CONFIRMING', 'PAID'], default: 'CREATED', index: true },
  orderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  needsAttention: String,
}, { timestamps: true });
// Abandoned checkouts are cleaned up after a week (completed ones are kept).
orderCheckoutSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600, partialFilterExpression: { status: 'CREATED' } });
export const OrderCheckout = mongoose.model('OrderCheckout', orderCheckoutSchema);
export const Contact = mongoose.model('Contact', contactSchema);
export const Admin = mongoose.model('Admin', adminSchema);
export const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);
export const PageView = mongoose.model('PageView', pageViewSchema);

// ── Writer Marketplace Schemas ───────────────────────────────────────────────

export const WRITER_STATUSES = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'INACTIVE'];
export const WRITER_DOCUMENT_TYPES = ['RESUME', 'CERTIFICATE', 'WRITING_SAMPLE', 'PORTFOLIO'];
const { ObjectId } = mongoose.Schema.Types;

// Writer: account-level state for a User with role WRITER. Holds private contact
// details, verification flags, lifecycle status and performance metrics.
// Never returned from public endpoints.
const writerSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true, unique: true },
  status: { type: String, default: 'PENDING', enum: WRITER_STATUSES, index: true },
  // Private contact info (E.164 phone, ISO country of the number)
  phoneE164: { type: String, required: true },
  phoneCountry: { type: String, required: true }, // ISO 3166-1 alpha-2
  dialCode: { type: String, required: true },     // e.g. "+44"
  emailVerified: { type: Boolean, default: false },
  emailVerifiedAt: { type: Date },
  phoneVerified: { type: Boolean, default: false },
  phoneVerifiedAt: { type: Date },
  // Status that SUSPENDED/INACTIVE writers return to on reactivation
  statusBeforeSuspension: { type: String, enum: WRITER_STATUSES },
  // Denormalised snapshot of the current WriterSubscription, kept in sync by membershipService.
  membership: {
    plan: { type: String, default: null },
    tier: { type: Number, default: 0 },
    subscriptionId: { type: ObjectId, ref: 'WriterSubscription', default: null },
    status: { type: String, default: 'NONE', enum: ['NONE', 'PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'SUSPENDED'] },
    activatedAt: { type: Date },
    expiresAt: { type: Date },
  },
  // Recomputed from source records by assignmentMetrics.recomputeWriterMetrics — never edited directly.
  metrics: {
    rating: { type: Number, default: 0, min: 0, max: 5 },          // Bayesian-smoothed overall rating
    ratingCount: { type: Number, default: 0 },
    completedAssignments: { type: Number, default: 0 },
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },
    responseRate: { type: Number, default: 0, min: 0, max: 100 },
    acceptanceRate: { type: Number, default: 0, min: 0, max: 100 },
    completionRate: { type: Number, default: 0, min: 0, max: 100 },
    onTimeRate: { type: Number, default: 0, min: 0, max: 100 },
    revisionRate: { type: Number, default: 0, min: 0, max: 100 },
    activeAssignments: { type: Number, default: 0 },
    updatedAt: { type: Date },
  },
  workload: {
    maxConcurrent: { type: Number, default: null },   // writer's own capacity choice
    adminLimit: { type: Number, default: null },      // admin override (caps the writer's choice)
  },
  // Anti-abuse: canonical email (dots/plus-tags removed for providers that ignore them)
  // and a keyed hash of the sign-up IP, so accounts can be correlated without storing raw IPs.
  emailCanonical: { type: String, default: '' },
  signupIpHash: { type: String, default: '' },
  // Summary of open RiskEvents, maintained by services/abuse.js.
  risk: {
    score: { type: Number, default: 0 },
    level: { type: String, enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'], default: 'NONE' },
    flags: { type: [String], default: [] },
    updatedAt: { type: Date },
  },
  // Denormalised, indexed snapshot of profile/skills/availability used by the public
  // directory and admin search, so they can filter, sort and page in one indexed query.
  // Maintained by services/writerDirectory.js (model hooks below); never edited directly.
  directory: {
    visible: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    country: { type: String, default: '' },
    subjects: { type: [String], default: [] },   // lowercased subjects + expertise areas
    levels: { type: [String], default: [] },
    skills: { type: [String], default: [] },     // skill slugs
    tokens: { type: [String], default: [] },     // public search words (name, headline, subjects, skills)
    yearsExperience: { type: Number, default: 0 },
    refreshedAt: { type: Date },
  },
  searchKeys: { type: [String], default: [] },   // admin-only search words: name words, email, email local part
}, { timestamps: true });
// A phone number can only be verified on one writer account.
writerSchema.index({ phoneE164: 1 }, { unique: true, partialFilterExpression: { phoneVerified: true } });
writerSchema.index({ phoneE164: 1, createdAt: 1 });            // duplicate checks / admin phone search
writerSchema.index({ emailCanonical: 1 });
writerSchema.index({ signupIpHash: 1, createdAt: -1 });
writerSchema.index({ status: 1, createdAt: -1 });
writerSchema.index({ 'membership.status': 1, 'membership.plan': 1 });
writerSchema.index({ 'metrics.rating': -1, 'metrics.ratingCount': -1 });
writerSchema.index({ 'risk.level': 1, 'risk.score': -1 });
writerSchema.index({ 'directory.country': 1 });
writerSchema.index({ 'directory.subjects': 1 });
writerSchema.index({ 'directory.skills': 1 });
writerSchema.index({ 'directory.levels': 1 });
writerSchema.index({ 'directory.tokens': 1 });
writerSchema.index({ searchKeys: 1 });
// Public directory: visible writers ranked by tier, rating and completed work.
writerSchema.index({ 'directory.visible': 1, status: 1, 'membership.tier': -1, 'metrics.rating': -1, 'metrics.completedAssignments': -1 });

// WriterProfile: the public-facing professional profile.
const educationSchema = new mongoose.Schema({
  degree: { type: String, required: true },       // e.g. "MSc Computer Science"
  level: { type: String, required: true },        // e.g. "Master's"
  university: { type: String, required: true },
  fieldOfStudy: { type: String, default: '' },
  graduationYear: { type: Number },
}, { _id: false });

const writerProfileSchema = new mongoose.Schema({
  writerId: { type: ObjectId, ref: 'Writer', required: true, unique: true },
  userId: { type: ObjectId, ref: 'User', required: true, unique: true },
  country: { type: String, required: true },      // ISO 3166-1 alpha-2
  city: { type: String, required: true },
  profilePhoto: { type: String, default: null },  // stored filename in private writer storage
  headline: { type: String, default: '' },
  bio: { type: String, default: '' },
  education: { type: [educationSchema], default: [] },
  yearsExperience: { type: Number, default: 0, min: 0, max: 60 },
  writingExperience: { type: String, default: '' },
  expertiseAreas: { type: [String], default: [] },
  subjects: { type: [String], default: [], index: true },
  academicLevels: { type: [String], default: [] },
  languages: { type: [String], default: [] },
  timezone: { type: String, default: '' },   // IANA zone, used for allocation
  visibility: { type: String, default: 'PUBLIC', enum: ['PUBLIC', 'HIDDEN'] },
  bioHash: { type: String, default: '' },   // normalised-bio fingerprint for copy-paste profile detection
}, { timestamps: true });
writerProfileSchema.index({ country: 1 });
writerProfileSchema.index({ bioHash: 1 });

// WriterSkill: one row per skill so skills can be searched/aggregated across writers.
const writerSkillSchema = new mongoose.Schema({
  writerId: { type: ObjectId, ref: 'Writer', required: true, index: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, index: true },
  isCustom: { type: Boolean, default: false },
}, { timestamps: true });
writerSkillSchema.index({ writerId: 1, slug: 1 }, { unique: true });

// WriterDocument: files live in private storage and are only streamed through
// authorised endpoints. Writing samples can be opted into public display.
const writerDocumentSchema = new mongoose.Schema({
  writerId: { type: ObjectId, ref: 'Writer', required: true, index: true },
  type: { type: String, required: true, enum: WRITER_DOCUMENT_TYPES },
  title: { type: String, default: '' },
  storedName: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  sha256: { type: String, required: true },
  isPublic: { type: Boolean, default: false },
  reviewStatus: { type: String, default: 'PENDING', enum: ['PENDING', 'VERIFIED', 'REJECTED'] },
  reviewNote: { type: String, default: '' },
}, { timestamps: true });
writerDocumentSchema.index({ sha256: 1 });   // same file uploaded by different writers

// WriterApplication: the HR review record. `history` is an append-only trail
// of every decision taken on the application.
const applicationEventSchema = new mongoose.Schema({
  action: { type: String, required: true },
  fromStatus: { type: String },
  toStatus: { type: String },
  note: { type: String, default: '' },
  actorType: { type: String, enum: ['WRITER', 'ADMIN', 'SYSTEM'], required: true },
  actorId: { type: ObjectId },
  actorName: { type: String },
  at: { type: Date, default: Date.now },
}, { _id: false });

const writerApplicationSchema = new mongoose.Schema({
  writerId: { type: ObjectId, ref: 'Writer', required: true, unique: true },
  userId: { type: ObjectId, ref: 'User', required: true },
  status: { type: String, default: 'DRAFT', enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED'], index: true },
  submittedAt: { type: Date },
  submissionCount: { type: Number, default: 0 },
  reviewedAt: { type: Date },
  reviewedBy: { type: ObjectId, ref: 'Admin' },
  decisionReason: { type: String, default: '' },
  infoRequest: {
    message: { type: String },
    requestedAt: { type: Date },
    response: { type: String },
    respondedAt: { type: Date },
  },
  history: { type: [applicationEventSchema], default: [] },
}, { timestamps: true });

// WriterAvailability: writer-controlled availability plus an admin override
// that takes precedence while active.
const writerAvailabilitySchema = new mongoose.Schema({
  writerId: { type: ObjectId, ref: 'Writer', required: true, unique: true },
  status: { type: String, default: 'AVAILABLE', enum: ['AVAILABLE', 'UNAVAILABLE'] },
  note: { type: String, default: '' },
  adminOverride: {
    active: { type: Boolean, default: false },
    status: { type: String, enum: ['AVAILABLE', 'UNAVAILABLE'] },
    reason: { type: String },
    setBy: { type: ObjectId, ref: 'Admin' },
    setAt: { type: Date },
  },
}, { timestamps: true });

writerAvailabilitySchema.virtual('effectiveStatus').get(function () {
  return this.adminOverride?.active ? this.adminOverride.status : this.status;
});

// One-time passcodes for email/phone verification. Only an HMAC of the code is
// stored; documents expire automatically via the TTL index.
const otpTokenSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  channel: { type: String, required: true, enum: ['EMAIL', 'PHONE'] },
  target: { type: String, required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
otpTokenSchema.index({ userId: 1, channel: 1 });
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ── Writer assignments (opportunities, offers, submissions, earnings, ratings) ─
// Replaces the earlier bidding scaffold (Job/Bid/Payment). Money is integer minor units.

export const ASSIGNMENT_STATUSES = ['DRAFT', 'OPEN', 'OFFERED', 'ASSIGNED', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'RESUBMITTED', 'APPROVED', 'CANCELLED', 'UNALLOCATED'];
export const ACTIVE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'RESUBMITTED'];
export const ALLOCATION_MODES = ['MANUAL', 'AUTOMATIC', 'HYBRID'];

const storedFileSchema = new mongoose.Schema({
  storedName: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  sha256: { type: String, default: '' },
  source: { type: String, enum: ['UPLOAD', 'ORDER'], default: 'UPLOAD' },  // ORDER = customer file from the linked order
  uploadedAt: { type: Date, default: Date.now },
});

const assignmentEventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  note: { type: String, default: '' },
  actorType: { type: String, enum: ['WRITER', 'ADMIN', 'SYSTEM'], required: true },
  actorId: { type: ObjectId },
  at: { type: Date, default: Date.now },
}, { _id: false });

const assignmentSchema = new mongoose.Schema({
  assignmentRef: { type: String, required: true, unique: true },   // public ID, e.g. ASG-7K2P9Q
  orderId: { type: ObjectId, ref: 'Order', default: null },         // linked customer order, if any
  source: { type: String, enum: ['ADMIN', 'ORDER', 'CUSTOMER_REQUEST'], default: 'ADMIN' },
  title: { type: String, required: true },
  service: { type: String, default: '' },
  subject: { type: String, required: true, index: true },
  academicLevel: { type: String, required: true },
  wordCount: { type: Number, required: true, min: 0 },
  requirements: { type: String, default: '' },
  instructions: { type: String, default: '' },
  deliverables: { type: [String], default: [] },
  requiredSkills: { type: [String], default: [] },
  writerDeadline: { type: Date, required: true },   // due to the platform
  clientDeadline: { type: Date },                   // internal only; never shown to writers
  payout: {
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
  },
  allocationMode: { type: String, enum: [...ALLOCATION_MODES, null], default: null },   // null → global setting
  rules: {
    minQualityScore: { type: Number, default: null },
    minRating: { type: Number, default: null },
    allowedCountries: { type: [String], default: [] },
    excludedWriterIds: { type: [ObjectId], default: [] },
    preferredTimezone: { type: String, default: '' },
  },
  referenceFiles: { type: [storedFileSchema], default: [] },
  status: { type: String, enum: ASSIGNMENT_STATUSES, default: 'DRAFT', index: true },
  assignedWriterId: { type: ObjectId, ref: 'Writer', default: null, index: true },
  assignedAt: { type: Date },
  firstSubmittedAt: { type: Date },
  revisionDueAt: { type: Date },
  revisionCount: { type: Number, default: 0 },
  approvedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String, default: '' },
  writerAtFault: { type: Boolean, default: false },   // counts against completion rate when cancelled
  allocation: {
    mode: { type: String, enum: ALLOCATION_MODES },     // mode actually used at publish
    attempts: { type: Number, default: 0 },
    lastRunAt: { type: Date },
    note: { type: String, default: '' },
  },
  createdBy: { type: ObjectId, ref: 'Admin' },
  history: { type: [assignmentEventSchema], default: [] },
}, { timestamps: true });
assignmentSchema.index({ assignedWriterId: 1, status: 1 });
assignmentSchema.index({ status: 1, writerDeadline: 1 });   // deadline reminders

const assignmentOfferSchema = new mongoose.Schema({
  assignmentId: { type: ObjectId, ref: 'Assignment', required: true },
  writerId: { type: ObjectId, ref: 'Writer', required: true, index: true },
  status: { type: String, required: true, default: 'OFFERED', enum: ['OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN'], index: true },
  source: { type: String, enum: ALLOCATION_MODES, required: true },
  score: { type: Number, default: null },
  scoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
  expiresAt: { type: Date, required: true, index: true },
  respondedAt: { type: Date },
  declineCode: { type: String, default: '' },
  declineReason: { type: String, default: '' },
  withdrawnReason: { type: String, default: '' },
  releasedAt: { type: Date },                      // admin took the work back after acceptance
  releasedAtFault: { type: Boolean, default: false },
}, { timestamps: true });
// A writer is offered a given assignment at most once.
assignmentOfferSchema.index({ assignmentId: 1, writerId: 1 }, { unique: true });

const assignmentSubmissionSchema = new mongoose.Schema({
  assignmentId: { type: ObjectId, ref: 'Assignment', required: true, index: true },
  writerId: { type: ObjectId, ref: 'Writer', required: true },
  version: { type: Number, required: true },
  files: { type: [storedFileSchema], default: [] },
  note: { type: String, default: '' },
  status: { type: String, required: true, default: 'SUBMITTED', enum: ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED'] },
  dueAt: { type: Date },
  minutesLate: { type: Number, default: 0 },
  reviewNote: { type: String, default: '' },
  reviewedBy: { type: ObjectId, ref: 'Admin' },
  reviewedAt: { type: Date },
}, { timestamps: true });
// Versions are numbered per writer (a reassigned assignment starts again at 1).
assignmentSubmissionSchema.index({ assignmentId: 1, writerId: 1, version: 1 }, { unique: true });

const writerEarningSchema = new mongoose.Schema({
  assignmentId: { type: ObjectId, ref: 'Assignment', required: true },
  writerId: { type: ObjectId, ref: 'Writer', required: true, index: true },
  baseAmountMinor: { type: Number, required: true },
  amountMinor: { type: Number, required: true },        // base + adjustments
  currency: { type: String, required: true },
  status: { type: String, required: true, default: 'PENDING', enum: ['PENDING', 'APPROVED', 'PAID', 'CANCELLED'], index: true },
  adjustments: { type: [{ amountMinor: Number, reason: String, by: { type: ObjectId, ref: 'Admin' }, at: { type: Date, default: Date.now } }], default: [] },
  approvedAt: { type: Date },
  paidAt: { type: Date },
  payoutReference: { type: String, default: '' },
  paidBy: { type: ObjectId, ref: 'Admin' },
}, { timestamps: true });
// One earning per writer per assignment (a released writer keeps theirs for history).
writerEarningSchema.index({ assignmentId: 1, writerId: 1 }, { unique: true });

const assignmentRatingSchema = new mongoose.Schema({
  assignmentId: { type: ObjectId, ref: 'Assignment', required: true, unique: true },   // one rating per assignment
  writerId: { type: ObjectId, ref: 'Writer', required: true, index: true },
  ratedBy: { type: ObjectId, ref: 'Admin', required: true },
  quality: { type: Number, required: true, min: 1, max: 5 },
  accuracy: { type: Number, required: true, min: 1, max: 5 },
  timeliness: { type: Number, required: true, min: 1, max: 5 },   // computed from submission times, not entered
  communication: { type: Number, required: true, min: 1, max: 5 },
  overall: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  edits: { type: [{ by: { type: ObjectId, ref: 'Admin' }, at: Date, reason: String, previous: mongoose.Schema.Types.Mixed }], default: [] },
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  attachments: { type: [String] },
  readAt: { type: Date },
}, { timestamps: true });

// Notification (a.k.a. WriterNotification): the in-app record plus the delivery
// state of every external channel it was sent on. Created only through
// services/notifications.js so preferences, dedupe and retries apply uniformly.
export const NOTIFICATION_CATEGORIES = ['APPLICATION', 'SUBSCRIPTION', 'PAYMENT', 'OPPORTUNITY', 'ASSIGNMENT', 'DEADLINE', 'REVISION', 'APPROVAL', 'ACCOUNT'];
export const NOTIFICATION_CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP'];   // in-app is always on

const notificationDeliverySchema = new mongoose.Schema({
  channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
  status: { type: String, enum: ['PENDING', 'SENT', 'FAILED', 'SKIPPED'], default: 'PENDING' },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  lastError: { type: String, default: '' },
  sentAt: { type: Date },
}, { _id: false });

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String }, // specific event, e.g. WRITER_APPROVE, OFFER_RECEIVED
  category: { type: String, enum: NOTIFICATION_CATEGORIES, default: 'ACCOUNT' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: '' },          // in-app path, e.g. /writer/assignments/ASG-1A2B
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  dedupeKey: { type: String },                  // makes repeat sends (reminders) idempotent
  deliveries: { type: [notificationDeliverySchema], default: [] },
}, { timestamps: true });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });
notificationSchema.index({ 'deliveries.status': 1, 'deliveries.nextAttemptAt': 1 });

// Per-user notification choices. Missing rows/categories fall back to defaults
// (email on, SMS/WhatsApp off) in services/notifications.js.
const notificationPreferenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  channels: { type: Map, of: new mongoose.Schema({ EMAIL: Boolean, SMS: Boolean, WHATSAPP: Boolean }, { _id: false }), default: {} },
}, { timestamps: true });

// ── Trust & safety ──────────────────────────────────────────────────────────
export const RISK_KINDS = [
  'DUPLICATE_EMAIL', 'DUPLICATE_PHONE', 'SHARED_SIGNUP_IP', 'DISPOSABLE_EMAIL', 'DUPLICATE_DOCUMENT', 'DUPLICATE_BIO',
  'CONTACT_DETAILS_IN_PROFILE', 'LINKS_IN_PROFILE', 'PAYMENT_REFERENCE_REUSED', 'CHECKOUT_CHURN', 'RATING_ANOMALY',
  'LOGIN_LOCKOUT', 'SPAM_CONTENT',
];
// One row per detected signal. (kind, dedupeKey) is unique so re-detecting the same
// thing updates the existing row instead of piling up duplicates.
const riskEventSchema = new mongoose.Schema({
  kind: { type: String, enum: RISK_KINDS, required: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
  writerId: { type: ObjectId, ref: 'Writer', default: null },
  userId: { type: ObjectId, ref: 'User', default: null },
  relatedWriterIds: { type: [ObjectId], default: [] },
  summary: { type: String, required: true },   // human-readable; never contains secrets or full contact details
  dedupeKey: { type: String, required: true },
  occurrences: { type: Number, default: 1 },
  lastSeenAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['OPEN', 'CONFIRMED', 'DISMISSED'], default: 'OPEN' },
  resolution: {
    note: { type: String, default: '' },
    by: { type: ObjectId, ref: 'Admin' },
    byName: { type: String },
    at: { type: Date },
  },
}, { timestamps: true });
riskEventSchema.index({ kind: 1, dedupeKey: 1 }, { unique: true });
riskEventSchema.index({ status: 1, severity: 1, lastSeenAt: -1 });
riskEventSchema.index({ writerId: 1, status: 1 });

// Failed sign-in tracking per account, independent of IP (stops distributed guessing).
const loginThrottleSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },   // e.g. user:jane@example.com, admin:ops1
  failures: { type: Number, default: 0 },
  firstFailureAt: { type: Date, default: Date.now },
  lockedUntil: { type: Date },
  expiresAt: { type: Date, required: true },
});
loginThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Customer order uploads: who uploaded which stored file, so orders can only
// reference (and customers can only download) their own files.
const uploadedFileSchema = new mongoose.Schema({
  storedName: { type: String, required: true, unique: true },
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  sha256: { type: String, default: '' },
}, { timestamps: true });

// WriterPerformance: a daily snapshot of the metrics recomputed onto Writer.metrics,
// giving HR/Operations a performance trend. Writer.metrics stays the live value.
const writerPerformanceSchema = new mongoose.Schema({
  writerId: { type: ObjectId, ref: 'Writer', required: true },
  day: { type: String, required: true },   // YYYY-MM-DD (UTC)
  rating: Number, ratingCount: Number, completedAssignments: Number, qualityScore: Number,
  responseRate: Number, acceptanceRate: Number, completionRate: Number, onTimeRate: Number, revisionRate: Number,
  activeAssignments: Number,
}, { timestamps: true });
writerPerformanceSchema.index({ writerId: 1, day: -1 }, { unique: true });

const auditLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  adminUsername: { type: String },
  adminRole: { type: String },
  action: { type: String, required: true, index: true },
  writerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional, if action relates to a writer
  targetType: { type: String },   // e.g. WRITER, SUBSCRIPTION, PAYMENT, ASSIGNMENT, ADMIN
  targetId: { type: String },
  reason: { type: String },
  ip: { type: String },
  userAgent: { type: String },
}, { timestamps: true });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });

// ── Writer membership & subscriptions ────────────────────────────────────────
// All money is stored as integer minor units (cents, paise, fils…) of `currency`.

export const BILLING_PERIODS = ['MONTHLY', 'ANNUAL'];
export const SUBSCRIPTION_STATUSES = ['PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'SUSPENDED'];
const OPEN_SUBSCRIPTION_STATUSES = ['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'];

const planPriceSchema = new mongoose.Schema({
  currency: { type: String, required: true },            // ISO 4217
  billingPeriod: { type: String, required: true, enum: BILLING_PERIODS },
  amountMinor: { type: Number, required: true, min: 0 },  // list price per period
  discountPercent: { type: Number, default: 0, min: 0, max: 90 },
  isActive: { type: Boolean, default: true },
}, { _id: false });

const membershipPlanSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },   // e.g. BASIC — stable identifier
  name: { type: String, required: true },
  description: { type: String, default: '' },
  features: { type: [String], default: [] },
  tier: { type: Number, required: true, min: 1 },          // higher = upgrade
  sortOrder: { type: Number, default: 0 },
  highlight: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false },
  prices: { type: [planPriceSchema], default: [] },
}, { timestamps: true });

const subscriptionEventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  note: { type: String, default: '' },
  actorType: { type: String, enum: ['WRITER', 'ADMIN', 'SYSTEM'], required: true },
  actorId: { type: ObjectId },
  at: { type: Date, default: Date.now },
}, { _id: false });

const writerSubscriptionSchema = new mongoose.Schema({
  subscriptionId: { type: String, required: true, unique: true },   // public reference, e.g. SUB-8F3K2Q
  writerId: { type: ObjectId, ref: 'Writer', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
  planId: { type: ObjectId, ref: 'MembershipPlan', required: true },
  planCode: { type: String, required: true },
  planName: { type: String, required: true },
  tier: { type: Number, required: true },
  billingPeriod: { type: String, required: true, enum: BILLING_PERIODS },
  currency: { type: String, required: true },
  amountMinor: { type: Number, required: true },       // price per period actually charged
  listAmountMinor: { type: Number, required: true },
  discountPercent: { type: Number, default: 0 },
  country: { type: String, default: '' },              // writer's country at signup, for analytics
  status: { type: String, required: true, enum: SUBSCRIPTION_STATUSES, default: 'PENDING', index: true },
  isOpen: { type: Boolean, default: true },            // derived from status; enforces one open subscription per writer
  autoRenew: { type: Boolean, default: true },
  startDate: { type: Date },                           // first activation
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },                    // renewal date
  graceEndsAt: { type: Date },
  cancelledAt: { type: Date },
  endedAt: { type: Date },
  endReason: { type: String, default: '' },
  scheduledChange: {
    planId: { type: ObjectId, ref: 'MembershipPlan' },
    planCode: { type: String },
    billingPeriod: { type: String, enum: BILLING_PERIODS },
    effectiveAt: { type: Date },
  },
  history: { type: [subscriptionEventSchema], default: [] },
}, { timestamps: true });
writerSubscriptionSchema.index({ writerId: 1 }, { unique: true, partialFilterExpression: { isOpen: true }, name: 'one_open_subscription_per_writer' });
writerSubscriptionSchema.index({ writerId: 1, createdAt: -1 });
writerSubscriptionSchema.pre('save', function () { this.isOpen = OPEN_SUBSCRIPTION_STATUSES.includes(this.status); });

const subscriptionPaymentSchema = new mongoose.Schema({
  paymentRef: { type: String, required: true, unique: true },   // public reference, e.g. PAY-…
  subscriptionId: { type: ObjectId, ref: 'WriterSubscription', required: true, index: true },
  writerId: { type: ObjectId, ref: 'Writer', required: true, index: true },
  kind: { type: String, required: true, enum: ['NEW', 'RENEWAL', 'UPGRADE'] },
  planId: { type: ObjectId, ref: 'MembershipPlan', required: true },
  planCode: { type: String, required: true },
  planName: { type: String, required: true },
  billingPeriod: { type: String, required: true, enum: BILLING_PERIODS },
  currency: { type: String, required: true },
  amountMinor: { type: Number, required: true },       // amount due — computed server-side only
  listAmountMinor: { type: Number, required: true },
  discountPercent: { type: Number, default: 0 },
  creditMinor: { type: Number, default: 0 },           // proration credit applied (upgrades)
  periodStart: { type: Date },                         // for renewals: the period being paid for
  country: { type: String, default: '' },
  status: { type: String, required: true, default: 'CREATED', index: true,
    enum: ['CREATED', 'PENDING_VERIFICATION', 'PAID', 'FAILED', 'REJECTED', 'EXPIRED', 'CANCELLED'] },
  provider: { type: String, enum: ['RAZORPAY', 'MANUAL', 'NONE'], default: 'NONE' },
  providerOrderId: { type: String, index: true, sparse: true },
  providerPaymentId: { type: String },
  manual: {
    method: { type: String },
    reference: { type: String },
    referenceKey: { type: String },   // normalised reference, used to reject reused transaction IDs
    submittedAt: { type: Date },
  },
  reviewedBy: { type: ObjectId, ref: 'Admin' },
  reviewNote: { type: String, default: '' },
  paidAt: { type: Date },
  appliedAt: { type: Date },                           // when the paid amount was applied to the subscription
  needsAttention: { type: String, default: '' },       // set when money was taken but can't be applied automatically
  failureReason: { type: String, default: '' },
  expiresAt: { type: Date },
}, { timestamps: true });
subscriptionPaymentSchema.index({ status: 1, paidAt: -1 });
subscriptionPaymentSchema.index({ 'manual.referenceKey': 1 }, { sparse: true });
subscriptionPaymentSchema.index({ writerId: 1, createdAt: -1 });

// ── Directory refresh hooks ────────────────────────────────────────────────────
// Any change to data the directory snapshot is built from schedules a coalesced
// refresh for that writer (see services/writerDirectory.js).
const directory = () => import('./services/writerDirectory.js');
function queueDirectoryRefresh(writerId) {
  if (!writerId) return;
  directory().then(m => m.scheduleDirectoryRefresh(writerId)).catch(err => console.error('[Directory] hook failed:', err.message));
}
const writerIdFromQuery = (q) => q.getFilter()?.writerId || q.getUpdate()?.$set?.writerId || q.getUpdate()?.writerId;
for (const schema of [writerProfileSchema, writerSkillSchema, writerAvailabilitySchema]) {
  schema.post('save', doc => queueDirectoryRefresh(doc.writerId));
  schema.post(['findOneAndUpdate', 'findOneAndDelete'], function (doc) { queueDirectoryRefresh(doc?.writerId || writerIdFromQuery(this)); });
  schema.post(['updateOne', 'updateMany', 'deleteOne', 'deleteMany'], function () { queueDirectoryRefresh(writerIdFromQuery(this)); });
  schema.post('insertMany', docs => [...new Set((docs || []).map(d => String(d.writerId)))].forEach(queueDirectoryRefresh));
}

// Writer changes (approval, suspension, membership start/expiry…) change who is
// public, so the cached public profile and directory listings are dropped.
// Awaited, so the next request already sees the change.
async function dropWriterCache(writerId) {
  try {
    const { cacheDel, cacheDelPattern } = await import('./services/cache.js');
    await Promise.all([writerId ? cacheDel(`writers:profile:${writerId}`) : null, cacheDelPattern('writers:public:')]);
  } catch (err) { console.error('[Cache] writer invalidation failed:', err.message); }
}
writerSchema.post('save', doc => dropWriterCache(doc._id));
writerSchema.post(['findOneAndUpdate', 'updateOne', 'updateMany'], function () { return dropWriterCache(this.getFilter()?._id); });

export const MembershipPlan = mongoose.model('MembershipPlan', membershipPlanSchema);
export const WriterSubscription = mongoose.model('WriterSubscription', writerSubscriptionSchema);
export const SubscriptionPayment = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);

export const Writer = mongoose.model('Writer', writerSchema);
export const WriterProfile = mongoose.model('WriterProfile', writerProfileSchema);
export const WriterSkill = mongoose.model('WriterSkill', writerSkillSchema);
export const WriterDocument = mongoose.model('WriterDocument', writerDocumentSchema);
export const WriterApplication = mongoose.model('WriterApplication', writerApplicationSchema);
export const WriterAvailability = mongoose.model('WriterAvailability', writerAvailabilitySchema);
export const OtpToken = mongoose.model('OtpToken', otpTokenSchema);
export const Assignment = mongoose.model('Assignment', assignmentSchema);
export const AssignmentOffer = mongoose.model('AssignmentOffer', assignmentOfferSchema);
export const AssignmentSubmission = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
export const WriterEarning = mongoose.model('WriterEarning', writerEarningSchema);
export const AssignmentRating = mongoose.model('AssignmentRating', assignmentRatingSchema);
export const Message = mongoose.model('Message', messageSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);
export const RiskEvent = mongoose.model('RiskEvent', riskEventSchema);
export const LoginThrottle = mongoose.model('LoginThrottle', loginThrottleSchema);
export const UploadedFile = mongoose.model('UploadedFile', uploadedFileSchema);
export const WriterPerformance = mongoose.model('WriterPerformance', writerPerformanceSchema);

// ── Marketplace model map ──────────────────────────────────────────────────────
// Writer-marketplace names used in product/spec documents, mapped onto the
// collections above (aliases, not separate collections):
//   Writer (1:1 User) → WriterProfile (1), WriterSkill (n), WriterDocument (n), WriterApplication (1),
//   WriterAvailability (1), WriterSubscription (n, at most one open) → SubscriptionPayment (n)
//   SubscriptionPlan → MembershipPlan          WriterAssignment → Assignment (+ AssignmentOffer)
//   WriterSubmission → AssignmentSubmission    WriterRating → AssignmentRating (1 per assignment)
//   WriterEarning (1 per writer per assignment) WriterNotification → Notification (by userId)
//   WriterPerformance → live Writer.metrics + daily WriterPerformance snapshots
export const SubscriptionPlan = MembershipPlan;
export const WriterAssignment = Assignment;
export const WriterSubmission = AssignmentSubmission;
export const WriterRating = AssignmentRating;
export const WriterNotification = Notification;

// ── Admin CRM: academic catalogue & pricing ────────────────────────────────────
// Subject → Service → Project. Each level can be switched on/off (status) and
// published/unpublished independently; the public catalogue only shows items
// that are ACTIVE, published and whose parents are too. Money is integer minor
// units of `currency` (as elsewhere). Words-per-page and multipliers are data,
// never constants: see PricingRule and the catalog word config (services/pricing.js).
export const CATALOG_STATUSES = ['ACTIVE', 'INACTIVE'];

const catalogFileSchema = new mongoose.Schema({
  storedName: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  kind: { type: String, enum: ['IMAGE', 'FILE'], required: true },
}, { _id: true, timestamps: { createdAt: true, updatedAt: false } });

// Per-page SEO for subjects/services/projects. Empty fields fall back to the
// entity's own name/description/image when the page is rendered (routes/catalog.js).
export const ROBOTS_OPTIONS = ['index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow'];
const seoSchema = new mongoose.Schema({
  metaTitle: { type: String, default: '' },
  metaDescription: { type: String, default: '' },
  keywords: { type: [String], default: [] },
  canonicalUrl: { type: String, default: '' },
  ogTitle: { type: String, default: '' },
  ogDescription: { type: String, default: '' },
  ogImage: { type: catalogFileSchema, default: null },
  robots: { type: String, enum: ROBOTS_OPTIONS, default: 'index,follow' },
}, { _id: false });

const catalogSubjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  image: { type: catalogFileSchema, default: null },
  status: { type: String, enum: CATALOG_STATUSES, default: 'ACTIVE', index: true },
  seo: { type: seoSchema, default: () => ({}) },
  published: { type: Boolean, default: false, index: true },
  publishedAt: { type: Date },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
catalogSubjectSchema.index({ sortOrder: 1, name: 1 });

const catalogServiceSchema = new mongoose.Schema({
  subjectId: { type: ObjectId, ref: 'CatalogSubject', required: true, index: true },
  name: { type: String, required: true, trim: true },
  seo: { type: seoSchema, default: () => ({}) },
  slug: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: CATALOG_STATUSES, default: 'ACTIVE', index: true },
  published: { type: Boolean, default: false, index: true },
  publishedAt: { type: Date },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
catalogServiceSchema.index({ subjectId: 1, slug: 1 }, { unique: true });   // slug unique within its subject
catalogServiceSchema.index({ subjectId: 1, sortOrder: 1, name: 1 });

const catalogProjectSchema = new mongoose.Schema({
  subjectId: { type: ObjectId, ref: 'CatalogSubject', required: true, index: true },   // always the service's subject
  serviceId: { type: ObjectId, ref: 'CatalogService', required: true, index: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true },
  description: { type: String, default: '' },
  files: { type: [catalogFileSchema], default: [] },   // images and downloadable files
  seo: { type: seoSchema, default: () => ({}) },
  status: { type: String, enum: CATALOG_STATUSES, default: 'ACTIVE', index: true },
  published: { type: Boolean, default: false, index: true },
  publishedAt: { type: Date },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
catalogProjectSchema.index({ serviceId: 1, slug: 1 }, { unique: true });   // slug unique within its service
catalogProjectSchema.index({ serviceId: 1, sortOrder: 1, title: 1 });

// A pricing rule applies to a subject, optionally narrowed to one service or one
// project (the most specific active rule in effect wins). `formula` selects a
// calculation from services/pricing.js so new formulas can be added later.
const pricingRuleSchema = new mongoose.Schema({
  subjectId: { type: ObjectId, ref: 'CatalogSubject', required: true, index: true },
  serviceId: { type: ObjectId, ref: 'CatalogService', default: null, index: true },
  projectId: { type: ObjectId, ref: 'CatalogProject', default: null, index: true },
  label: { type: String, default: '' },
  wordsPerPage: { type: Number, default: null, min: 1 },        // null → catalog word config default
  basePriceMinor: { type: Number, required: true, min: 0 },     // per page, in minor units
  multiplier: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true },
  formula: { type: String, default: 'BASE_X_MULTIPLIER' },
  effectiveDate: { type: Date, required: true },
  status: { type: String, enum: CATALOG_STATUSES, default: 'ACTIVE', index: true },
}, { timestamps: true });
pricingRuleSchema.index({ subjectId: 1, serviceId: 1, projectId: 1, currency: 1, status: 1, effectiveDate: -1 });

// ── Dynamic content: blocks, FAQs, media library ───────────────────────────────
// Content lives in data, not code: admins add any number of typed blocks to a
// subject/service/project. `content` is a per-type JSON payload validated and
// sanitised in services/contentBlocks.js; `media` references library files.
export const CONTENT_ENTITY_TYPES = ['SUBJECT', 'SERVICE', 'PROJECT'];
export const BLOCK_TYPES = ['HEADING', 'RICH_TEXT', 'INTRODUCTION', 'FEATURES', 'AVAILABLE_PROJECTS', 'PROGRAMMING_LANGUAGES', 'FAQ', 'CTA', 'IMAGE', 'CUSTOM_HTML', 'SEO_CONTENT'];

const blockMediaSchema = new mongoose.Schema({
  mediaId: { type: ObjectId, ref: 'CatalogMedia' },
  storedName: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  kind: { type: String, enum: ['IMAGE', 'FILE'], required: true },
  alt: { type: String, default: '' },
}, { _id: false });

const contentBlockSchema = new mongoose.Schema({
  entityType: { type: String, enum: CONTENT_ENTITY_TYPES, required: true },
  entityId: { type: ObjectId, required: true },
  type: { type: String, enum: BLOCK_TYPES, required: true },
  title: { type: String, default: '' },
  content: { type: mongoose.Schema.Types.Mixed, default: {} },
  media: { type: [blockMediaSchema], default: [] },
  sortOrder: { type: Number, default: 0 },
  status: { type: String, enum: CATALOG_STATUSES, default: 'ACTIVE' },
}, { timestamps: true, minimize: false });
contentBlockSchema.index({ entityType: 1, entityId: 1, sortOrder: 1 });
contentBlockSchema.index({ 'media.storedName': 1 });

const catalogFaqSchema = new mongoose.Schema({
  entityType: { type: String, enum: CONTENT_ENTITY_TYPES, required: true },
  entityId: { type: ObjectId, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },     // sanitised rich text
  sortOrder: { type: Number, default: 0 },
  status: { type: String, enum: CATALOG_STATUSES, default: 'ACTIVE' },
}, { timestamps: true });
catalogFaqSchema.index({ entityType: 1, entityId: 1, sortOrder: 1 });

// Reusable uploads for blocks and SEO images (picked in the admin media selector).
const catalogMediaSchema = new mongoose.Schema({
  storedName: { type: String, required: true, unique: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  kind: { type: String, enum: ['IMAGE', 'FILE'], required: true, index: true },
  alt: { type: String, default: '' },
  uploadedBy: { type: String, default: '' },
}, { timestamps: true });
catalogMediaSchema.index({ createdAt: -1 });

export const ContentBlock = mongoose.model('ContentBlock', contentBlockSchema);
export const CatalogFaq = mongoose.model('CatalogFaq', catalogFaqSchema);
export const CatalogMedia = mongoose.model('CatalogMedia', catalogMediaSchema);

export const CatalogSubject = mongoose.model('CatalogSubject', catalogSubjectSchema);
export const CatalogService = mongoose.model('CatalogService', catalogServiceSchema);
export const CatalogProject = mongoose.model('CatalogProject', catalogProjectSchema);
export const PricingRule = mongoose.model('PricingRule', pricingRuleSchema);
