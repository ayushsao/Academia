// Long-form content for the main service pages (/p/<slug>): a readable guide
// plus FAQs, shown under the page's hero. Search engines rank pages on what
// they actually explain, so each guide answers the questions a student
// searching for that service would have.

export type ServiceGuide = {
    heading: string;
    intro: string[];
    sections: { title: string; body: string[]; points?: string[] }[];
    faqs: { question: string; answer: string }[];
};

const PRICING_FAQ = {
    question: 'How is the price calculated?',
    answer: 'The price depends on the word count, academic level and deadline. Enter these in the calculator on the home page to see the exact price in your currency before you pay. Coupon codes are applied at checkout.',
};
const PRIVACY_FAQ = {
    question: 'Is my information kept private?',
    answer: 'Yes. Your name, contact details and files are only shared with the expert working on your order, and we never publish or resell your work.',
};

export const SERVICE_GUIDES: Record<string, ServiceGuide> = {
    'dissertation-help': {
        heading: 'Dissertation help for every stage of your project',
        intro: [
            'A dissertation is usually the longest and most independent piece of work in a degree. Most students find it hard not because they lack ideas, but because they have to plan the research, manage the literature, analyse data and write 10,000 words or more while keeping up with other modules.',
            'AssignmentMinds connects you with dissertation experts who hold Master’s and PhD degrees in your subject. You can get help with the whole dissertation or only the chapter you are stuck on, and you can follow its progress from your dashboard.',
        ],
        sections: [
            {
                title: 'What our dissertation help covers',
                body: ['Tell us where you are in your project and we will match you with an expert who has worked on similar topics.'],
                points: [
                    'Choosing a researchable topic and writing clear research questions',
                    'Dissertation proposals with aims, objectives and a timeline',
                    'Literature reviews that compare and critique sources, not just summarise them',
                    'Methodology chapters: qualitative, quantitative and mixed methods',
                    'Data analysis in SPSS, R, Python, NVivo or Excel, with results explained in plain language',
                    'Discussion, conclusion and recommendations chapters',
                    'Editing, proofreading and referencing in Harvard, APA, MLA, OSCOLA or Chicago',
                ],
            },
            {
                title: 'Undergraduate, Master’s and PhD dissertations',
                body: [
                    'An undergraduate dissertation needs a focused question and a solid literature base. A Master’s dissertation is expected to show critical depth and a justified methodology. At PhD level the work must make an original contribution. Your expert writes to the level and marking criteria of your course, so share your module handbook or rubric when you order.',
                ],
            },
            {
                title: 'How it works',
                body: [
                    'Share your topic, word count, deadline and any files from your supervisor. You see the price before you pay. Your expert then works chapter by chapter, and you can ask for changes if something doesn’t match your brief. Final files are delivered to your dashboard, together with a similarity report.',
                ],
            },
        ],
        faqs: [
            { question: 'Can you help with just one chapter of my dissertation?', answer: 'Yes. Many students order only the literature review, methodology or data analysis chapter. Upload what you have written so far so the new chapter fits the rest of your work.' },
            { question: 'Who will work on my dissertation?', answer: 'An expert with a Master’s or PhD in your subject area. You can follow the progress from your dashboard and reach our support team on WhatsApp at any time.' },
            { question: 'Can I ask for changes after delivery?', answer: 'Yes. If the work doesn’t follow the instructions you gave, request a revision from your dashboard and the expert will update it.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'thesis-help': {
        heading: 'Thesis help from PhD-qualified experts',
        intro: [
            'Writing a thesis means turning months of research into a clear, well-argued document that meets your university’s standards. Our thesis experts help Master’s and doctoral students plan, write, analyse and polish their thesis, one chapter at a time or as a whole.',
        ],
        sections: [
            {
                title: 'Thesis support we offer',
                body: [],
                points: [
                    'Research proposals and thesis outlines',
                    'Literature reviews and theoretical frameworks',
                    'Research design, sampling and methodology',
                    'Statistical and qualitative data analysis',
                    'Results, discussion and conclusion chapters',
                    'Academic editing, formatting and referencing',
                ],
            },
            {
                title: 'Thesis vs dissertation',
                body: [
                    'In the UK a “thesis” usually means a PhD or MPhil project, while in the USA it often refers to a Master’s project. Whichever system you are in, tell us your level and your department’s guidelines and your expert will follow them.',
                ],
            },
        ],
        faqs: [
            { question: 'Do you help with PhD theses?', answer: 'Yes. PhD work is handled by experts who hold a doctorate in a related field.' },
            { question: 'Can you format my thesis to my university’s template?', answer: 'Yes. Share the template or style guide and we will format headings, tables, figures and references to match it.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'essay-help': {
        heading: 'Essay help from outline to final draft',
        intro: [
            'A good essay answers the question directly, builds an argument and supports every point with evidence. Our essay experts help you do exactly that, whether you need a full essay, a stronger structure or feedback on a draft you have already written.',
        ],
        sections: [
            {
                title: 'Types of essays we help with',
                body: [],
                points: [
                    'Argumentative and persuasive essays',
                    'Critical and analytical essays',
                    'Reflective essays (Gibbs, Kolb and other models)',
                    'Compare and contrast essays',
                    'Literature, history, law, business and nursing essays',
                    'Admission and personal statement essays',
                ],
            },
            {
                title: 'What makes our essays different',
                body: [
                    'Each essay is written from scratch for your question. Your expert uses academic sources, cites them in your referencing style and follows the word count and marking criteria you provide. You receive a similarity report with every final submission.',
                ],
            },
        ],
        faqs: [
            { question: 'How quickly can I get an essay?', answer: 'Short essays can be delivered within 24 hours. Choose your deadline in the calculator to see the price for that timeframe.' },
            { question: 'Which referencing styles do you use?', answer: 'Harvard, APA, MLA, Chicago, OSCOLA, IEEE and Vancouver, or any style your course requires.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'university-assignment-help': {
        heading: 'Assignment help for university students',
        intro: [
            'University assignments come in many forms: essays, reports, case studies, presentations, lab reports and projects. Each has its own structure and marking criteria. AssignmentMinds matches you with an expert in your subject who understands what your lecturers are looking for.',
            'We support undergraduate and postgraduate students in the UK, USA, Canada, Australia, New Zealand, the UAE, Malaysia and India, across a wide range of subjects.',
        ],
        sections: [
            {
                title: 'Subjects we cover',
                body: [],
                points: [
                    'Business, management, marketing and MBA',
                    'Nursing, healthcare and social work',
                    'Law and criminology',
                    'Engineering, computer science and programming',
                    'Economics, finance and accounting',
                    'Psychology, sociology, education and humanities',
                ],
            },
            {
                title: 'Why students choose AssignmentMinds',
                body: [
                    'You see the price upfront in your own currency and track your order from your dashboard. Every final submission includes the finished file and a similarity report, and you can request revisions if something doesn’t match your brief.',
                ],
            },
        ],
        faqs: [
            { question: 'How do I stay updated on my order?', answer: 'Your dashboard shows the status of every order, and our support team is available on WhatsApp for any questions.' },
            { question: 'What do I need to share when ordering?', answer: 'Your assignment brief, word count, deadline and any lecture notes, rubrics or readings. The more detail you share, the closer the work will be to what your module expects.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'do-my-assignment': {
        heading: 'Need someone to help with your assignment?',
        intro: [
            'When deadlines pile up, getting expert help can take the pressure off. Share your assignment brief with AssignmentMinds and we will match you with a subject expert who can work on it, explain the approach and deliver before your deadline.',
        ],
        sections: [
            {
                title: 'How to get started',
                body: [],
                points: [
                    'Enter your word count, level and deadline to see the price',
                    'Upload your brief and any supporting files',
                    'Pay securely by card, UPI or WhatsApp payment',
                    'Track progress from your dashboard',
                    'Download the final file and similarity report when it’s ready',
                ],
            },
            {
                title: 'Urgent assignments',
                body: [
                    'Short assignments can be completed in as little as a few hours, depending on the length and subject. Choose the shortest deadline that works for you in the calculator to see the price.',
                ],
            },
        ],
        faqs: [
            { question: 'How fast can you do my assignment?', answer: 'It depends on the length and complexity. Short tasks can be finished within a few hours; longer projects need more time. The calculator shows the price for each deadline.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'write-my-assignment': {
        heading: 'Assignments written from scratch by subject experts',
        intro: [
            'Every assignment we deliver is written from scratch for your brief, by an expert who studies or teaches in your field. We don’t reuse old work, and each final file comes with a similarity report.',
        ],
        sections: [
            {
                title: 'What you get',
                body: [],
                points: [
                    'An expert matched to your subject and academic level',
                    'Work that follows your brief, word count and marking rubric',
                    'Correct in-text citations and a reference list in your required style',
                    'A similarity report with the final submission',
                    'Revisions if the work doesn’t match your instructions',
                ],
            },
        ],
        faqs: [
            { question: 'Will my assignment be original?', answer: 'Yes. It is written from scratch for your brief and checked for similarity before delivery.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },
};
