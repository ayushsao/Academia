import React from 'react';
import { Phone, Mail } from 'lucide-react';

export const TopUtilityBar: React.FC = () => {
    return (
        <div className="bg-[#e36100] text-white py-2 px-4 w-full z-[60] relative">
            <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-[13px]">
                <div className="flex items-center gap-5 text-white/90">
                    <a href="https://wa.me/919263606941" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                        <Phone className="w-3.5 h-3.5" />
                        +91 92636 06941
                    </a>
                    <span className="w-px h-3.5 bg-white/30 hidden sm:block" />
                    <a href="mailto:support@assignmentminds.com" className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors">
                        <Mail className="w-3.5 h-3.5" />
                        support@assignmentminds.com
                    </a>
                </div>
                <p className="text-center w-full md:w-auto">
                    Expert-crafted assignments, <span className="font-bold">save 51%</span>
                </p>
            </div>
        </div>
    );
};
