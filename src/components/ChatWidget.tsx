import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

// Floating help chat: a plain, Messages-style bubble that opens the embedded
// chat assistant.
export const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div data-chat-widget className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end pointer-events-none">
            {isOpen && (
                <div role="dialog" aria-label="Chat" className="pointer-events-auto mb-4 flex h-[550px] w-[350px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] animate-in fade-in slide-in-from-bottom-4 duration-300 sm:h-[620px] sm:w-[390px]">
                    <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#002147]">
                                <MessageCircle className="h-[18px] w-[18px] text-white" />
                            </span>
                            <div>
                                <p className="text-[15px] font-semibold text-gray-900">Chat with us</p>
                                <p className="text-xs text-gray-500">Automated assistant · ask anything</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} aria-label="Close chat"
                            className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200 hover:text-gray-900">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="relative flex-1 bg-white">
                        <iframe
                            src="https://chatwith.tools/embed/e5d4cbe0-c5b1-45eb-8240-4aa5fd4069c0"
                            className="absolute inset-0 h-full w-full border-0"
                            title="AssignmentMinds chat"
                            allow="microphone"
                        />
                    </div>
                </div>
            )}

            {!isOpen && (
                <button onClick={() => setIsOpen(true)} aria-label="Open chat"
                    className="pointer-events-auto group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#002147] text-white shadow-[0_10px_30px_-8px_rgba(0,33,71,0.6)] transition hover:scale-105 active:scale-95">
                    <MessageCircle className="h-6 w-6" />
                    <span className="pointer-events-none absolute right-[115%] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl bg-gray-900/90 px-3 py-2 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                        Chat with us
                    </span>
                </button>
            )}
        </div>
    );
};
