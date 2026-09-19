import { Consultant, Discipline, Review } from '../types';

export const CONSULTANTS: Consultant[] = [
  {
    id: 'c1',
    name: 'K. Anderson',
    field: 'ACCOUNTING',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtr0Ac-zJLlLWEFiqALJSlk_LgOBX037ax-P2y3igX_b5iJQYVH6aYkdSWvYhsuN-2QH4gtgtGZGsSDXNPtp_x6DhzvPtWar_FRSHtolWLhG3rahxD04WWTk8Ehu-ymbyvoXdFvRp0vOwttiICR2HW11uAjHrF_U_3XrX2_JwnybKAGXF5jR16mfusCjZGd3s-77_p5ACcSAo7pKBMx7dOYmitAY3bJBe66VK_P3Lz7_m0A6FSfoB0fw',
    status: 'Available',
    degrees: ['MSc Taxation', 'Financial Rep.'],
    bio: 'Degree in Accounting from Univ. of Texas. Expert in critical accounting papers, IFRS/GAAP reconciliation, and corporate financial analysis.',
    ordersCompleted: 1698,
    rating: 4.9,
    ratePerPage: 18,
    university: 'University of Texas at Austin',
    specialties: ['Taxation', 'Corporate Finance', 'Auditing', 'IFRS Standards']
  },
  {
    id: 'c2',
    name: 'Dr. J. Abe',
    field: 'LITERATURE',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCADFvv6xtccDmfgavflm_9PVRr5hQRD9T4ZRe06sGsHBvhUYfNFr-hNqxknEpAU8NAKc_D5VtXtcIKHQBz5XeWQWL9rQ-TAqJE_C6KPqX1z256tJSsEG-O_lRl9AhEQ7gTlM9hYqgqPwHbo7u000XEWnYvG-HkyTctVNU4ATfLvS5OgXOz_m43Kq6O-0LgP0je8K3617jyfOo3IbTAxAY36EEHOyrwE8mIQ4WSqWuD7mXRfRsXFUgScg',
    status: 'Available',
    degrees: ['PhD English', 'Critique'],
    bio: 'Cornell graduate dedicated to dissecting complex compositions, comparative literature, post-colonial rhetoric, and academic essays.',
    ordersCompleted: 2594,
    rating: 5.0,
    ratePerPage: 20,
    university: 'Cornell University',
    specialties: ['Postmodern Fiction', 'Literary Criticism', 'Rhetoric & Composition', 'Poetics']
  },
  {
    id: 'c3',
    name: 'M. Ansari',
    field: 'LEGAL STUDIES',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtB7Lp0ss68AJwGL2uAIOIiWolAokdQRTzOzd_zpk2UAnjZqO_-eUpL8Szhf6tdisUS6IsVVnWDX5cqSu9MgY53qm6LbRpX1W7E4Oyxy5EA_JvlMY79VS0sj0iaWUWpyc-HSc5en4rsYaCFh5jOpHwvt-D0EJdTKzm9o_OGjFWRJjvSJXagL7yejHNeXFbfZ6VzFEEdjWJWVuSD29RYysj0HjCkNB6y5l4MqV5uvqRncZN0ueFr0PItg',
    status: 'Busy',
    degrees: ['LLM', 'Corp. Law'],
    bio: 'Senior Legal Advisor specializing in simplifying complex law papers, constitutional jurisprudence, and international trade briefs using the IRAC method.',
    ordersCompleted: 3179,
    rating: 4.8,
    ratePerPage: 22,
    university: 'London School of Economics',
    specialties: ['IRAC Methodology', 'International Commercial Law', 'Tort & Contract', 'Jurisprudence']
  },
  {
    id: 'c4',
    name: 'J. Smith',
    field: 'FINANCE',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCrlJxYMXFkSYNIR8gyXK096FYt8avBG9xdt-RPaGMrmBYdNcbrxC6bNPhd4pVTiNTFW2j-n9ZqkZ2J61wZ03txWjBMpt-L_uQxAmui291rTJk1e5b49a3mveLiN1g_x571XcXtBHyUbwIS3M8Xgbc3226_VewwSzxF-OVpIovgnSNepw3A6igHVOMv_wqdQsehpp9IBat6wy9CdcwABAFFYqAJyj9ey1Xnh-Tt-DsPL00b_FhLvDbOxw',
    status: 'Available',
    degrees: ['MSc Finance', 'Economics'],
    bio: 'Wharton School graduate helping students understand intricate concepts of quantitative modeling, portfolio valuation, and macro-economics.',
    ordersCompleted: 1165,
    rating: 4.9,
    ratePerPage: 19,
    university: 'Wharton School of Business',
    specialties: ['DCF & Valuation', 'Econometrics', 'Asset Pricing', 'Stata / R Analysis']
  }
];

