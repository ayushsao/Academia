import React from 'react';
import { Phone, Mail } from 'lucide-react';

export const TopUtilityBar: React.FC = () => {
    return (
        <div className="bg-[#e36100] text-white py-1.5 px-4 shadow-sm w-full z-[60] relative">
            <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-[13px] font-medium tracking-wide">
                <div className="flex items-center gap-6">
                    <a href="https://wa.me/919263606941" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-4 h-4" />
                        +91 92636 06941
                    </a>
                    <div className="w-px h-4 bg-white/30 hidden sm:block"></div>
                    <a href="mailto:assignmentminds@gmail.com" className="flex items-center gap-2 hover:opacity-80 transition-opacity hidden sm:flex">
                        <Mail className="w-4 h-4" />
                        assignmentminds@gmail.com
                    </a>
                </div>
                <div className="flex items-center justify-center flex-wrap gap-2 text-[11px] sm:text-[13px] text-center w-full md:w-auto">
                    <span className="bg-yellow-400 text-red-700 font-bold px-2 py-0.5 rounded-sm text-[10px] sm:text-[11px] uppercase flex items-center gap-1 shadow-sm shrink-0">
                        OFFERS! <span className="rotate-12 bg-red-600 text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px]">%</span>
                    </span>
                    <span className="whitespace-nowrap shrink-0">Get Expert-crafted assignments &</span>
                    <span className="bg-white font-semibold px-2 py-0.5 rounded-sm text-[#c2410c] shrink-0">Save 51%</span>
                </div>
            </div>
        </div>
    );
};
