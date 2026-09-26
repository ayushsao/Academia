import React from 'react';
import { GraduationCap } from 'lucide-react';

export const TrustLogosMarquee: React.FC = () => {
    const universities = [
        'REGENT UNIVERSITY',
        'ACU Australian Catholic',
        'UNIVERSITY CANADA WEST',
        'UNIVERSITY OF CAMBRIDGE',
        'UNIVERSITY OF LIVERPOOL',
        'UNIVERSITY OF DUNDEE'
    ];

    return (
        <div className="bg-[#f6f6fa] py-14 overflow-hidden relative">
            <div className="max-w-[1300px] mx-auto px-4 md:px-8 relative hidden md:block">

                {/* Floating Pink Card Layout */}
                <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 w-80 bg-[#fea520] text-white p-5 rounded-2xl shadow-xl flex items-center gap-4">
                    <div className="shrink-0 text-white opacity-90 border-[1.5px] border-white/40 p-2 rounded-xl">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
                    </div>
                    <div>
                        <h4 className="font-bold text-[17px] mb-1">Trusted by 85,000 Students</h4>
                        <p className="text-[12px] text-white/90 leading-tight">connecting with over 4500 Trusted Experts.</p>
                    </div>
                </div>

                {/* Marquee Track Container (Has left padding so logos disappear behind the pink card) */}
                <div className="relative pl-[330px] flex overflow-x-hidden group items-center min-h-[80px]">
                    <div className="animate-marquee whitespace-nowrap flex items-center gap-14 cursor-default">
                        {[...universities, ...universities, ...universities].map((uni, index) => (
                            <div key={index} className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                                <GraduationCap className="w-6 h-6 text-[#2d2d2d]" />
                                <h3 className="text-xl md:text-2xl font-bold font-serif text-[#2d2d2d] uppercase tracking-tight">
                                    {uni}
                                </h3>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile View (No overlap, just stacked) */}
            <div className="md:hidden flex flex-col items-center">
                <div className="w-[90%] bg-[#fea520] text-white p-5 rounded-2xl shadow-md flex items-center gap-4 mb-8">
                    <div className="shrink-0 border-[1.5px] border-white/40 p-2 rounded-xl">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
                    </div>
                    <div>
                        <h4 className="font-bold text-[15px] mb-0.5">Trusted by 85,000 Students</h4>
                        <p className="text-[11px] text-white/90 leading-tight">connecting with over 4500 Trusted Experts.</p>
                    </div>
                </div>

                <div className="w-full relative flex overflow-x-hidden items-center group">
                    <div className="animate-marquee whitespace-nowrap flex items-center gap-10 pl-4 py-2">
                        {[...universities, ...universities].map((uni, index) => (
                            <div key={index} className="flex items-center gap-2 opacity-70">
                                <GraduationCap className="w-5 h-5 text-[#2d2d2d]" />
                                <h3 className="text-lg font-bold font-serif text-[#2d2d2d] uppercase tracking-tight">
                                    {uni}
                                </h3>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
};
