import React from 'react';
import { motion } from 'framer-motion';
import {
  ListChecks, Workflow, Cpu, Plane, Handshake, Landmark, Scale, TrendingUp, ScrollText,
  BriefcaseBusiness, Stethoscope, Brain, Database,
} from 'lucide-react';

// One Lucide icon per subject, chosen for what the subject is about.
const SubjectIcon = {
  Ops: Workflow, IT: Cpu, Travel: Plane, CRM: Handshake, PolSci: Landmark, Law: Scale,
  Finance: TrendingUp, History: ScrollText, MBA: BriefcaseBusiness, Nursing: Stethoscope,
  Psychology: Brain, Database: Database,
};

interface DisciplinesProps {
  onSelectDiscipline: (discipline: any) => void;
  onViewAll?: () => void;
}

export const Disciplines: React.FC<DisciplinesProps> = ({ onSelectDiscipline }) => {

  const col1Modules = [
    { title: 'Operation Management', icon: SubjectIcon.Ops, iconColor: 'text-[#f5a623]', bgColor: 'bg-[#fff7e6]' },
    { title: 'Travel & Tourism', icon: SubjectIcon.Travel, iconColor: 'text-[#4a90e2]', bgColor: 'bg-[#eef5fd]' },
    { title: 'Political Science', icon: SubjectIcon.PolSci, iconColor: 'text-[#f76b6b]', bgColor: 'bg-[#fdeaea]' },
    { title: 'Finance', icon: SubjectIcon.Finance, iconColor: 'text-[#fea520]', bgColor: 'bg-[#fce8ed]' },
    { title: 'MBA', icon: SubjectIcon.MBA, iconColor: 'text-[#4ed572]', bgColor: 'bg-[#f0fcf3]' },
    { title: 'Psychology', icon: SubjectIcon.Psychology, iconColor: 'text-[#f89b4b]', bgColor: 'bg-[#fff6ef]' },
  ];

  const col2Modules = [
    { title: 'Information Technology', icon: SubjectIcon.IT, iconColor: 'text-[#fea520]', bgColor: 'bg-[#fce8ed]' },
    { title: 'CRM', icon: SubjectIcon.CRM, iconColor: 'text-[#6c757d]', bgColor: 'bg-[#f1f3f5]' },
    { title: 'Law', icon: SubjectIcon.Law, iconColor: 'text-[#ff8a65]', bgColor: 'bg-[#fff3f0]' },
    { title: 'History', icon: SubjectIcon.History, iconColor: 'text-[#f07b5a]', bgColor: 'bg-[#fff3f0]' },
    { title: 'Nursing', icon: SubjectIcon.Nursing, iconColor: 'text-[#64b5f6]', bgColor: 'bg-[#eff7ff]' },
    { title: 'Database', icon: SubjectIcon.Database, iconColor: 'text-[#ffb74d]', bgColor: 'bg-[#fff8f0]' },
  ];

  // Helper to render columns
  const renderColumn = (modules: typeof col1Modules, animationClass: string) => {
    // Triple the list to ensure totally seamless infinite vertical scrolling
    const infiniteList = [...modules, ...modules, ...modules];

    return (
      <div className="relative h-[480px] overflow-hidden w-full flex-1 mask-vertical-fades">
        <div className={`flex flex-col gap-4 w-full ${animationClass}`}>
          {infiniteList.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <div
                key={i}
                onClick={() => onSelectDiscipline({ name: mod.title, code: '', icon: '', description: '' })}
                className="bg-white border border-gray-100 rounded-[14px] p-4 md:p-5 shadow-[0_2px_12px_rgb(0,0,0,0.03)] hover:shadow-[0_6px_20px_rgb(0,0,0,0.08)] transition-all flex items-center gap-4 cursor-pointer min-h-[90px] w-full group"
              >
                <div className={`w-[54px] h-[54px] rounded-[16px] flex items-center justify-center shrink-0 ${mod.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                  <div className={`${mod.iconColor}`}>
                    <Icon className="w-[26px] h-[26px]" strokeWidth={1.6} aria-hidden="true" />
                  </div>
                </div>
                <h4 className="font-bold text-[#353535] text-[15.5px] leading-tight pr-2">
                  {mod.title}
                </h4>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="py-20 md:py-24 bg-white relative">
      <div className="max-w-[1200px] mx-auto px-4">

        {/* Header (Matching Reference Design) */}
        <div className="text-center mb-16">
          <h2 className="text-[26px] md:text-[32px] lg:text-[34px] font-bold text-[#2d2d2d] mb-3 tracking-tight">
            Modules Covered By Our Expert Writers
          </h2>
          <p className="text-sm md:text-[15px] text-gray-600 mb-5 font-medium">
            We Provide Top-Class Assistance in Following Modules
          </p>
          <div className="relative w-[320px] h-[1px] bg-[#fea520]/30 flex justify-center mx-auto">
            <div className="absolute top-1/2 -translate-y-1/2 w-14 h-1 bg-[#fea520]"></div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

          {/* Left Column (Image & Badges) */}
          <div className="flex-1 w-full relative max-w-[500px] mx-auto lg:mx-0">

            {/* Back decor */}
            <div className="absolute -inset-4 bg-[#f4f7fc] rounded-[3rem] -z-10 rotate-3"></div>

            <div className="relative bg-white rounded-[2rem] p-3 shadow-lg border border-gray-50">
              {/* Main Cover Image */}
              <img loading="lazy" decoding="async"
                src="https://images.pexels.com/photos/1758144/pexels-photo-1758144.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Graduation Student"
                className="w-full h-[450px] object-cover rounded-[1.5rem]"
              />

              {/* Top Right Floating Badge */}
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                className="absolute top-8 -right-3 md:-right-6 bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center border border-pink-50"
              >
                <div className="w-10 h-10 rounded-xl bg-[#fff1f4] flex items-center justify-center text-[#fea520]">
                  <ListChecks className="w-5 h-5" />
                </div>
              </motion.div>

              {/* Bottom Left Floating Badge */}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                className="absolute bottom-10 -left-6 md:-left-8 bg-white p-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-3 border border-gray-50 pr-6"
              >
                {/* Circular Progress Mockup */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-gray-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-[#fea520]" strokeDasharray="90, 100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span className="absolute text-[10px] font-bold text-gray-700">90%</span>
                </div>
                <div className="leading-tight">
                  <p className="text-[13px] font-bold text-[#1a1a1a]">Success</p>
                  <p className="text-[13px] font-bold text-[#1a1a1a]">Result</p>
                </div>
              </motion.div>

            </div>
          </div>

          {/* Right Column (Double Vertical Marquee) */}
          <div className="flex-1 w-full flex gap-4 md:gap-6 relative">
            {renderColumn(col1Modules, 'animate-marquee-vertical-up')}
            {renderColumn(col2Modules, 'animate-marquee-vertical-down')}
          </div>

        </div>
      </div>

      <style>{`
        .mask-vertical-fades {
           mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
           -webkit-mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
        }

        .animate-marquee-vertical-up {
           animation: scroll-up 25s linear infinite;
        }
        
        .animate-marquee-vertical-down {
           animation: scroll-down 25s linear infinite;
        }

        .animate-marquee-vertical-up:hover,
        .animate-marquee-vertical-down:hover {
           animation-play-state: paused;
        }

        @keyframes scroll-up {
           0% { transform: translateY(0%); }
           100% { transform: translateY(-33.3333%); }
        }

        @keyframes scroll-down {
           0% { transform: translateY(-33.3333%); }
           100% { transform: translateY(0%); }
        }
      `}</style>
    </section>
  );
};
