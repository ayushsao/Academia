import React from 'react';
import { MessageCircle, Mail, Sparkles } from 'lucide-react';

export const TopUtilityBar: React.FC = () => {
    return (
        <div className="bg-[#1d1d1f] text-[#f5f5f7] py-2 px-4 w-full z-[60] relative border-b border-white/[0.06]">
            <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-[12px] tracking-[-0.01em]">
                <div className="flex items-center gap-5 text-[#a1a1a6]">
                    <a href="https://wa.me/919263606941" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors duration-300">
                        <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                        +91 92636 06941
                    </a>
                    <span className="w-px h-3 bg-white/15 hidden sm:block" />
                    <a href="mailto:support@assignmentminds.com" className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors duration-300">
                        <Mail className="w-3.5 h-3.5" strokeWidth={1.75} />
                        support@assignmentminds.com
                    </a>
                </div>
                <div className="flex items-center justify-center flex-wrap gap-x-2.5 gap-y-1 text-center w-full md:w-auto">
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#fea520] shrink-0">
                        <Sparkles className="w-3 h-3" strokeWidth={2} /> Limited offer
                    </span>
                    <span className="text-[#d2d2d7] shrink-0">Expert-crafted assignments, now</span>
                    <span className="font-semibold text-white bg-white/10 border border-white/10 rounded-full px-2.5 py-0.5 shrink-0">51% off</span>
                </div>
            </div>
        </div>
    );
};
