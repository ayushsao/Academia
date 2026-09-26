import React from 'react';
import { X, ArrowRight, CheckCircle, BookOpen } from 'lucide-react';
import { Discipline } from '../types';

interface DisciplineModalProps {
  discipline: Discipline | null;
  onClose: () => void;
  onStartOrderForDiscipline: (disciplineTitle: string) => void;
}

export const DisciplineModal: React.FC<DisciplineModalProps> = ({
  discipline,
  onClose,
  onStartOrderForDiscipline,
}) => {
  if (!discipline) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#000a1e]/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-white/80 w-full max-w-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Cover image header */}
        <div className="relative h-48 sm:h-56">
          <img loading="lazy" decoding="async"
            src={discipline.image}
            alt={discipline.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#000a1e] via-[#000a1e]/60 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 backdrop-blur-sm transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-6 left-6 text-white">
            <span className="text-xs font-bold text-[#fea520] tracking-wider uppercase">
              Academic Field
            </span>
            <h3 className="text-3xl font-bold text-white mt-0.5">{discipline.title}</h3>
            <p className="text-xs text-white/80">{discipline.subtitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <h4 className="text-sm font-bold text-[#000a1e] uppercase tracking-wide mb-3">
              Specialized Core Sub-Disciplines
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {discipline.topics.map((topic, i) => (
                <div key={i} className="flex items-center gap-2.5 p-3 rounded-xl bg-[#f8f9ff] border border-[#d1e4ff] text-xs font-semibold text-[#000a1e]">
                  <CheckCircle className="w-4 h-4 text-[#1d1d1f] flex-shrink-0" />
                  <span>{topic}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[#000a1e] uppercase tracking-wide mb-3">
              Representative Module Syllabi & Papers Supported
            </h4>
            <div className="flex flex-wrap gap-2">
              {discipline.popularCourses.map((course, i) => (
                <span key={i} className="px-3 py-1.5 bg-[#e4efff] text-[#002147] rounded-lg text-xs font-medium flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#fea520]" />
                  {course}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#d1e4ff] flex justify-between items-center">
            <div>
              <span className="text-xs text-[#708ab5] block">Average Consultant Rating</span>
              <span className="text-sm font-bold text-[#000a1e]">4.95 / 5.0 (3,400+ papers)</span>
            </div>
            <button
              onClick={() => {
                onStartOrderForDiscipline(discipline.title);
                onClose();
              }}
              className="bg-[#000a1e] text-white hover:bg-[#002147] px-6 py-3 rounded-xl text-xs font-bold shadow-soft flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>Commission {discipline.title} Paper</span>
              <ArrowRight className="w-4 h-4 text-[#fea520]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
