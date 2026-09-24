import { User, Writer, WriterProfile, WriterSkill, WriterAvailability, Assignment, AssignmentOffer, ACTIVE_ASSIGNMENT_STATUSES } from '../db.js';
import { slugify } from '../writerConstants.js';
import { workloadLimit } from './assignmentSettings.js';
import { effectiveAvailability } from './writerService.js';

// Opportunity matching.
//   1. Hard filters decide eligibility (with a reason for every exclusion).
//   2. Weighted signals rank eligible writers; each signal is 0..1 and the
//      admin-configured weights are normalised to a 0-100 score.
// Membership tier is one small, capped signal: it can nudge ordering among
// otherwise eligible writers but never makes anyone eligible or guarantees work.

const norm = (s) => String(s || '').trim().toLowerCase();

function utcOffsetHours(timeZone, at = new Date()) {
    try {
        const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value || '';
        const m = part.match(/GMT([+-])(\d{2}):?(\d{2})?/);
        if (!m) return 0; // "GMT" alone = UTC
        return (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3] || 0) / 60);
    } catch { return null; }
}

function timezoneFit(preferred, writerTz) {
    if (!preferred) return 0.5;          // no preference: neutral for everyone
    if (!writerTz) return 0.4;
    const a = utcOffsetHours(preferred), b = utcOffsetHours(writerTz);
    if (a === null || b === null) return 0.4;
    let diff = Math.abs(a - b);
    diff = Math.min(diff, 24 - diff);
    return Math.max(0, 1 - diff / 12);
}

function subjectFit(subject, profile, skillSlugs) {
    const s = norm(subject);
    const subjects = (profile.subjects || []).map(norm);
    const expertise = (profile.expertiseAreas || []).map(norm);
    if (subjects.includes(s)) return 1;
    if (expertise.includes(s)) return 0.8;
    if ([...subjects, ...expertise].some(x => x && (x.includes(s) || s.includes(x)))) return 0.6;
    if (skillSlugs.has(slugify(subject))) return 0.5;
    return 0;
}

