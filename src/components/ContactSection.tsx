import React, { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { Mail, Phone, MessageCircle, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

export const ContactSection: React.FC = () => {
    const formRef = useRef<HTMLFormElement>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formRef.current) return;

        setStatus('loading');

        try {
            // First save to our database (MongoDB)
            const formData = new FormData(formRef.current);
            const dbData = {
                name: formData.get('from_name'),
                email: formData.get('from_email'),
                phone: formData.get('from_phone') || '',
                subject: formData.get('subject'),
                message: formData.get('message')
            };

            const API = (import.meta as any).env.VITE_API_URL || 'https://academia-iw7x.onrender.com/api';
            await fetch(`${API}/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbData)
            });

            // Then send via EmailJS to Gmail
            const env = (import.meta as any).env;
            await emailjs.sendForm(
                env.VITE_EMAILJS_SERVICE_ID || 'service_089l13d',
                env.VITE_EMAILJS_TEMPLATE_ID || 'template_placeholder',
                formRef.current,
                env.VITE_EMAILJS_PUBLIC_KEY || 'public_key_placeholder'
            );

            setStatus('success');
            formRef.current.reset();

            setTimeout(() => {
                setStatus('idle');
            }, 5000);
        } catch (error: any) {
            console.error('EmailJS Form Error:', error);
            setStatus('error');
            setErrorMessage(error.text || error.message || 'Something went wrong. Please try again.');
        }
    };

    return (
        <section id="contact-us" className="py-20 lg:py-32 bg-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#002147]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16 relative z-10">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-[#fea520]/10 text-[#e09510] font-bold text-sm tracking-wide mb-4">
                        GET IN TOUCH
                    </span>
                    <h2 className="text-3xl md:text-5xl font-extrabold text-[#000a1e] mb-6">
                        Contact <span className="text-[#fea520]">AssignmentMind</span> Team
                    </h2>
                    <p className="text-gray-500 max-w-2xl mx-auto text-lg">
                        Have a question about our academic services? Fill out the form below and we'll get back to you immediately.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 relative z-10">

                    {/* Left: Contact Information */}
                    <div className="space-y-12">
                        <div className="bg-[#000a1e] text-white rounded-3xl p-10 shadow-2xl relative overflow-hidden">
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#fea520]/20 rounded-full blur-2xl"></div>

                            <h3 className="text-2xl font-bold mb-8">Contact Information</h3>

                            <div className="space-y-8 relative z-10">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                        <Phone className="w-5 h-5 text-[#fea520]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white/50 mb-1">Phone / WhatsApp</p>
                                        <p className="font-bold text-lg">+91 92636 06941</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                        <Mail className="w-5 h-5 text-[#fea520]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white/50 mb-1">Email Address</p>
                                        <p className="font-bold text-lg">assignmentminds@gmail.com</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                        <MessageCircle className="w-5 h-5 text-[#fea520]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white/50 mb-1">Live Chat</p>
                                        <p className="font-bold text-lg">Available 24/7 online</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Contact Form loaded with EmailJS */}
                    <div className="bg-white rounded-3xl p-2 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                        {status === 'success' ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-12">
                                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-[#000a1e] mb-2">Message Sent Successfully!</h3>
                                <p className="text-gray-500">Thank you for reaching out. Our team will contact you shortly.</p>
                            </div>
                        ) : (
                            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                                {status === 'error' && (
                                    <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 text-sm font-semibold border border-red-100">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <p>{errorMessage}</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-[#000a1e] mb-2">Your Name</label>
                                        <input
                                            type="text"
                                            name="from_name"
                                            required
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-[#fea520]/50 focus:border-[#fea520] outline-none transition-all"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#000a1e] mb-2">Email Address</label>
                                        <input
                                            type="email"
                                            name="from_email"
                                            required
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-[#fea520]/50 focus:border-[#fea520] outline-none transition-all"
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-[#000a1e] mb-2">Phone (Optional)</label>
                                        <input
                                            type="text"
                                            name="from_phone"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-[#fea520]/50 focus:border-[#fea520] outline-none transition-all"
                                            placeholder="+91 92636 06941"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#000a1e] mb-2">Subject</label>
                                        <input
                                            type="text"
                                            name="subject"
                                            required
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-[#fea520]/50 focus:border-[#fea520] outline-none transition-all"
                                            placeholder="How can we help?"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#000a1e] mb-2">Your Message</label>
                                    <textarea
                                        name="message"
                                        required
                                        rows={4}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-[#fea520]/50 focus:border-[#fea520] outline-none transition-all resize-none"
                                        placeholder="Please provide details about your assignment..."
                                    ></textarea>
                                </div>
                                <button
                                    type="submit"
                                    disabled={status === 'loading'}
                                    className="w-full bg-[#000a1e] hover:bg-[#002147] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {status === 'loading' ? (
                                        <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                                    ) : (
                                        <><Send className="w-5 h-5" /> Send Message</>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};
