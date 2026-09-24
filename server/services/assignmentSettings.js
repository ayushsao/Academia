import { SiteSettings } from '../db.js';

const KEY = 'assignments';

// Submission formats the platform knows how to verify. Admins choose which are allowed.
export const SUPPORTED_SUBMISSION_FORMATS = ['pdf', 'doc', 'docx', 'zip', 'xlsx', 'pptx', 'txt', 'csv', 'jpg', 'png'];

export const DEFAULT_ASSIGNMENT_SETTINGS = {
    allocationMode: 'HYBRID',          // MANUAL | AUTOMATIC | HYBRID
    offerTtlHours: 12,                 // how long a writer has to accept an offer
    hybridShortlistSize: 3,            // HYBRID: writers offered simultaneously, first to accept wins
    autoMaxAttempts: 5,                // AUTOMATIC: sequential offers before handing back to admins
    defaultWorkloadLimit: 3,           // concurrent active assignments per writer
    maxWorkloadLimit: 10,              // highest capacity a writer may choose
    requireSubjectMatch: true,
    minQualityScore: 0,                // global floor; applies once a writer has enough history
    minRating: 0,
    newWriterGrace: 3,                 // completed assignments before quality/rating floors apply
    // Relative weights of each matching signal (normalised to 100).
    weights: { subject: 25, skills: 15, quality: 20, rating: 15, performance: 10, workload: 10, timezone: 5, membership: 5 },
    submission: { allowedFormats: ['pdf', 'doc', 'docx', 'zip'], maxFileMB: 25, maxFiles: 5 },
    revisionHours: 48,                 // default time allowed for a revision
    maxRevisions: 3,
    // Overall rating = weighted mean of the four sub-scores.
    ratingWeights: { quality: 40, accuracy: 25, timeliness: 20, communication: 15 },
    ratingEditWindowDays: 7,
    // Bayesian smoothing so a handful of ratings can't swing a writer's score.
    ratingPrior: { mean: 4.0, weight: 5 },
    // Internal quality score (0-100) weights.
    qualityWeights: { rating: 40, onTime: 25, completion: 15, revisions: 10, response: 10 },
};

const merge = (base, over) => {
    const out = { ...base };
    for (const [k, v] of Object.entries(over || {})) {
        out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? { ...base[k], ...v } : v;
    }
    return out;
};

export async function getAssignmentSettings() {
    const doc = await SiteSettings.findOne({ key: KEY }).lean();
    return merge(DEFAULT_ASSIGNMENT_SETTINGS, doc?.value);
}

export async function saveAssignmentSettings(value) {
    await SiteSettings.findOneAndUpdate({ key: KEY }, { $set: { value } }, { upsert: true });
    return getAssignmentSettings();
}

// Effective concurrent-assignment limit for a writer.
export const workloadLimit = (writer, settings) => {
    const own = writer.workload?.maxConcurrent || settings.defaultWorkloadLimit;
    const admin = writer.workload?.adminLimit;
    return Math.max(0, Math.min(own, admin ?? settings.maxWorkloadLimit, settings.maxWorkloadLimit));
};
