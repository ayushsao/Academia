import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Paperclip } from 'lucide-react';
import { motion } from 'framer-motion';

interface SamplesShowcaseProps {
    onOpenAction?: () => void;
}

export const SamplesShowcase: React.FC<SamplesShowcaseProps> = ({ onOpenAction }) => {
    const [startIndex, setStartIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    const samples = [
        { type: 'Thesis Examples', subject: 'Business', pages: 12, words: 3096, downloads: 25701 },
        { type: 'Dissertation Examples', subject: 'Accounting', pages: 9, words: 2221, downloads: 1266 },
        { type: 'Case Study Examples', subject: 'Innovation and', pages: 23, words: 4637, downloads: 650 },
        { type: 'Research Paper', subject: 'Computer Science', pages: 8, words: 2000, downloads: 4100 },
        { type: 'Term Paper', subject: 'History', pages: 10, words: 2500, downloads: 1200 },
    ];

    const nextSlide = () => {
        setStartIndex((prev) => (prev + 1) % samples.length);
    };

    const prevSlide = () => {
        setStartIndex((prev) => (prev - 1 + samples.length) % samples.length);
    };

    useEffect(() => {
        let intervalId: NodeJS.Timeout;
        if (isAutoPlaying) {
            intervalId = setInterval(() => {
                nextSlide();
            }, 3500);
        }
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isAutoPlaying]);

    const visibleSamples = [
        samples[startIndex % samples.length],
        samples[(startIndex + 1) % samples.length],
        samples[(startIndex + 2) % samples.length],
    ];

    return (
        <section
            className="py-20 md:py-24 bg-white relative overflow-hidden"
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
        >
            <div className="max-w-[1250px] mx-auto px-4">

                {/* Header */}
                <div className="text-center mb-10 md:mb-16">
                    <h2 className="text-[26px] md:text-[32px] lg:text-[34px] font-bold text-[#2d2d2d] mb-3 tracking-tight">
                        Are You Ready to Try Our FREE Samples?
                    </h2>
                    <p className="text-sm md:text-base text-gray-600 mb-5">
                        Access thousands of free samples on all subject topics now
                    </p>
                    <div className="relative w-64 h-[1px] bg-[#fea520]/30 flex justify-center mx-auto">
                        <div className="absolute top-1/2 -translate-y-1/2 w-10 h-1 bg-[#fea520]"></div>
                    </div>
                </div>

                <div className="relative w-full flex items-center justify-center">

                    {/* Left Chevron */}
                    <button
                        onClick={prevSlide}
                        className="absolute -left-2 md:-left-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-800 transition-colors z-20"
                    >
                        <ChevronLeft className="w-8 h-8 md:w-10 md:h-10 font-light" strokeWidth={1.5} />
                    </button>

                    {/* Cards Container */}
                    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 px-8 py-6">
                        {visibleSamples.map((sample, idx) => (
                            <motion.div
                                key={`${sample.type}-${idx}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="relative group cursor-pointer w-full max-w-sm mx-auto"
                            >
                                {/* Pink Back Shadow Block (Tilted) */}
                                <div className="absolute inset-0 bg-[#ffe8ec] rounded-xl transform -rotate-[4deg] scale-[1.02] origin-bottom-left transition-transform group-hover:-rotate-[6deg] z-0"></div>

                                {/* Main Front Card */}
                                <div className="bg-[#fff1f4] rounded-xl p-6 relative z-10 w-full shadow-sm flex flex-col min-h-[340px]">

                                    {/* Paperclip */}
                                    <div className="absolute -top-3 -left-3 text-[#5894b9] transform -rotate-45 drop-shadow-md">
                                        <Paperclip className="w-8 h-8" strokeWidth={2.5} />
                                    </div>

                                    {/* Card Header */}
                                    <h3 className="text-[14px] md:text-[15px] font-extrabold text-[#333] text-center mb-4 mt-2">
                                        Type: {sample.type}
                                    </h3>

                                    <div className="w-full h-[1px] bg-[#fea520] mb-4 opacity-50"></div>

                                    {/* Data Rows */}
                                    <div className="flex flex-col flex-1 text-[13px] text-[#444] font-medium">
                                        <div className="flex justify-between py-2.5">
                                            <span>Subject:</span>
                                            <span>{sample.subject}</span>
                                        </div>
                                        <div className="w-full h-[1px] bg-gray-300 opacity-60"></div>

                                        <div className="flex justify-between py-2.5">
                                            <span>Number of pages:</span>
                                            <span>{sample.pages}</span>
                                        </div>
                                        <div className="w-full h-[1px] bg-gray-300 opacity-60"></div>

                                        <div className="flex justify-between py-2.5">
                                            <span>Total Words:</span>
                                            <span>{sample.words}</span>
                                        </div>
                                        <div className="w-full h-[1px] bg-gray-300 opacity-60"></div>

                                        <div className="flex justify-between py-2.5">
                                            <span>Downloads:</span>
                                            <span>{sample.downloads}</span>
                                        </div>
                                        <div className="w-full h-[1px] bg-gray-300 opacity-60 mb-6"></div>
                                    </div>

                                    {/* Action Button & Pen Graphic */}
                                    <div className="relative flex justify-center mt-auto pb-2">
                                        <button onClick={onOpenAction} className="bg-[#ffe0e6] font-bold text-[#444] text-[12px] px-4 py-2 rounded-md hover:bg-[#ffcddb] transition-colors shadow-sm">
                                            View Full Sample
                                        </button>

                                        {/* Squiggly line and Pen */}
                                        <div className="absolute right-0 bottom-0 flex items-end">
                                            <svg className="w-12 h-6 text-gray-400 transform -translate-x-1" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M5,25 Q15,10 25,25 T45,25 T65,25 T85,25" />
                                            </svg>
                                            <div className="transform rotate-[-30deg] text-[#1e5eb8] translate-y-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 20h9" stroke="none" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Right Chevron */}
                    <button
                        onClick={nextSlide}
                        className="absolute -right-2 md:-right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-800 transition-colors z-20"
                    >
                        <ChevronRight className="w-8 h-8 md:w-10 md:h-10 font-light" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Bottom View All Button */}
                <div className="flex justify-center mt-8">
                    <button onClick={onOpenAction} className="bg-[#ffcb05] hover:bg-[#eebc04] text-[#2d2d2d] font-bold text-[15px] px-8 py-3 rounded-[4px] shadow-sm transition-colors cursor-pointer">
                        View Free Samples Here!
                    </button>
                </div>

            </div>
        </section>
    );
};
