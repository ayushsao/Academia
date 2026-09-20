import React, { useState } from 'react';
import { FileEdit, BookOpen, PenTool, LayoutTemplate, GraduationCap, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ServicesTabs: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);

    const services = [
        {
            title: 'Assignments',
            contentTitle: 'Assignment Writing Help',
            icon: PenTool,
            content: (
                <>
                    <p className="text-[#555] mb-4 text-[15px] leading-relaxed">
                        Assignment writing has always been a challenge for students as it's not easy to research from in-depth on any topic and meet all guidelines set by the universities in the UK. But still, students try their best to balance their precious time between academic responsibilities and other daily chores, which can be quite overwhelming and exhausting.
                    </p>
                    <p className="text-[#555] mb-8 text-[15px] leading-relaxed">
                        To share their burden, AssignmentMinds extends its helping hand. We are the No.1 online assignment writing help service UK provider, having completed more than 1000,000+ assignments. The assignment helpers of our website make sure to draft a high quality paper following proper formatting and referencing style, thus resulting in top grades for students.
                    </p>
                </>
            ),
            features: [
                'In-depth Research', 'Flawless Writing', 'Professional Editing',
                'Keen Proofreading', 'Experienced Assistance', 'Accurate Formatting'
            ],
            btnText: 'Do My Assignment'
        },
        {
            title: 'Coursework',
            contentTitle: 'Coursework Writing Help',
            icon: LayoutTemplate,
            content: (
                <>
                    <p className="text-[#555] mb-4 text-[15px] leading-relaxed">
                        Coursework constitutes a significant chunk of your final grades. It requires consistent effort, extensive reading, and practical application of theoretical concepts. Many students find it difficult to keep up with the rigorous demands of coursework alongside their regular studies.
                    </p>
                    <p className="text-[#555] mb-8 text-[15px] leading-relaxed">
                        Our expert coursework writers are here to rescue you. We provide step-by-step assistance, ensuring every module is addressed comprehensively. With our professional coursework help, you can submit meticulously crafted papers that impress your tutors.
                    </p>
                </>
            ),
            features: [
                'Module Alignment', 'Data Analysis', 'Custom Structuring',
                'Plagiarism-Free', 'Timely Delivery', '24/7 Support'
            ],
            btnText: 'Do My Coursework'
        },
        {
            title: 'Essay',
            contentTitle: 'Professional Essay Help',
            icon: FileEdit,
            content: (
                <>
                    <p className="text-[#555] mb-4 text-[15px] leading-relaxed">
                        Essays require a strong thesis, logical flow, and persuasive arguments. From argumentative to descriptive essays, understanding the nuanced differences and executing them perfectly often leaves students stressed.
                    </p>
                    <p className="text-[#555] mb-8 text-[15px] leading-relaxed">
                        Let our seasoned essay writers craft original, thought-provoking essays for you. We focus on clear narratives, strong vocabulary, and impeccable grammar to guarantee an A+ worthy submission every single time.
                    </p>
                </>
            ),
            features: [
                'Strong Thesis', 'Persuasive Arguments', 'Flawless Grammar',
                'Custom Written', 'Free Revisions', 'Proper Citations'
            ],
            btnText: 'Write My Essay'
        },
        {
            title: 'Dissertation',
            contentTitle: 'Dissertation & Thesis Support',
            icon: GraduationCap,
            content: (
                <>
                    <p className="text-[#555] mb-4 text-[15px] leading-relaxed">
                        A dissertation is the most critical and extensive piece of academic writing you will ever undertake. It demands months of independent research, data gathering, and critical analysis, causing immense pressure on scholars.
                    </p>
                    <p className="text-[#555] mb-8 text-[15px] leading-relaxed">
                        Our Ph.D. qualified experts offer comprehensive dissertation help. From crafting the perfect proposal and literature review to rigorous methodology and data analysis, we guide you through every chapter flawlessly.
                    </p>
                </>
            ),
            features: [
                'Ph.D. Experts', 'Literature Review', 'Methodology Design',
                'Data Analysis', 'Proposal Writing', 'Chapter-by-Chapter'
            ],
            btnText: 'Help With Dissertation'
        },
        {
            title: 'Homework',
            contentTitle: 'Daily Homework Assistance',
            icon: BookOpen,
            content: (
                <>
                    <p className="text-[#555] mb-4 text-[15px] leading-relaxed">
                        Daily homework tasks across multiple subjects can easily pile up, leaving students with no time for extracurricular activities or self-study. Balancing these minor but frequent tasks is a common struggle.
                    </p>
                    <p className="text-[#555] mb-8 text-[15px] leading-relaxed">
                        Our rapid homework assistance service is designed to solve this. Whether it's math problems, science charts, or short Q&A, our tutors provide accurate solutions quickly, ensuring you never miss a deadline.
                    </p>
                </>
            ),
            features: [
                'All Subjects', 'Accurate Answers', 'Step-by-Step Solutions',
                'Fast Turnaround', 'Affordable Rates', 'Conceptual Clarity'
            ],
            btnText: 'Do My Homework'
        }
    ];

    return (
        <section className="py-20 bg-white relative">
            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 relative z-10 border-t border-white/50">

                {/* Title */}
                <h2 className="text-[26px] md:text-[34px] font-bold text-[#2d2d2d] mb-3 text-center tracking-tight">
                    Best Assignment Writing Services Offered in UK
                </h2>

                {/* Decorative Divider */}
                <div className="relative w-72 h-[1px] bg-[#fea520]/30 flex justify-center mb-16 mx-auto">
                    <div className="absolute top-1/2 -translate-y-1/2 w-12 h-1 bg-[#fea520]"></div>
                </div>

                {/* Main Content Layout */}
                <div className="flex flex-col md:flex-row relative">

                    {/* Left Sidebar Menu (Overlapping) */}
                    <div className="md:w-[280px] lg:w-[320px] z-20 shrink-0 md:pt-8 relative mb-8 md:mb-0">
                        {/* Faint Dotted grid absolute behind the sidebar (like screenshot) */}
                        <div className="absolute -top-4 -left-6 w-24 h-24 opacity-10 -z-10" style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '10px 10px' }}></div>

                        <div className="bg-white rounded-2xl shadow-[0_5px_30px_rgba(0,0,0,0.06)] p-3 lg:p-4 border border-gray-50 flex flex-col gap-3">
                            <h4 className="text-[14px] font-bold py-2 px-3 flex items-center gap-2 text-[#333] mb-1">
                                <span className="transform -rotate-12 bg-pink-50 p-1.5 rounded text-[#fea520]"><PenTool className="w-4 h-4" /></span>
                                We Offer Academic Assistance In:
                            </h4>
                            {services.map((service, idx) => {
                                const Icon = service.icon;
                                const isActive = activeTab === idx;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveTab(idx)}
                                        className={`flex items-center gap-3 p-3.5 lg:p-4 rounded-xl text-left transition-all font-bold text-[15px] border ${isActive ? 'bg-[#fff1f4] border-[#fea520] text-[#fea520]' : 'bg-white border-gray-200 text-[#444] hover:border-[#fea520] hover:text-[#fea520]'}`}
                                    >
                                        <Icon className={`w-6 h-6 stroke-[1.5] ${isActive ? 'text-[#fea520]' : 'text-gray-400'}`} />
                                        <span>{service.title}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Right Content Area (Premium Glassy Box) */}
                    <div className="md:w-full bg-gradient-to-br from-white to-[#fafbfc] md:-ml-12 z-10 rounded-[24px] md:pl-24 p-8 md:p-12 pb-14 relative overflow-hidden flex flex-col shadow-[0_15px_40px_rgb(0,0,0,0.04)] border border-gray-100">

                        {/* Background Sketch Image (Pencil) */}
                        <div className="absolute -bottom-10 -right-4 opacity-5 pointer-events-none transform -rotate-12 w-64 h-64">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-[#000]">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                <path d="m15 5 4 4" />
                            </svg>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="relative z-10 flex flex-col h-full"
                            >
                                <h3 className="text-[22px] md:text-[24px] font-bold text-[#fea520] mb-4">
                                    {services[activeTab].contentTitle}
                                </h3>

                                {services[activeTab].content}

                                {/* Key Features Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 w-full lg:w-[85%]">
                                    {services[activeTab].features.map((feature, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" strokeWidth={2.5} />
                                            <span className="text-[14px] font-semibold text-[#333] tracking-tight">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Premium Action Button */}
                                <div className="mt-auto">
                                    <button className="bg-[#fea520] hover:bg-[#e39115] text-[#111] font-bold text-[15px] px-8 py-3.5 shadow-md hover:shadow-lg transition-all rounded-[6px] tracking-wide relative overflow-hidden group">
                                        <span className="relative z-10">{services[activeTab].btnText}</span>
                                        <div className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out"></div>
                                    </button>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </section>
    );
};
