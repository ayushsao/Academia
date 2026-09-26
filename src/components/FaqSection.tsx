import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export const FaqSection: React.FC = () => {

    // Exact mapping of questions from the design
    const faqs = [
        {
            question: "Is Assignment Help Legal in the UK?",
            answer: "Yes, assignment help is completely legal in the UK. We operate as a legitimate academic assistance service, providing reference materials and guidance to help you understand your coursework better and improve your academic performance."
        },
        {
            question: "Where Can I Get Help with My Assignment?",
            answer: "Right here! Our platform offers comprehensive academic assistance across all disciplines. Simply click 'Order Now', submit your requirements, and we will connect you with a qualified subject expert instantly."
        },
        {
            question: "What Type of Services Do Offer?",
            answer: "We offer a wide range of academic services including custom essay writing, dissertation assistance, proofreading, editing, coding help, technical project development, and exam preparation guidance."
        },
        {
            question: "Is Using Assignment Help Considered Plagiarism?",
            answer: "No, using our service is not plagiarism. We provide original, custom-written reference papers designed to serve as research models. We strictly adhere to academic integrity guidelines."
        },
        {
            question: "Do You Follow All University Guidelines?",
            answer: "Absolutely. Our academic experts are well-versed in standard university rubrics across the UK, US, and Australia. You can attach specific guidelines, and we guarantee strict adherence to your styling (Harvard, APA, MLA, etc.)."
        },
        {
            question: "Will You Reuse My Assignments?",
            answer: "Never. Every document we deliver is 100% custom-written for the specific order. We never resell, publish, or recycle previously submitted assignments to any other student or database."
        },
        {
            question: "How Much Time Will You Need to Deliver My Work?",
            answer: "We can deliver work in as little as 3-6 hours for urgent requests. Standard turnaround times range from 24 hours to a week or more, depending on the length and complexity of your requirements."
        },
        {
            question: "Can I Directly Share My Details with the Writers?",
            answer: "For your privacy and security, direct contact information is kept confidential. However, you maintain direct communication with your assigned writer through our secure encrypted dashboard messaging system."
        },
        {
            question: "How to Get Help with Assignments?",
            answer: "It's simple: click 'Order Now', fill out the order form with your assignment details and attachments, complete the secure payment, and your assignment will be assigned to a suitable expert immediately."
        },
        {
            question: "Is My Identity Safe with You?",
            answer: "100% Secure. We operate under strict GDPR compliance and utilize bank-grade encryption protocols. Your personal identity, university details, and financial data are never shared with third parties or even your writer."
        },
        {
            question: "How Much Does an Assignment Cost in UK?",
            answer: "Pricing depends on the academic level, word count, and urgency of the deadline. We ensure our rates are highly competitive and specifically tailored to fit within student budgets. Check our cost calculator for exact pricing!"
        }
    ];

    const [openIdx, setOpenIdx] = useState<number | null>(0);

    return (
        <section className="py-16 md:py-24 bg-[#f6f6fa]">
            <div className="max-w-[1200px] mx-auto px-4 md:px-6">

                <div className="text-center mb-10">
                    <h2 className="text-[26px] md:text-[34px] font-bold text-[#2d2d2d]">
                        Frequently Asked Questions
                    </h2>
                </div>

                {/* 2-Column Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 items-start">
                    {faqs.map((faq, idx) => {
                        const isOpen = openIdx === idx;
                        return (
                            <div
                                key={idx}
                                className={`bg-white border rounded-[3px] overflow-hidden transition-all duration-300 ${isOpen ? 'border-[#fea520] shadow-sm' : 'border-gray-200/80 shadow-sm'}`}
                            >
                                <button
                                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                                    className="w-full px-5 py-3.5 flex items-center justify-between bg-white text-left text-[#444] font-medium text-[14px] md:text-[14.5px] hover:text-[#2d2d2d] transition-colors focus:outline-none"
                                >
                                    {faq.question}
                                    <ChevronDown className={`w-4 h-4 ml-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#fea520]' : 'text-gray-500'}`} strokeWidth={2} />
                                </button>
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-5 pb-4 pt-1 text-[#666] leading-relaxed text-[13.5px]">
                                                {faq.answer}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>

            </div>
        </section>
    );
};
