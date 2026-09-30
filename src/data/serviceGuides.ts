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

    'assignment-help': {
        heading: 'Online assignment help, from brief to final draft',
        intro: [
            'Assignments are how most modules are marked, and each one comes with its own brief, word count, marking rubric and referencing style. AssignmentMinds matches you with a subject expert who reads your brief, plans the answer and delivers well-structured, referenced work before your deadline.',
            'You can use the finished work as a model answer: to see how an argument is built, how sources are used and how the marking criteria are met, so your own submissions get stronger.',
        ],
        sections: [
            {
                title: 'Types of assignments we help with',
                body: [],
                points: [
                    'Essays, reports and reflective writing',
                    'Case studies and business analyses',
                    'Literature reviews and research proposals',
                    'Lab reports, calculations and data analysis',
                    'Programming tasks and technical documentation',
                    'Presentations with speaker notes',
                ],
            },
            {
                title: 'How our assignment help works',
                body: [
                    'Enter the word count, academic level and deadline in the calculator to see the price in your currency. Upload the brief and any lecture notes, pay securely, and follow the progress from your dashboard. Every final submission includes the finished file and a similarity report, and you can ask for a revision if something doesn’t match your instructions.',
                ],
            },
        ],
        faqs: [
            { question: 'Which subjects do you cover?', answer: 'Business, management, nursing and healthcare, law, engineering, computer science, economics, psychology, education and many more. Tell us your module and we will match an expert in that field.' },
            { question: 'Can you follow my university’s marking rubric?', answer: 'Yes. Upload the rubric or module handbook with your order and the expert will structure the work around the criteria it lists.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'uk-assignment-help': {
        heading: 'Assignment help for UK university students',
        intro: [
            'UK degrees are marked against clear grade bands, from a pass to a first, and lecturers expect critical analysis, not just description. Our experts know how UK marking works and write to the level your module expects, whether you are in your first year or on a Master’s course.',
        ],
        sections: [
            {
                title: 'Written the way UK universities expect',
                body: ['Every order follows British English spelling and the conventions UK lecturers look for.'],
                points: [
                    'Harvard, APA, OSCOLA or MHRA referencing, as your course requires',
                    'Critical evaluation and a clear line of argument',
                    'Word counts kept within your module’s allowed range',
                    'Structure matched to your assessment brief and learning outcomes',
                ],
            },
            {
                title: 'Undergraduate and postgraduate support',
                body: [
                    'From first-year essays to Level 7 reports and dissertations, we match you with an expert who has studied or taught at that level. Share your module handbook so the work matches what your lecturers expect.',
                ],
            },
        ],
        faqs: [
            { question: 'Do you use British English?', answer: 'Yes. All work for UK students is written in British English unless you ask otherwise.' },
            { question: 'Can I pay in pounds?', answer: 'Yes. Choose the +44 country code in the calculator and the price is shown in GBP.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'college-assignment-help': {
        heading: 'College assignment help that fits your course',
        intro: [
            'College assignments often come thick and fast, with several deadlines in the same week. Our experts help you plan, research and write assignments for college and further-education courses, and explain the approach so you can tackle the next one with confidence.',
        ],
        sections: [
            {
                title: 'What we can help with',
                body: [],
                points: [
                    'Essays and short written assignments',
                    'Coursework units and portfolio tasks',
                    'Reports, presentations and posters',
                    'Maths, science and computing problems with worked steps',
                    'Proofreading and referencing checks',
                ],
            },
            {
                title: 'Clear pricing, no surprises',
                body: [
                    'The calculator shows the full price before you order, in your own currency. Shorter deadlines cost a little more; plan ahead and the price drops.',
                ],
            },
        ],
        faqs: [
            { question: 'Is this only for university students?', answer: 'No. We help college, diploma and further-education students as well as undergraduates and postgraduates.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'masters-dissertation-help': {
        heading: 'Master’s dissertation help from PhD-qualified experts',
        intro: [
            'A Master’s dissertation is expected to show independent research, a justified methodology and critical depth, usually over 12,000 to 20,000 words. Our experts hold PhDs or have supervised postgraduate research, and they help you at any stage, from the proposal to final editing.',
        ],
        sections: [
            {
                title: 'Support at every stage',
                body: [],
                points: [
                    'Research questions, aims and a realistic plan',
                    'Proposal and ethics application',
                    'A critical literature review that identifies a clear gap',
                    'Methodology: qualitative, quantitative or mixed methods',
                    'Analysis in SPSS, NVivo, R, Python or Excel, explained step by step',
                    'Discussion, conclusion, abstract and final proofreading',
                ],
            },
            {
                title: 'Working with your supervisor’s feedback',
                body: [
                    'Upload your supervisor’s comments with your order. Your expert revises chapters around that feedback so the dissertation develops in the direction your supervisor expects.',
                ],
            },
        ],
        faqs: [
            { question: 'Can you help with just one chapter?', answer: 'Yes. Many Master’s students order only the literature review, the methodology or the data analysis. Upload your earlier chapters so the new one fits.' },
            { question: 'Do you help with MBA and MSc dissertations?', answer: 'Yes, including MBA, MSc, MA, LLM and MRes projects.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'assignment-help-university-of-salford': {
        heading: 'Assignment help for the University of Salford students',
        intro: [
            'Studying at the University of Salford in Greater Manchester? Our subject experts help with essays, reports, case studies and dissertations written to the brief and marking criteria of your module, whether you study at the Peel Park campus or at MediaCityUK.',
            'AssignmentMinds is an independent academic support service. We are not affiliated with, endorsed by or connected to the University of Salford.',
        ],
        sections: [
            {
                title: 'Written to your module brief',
                body: [
                    'Upload your assessment brief, module handbook and any lecture slides. Your expert follows the learning outcomes and word count they set, and uses the referencing style your course asks for. Many UK courses use a Harvard style, but always check your handbook and tell us if yours is different.',
                ],
            },
            {
                title: 'Subjects students often ask us about',
                body: [],
                points: ['Nursing, midwifery and allied health', 'Media, journalism and digital content', 'Engineering and the built environment', 'Business, management and law', 'Psychology and social sciences'],
            },
        ],
        faqs: [
            { question: 'Are you part of the University of Salford?', answer: 'No. AssignmentMinds is an independent service with no connection to the University of Salford. Always follow your university\u2019s academic integrity rules when using any support.' },
            { question: 'Can you use my course\u2019s referencing style?', answer: 'Yes. Tell us the style in your module handbook (for example Harvard, APA or OSCOLA) and the expert will follow it.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'assignment-help-university-of-east-london': {
        heading: 'Assignment help for the University of East London students',
        intro: [
            'Studying at the University of East London in east London? Our subject experts help with essays, reports, case studies and dissertations written to the brief and marking criteria of your module, whether you are based at Stratford or at the Docklands campus.',
            'AssignmentMinds is an independent academic support service. We are not affiliated with, endorsed by or connected to the University of East London.',
        ],
        sections: [
            {
                title: 'Written to your module brief',
                body: [
                    'Upload your assessment brief, module handbook and any lecture slides. Your expert follows the learning outcomes and word count they set, and uses the referencing style your course asks for. Many UK courses use a Harvard style, but always check your handbook and tell us if yours is different.',
                ],
            },
            {
                title: 'Subjects students often ask us about',
                body: [],
                points: ['Psychology and counselling', 'Business, finance and management', 'Law and criminology', 'Health, sport and bioscience', 'Computing and engineering'],
            },
        ],
        faqs: [
            { question: 'Are you part of the University of East London?', answer: 'No. AssignmentMinds is an independent service with no connection to the University of East London. Always follow your university\u2019s academic integrity rules when using any support.' },
            { question: 'Can you use my course\u2019s referencing style?', answer: 'Yes. Tell us the style in your module handbook (for example Harvard, APA or OSCOLA) and the expert will follow it.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'assignment-help-university-of-west-london': {
        heading: 'Assignment help for the University of West London students',
        intro: [
            'Studying at the University of West London in Ealing or Brentford? Our subject experts help with essays, reports, case studies and dissertations written to the brief and marking criteria of your module, from undergraduate modules to postgraduate projects.',
            'AssignmentMinds is an independent academic support service. We are not affiliated with, endorsed by or connected to the University of West London.',
        ],
        sections: [
            {
                title: 'Written to your module brief',
                body: [
                    'Upload your assessment brief, module handbook and any lecture slides. Your expert follows the learning outcomes and word count they set, and uses the referencing style your course asks for. Many UK courses use a Harvard style, but always check your handbook and tell us if yours is different.',
                ],
            },
            {
                title: 'Subjects students often ask us about',
                body: [],
                points: ['Nursing, midwifery and healthcare', 'Business, hospitality and tourism', 'Law and criminology', 'Computing and cyber security', 'Music, media and performance'],
            },
        ],
        faqs: [
            { question: 'Are you part of the University of West London?', answer: 'No. AssignmentMinds is an independent service with no connection to the University of West London. Always follow your university\u2019s academic integrity rules when using any support.' },
            { question: 'Can you use my course\u2019s referencing style?', answer: 'Yes. Tell us the style in your module handbook (for example Harvard, APA or OSCOLA) and the expert will follow it.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },

    'assignment-help-university-of-bedfordshire': {
        heading: 'Assignment help for the University of Bedfordshire students',
        intro: [
            'Studying at the University of Bedfordshire in Luton, Bedford or Aylesbury? Our subject experts help with essays, reports, case studies and dissertations written to the brief and marking criteria of your module, including reports, reflective writing and dissertations.',
            'AssignmentMinds is an independent academic support service. We are not affiliated with, endorsed by or connected to the University of Bedfordshire.',
        ],
        sections: [
            {
                title: 'Written to your module brief',
                body: [
                    'Upload your assessment brief, module handbook and any lecture slides. Your expert follows the learning outcomes and word count they set, and uses the referencing style your course asks for. Many UK courses use a Harvard style, but always check your handbook and tell us if yours is different.',
                ],
            },
            {
                title: 'Subjects students often ask us about',
                body: [],
                points: ['Nursing and health studies', 'Business and management', 'Education and teaching', 'Computing and IT', 'Sport, psychology and social work'],
            },
        ],
        faqs: [
            { question: 'Are you part of the University of Bedfordshire?', answer: 'No. AssignmentMinds is an independent service with no connection to the University of Bedfordshire. Always follow your university\u2019s academic integrity rules when using any support.' },
            { question: 'Can you use my course\u2019s referencing style?', answer: 'Yes. Tell us the style in your module handbook (for example Harvard, APA or OSCOLA) and the expert will follow it.' },
            PRICING_FAQ,
            PRIVACY_FAQ,
        ],
    },
};
