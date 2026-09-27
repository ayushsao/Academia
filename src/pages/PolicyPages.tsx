import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MarketplaceNavbar as Navbar } from '../components/writer/MarketplaceNavbar';
import { Footer } from '../components/Footer';


// About Us and the customer policies linked from the footer.
// Each section is a heading plus paragraphs; edit the text here.

type Section = { heading?: string; body: string[] };
type PolicyDoc = { title: string; intro: string; sections: Section[] };

const SUPPORT_EMAIL = 'support@assignmentminds.com';
const SUPPORT_PHONE = '+91 92636 06941';
const LAST_UPDATED = '28 September 2026';

export const POLICIES: Record<string, PolicyDoc> = {
    '/about': {
        title: 'About AssignmentMinds',
        intro: 'AssignmentMinds connects students with subject experts for tutoring-style academic support: model answers, proofreading, editing and guidance they can learn from.',
        sections: [
            { heading: 'What we do', body: [
                'Students tell us what they need, the subject, the word count and the deadline. We price the order up front, match it with a writer who knows the subject, and deliver the finished work through the student dashboard.',
                'Every piece of work is written from scratch for that order and is meant as a reference to help the student understand the topic and produce their own work.',
            ] },
            { heading: 'Our writers', body: [
                'Writers apply through our writer programme, submit their qualifications and are reviewed before they can take orders. Their work is checked by our team before it reaches the student.',
            ] },
            { heading: 'Talk to us', body: [
                `We are reachable on WhatsApp and phone at ${SUPPORT_PHONE}, and by email at ${SUPPORT_EMAIL}.`,
            ] },
        ],
    },
    '/refund-policy': {
        title: 'Refund Policy',
        intro: 'This policy explains when you can get your money back for an order placed on AssignmentMinds.',
        sections: [
            { heading: 'When a refund applies', body: [
                'You can ask for a full refund if we cannot assign a writer to your order, or if you cancel before a writer has started work.',
                'If the delivered work does not follow the instructions you gave when ordering, first ask for a free revision. If the revised work still does not meet those instructions, you can ask for a partial or full refund, and our team will review the order.',
            ] },
            { heading: 'When a refund does not apply', body: [
                'Refunds are not given for changes to the instructions after the order was placed, for missing information that the writer asked for and did not receive, or because of the grade the work was given.',
            ] },
            { heading: 'How to ask', body: [
                `Email ${SUPPORT_EMAIL} with your order ID and the reason. We reply within 2 working days. Approved refunds go back to the original payment method; how long they take to show depends on your bank or UPI app.`,
            ] },
        ],
    },
    '/cancellation-policy': {
        title: 'Cancellation Policy',
        intro: 'To cancel an order, contact support on WhatsApp or by email with your order ID.',
        sections: [
            { heading: 'Before a writer starts', body: [
                'If no writer has started on your order, you can cancel it and get a full refund.',
            ] },
            { heading: 'After work has started', body: [
                'Once a writer has started, the refund depends on how much of the work is done. Our team reviews the order and tells you the amount before the cancellation is final.',
            ] },
            { heading: 'After delivery', body: [
                'Delivered orders cannot be cancelled. If something is wrong with the work, ask for a revision or see the Refund Policy.',
            ] },
        ],
    },
    '/terms': {
        title: 'Terms & Conditions',
        intro: 'By using AssignmentMinds or placing an order, you agree to these terms.',
        sections: [
            { heading: 'The service', body: [
                'AssignmentMinds provides custom-written reference material, proofreading and editing. The work we deliver is for research and learning. You are responsible for how you use it and for following your institution\'s rules.',
            ] },
            { heading: 'Orders and payment', body: [
                'The price is shown before you pay and depends on the word count, deadline and options you choose. An order starts once payment is confirmed.',
            ] },
            { heading: 'Your account', body: [
                'Keep your login details private. You are responsible for activity on your account.',
            ] },
            { heading: 'Revisions, cancellations and refunds', body: [
                'These are covered by our Cancellation Policy and Refund Policy, which are part of these terms.',
            ] },
            { heading: 'Changes', body: [
                'We may update these terms. The date at the top of this page shows when they last changed.',
            ] },
        ],
    },
    '/privacy-policy': {
        title: 'Privacy Policy',
        intro: 'This policy explains what personal information AssignmentMinds collects and how we use it.',
        sections: [
            { heading: 'What we collect', body: [
                'Your name, email address and phone number; the order details and files you upload; and payment confirmations from our payment provider. We do not store your card or UPI details.',
            ] },
            { heading: 'How we use it', body: [
                'To process and deliver your orders, to contact you about them, to provide support, and to keep the service secure.',
            ] },
            { heading: 'Who sees it', body: [
                'The writer on your order sees the instructions and files needed to do the work. Our payment provider processes payments. We do not sell your information.',
            ] },
            { heading: 'Your choices', body: [
                `You can ask us to show, correct or delete your personal information by emailing ${SUPPORT_EMAIL}.`,
            ] },
        ],
    },
    '/usage-policy': {
        title: 'Usage Policy',
        intro: 'How the work we deliver may be used.',
        sections: [
            { body: [
                'Work delivered by AssignmentMinds is reference material. Use it to understand the topic, check your approach and improve your own writing.',
                'Do not submit it as your own work where your institution does not allow it. Cite any ideas or sources you take from it.',
                'Do not resell or publish the delivered work without our written permission.',
            ] },
        ],
    },
};

export default function PolicyPage() {
    const { pathname } = useLocation();
    const doc = POLICIES[pathname];
    useEffect(() => { if (doc) document.title = `${doc.title} | AssignmentMinds`; }, [doc]);
    useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);
    if (!doc) return null;
    const isAbout = pathname === '/about';

    return (
        <div className="flex min-h-screen flex-col bg-[#f7f6f3] font-sans">
            <Navbar />
            <main className="flex-grow px-4 pb-24 pt-10 sm:px-6 lg:pt-14">
                <article className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 sm:p-10">
                    <h1 className="text-3xl font-bold tracking-tight text-[#000a1e] sm:text-4xl">{doc.title}</h1>
                    {!isAbout && <p className="mt-2 text-sm text-gray-500">Last updated {LAST_UPDATED}</p>}
                    <p className="mt-6 text-lg leading-relaxed text-gray-700">{doc.intro}</p>
                    <div className="mt-8 space-y-8">
                        {doc.sections.map((s, i) => (
                            <section key={i}>
                                {s.heading && <h2 className="mb-3 text-xl font-semibold text-[#000a1e]">{s.heading}</h2>}
                                <div className="space-y-3 leading-relaxed text-gray-700">
                                    {s.body.map((p, j) => <p key={j}>{p}</p>)}
                                </div>
                            </section>
                        ))}
                    </div>
                    <p className="mt-10 rounded-xl bg-[#fff7f0] px-4 py-3 text-sm text-gray-700">
                        Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#e36100] hover:underline">{SUPPORT_EMAIL}</a> or message us on <a href="https://wa.me/919263606941" target="_blank" rel="noreferrer" className="font-semibold text-[#e36100] hover:underline">WhatsApp</a>.
                    </p>
                    <p className="mt-8 text-sm"><Link to="/" className="font-semibold text-[#002147] hover:underline">← Back to home</Link></p>
                </article>
            </main>
            <Footer />
        </div>
    );
}
