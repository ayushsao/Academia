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
                                        Grab your seasonal deal <span className="text-[#d53867]">NOW!</span>
                                    </h2>
                                    <p className="text-[12px] font-bold text-gray-600 mb-6">
                                        Massive <span className="text-[#d53867]">Discounts</span> + Top-Quality <span className="text-[#d53867]">Assignments</span>
                                    </p>

                                    {/* Offer Text */}
                                    <div className="relative w-full flex flex-col items-center justify-center mb-6 mt-2">
                                        <span className="text-[14px] font-bold text-gray-700">Get Up to</span>
                                        <span className="text-[42px] font-black text-[#d53867] leading-none drop-shadow-sm mt-1">51% OFF</span>
                                    </div>

                                    {/* Promocode Box */}
                                    <div className="relative w-full mb-4">
                                        <div className="bg-[#d53867] text-white font-bold text-[15px] py-2.5 px-4 rounded-[6px] border-2 border-dashed border-white shadow-[0_0_0_2px_#d53867] tracking-wider w-[90%] flex items-center justify-center mx-auto">
                                            Use Code : INSTANT25
                                        </div>
                                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 bg-white rounded-full p-1 shadow-sm border border-gray-100 z-10 rotate-90">
                                            <Scissors className="w-5 h-5 text-gray-600" />
                                        </div>
                                    </div>

                                    {/* Claim Button */}
                                    <button className="w-[90%] bg-[#ffcb05] text-[#222] font-black py-3 rounded-[6px] text-[16px] hover:bg-[#f5b800] transition-colors uppercase tracking-tight shadow-md">
                                        Claim Now
                                    </button>

                                </div>
                            </div>
                        </div>

                        {/* Right Pane - Form */}
                        <div className="w-full md:w-[55%] p-8 md:p-12 flex flex-col justify-center text-center">

                            <h3 className="text-[26px] font-bold text-[#222] mb-1">
                                Login/ Sign up
                            </h3>
                            <p className="text-[12px] text-gray-500 mb-8 font-medium px-4">
                                Login or Sign Up With Your Email to Complete the Order Process
                            </p>

                            <div className="w-full max-w-[360px] mx-auto flex flex-col gap-4 mb-6">
                                <input
                                    type="email"
                                    placeholder="Enter Email Id"
                                    className="w-full border border-gray-300 rounded-[5px] px-4 py-3.5 text-[14px] outline-none focus:border-[#d53867] transition-colors shadow-[0_2px_10px_rgb(0,0,0,0.02)]"
                                />

                                <button className="w-full bg-[#d53867] text-white font-bold py-3.5 rounded-[5px] text-[15px] hover:bg-[#b02c53] transition-colors shadow-md">
                                    Continue With Email
                                </button>
                            </div>

                            {/* Or continue with */}
                            <div className="flex items-center gap-3 w-full max-w-[360px] mx-auto mb-6">
                                <div className="h-px bg-gray-200 flex-1"></div>
                                <span className="text-[12px] text-gray-400 font-medium">Or Continue with</span>
                                <div className="h-px bg-gray-200 flex-1"></div>
                            </div>

                            {/* Social Logins */}
                            <div className="flex gap-4 w-full max-w-[360px] mx-auto mb-8">
                                <button className="flex-1 flex items-center justify-center gap-2 border border-gray-200 bg-white py-3 rounded-[5px] hover:bg-gray-50 transition-colors shadow-sm text-[13px] font-semibold text-gray-600">
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Google
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-2 border border-gray-200 bg-white py-3 rounded-[5px] hover:bg-gray-50 transition-colors shadow-sm text-[13px] font-semibold text-gray-600">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#1877F2]" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                    </svg>
                                    Facebook
                                </button>
                            </div>

                            <p className="text-[10px] text-gray-400 leading-relaxed text-left w-full max-w-[360px] mx-auto">
                                By clicking 'Continue with Email', you agree to our terms of service and privacy policy. We'll occasionally send you promo and account related email.
                            </p>

                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
