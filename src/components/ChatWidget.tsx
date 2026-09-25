import React, { useState } from 'react';
import { MessageSquare, X, Sparkles, Bot } from 'lucide-react';

export const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div data-chat-widget className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end pointer-events-none">
            {isOpen && (
                <div className="pointer-events-auto mb-6 bg-white/70 backdrop-blur-3xl border border-white/50 rounded-[32px] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.4)_inset] overflow-hidden w-[350px] h-[550px] sm:w-[400px] sm:h-[650px] flex flex-col transition-all duration-500 animate-in fade-in slide-in-from-bottom-8">
                    {/* Apple Intelligence style header */}
                    <div className="relative p-5 flex justify-between items-center bg-white/40 border-b border-gray-100/30">
                        {/* Subtle animated gradient background in header */}
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-400 via-purple-400 to-transparent"></div>

                        <div className="relative z-10 flex items-center gap-4">
                            {/* Glowing Siri-like ring avatar */}
                            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[2px] shadow-sm">
                                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-md opacity-60 animate-pulse"></div>
                                <div className="w-full h-full bg-white rounded-full flex items-center justify-center relative z-10">
                                    <Sparkles className="w-4 h-4 text-purple-600" />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-[16px] text-gray-900 tracking-tight leading-tight">AI Assistant</span>
                                <span className="text-[12px] font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 tracking-wide flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span> Intelligent Support
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="relative z-10 text-gray-500 hover:text-gray-900 bg-white/50 hover:bg-white p-2.5 rounded-full transition-all duration-300 shadow-sm focus:outline-none backdrop-blur-md border border-gray-200/50 hover:scale-105"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Chat Iframe embedded seamlessly */}
                    <div className="flex-1 w-full bg-white/50 overflow-hidden relative">
                        <iframe
                            src="https://chatwith.tools/embed/e5d4cbe0-c5b1-45eb-8240-4aa5fd4069c0"
                            className="absolute inset-0 w-full h-full border-0 bg-transparent rounded-b-[32px]"
                            title="AssignmentMinds Chatbot"
                            allow="microphone"
                        />
                    </div>
                </div>
            )}

            {/* Apple Intelligence style glowing orb button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="pointer-events-auto relative group flex items-center justify-center w-16 h-16 rounded-full outline-none transition-transform duration-500 hover:scale-105 active:scale-95"
                    aria-label="Open AI Assistant"
                >
                    {/* Glass backdrop */}
                    <div className="absolute inset-0 rounded-full bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"></div>

                    {/* Apple Intelligence glowing mesh effect */}
                    <div className="absolute inset-[-4px] rounded-full mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[10px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-[spin_4s_linear_infinite]"></div>
                    <div className="absolute inset-[2px] rounded-full mix-blend-screen opacity-60 group-hover:opacity-100 transition-opacity duration-700 blur-[4px] bg-gradient-to-tr from-blue-400 via-indigo-500 to-purple-500 animate-[spin_3s_linear_infinite_reverse]"></div>

                    {/* Center dark core to hide iframe/internal details */}
                    <div className="absolute inset-1 rounded-full bg-black z-10 flex items-center justify-center overflow-hidden">
                        {/* Dynamic Icons */}
                        <div className="relative w-full h-full flex items-center justify-center">
                            <Sparkles className="absolute w-7 h-7 text-white opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-20" />
                            <Bot className="absolute w-7 h-7 text-white opacity-100 group-hover:opacity-0 scale-100 group-hover:scale-50 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-20" />
                        </div>
                    </div>

                    {/* Tooltip */}
                    <div className="absolute right-[115%] top-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-lg border border-white/10 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-500 pointer-events-none whitespace-nowrap flex items-center mr-2 z-30">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400 mr-2" />
                        Ask AI Assistant
                    </div>
                </button>
            )}
        </div>
    );
};
