import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import HowItWorks, { Step } from './ui/how-it-works';

interface TimelineJourneyProps {
  onStartOrder: () => void;
}

export const TimelineJourney: React.FC<TimelineJourneyProps> = ({ onStartOrder }) => {
  const steps: Step[] = [
    {
      title: '1. Provide your instructions',
      description: 'Upload your assignment details, rubrics, and any required reading lists. Our system keeps all your files organized.',
      colorTheme: 'orange',
    },
    {
      title: '2. Payment & Writer Match',
      description: 'Make a secure payment, and we will assign your task to an experienced writer specialized in your subject.',
      colorTheme: 'blue',
    },
    {
      title: '3. Receive your work',
      description: 'Download your completed assignment alongside a free originality report directly from your dashboard.',
      colorTheme: 'purple',
    },
  ];

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <section id="how-it-works-section" className="py-24 md:py-32 bg-white relative overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-4 relative">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUpVariant}
          className="text-center mb-8 relative z-10"
        >
          <h2 className="text-3xl md:text-4xl lg:text-[40px] font-bold text-[#000a1e] mb-4 tracking-tight">
            How It Works
          </h2>
          <p className="text-base md:text-lg text-[#44474e] max-w-2xl mx-auto">
            Three simple steps to get the reliable academic help you need.
          </p>
        </motion.div>

        {/* Shadcn UI Generated Component */}
        <HowItWorks features={steps} className="bg-transparent" />

        {/* Action Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          className="mt-6 md:mt-10 text-center relative z-10"
        >
          <button
            onClick={onStartOrder}
            className="bg-[#000a1e] text-white hover:bg-[#002147] px-10 py-4 rounded-xl text-base font-bold shadow-soft hover:-translate-y-0.5 transition-all duration-300 inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Start Your Order</span>
            <ArrowRight className="w-5 h-5 text-[#fea520]" />
          </button>
        </motion.div>
      </div>
    </section>
  );
};