export async function rankCandidates(assignment, settings, { now = new Date() } = {}) {
    const writers = await Writer.find({ status: 'ACTIVE' }).select('userId metrics workload membership').lean();
    const ids = writers.map(w => w._id);
    const [profiles, skills, availabilities, activeCounts, priorOffers, users] = await Promise.all([
        WriterProfile.find({ writerId: { $in: ids } }).select('writerId subjects expertiseAreas academicLevels country timezone').lean(),
        WriterSkill.find({ writerId: { $in: ids } }).select('writerId slug').lean(),
        WriterAvailability.find({ writerId: { $in: ids } }).lean(),
        Assignment.aggregate([{ $match: { assignedWriterId: { $in: ids }, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } } }, { $group: { _id: '$assignedWriterId', n: { $sum: 1 } } }]),
        AssignmentOffer.find({ assignmentId: assignment._id }).select('writerId status').lean(),
        User.find({ _id: { $in: writers.map(w => w.userId) } }).select('name').lean(),
    ]);
    const by = (rows, key = 'writerId') => new Map(rows.map(r => [String(r[key]), r]));
    const profileMap = by(profiles), availMap = by(availabilities), offerMap = by(priorOffers);
    const activeMap = new Map(activeCounts.map(c => [String(c._id), c.n]));
    const nameMap = new Map(users.map(u => [String(u._id), u.name]));
    const skillMap = new Map();
    for (const s of skills) {
        const k = String(s.writerId);
        if (!skillMap.has(k)) skillMap.set(k, new Set());
        skillMap.get(k).add(s.slug);
    }

    const rules = assignment.rules || {};
    const minQuality = rules.minQualityScore ?? settings.minQualityScore;
    const minRating = rules.minRating ?? settings.minRating;
    const excluded = new Set((rules.excludedWriterIds || []).map(String));
    const allowedCountries = rules.allowedCountries || [];
    const requiredSkills = (assignment.requiredSkills || []).map(slugify).filter(Boolean);
    const maxTier = Math.max(1, ...writers.map(w => w.membership?.tier || 0));
    const W = settings.weights;
    const weightTotal = Object.values(W).reduce((a, b) => a + (b || 0), 0) || 1;

    const eligible = [], ineligible = [];
    for (const w of writers) {
        const id = String(w._id);
        const profile = profileMap.get(id) || {};
        const skillSlugs = skillMap.get(id) || new Set();
        const active = activeMap.get(id) || 0;
        const limit = workloadLimit(w, settings);
        const m = w.metrics || {};
        const experienced = (m.completedAssignments || 0) >= settings.newWriterGrace;
        const reasons = [];

        const prior = offerMap.get(id);
        if (prior) reasons.push(prior.status === 'OFFERED' ? 'Offer already pending' : `Previously ${prior.status.toLowerCase()} this assignment`);
        if (excluded.has(id)) reasons.push('Excluded by admin rule');
        if (effectiveAvailability(availMap.get(id)) !== 'AVAILABLE') reasons.push('Unavailable');
        if (active >= limit) reasons.push(`At workload limit (${active}/${limit})`);
        if (!(profile.academicLevels || []).includes(assignment.academicLevel)) reasons.push(`Doesn’t cover ${assignment.academicLevel}`);
        const subject = subjectFit(assignment.subject, profile, skillSlugs);
        if (settings.requireSubjectMatch && subject === 0) reasons.push(`No ${assignment.subject} expertise`);
        const missingSkills = requiredSkills.filter(s => !skillSlugs.has(s));
        if (missingSkills.length) reasons.push(`Missing required skill${missingSkills.length > 1 ? 's' : ''}`);
        if (allowedCountries.length && !allowedCountries.includes(profile.country)) reasons.push('Country not allowed for this assignment');
        if (experienced && minQuality && (m.qualityScore || 0) < minQuality) reasons.push(`Quality score below ${minQuality}`);
        if (minRating && (m.ratingCount || 0) >= settings.newWriterGrace && (m.rating || 0) < minRating) reasons.push(`Rating below ${minRating}`);
        if (assignment.writerDeadline && assignment.writerDeadline <= now) reasons.push('Deadline has passed');

        const name = nameMap.get(String(w.userId)) || 'Writer';
        if (reasons.length) { ineligible.push({ writerId: w._id, name, reasons }); continue; }

        const hasHistory = (m.completedAssignments || 0) > 0;
        const signals = {
            subject,
            skills: requiredSkills.length ? 1 : (skillSlugs.has(slugify(assignment.subject)) ? 1 : 0.4),
            quality: hasHistory ? (m.qualityScore || 0) / 100 : 0.6,
            rating: m.ratingCount ? (m.rating || 0) / 5 : 0.7,
            performance: hasHistory ? ((m.onTimeRate || 0) + (m.completionRate || 0) + (m.responseRate || 0)) / 300 : 0.7,
            workload: limit ? 1 - active / limit : 0,
            timezone: timezoneFit(rules.preferredTimezone, profile.timezone),
            membership: Math.min(1, (w.membership?.tier || 0) / maxTier),
        };
        const breakdown = Object.fromEntries(Object.entries(signals).map(([k, v]) => [k, { value: Math.round(v * 100) / 100, weight: W[k] || 0 }]));
        const score = Math.round((Object.entries(signals).reduce((s, [k, v]) => s + v * (W[k] || 0), 0) / weightTotal) * 1000) / 10;
        eligible.push({ writerId: w._id, name, score, breakdown, active, limit, country: profile.country, metrics: { rating: m.rating, ratingCount: m.ratingCount, qualityScore: m.qualityScore, completed: m.completedAssignments } });
    }

    // Deterministic order: score, then lighter workload, then id.
    eligible.sort((a, b) => b.score - a.score || a.active - b.active || String(a.writerId).localeCompare(String(b.writerId)));
    return { eligible, ineligible };
}
