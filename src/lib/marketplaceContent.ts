import { useEffect, useState } from 'react';
import { api } from './api';

// Admin-editable marketplace copy (Admin → Site Content), served by GET /api/content/marketplace.
export type ContentItem = { title: string; text: string };
export type QA = { q: string; a: string };
export type JourneyStep = { key: 'REGISTER' | 'PROFILE' | 'APPROVAL' | 'MEMBERSHIP' | 'OPPORTUNITIES' | 'ASSIGNMENTS' | 'RATING'; title: string; text: string };

export interface MarketplaceContent {
    recruitment: {
        hero: { eyebrow: string; title: string; highlight: string; subtitle: string; note: string };
        benefits: ContentItem[];
        steps: JourneyStep[];
        requirements: ContentItem[];
        documents: { title: string; required: boolean }[];
        cta: { title: string; points: string[] };
    };
    faq: QA[];
    pricing: {
        title: string; subtitle: string;
        planNotes: Record<string, { tagline: string; bestFor: string }>;
        footnote: string;
        faq: QA[];
    };
    terms: { title: string; body: string };
    contact: { email: string; phone: string; whatsapp: string; hours: string; address: string };
}

export type ContentResponse = { content: MarketplaceContent; updatedAt: string | null; termsUpdatedAt: string | null; disclaimer: string };

export const DEFAULT_MARKETPLACE_CONTENT: ContentResponse = {
    content: {
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
    },
    updatedAt: null,
    termsUpdatedAt: null,
    disclaimer: 'Membership provides access to platform features and opportunities. Assignments depend on eligibility, requirements, availability and platform allocation.',
};

let cache: Promise<ContentResponse> | null = null;

export function loadMarketplaceContent(force = false): Promise<ContentResponse> {
    if (!cache || force) {
        cache = api<ContentResponse>('/content/marketplace')
            .catch(err => {
                console.warn('[MarketplaceContent] Falling back to default content:', err.message);
                return DEFAULT_MARKETPLACE_CONTENT;
            });
    }
    return cache;
}

export function useMarketplaceContent() {
    const [data, setData] = useState<ContentResponse>(DEFAULT_MARKETPLACE_CONTENT);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let live = true;
        loadMarketplaceContent()
            .then(d => {
                if (live) {
                    setData(d || DEFAULT_MARKETPLACE_CONTENT);
                    setLoading(false);
                }
            })
            .catch(e => {
                if (live) {
                    setError(e.message);
                    setLoading(false);
                }
            });
        return () => { live = false; };
    }, []);

    return { data, error, loading };
}