export const DISCIPLINES: Discipline[] = [
  {
    id: 'stem',
    title: 'STEM',
    subtitle: 'Science, Tech, Eng, Math',
    icon: 'biotech',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAaE26n48qrDF3jcyr0gXw_WW5BdSsiL3QgdnW-2nbPlxOpfC__PbTd7j98qQz-CswYXjXNMG_fvfEC_WPTFFCDTjZUkYsXcAbDlGLvvFVlIcukebQ2sKJnoD_0qeNyvqbwuMkwM0BLPP152HRnkJx-MHJo23YvEbRvxuXxov8SABK_ITuT6qviQ5awkVMOa8xS5RXIgW5F3euYGC-SHhj_qsf33RVrLmx-pTQFBI4YXL1rsBkU50_53g',
    topics: ['Computer Science', 'Data Algorithms', 'Electrical Engineering', 'Applied Mathematics', 'Physics & Chemistry'],
    popularCourses: ['CS50 Advanced Algorithms', 'Applied Linear Algebra', 'Differential Equations', 'Embedded Systems']
  },
  {
    id: 'humanities',
    title: 'Humanities',
    subtitle: 'Literature, History, Arts',
    icon: 'menu_book',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBzfZbQO4MHnhMQL3WAsoycuvvh6UfVM6Ajrno1r8EnCcikpIlsrurLQRBpICjIbfFgR0F9OCf9uakJXnL75LyAryfhvIqte9AvEVbNLf0tFnotDE8P33sd1BUEO0mWJOm_zm_sgq6eywDmhzmeJPF5BFJcvDw3kKrAp4F9nRVZzbdzGFRCORyyJmT1EuA3qAzJpw8BFhi28Qvr_Blf7_VINBIbUWHYdvEzdYAvoBUwFGre_1Di4gti1Q',
    topics: ['Comparative Literature', 'World History', 'Philosophy & Ethics', 'Art History', 'Cultural Anthropology'],
    popularCourses: ['Enlightenment Philosophy', 'Modernist Poetry Analysis', 'Historical Historiography', 'Ethics in Society']
  },
  {
    id: 'business',
    title: 'Business & Law',
    subtitle: 'Finance, Mgt, Legal',
    icon: 'gavel',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAY6ZLYJ_bET8b-qaCIms4JCF1rsWGVJOw41z6Fu7qbSIwGP5STQn38sP7mXNI7tGc1k-YyBjjKnDHzIA8qMhGCiPuxtq6SVUkeULBKUMGb_4t4D_x6sel7ktXtSZHp_0LxXV9jk1XHmG57NlggFZ4JVZ8DuUwcuIxG_koIoKbJQ7XxenZjIIkPW_9pmLQqMcE07K7ejOj8cyItSUbZWyiy2aXtBs8MLIRgD1GJYKTKC3DIUskkjjerIw',
    topics: ['Strategic Management', 'Corporate Law', 'Financial Analysis', 'Supply Chain Operations', 'Marketing Strategies'],
    popularCourses: ['Global Strategy MBA', 'Corporate Governance Law', 'Mergers & Acquisitions', 'Commercial Contracts']
  },
  {
    id: 'medical',
    title: 'Medical Sciences',
    subtitle: 'Nursing, Public Health',
    icon: 'medical_services',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUfaYOVb-sd6UqjkZsgvugEescO5JC0qWmYW3WgMha8XPj5QkhsvfcI9VviKKzi6ZC8ebdj2EKKqF97qt3IuboMrrPcUEG4cQzNdLFAjoI1Sb6WAlsm1AcPbOK2WBx9QFQLV3qw5st_caIx1ostO0wdb4YdcOVTJ7Z3epN6GLLsds2g5pD6cyqqijbzxSGc2SCGr9v3k_r5p9VaD21zE6M-sZecV4msPHcaO9jEVR9ul_RH9QY_UV-fw',
    topics: ['Evidence-Based Nursing', 'Epidemiology', 'Healthcare Policy', 'Pharmacology Research', 'Biomedical Ethics'],
    popularCourses: ['Clinical Trial Methodology', 'Advanced Health Informatics', 'Public Health Interventions', 'Nursing Leadership']
  }
];

export const REVIEWS: Review[] = [
  {
    id: 'r1',
    author: 'Verified Student',
    title: 'Organizational Behavior',
    type: 'DISSERTATION',
    pages: 80,
    date: 'Aug 2026',
    rating: 5,
    text: 'Excellent service and outstanding professionalism. The work was completed to a high standard, delivered on time, and exceeded expectations.',
    platform: 'MY ASSIGNMENT HELP'
  },
  {
    id: 'r2',
    author: 'Verified Student',
    title: 'Strategic Management',
    type: 'ESSAY',
    pages: 6,
    date: 'Aug 2026',
    rating: 5,
    text: 'I received an excellent score and received great feedback from my professor. I will refer other students for this support.',
    platform: 'SITEJABBER'
  },
  {
    id: 'r3',
    author: 'Verified Student',
    title: 'Corporate Law',
    type: 'CASE STUDY',
    pages: 12,
    date: 'Jul 2026',
    rating: 5,
    text: 'I had great feedback on my paper. I appreciate the deep scholarly research that was invested in the arguments presented.',
    platform: 'REVIEWS.io'
  },
  {
    id: 'r4',
    author: 'Elena R., University Student',
    title: 'Machine Learning in Genomics',
    type: 'RESEARCH THESIS',
    pages: 45,
    date: 'Jun 2026',
    rating: 5,
    text: 'The statistical methodology and analysis were spot on. It really helped me meet my tight deadline without any issues.',
    platform: 'REVIEWS.io'
  },
  {
    id: 'r5',
    author: 'Liam M., MBA Candidate',
    title: 'Cross-Border M&A Valuation',
    type: 'CAPSTONE REPORT',
    pages: 35,
    date: 'May 2026',
    rating: 5,
    text: 'The financial modeling and DCF analysis were exactly what I needed for my final project. Highly recommended.',
    platform: 'MY ASSIGNMENT HELP'
  },
  {
    id: 'r6',
    author: 'Sophia T., Law Student',
    title: 'Arbitration in Maritime Law',
    type: 'LEGAL MEMORANDUM',
    pages: 18,
    date: 'Apr 2026',
    rating: 5,
    text: 'Clear structuring with accurate citations of recent precedents. Great attention to detail.',
    platform: 'SITEJABBER'
  }
];
