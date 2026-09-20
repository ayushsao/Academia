import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToolType = 'essay-grader' | 'plagiarism-checker' | 'citation-generator';

interface AcademicToolsSectionProps {
  onOpenTool: (toolType: ToolType) => void;
}

export const AcademicToolsSection: React.FC<AcademicToolsSectionProps> = ({ onOpenTool }) => {
  // Simple simulated carousel state
  const [startIndex, setStartIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const tools = [
    {
      id: 'plagiarism-checker',
      title: 'Plagiarism Tool',
      desc: 'Check your work against plagiarism & get a free Turnitin report!',
      image: 'https://images.pexels.com/photos/5989925/pexels-photo-5989925.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      id: 'essay-grader',
      title: 'Essay Typer Tool',
      desc: 'Generate plagiarism-free essays as per your topic\'s requirement!',
      image: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      id: 'grammar-checker',
      title: 'Grammar Checker',
      desc: 'Make your content free of errors in just a few clicks for free!',
      image: 'https://images.pexels.com/photos/4145153/pexels-photo-4145153.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      id: 'citation-generator',
      title: 'Citation Generator',
      desc: 'Automatically format your references in APA, MLA & Harvard styles.',
      image: 'https://images.pexels.com/photos/699459/pexels-photo-699459.jpeg?auto=compress&cs=tinysrgb&w=800'
    }
  ];

  const nextSlide = () => {
    setStartIndex((prev) => (prev + 1) % tools.length);
  };

  const prevSlide = () => {
    setStartIndex((prev) => (prev - 1 + tools.length) % tools.length);
  };

  // Auto-scroll logic
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isAutoPlaying) {
      intervalId = setInterval(() => {
        nextSlide();
      }, 3500); // 3.5 seconds
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoPlaying]);

  // Get current 3 visible items wrapped
  const visibleTools = [
    tools[startIndex % tools.length],
    tools[(startIndex + 1) % tools.length],
    tools[(startIndex + 2) % tools.length],
  ];

  return (
    <section
      id="academic-tools-section"
      className="py-20 md:py-24 bg-white relative"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      <div className="max-w-[1250px] mx-auto px-4 relative">

        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-[24px] md:text-[28px] lg:text-[32px] font-bold text-[#2d2d2d] mb-4 tracking-tight">
            Our FREE Tools That Make Academic Journey Easier!
          </h2>
          <div className="relative w-64 h-[1px] bg-[#fea520]/30 flex justify-center mx-auto">
            <div className="absolute top-1/2 -translate-y-1/2 w-10 h-1 bg-[#fea520]"></div>
          </div>
        </div>

        <div className="relative w-full flex items-center justify-center">

          {/* Floating Left Arrow */}
          <button
            onClick={prevSlide}
            className="absolute -left-2 md:-left-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-11 md:h-11 bg-[#fea520] hover:bg-[#b02b52] rounded-full flex items-center justify-center text-white z-20 shadow-[0_5px_15px_rgba(213,56,103,0.3)] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 ml-0.5" />
          </button>

          {/* Cards Viewport */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 px-6 md:px-8">
            {visibleTools.map((tool, index) => (
              <motion.div
                key={`${tool.id}-${index}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-[15px] border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-shadow overflow-hidden flex flex-col cursor-pointer"
                onClick={() => onOpenTool(tool.id as ToolType)}
              >
                {/* Top Image Section */}
                <div className="w-full h-48 md:h-[200px] overflow-hidden p-3 pb-0">
                  <img
                    src={tool.image}
                    alt={tool.title}
                    className="w-full h-full object-cover rounded-[10px]"
                  />
                </div>

                {/* Bottom Details */}
                <div className="p-5 md:p-6 flex flex-col flex-1">
                  <h3 className="text-[19px] md:text-[21px] font-bold text-[#2d2d2d] mb-2">{tool.title}</h3>
                  <p className="text-[13px] md:text-[14px] text-[#555] leading-relaxed mb-6 flex-1">
                    {tool.desc}
                  </p>
                  <span className="text-[#fea520] text-[13.5px] font-semibold flex items-center gap-1 group">
                    Check Now <ArrowUpRight className="w-4 h-4 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Floating Right Arrow */}
          <button
            onClick={nextSlide}
            className="absolute -right-2 md:-right-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-11 md:h-11 bg-[#fea520] hover:bg-[#b02b52] rounded-full flex items-center justify-center text-white z-20 shadow-[0_5px_15px_rgba(213,56,103,0.3)] transition-colors"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 mr-0.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
