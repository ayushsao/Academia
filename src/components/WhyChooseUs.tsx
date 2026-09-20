import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const Illustrations = {
    Pricing: () => (
        <svg viewBox="0 0 200 120" className="w-[180px] h-[120px] mx-auto text-[#2d2d2d]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="70" width="100" height="20" rx="3" fill="#e8f3ee" />
            <rect x="40" y="90" width="120" height="20" rx="3" fill="#fea520" />
            <path d="M100 40 l40 -20 l-40 -20 l-40 20 z" fill="#1e5eb8" />
            <rect x="80" y="40" width="40" height="20" fill="#1e5eb8" />
            <circle cx="100" cy="20" r="12" fill="#ffcb05" />
            <path d="M100 12v16M92 20h16" stroke="#c09600" strokeWidth="2" />
            <path d="M60 100 Q 140 100 140 30" stroke="#fea520" strokeWidth="2" strokeDasharray="4 4" fill="none" />
        </svg>
    ),
    Timely: () => (
        <svg viewBox="0 0 200 120" className="w-[180px] h-[120px] mx-auto text-[#2d2d2d]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="60" r="50" fill="#fff1f4" />
            <circle cx="100" cy="60" r="40" stroke="#ffcb05" strokeWidth="4" />
            <path d="M100 30v30l20 10" stroke="#ffcb05" strokeWidth="4" strokeLinecap="round" />
            <rect x="40" y="80" width="40" height="30" rx="4" fill="#1e5eb8" opacity="0.8" />
            <rect x="120" y="70" width="50" height="40" rx="4" fill="#e8f3ee" />
            <path d="M50 85h20M50 95h10M130 80h30M130 90h20" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    Support: () => (
        <svg viewBox="0 0 200 120" className="w-[180px] h-[120px] mx-auto text-[#2d2d2d]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="60" y="60" width="80" height="40" rx="5" fill="#1e5eb8" />
            <circle cx="100" cy="40" r="25" fill="#ffcb05" />
            <path d="M75 40 A25 25 0 0 1 125 40" stroke="#fea520" strokeWidth="4" />
            <circle cx="125" cy="40" r="4" fill="#fea520" />
            <rect x="75" y="65" width="50" height="15" rx="2" fill="#fff" />
            <circle cx="40" cy="30" r="15" fill="#e8f3ee" />
            <circle cx="160" cy="30" r="15" fill="#e8f3ee" />
            <path d="M35 30h10M155 30h10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </svg>
    ),
};

export const WhyChooseUs: React.FC = () => {
    const [startIndex, setStartIndex] = useState(0);

    const guarantees = [
        {
            title: 'Affordable Prices',
            desc: "A student's tight budget should never come in the way of their academic excellence. Thus, we've kept the prices of our UK assignment writing services.",
            illustration: Illustrations.Pricing,
        },
        {
            title: 'Timely Submission',
            desc: "We understand the importance of timely submission for students. We work 24*7 to ensure that top-quality work is delivered to the students before the deadline.",
            illustration: Illustrations.Timely,
        },
        {
            title: '24/7 Customer Support',
            desc: "Some students work early in the morning while some get queries late night. So, we are available round-the-clock to solve queries of every student.",
            illustration: Illustrations.Support,
        },
    ];

    const nextSlide = () => {
        setStartIndex((prev) => (prev + 1) % guarantees.length);
    };

    const prevSlide = () => {
        setStartIndex((prev) => (prev - 1 + guarantees.length) % guarantees.length);
    };

    // Auto scroll
    useEffect(() => {
        const interval = setInterval(() => {
            nextSlide();
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    const visibleItems = [
        guarantees[startIndex % guarantees.length],
        guarantees[(startIndex + 1) % guarantees.length],
        guarantees[(startIndex + 2) % guarantees.length]
    ];

    return (
        <section className="py-20 md:py-24 bg-white relative">
            <div className="max-w-[1250px] mx-auto px-4 relative z-10">

                {/* Yellow Top CTA */}
                <div className="flex justify-center mb-10 text-center">
                    <button className="bg-[#ffcb05] text-[#2d2d2d] font-bold text-[15px] px-8 py-2.5 shadow-sm transition-colors cursor-pointer rounded-sm hover:bg-[#eebc04]">
                        Get your Assignments Done!
                    </button>
                </div>

                {/* Header Titles */}
                <div className="text-center mb-12 flex flex-col items-center">
                    <h2 className="text-[24px] md:text-[28px] lg:text-[32px] font-bold text-[#2d2d2d] mb-4 tracking-tight">
                        We Guarantee the Best Online Assignment Help UK Service
                    </h2>

                    <div className="max-w-4xl mx-auto mb-2 text-[#666] text-[13px] md:text-[14px] leading-relaxed relative">
                        Being the leading assignment writing service provider in the UK, Instant Assignment Help understands the problems that students go through every day during their academic careers. It's not only preparing assignments but also studying for examinations, doing part-time jobs, taking part in extra-curricular activities and a k... <span className="text-[#fea520] cursor-pointer hover:underline">Know more</span>
                    </div>
                </div>

            </div>

            {/* Carousel Container (with background pink band) */}
            <div className="relative w-full pb-8 pt-4 overflow-hidden">

                {/* Full-width Pink Background Strip */}
                <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-[140px] bg-[#fff1f4] opacity-50 z-0"></div>

                <div className="max-w-[1300px] mx-auto px-4 flex items-center justify-center relative z-10 gap-2 md:gap-6">

                    {/* Left Chevron */}
                    <button
                        onClick={prevSlide}
                        className="hidden md:flex text-gray-500 hover:text-[#fea520] transition-colors p-2"
                    >
                        <ChevronLeft className="w-8 h-8 font-light" strokeWidth={1} />
                    </button>

                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-center justify-center px-2">
                        {visibleItems.map((item, idx) => {
                            // The middle item (idx === 1) is highlighted
                            const isCenter = idx === 1;
                            const Illustration = item.illustration;

                            return (
                                <motion.div
                                    key={`${item.title}-${idx}`}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: isCenter ? 1.05 : 1 }}
                                    transition={{ duration: 0.3 }}
                                    className={`bg-white rounded-[10px] sm:min-h-[300px] flex flex-col pt-6 pb-8 px-6 shadow-sm transition-all duration-300 mx-auto w-full max-w-[360px]
                                        ${isCenter ? 'border-[1.5px] border-[#fea520] z-20 shadow-md transform scale-105' : 'border border-gray-100 opacity-90 z-10'}
                                    `}
                                >
                                    {/* Illustration Area */}
                                    <div className="w-full flex justify-center mb-6 h-[120px] bg-slate-50/50 rounded-xl overflow-hidden relative border border-gray-50">
                                        <Illustration />
                                    </div>

                                    {/* Text Content */}
                                    <h3 className={`text-[15px] font-bold mb-3 ${isCenter ? 'text-[#fea520]' : 'text-[#fea520]'}`}>
                                        {item.title}
                                    </h3>
                                    <p className="text-[12.5px] text-[#555] leading-relaxed">
                                        {item.desc}
                                    </p>

                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Right Chevron */}
                    <button
                        onClick={nextSlide}
                        className="hidden md:flex text-gray-500 hover:text-[#fea520] transition-colors p-2"
                    >
                        <ChevronRight className="w-8 h-8 font-light" strokeWidth={1} />
                    </button>

                </div>
            </div>

        </section>
    );
};
