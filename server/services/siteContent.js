import { z } from 'zod';
import { SiteSettings } from '../db.js';
import { MEMBERSHIP_DISCLAIMER } from './membershipSettings.js';

// Admin-editable marketplace copy: the "Become a Writer" page, applicant FAQ,
// pricing-page text, requirements, writer terms and contact details. Stored in
// the existing SiteSettings collection under one key. Plan names, prices and
// features stay in MembershipPlan (Admin → Memberships → Plans).
//
// Two rules are enforced server-side whatever an admin types:
//  • no promises of guaranteed work or income (see findGuaranteeClaims), and
//  • the membership disclaimer is fixed and always shown; it isn't editable.

export const CONTENT_KEY = 'marketplace_content';

// The recruitment journey is fixed; admins edit the wording of each step.
export const JOURNEY_STEPS = ['REGISTER', 'VERIFY', 'PROFILE', 'APPROVAL', 'MEMBERSHIP', 'OPPORTUNITIES', 'ASSIGNMENTS', 'RATING'];

export const DEFAULT_CONTENT = {
    recruitment: {
        hero: {
            eyebrow: 'Join as a freelance writer',
            title: 'Your expertise,',
            highlight: 'working worldwide.',
            subtitle: 'AssignmentMinds works with qualified academics, researchers and editors. Apply once, get verified by our team, and take on assignments in your discipline, on your schedule, from any country.',
            note: 'Free to apply · Membership only after approval · Work volume depends on demand and eligibility',
        },
        benefits: [
            { title: 'Work on your terms', text: 'Set your availability and how many assignments you take on at once. Pause new offers whenever you need to.' },
            { title: 'Matched to your expertise', text: 'Opportunities are matched on your subjects, academic levels, skills and track record.' },
            { title: 'Clear payouts', text: 'The payout for each assignment is shown before you accept, and every earning is tracked in your dashboard.' },
            { title: 'Private and secure', text: 'Your email, phone number and documents are never shown publicly or shared with clients.' },
            { title: 'A reputation that counts', text: 'Ratings on completed work build a quality score that reflects your reliability and standards.' },
            { title: 'A real team behind you', text: 'Our HR and operations team review applications, answer questions and support you on live work.' },
        ],
        steps: [
            { key: 'REGISTER', title: 'Register', text: 'Create your account with your name, email, country and mobile number.' },
            { key: 'VERIFY', title: 'Verify', text: 'Confirm your email and phone with one-time codes. Each phone number can be verified on one account.' },
            { key: 'PROFILE', title: 'Complete your profile', text: 'Add your education, subjects, skills, CV and writing samples.' },
            { key: 'APPROVAL', title: 'Approval', text: 'Our HR team reviews your credentials and may ask for more information.' },
            { key: 'MEMBERSHIP', title: 'Membership', text: 'Approved writers choose a monthly or annual plan to access the platform.' },
            { key: 'OPPORTUNITIES', title: 'Opportunities', text: 'See opportunities that match your profile. Availability varies with client demand.' },
            { key: 'ASSIGNMENTS', title: 'Eligible assignments', text: 'Accept the assignments you are eligible for and deliver by the deadline.' },
            { key: 'RATING', title: 'Rating', text: 'Completed work is rated for quality, accuracy, timeliness and communication.' },
        ],
        requirements: [
            { title: 'A completed degree', text: 'Bachelor’s at minimum; postgraduate degrees are preferred for advanced work.' },
            { title: 'Strong academic English', text: 'Clear, well-structured writing and confident use of referencing styles.' },
            { title: 'Anywhere in the world', text: 'We welcome writers from every country and time zone.' },
            { title: 'Integrity', text: 'Original work, honest credentials and respect for client confidentiality.' },
        ],
        documents: [
            { title: 'Resume / CV', required: true },
            { title: 'Degree or professional certificates', required: false },
            { title: 'One or more writing samples', required: false },
            { title: 'Portfolio (optional)', required: false },
        ],
        cta: { title: 'Ready to apply?', points: ['No fee to apply', 'Human review', 'Work from anywhere'] },
    },
    faq: [
        { q: 'How long does the review take?', a: 'Most applications receive a decision within 2–5 working days of submission. If our team needs more information, you’ll be notified and can respond from your application page.' },
        { q: 'Does membership guarantee work or income?', a: 'No. Membership provides access to platform features and opportunities. Assignments depend on eligibility, requirements, availability and platform allocation, so the amount of work varies.' },
        { q: 'When do I pay for membership?', a: 'Only after your application is approved. There is no fee to apply.' },
        { q: 'Is my personal information shown to clients?', a: 'No. Your email address and phone number are never shown publicly or shared with clients. Your public profile shows your name, country, qualifications, expertise and any writing samples you choose to publish.' },
        { q: 'Why do I need to verify my phone number?', a: 'Phone verification protects clients and writers from fake and duplicate accounts. Each number can be verified on only one writer account.' },
        { q: 'Can I stop halfway through the application?', a: 'Yes. Your progress saves automatically. Sign in any time to continue where you left off.' },
    ],
    pricing: {
        title: 'Writer membership',
        subtitle: 'Membership is for approved writers. Choose monthly or annual billing and change or cancel auto-renewal at any time.',
        planNotes: {
            BASIC: { tagline: 'Get started', bestFor: 'Newly approved writers building a track record' },
            PROFESSIONAL: { tagline: 'Most popular', bestFor: 'Writers who work with us regularly' },
            PREMIUM: { tagline: 'Everything included', bestFor: 'Established writers who want every feature' },
        },
        footnote: 'Prices are shown in the currency you select. The final amount, including any discount, is calculated on our servers and confirmed before you pay.',
        faq: [
            { q: 'Can I change plans later?', a: 'Yes. Upgrades apply straight away with credit for the unused time on your current plan; downgrades take effect at your next renewal.' },
            { q: 'Can I cancel?', a: 'Yes. Turn off auto-renew and your membership stays active until the end of the period you’ve paid for.' },
            { q: 'How can I pay?', a: 'Available payment methods are shown at checkout and may include online card/UPI payments or a bank/UPI/PayPal transfer verified by our finance team.' },
        ],
    },
    terms: {
        title: 'Writer terms',
        body: [
            '1. Eligibility. You must be at least 18, provide accurate information and hold the qualifications you declare. Each person may hold one writer account.',
            '2. Verification and review. We verify your email and phone number and review your application and documents. We may approve, decline, or ask for more information at our discretion.',
            '3. No guarantee of work. Membership provides access to platform features and opportunities. Assignments depend on eligibility, requirements, availability and platform allocation. We do not guarantee any volume of work or level of income.',
            '4. Membership and billing. Membership fees are charged per billing period in the selected currency. You can turn off auto-renewal at any time; your membership then ends at the close of the paid period.',
            '5. Standards. Work must be original, meet the stated requirements and be delivered by the deadline. Plagiarism, misrepresented credentials, sharing accounts or contacting clients outside the platform may lead to suspension.',
            '6. Confidentiality. Client materials and assignment details are confidential and may be used only to complete the assignment.',
            '7. Payouts. The payout for an assignment is shown before you accept it and becomes payable once the work is approved, subject to any adjustments explained to you.',
            '8. Ratings. Completed assignments are rated by our team. Ratings and performance metrics are used to match work and maintain quality.',
            '9. Privacy. Your contact details and documents are kept private and used only to operate the platform.',
            '10. Changes. We may update these terms; material changes will be notified to you in advance.',
        ].join('\n\n'),
    },
    contact: {
        email: 'assignmentminds@gmail.com',
        phone: '',
        whatsapp: '',
        hours: 'Monday–Saturday, 9:00–18:00 (UK time)',
        address: '',
    },
};

