import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Scissors } from 'lucide-react';
import { useStore } from '../store/useStore';

export const PopupFunnel: React.FC = () => {
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const user = useStore(state => state.user);

    useEffect(() => {
        // Only trigger once per session
        const seen = sessionStorage.getItem('promoPopupSeen');
        if (seen || user) return;

        let idleTimer: ReturnType<typeof setTimeout>;

        const resetIdleTimer = () => {
            clearTimeout(idleTimer);
            // Trigger popup after 12 seconds of zero interaction
            idleTimer = setTimeout(() => {
                setIsVisible(true);
                sessionStorage.setItem('promoPopupSeen', 'true');
            }, 12000);
        };

        // Listen for standard user interactions
        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

        events.forEach(event => {
            document.addEventListener(event, resetIdleTimer, { passive: true });
        });

        // Initialize timer
        resetIdleTimer();

        // Cleanup event listeners
        return () => {
            clearTimeout(idleTimer);
            events.forEach(event => {
                document.removeEventListener(event, resetIdleTimer);
            });
        };
    }, []);

    const closePopup = () => setIsVisible(false);

    // Completely hide if user is logged in
    if (user) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Dark Dimmed Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[#111111]/80 backdrop-blur-sm"
                        onClick={closePopup}
                    />

                    {/* Main Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-[850px] bg-gradient-to-br from-[#f0fdfa]/50 via-white to-[#fdf2f8]/80 rounded-[20px] overflow-hidden flex flex-col md:flex-row shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
                    >

                        {/* Close Button Top Right */}
                        <button
                            onClick={closePopup}
                            className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-transparent border border-gray-400 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Left Pane - Promo Card */}
                        <div className="w-full md:w-[45%] p-6 md:p-8 flex items-center justify-center relative">
                            {/* Glowing Gradient Wrapper */}
                            <div className="bg-gradient-to-br from-[#7dd3fc] to-[#f472b6] p-[2px] rounded-[16px] w-full max-w-[340px] shadow-[0_0_30px_rgba(236,72,153,0.3)] relative">
                                <div className="bg-white rounded-[14px] p-6 h-full flex flex-col items-center text-center relative overflow-hidden">

                                    <h2 className="text-[22px] font-extrabold text-[#111] leading-tight mb-1">
                                        Grab your seasonal deal <span className="text-[#fea520]">NOW!</span>
                                    </h2>
                                    <p className="text-[12px] font-bold text-gray-600 mb-6">
                                        Massive <span className="text-[#fea520]">Discounts</span> + Top-Quality <span className="text-[#fea520]">Assignments</span>
                                    </p>

                                    {/* Offer Text */}
                                    <div className="relative w-full flex flex-col items-center justify-center mb-6 mt-2">
                                        <span className="text-[14px] font-bold text-gray-700">Get Up to</span>
                                        <span className="text-[42px] font-black text-[#fea520] leading-none drop-shadow-sm mt-1">51% OFF</span>
                                    </div>

                                    {/* Promocode Box */}
                                    <div className="relative w-full mb-4">
                                        <div className="bg-[#fea520] text-white font-bold text-[15px] py-2.5 px-4 rounded-[6px] border-2 border-dashed border-white shadow-[0_0_0_2px_#fea520] tracking-wider w-[90%] flex items-center justify-center mx-auto">
                                            Use Code : INSTANT25
                                        </div>
                                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 bg-white rounded-full p-1 shadow-sm border border-gray-100 z-10 rotate-90">
                                            <Scissors className="w-5 h-5 text-gray-600" />
                                        </div>
                                    </div>

                                    {/* Claim Button */}
                                    <button className="w-[90%] bg-[#ffcb05] text-[#222] font-black py-3 rounded-[12px] text-[16px] hover:bg-[#f5b800] transition-colors uppercase tracking-tight shadow-md">
                                        Claim Now
                                    </button>

                                </div>
                            </div>
                        </div>

                        {/* Right Pane - Marketing CTA Instead of Fake Login */}
                        <div className="w-full md:w-[55%] p-8 md:p-12 flex flex-col justify-center text-center">

                            <h3 className="text-[26px] font-bold text-[#222] mb-3">
                                Ready to secure your grade?
                            </h3>
                            <p className="text-[14px] text-gray-500 mb-8 font-medium px-4">
                                Our top-rated academic experts are standing by. Apply your discount code at checkout and elevate your academics instantly.
                            </p>

                            <div className="w-full max-w-[360px] mx-auto flex flex-col gap-4 mb-6">
                                <button
                                    onClick={() => {
                                        closePopup();
                                        // Dispatch a standard custom event that Home.tsx listens to
                                        window.dispatchEvent(new CustomEvent('open-order-modal'));
                                    }}
                                    className="w-full bg-[#fea520] text-white font-bold py-4 rounded-xl text-[16px] hover:bg-[#b02c53] transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform duration-200"
                                >
                                    Claim Discount & Order Now
                                </button>

                                <button
                                    onClick={closePopup}
                                    className="w-full bg-white text-gray-500 font-bold py-3.5 rounded-xl text-[14px] hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
                                >
                                    Maybe Later
                                </button>
                            </div>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
