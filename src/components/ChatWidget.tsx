import React, { useState } from 'react';
import { MessageSquare, X, Sparkles } from 'lucide-react';

export const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
            {isOpen && (
                <div className="mb-4 bg-white/80 backdrop-blur-3xl rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)] overflow-hidden w-[350px] h-[550px] sm:w-[400px] sm:h-[650px] flex flex-col transition-all duration-300 transform origin-bottom-right">
                    {/* Apple-style sleek header */}
                    <div className="p-4 flex justify-between items-center border-b border-gray-200/50 bg-white/40">
                        <div className="flex items-center gap-3">
                            <div className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-semibold text-[15px] text-gray-900 tracking-tight leading-tight">AssignmentMinds Support</span>
                                <span className="text-[11px] font-medium text-gray-500 tracking-wide">ALWAYS ONLINE</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-gray-900 bg-gray-100/50 hover:bg-gray-200/70 p-2 rounded-full transition-all duration-200 focus:outline-none"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Chat Iframe embedded seamlessly */}
                    <div className="flex-1 w-full bg-transparent overflow-hidden">
                        <iframe
                            src="https://chatwith.tools/embed/e5d4cbe0-c5b1-45eb-8240-4aa5fd4069c0"
                            className="w-full h-full border-0 bg-transparent rounded-b-[28px]"
                            title="AssignmentMinds Chatbot"
                            allow="microphone"
                        />
                    </div>
                </div>
            )}

            {/* Apple-style floating action button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative group flex items-center justify-center w-16 h-16 rounded-full bg-black hover:bg-gray-900 text-white shadow-[0_10px_40px_rgba(0,0,0,0.15)] transition-all duration-300 hover:scale-105 overflow-hidden"
                    aria-label="Open Chat"
                >
                    {/* Animated gradient mesh simulating Apple Intelligence / Siri */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-purple-500 to-pink-500 blur-xl"></div>
                    <div className="absolute inset-0 opacity-20 group-hover:opacity-60 transition-opacity duration-500 bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 animate-spin-slow" style={{ animationDuration: '4s' }}></div>

                    <Sparkles className="w-7 h-7 relative z-10 opacity-0 group-hover:opacity-100 absolute transition-all duration-300 transform scale-0 group-hover:scale-100" />
                    <MessageSquare className="w-7 h-7 relative z-10 group-hover:opacity-0 transition-all duration-300 absolute" />

                    {/* Tooltip */}
                    <div className="absolute right-[110%] top-1/2 -translate-y-1/2 bg-black text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-[0_10px_20px_rgba(0,0,0,0.1)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap flex items-center mr-2">
                        Ask AI Assistant
                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-black transform rotate-45"></div>
                    </div>
                </button>
            )}
        </div>
    );
};