// ── Guarantee guard ────────────────────────────────────────────────────────────

const CLAIMS = [
    /\bguarantee[sd]?\b[^.!?\n]{0,40}?\b(work|income|earnings?|assignments?|jobs?|orders?|pay(?:outs?|ments?)?|salary|money|projects?|clients?)\b/i,
    /\b(assured|fixed|steady|regular|stable|passive)\s+(income|earnings|salary|pay|work|assignments?)\b/i,
    /\b(unlimited|endless|constant|non-stop)\s+(work|assignments?|orders?|jobs?|income|earnings)\b/i,
    /\bearn\s+(up\s+to\s+|over\s+|more\s+than\s+)?(?:[$₹£€]|usd|inr|gbp|eur|aud|cad|aed)\s?\d/i,
    /\b\d[\d,.]*\s*(?:[$₹£€]|usd|inr|gbp|eur)?\s*(?:per|a|\/)\s*(month|week|day)\s+guaranteed\b/i,
];
const NEGATION = /\b(no|not|never|cannot|can't|can’t|doesn't|doesn’t|don't|don’t|won't|won’t|without|nor)\b[^.!?\n]{0,30}$/i;

// Returns the phrases that promise work or income (negated statements such as
// "does not guarantee work" are fine).
export function findGuaranteeClaims(text) {
    const found = [];
    for (const re of CLAIMS) {
        const g = new RegExp(re.source, 'gi');
        let m;
        while ((m = g.exec(String(text)))) {
            const before = String(text).slice(Math.max(0, m.index - 40), m.index);
            // A question ("Does membership guarantee work?") isn't a promise.
            const sentenceEnd = String(text).slice(m.index).match(/^[^.!?\n]*([.!?]|\n|$)/)?.[1];
            if (!NEGATION.test(before) && sentenceEnd !== '?') found.push(m[0]);
        }
    }
    return found;
}

