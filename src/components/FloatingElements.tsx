import React, { useState, useEffect } from 'react';
import { MessageCircle, Phone, FileSignature, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const FloatingElements: React.FC = () => {
    const [cookieConsent, setCookieConsent] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) {
            // slight delay
            const timer = setTimeout(() => setCookieConsent(true), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const acceptCookies = () => {
        localStorage.setItem('cookieConsent', 'true');
        setCookieConsent(false);
    };

    return (
        <>
            {/* WhatsApp Floating Bubble */}
            <a
                href="https://wa.me/1234567890"
                target="_blank"
                rel="noreferrer"
                className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-3.5 rounded-full shadow-lg hover:scale-110 transition-transform hidden md:flex items-center justify-center group"
            >
                <div className="absolute inset-0 bg-[#25D366] rounded-full animate-ping opacity-75"></div>
                <MessageCircle className="w-7 h-7 relative z-10" />
            </a>

            {/* Mobile Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-3 z-50 flex justify-around items-center md:hidden pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <button className="flex flex-col items-center gap-1 text-gray-500">
                    <Phone className="w-5 h-5 text-[#002147]" />
                    <span className="text-[10px] font-bold">Call Back</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-gray-500">
                    <MessageCircle className="w-5 h-5 text-[#25D366]" />
                    <span className="text-[10px] font-bold">Live Chat</span>
                </button>
                <button className="bg-[#fea520] text-[#000a1e] font-bold px-6 py-2.5 rounded-xl shadow-soft text-sm">
                    Order Now
                </button>
            </div>

            {/* Cookie Banner */}
            <AnimatePresence>
                {cookieConsent && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-6 md:right-auto md:max-w-sm bg-[#000a1e] text-white p-5 rounded-2xl z-50 shadow-glass border border-white/10"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <h4 className="font-bold">We value your privacy</h4>
                            <button onClick={() => setCookieConsent(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-300 mb-4 leading-relaxed">
                            We use cookies to improve your experience and analyze our traffic. By clicking "Accept", you consent to our use of cookies.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setCookieConsent(false)} className="flex-1 px-4 py-2 text-xs font-bold bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                                Decline
                            </button>
                            <button onClick={acceptCookies} className="flex-1 px-4 py-2 text-xs font-bold bg-[#fea520] text-[#000a1e] rounded-lg hover:bg-[#e36100] transition-colors">
                                Accept All
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
