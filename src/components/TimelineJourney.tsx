import React, { useState } from 'react';
import { UploadCloud, CreditCard, CheckCircle, ArrowRight, FileText, Lock, Award } from 'lucide-react';
import { motion } from 'framer-motion';

interface TimelineJourneyProps {
  onStartOrder: () => void;
}

export const TimelineJourney: React.FC<TimelineJourneyProps> = ({ onStartOrder }) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    {
      id: 1,
      title: '1. Provide your instructions',
      desc: 'Upload your assignment details, rubrics, and any required reading lists. Our system keeps all your files organized.',
      icon: UploadCloud,
      badge: 'Step 1: Details',
      subtext: 'Secure document upload'
    },
    {
      id: 2,
      title: '2. Payment & Writer Match',
      desc: 'Make a secure payment, and we will assign your task to an experienced writer specialized in your subject.',
      icon: CreditCard,
      badge: 'Step 2: Match',
      subtext: 'Payment held until you approve'
    },
    {
      id: 3,
      title: '3. Receive your work',
      desc: 'Download your completed assignment alongside a free originality report directly from your dashboard.',
      icon: CheckCircle,
      badge: 'Step 3: Delivery',
      subtext: 'Originality checked • Free revisions'
    },
  ];

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  return (
    <section id="how-it-works-section" className="py-24 md:py-32 bg-[#f8f9ff] relative overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-4 md:px-10 lg:px-20 relative">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUpVariant}
          className="text-center mb-16 md:mb-24 relative z-10"
        >
          <h2 className="text-3xl md:text-4xl lg:text-[40px] font-bold text-[#000a1e] mb-4 tracking-tight">
            How It Works
          </h2>
          <p className="text-base md:text-lg text-[#44474e] max-w-2xl mx-auto">
            Three simple steps to get the reliable academic help you need.
          </p>
        </motion.div>

        {/* Desktop Interactive Timeline */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="relative max-w-4xl mx-auto hidden md:block min-h-[460px]"
        >
          {/* Vertical Timeline Central Line */}
          <div className="absolute left-1/2 top-4 bottom-12 -translate-x-1/2 w-0.5 bg-gradient-to-b from-[#d1e4ff] via-[#002147] to-[#d1e4ff] z-0" />

          {/* Step 1 */}
          <motion.div
            variants={fadeUpVariant}
            onClick={() => setActiveStep(1)}
            className={`cursor-pointer transition-all duration-300 ${activeStep === 1 ? 'scale-[1.02]' : 'opacity-80'}`}
          >
            <div className="absolute left-0 top-0 w-[45%] text-right pr-12">
              <span className="text-xs font-bold text-[#fea520] tracking-wider uppercase">Stage 01</span>
              <h3 className="text-xl font-bold text-[#000a1e] mt-1 mb-2">1. Provide your instructions</h3>
              <p className="text-sm text-[#44474e] leading-relaxed">
                Upload your assignment details, rubrics, and any required reading lists. Our system keeps all your files organized.
              </p>
              <div className="mt-2 text-xs font-semibold text-[#708ab5] flex items-center justify-end gap-1">
                <FileText className="w-3.5 h-3.5" /> PDF, DOCX, LaTeX, SPSS formats
              </div>
            </div>
            <div className={`absolute left-1/2 top-0 -translate-x-1/2 w-16 h-16 rounded-full border-4 shadow-md flex items-center justify-center z-10 transition-all ${activeStep === 1
              ? 'bg-[#000a1e] text-white border-[#fea520]'
              : 'bg-white text-[#000a1e] border-[#d1e4ff]'
              }`}>
              <UploadCloud className="w-7 h-7" />
            </div>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            variants={fadeUpVariant}
            onClick={() => setActiveStep(2)}
            className={`cursor-pointer transition-all duration-300 ${activeStep === 2 ? 'scale-[1.02]' : 'opacity-80'}`}
          >
            <div className="absolute right-0 top-[150px] w-[45%] text-left pl-12">
              <span className="text-xs font-bold text-[#fea520] tracking-wider uppercase">Stage 02</span>
              <h3 className="text-xl font-bold text-[#000a1e] mt-1 mb-2">2. Payment & Writer Match</h3>
              <p className="text-sm text-[#44474e] leading-relaxed">
                Make a secure payment, and we will assign your task to an experienced writer specialized in your subject.
              </p>
              <div className="mt-2 text-xs font-semibold text-[#708ab5] flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-emerald-600" /> Payment held until you approve
              </div>
            </div>
            <div className={`absolute left-1/2 top-[150px] -translate-x-1/2 w-16 h-16 rounded-full border-4 shadow-md flex items-center justify-center z-10 transition-all ${activeStep === 2
              ? 'bg-[#000a1e] text-white border-[#fea520]'
              : 'bg-white text-[#000a1e] border-[#d1e4ff]'
              }`}>
              <CreditCard className="w-7 h-7" />
            </div>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            variants={fadeUpVariant}
            onClick={() => setActiveStep(3)}
            className={`cursor-pointer transition-all duration-300 ${activeStep === 3 ? 'scale-[1.02]' : 'opacity-80'}`}
          >
            <div className="absolute left-0 top-[300px] w-[45%] text-right pr-12">
              <span className="text-xs font-bold text-[#fea520] tracking-wider uppercase">Stage 03</span>
              <h3 className="text-xl font-bold text-[#000a1e] mt-1 mb-2">3. Receive your work</h3>
              <p className="text-sm text-[#44474e] leading-relaxed">
                Download your completed assignment alongside a free originality report directly from your dashboard.
              </p>
              <div className="mt-2 text-xs font-semibold text-[#708ab5] flex items-center justify-end gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Free originality checks
              </div>
            </div>
            <div className={`absolute left-1/2 top-[300px] -translate-x-1/2 w-16 h-16 rounded-full border-4 shadow-md flex items-center justify-center z-10 transition-all ${activeStep === 3
              ? 'bg-[#000a1e] text-white border-[#fea520]'
              : 'bg-[#000a1e] text-white border-[#002147]'
              }`}>
              <CheckCircle className="w-7 h-7 text-[#fea520]" />
            </div>
          </motion.div>
        </motion.div>

        {/* Mobile Timeline Cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col gap-8 md:hidden"
        >
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                variants={fadeUpVariant}
                key={step.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-[#d1e4ff] flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-[#e4efff] rounded-2xl flex items-center justify-center mb-4 text-[#002147]">
                  <Icon className="w-8 h-8" />
                </div>
                <span className="text-xs font-bold text-[#fea520] uppercase tracking-wider mb-1">
                  {step.badge}
                </span>
                <h3 className="text-xl font-bold text-[#000a1e] mb-2">{step.title}</h3>
                <p className="text-sm text-[#44474e] leading-relaxed mb-3">{step.desc}</p>
                <span className="text-xs text-[#708ab5] font-medium">{step.subtext}</span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Action Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          className="mt-14 md:mt-24 text-center relative z-10"
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