// ── Validation ─────────────────────────────────────────────────────────────────

// Plain text only: tags and control characters are stripped.
const clean = (max) => z.string().max(max).transform(s => s.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim());
const item = z.object({ title: clean(80).pipe(z.string().min(1, 'Every item needs a title')), text: clean(400) });
const qa = z.object({ q: clean(200).pipe(z.string().min(1, 'Every question needs text')), a: clean(1500).pipe(z.string().min(1, 'Every answer needs text')) });

export const contentSchema = z.object({
    recruitment: z.object({
        hero: z.object({ eyebrow: clean(60), title: clean(80).pipe(z.string().min(1)), highlight: clean(80), subtitle: clean(500), note: clean(200) }),
        benefits: z.array(item).max(9),
        steps: z.array(z.object({ key: z.enum(JOURNEY_STEPS), title: clean(60).pipe(z.string().min(1)), text: clean(240) })).length(JOURNEY_STEPS.length)
            .refine(s => s.every((x, i) => x.key === JOURNEY_STEPS[i]), 'The application steps are fixed; only their wording can change.'),
        requirements: z.array(item).max(8),
        documents: z.array(z.object({ title: clean(80).pipe(z.string().min(1)), required: z.boolean() })).max(8),
        cta: z.object({ title: clean(80), points: z.array(clean(40)).max(5) }),
    }),
    faq: z.array(qa).max(25),
    pricing: z.object({
        title: clean(80), subtitle: clean(400),
        planNotes: z.record(z.string().regex(/^[A-Z0-9_]{2,30}$/), z.object({ tagline: clean(40), bestFor: clean(120) })),
        footnote: clean(400),
        faq: z.array(qa).max(15),
    }),
    terms: z.object({ title: clean(80).pipe(z.string().min(1)), body: clean(20000).pipe(z.string().min(20, 'Terms are too short')) }),
    contact: z.object({
        email: clean(120).pipe(z.union([z.literal(''), z.string().email('Enter a valid contact email')])),
        phone: clean(30).pipe(z.string().regex(/^[+\d\s()-]*$/, 'Phone may contain digits, spaces, + ( ) - only')),
        whatsapp: clean(30).pipe(z.string().regex(/^[+\d\s()-]*$/, 'WhatsApp may contain digits, spaces, + ( ) - only')),
        hours: clean(120),
        address: clean(300),
    }),
});

const allStrings = (v, out = []) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(x => allStrings(x, out));
    else if (v && typeof v === 'object') Object.values(v).forEach(x => allStrings(x, out));
    return out;
};

export class ContentError extends Error { constructor(message) { super(message); this.status = 400; } }

// Validates and sanitises a full content document. Throws ContentError.
export function parseContent(input) {
    const parsed = contentSchema.safeParse(input);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new ContentError(`${issue.path.join(' › ') || 'Content'}: ${issue.message}`);
    }
    const claims = [...new Set(allStrings(parsed.data).flatMap(findGuaranteeClaims))];
    if (claims.length) throw new ContentError(`Content can’t promise guaranteed work or income. Please reword: “${claims.slice(0, 3).join('”, “')}”.`);
    return parsed.data;
}

// ── Storage ────────────────────────────────────────────────────────────────────

// Saved content merged over defaults section by section, so new sections added
// in code appear automatically.
export async function getContent() {
    const row = await SiteSettings.findOne({ key: CONTENT_KEY }).lean();
    const saved = row?.value || {};
    const content = {
        recruitment: { ...DEFAULT_CONTENT.recruitment, ...(saved.recruitment || {}) },
        faq: saved.faq || DEFAULT_CONTENT.faq,
        pricing: { ...DEFAULT_CONTENT.pricing, ...(saved.pricing || {}) },
        terms: { ...DEFAULT_CONTENT.terms, ...(saved.terms || {}) },
        contact: { ...DEFAULT_CONTENT.contact, ...(saved.contact || {}) },
    };
    return { content, updatedAt: row?.updatedAt || null, termsUpdatedAt: saved.termsUpdatedAt || null, disclaimer: MEMBERSHIP_DISCLAIMER };
}

export async function saveContent(input) {
    const content = parseContent(input);
    const current = (await SiteSettings.findOne({ key: CONTENT_KEY }).lean())?.value || {};
    const termsChanged = JSON.stringify(current.terms || DEFAULT_CONTENT.terms) !== JSON.stringify(content.terms);
    const changed = Object.keys(content).filter(k => JSON.stringify(current[k] ?? DEFAULT_CONTENT[k]) !== JSON.stringify(content[k]));
    await SiteSettings.updateOne({ key: CONTENT_KEY }, {
        $set: { value: { ...content, termsUpdatedAt: termsChanged ? new Date() : current.termsUpdatedAt || null } },
    }, { upsert: true });
    return { changed, ...(await getContent()) };
}
