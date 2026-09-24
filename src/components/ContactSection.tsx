import React, { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { Mail, Phone, MessageCircle, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { ContactCard } from './ui/contact-card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { API } from '../lib/api';

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

            await fetch(`${API}/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbData)
            });

            // Then send via EmailJS securely via API
            // Read each variable by name: referencing the whole env object makes Vite inline every VITE_* value.
            const env = { VITE_EMAILJS_SERVICE_ID: (import.meta as any).env.VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID: (import.meta as any).env.VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY: (import.meta as any).env.VITE_EMAILJS_PUBLIC_KEY };
            await emailjs.send(
                env.VITE_EMAILJS_SERVICE_ID || 'service_089l13d',
                env.VITE_EMAILJS_TEMPLATE_ID || 'template_omo2hya',
                {
                    name: formData.get('from_name'),
                    email: formData.get('from_email'),
                    subject: formData.get('subject'),
                    message: formData.get('message'),
                    phone: formData.get('from_phone') || 'No Phone'
                },
                env.VITE_EMAILJS_PUBLIC_KEY || 'u1Lnz6UEF9jlDevVZ'
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
        <section id="contact-us" className="py-20 lg:py-32 bg-[#fafafa] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#fea520]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>

            <div className="flex justify-center mb-6">
                <span className="inline-block px-4 py-1 rounded-full bg-[#fea520]/10 text-[#e09510] font-bold text-xs tracking-wide uppercase">
                    GET IN TOUCH
                </span>
            </div>

            <ContactCard
                title="Contact AssignmentMind Team"
                description="Have a question about our academic services? Fill out the form below and we'll get back to you immediately."
                contactInfo={[
                    {
                        icon: Phone,
                        label: 'Phone / WhatsApp',
                        value: '+91 92636 06941'
                    },
                    {
                        icon: Mail,
                        label: 'Email Address',
                        value: 'assignmentminds@gmail.com'
                    },
                    {
                        icon: MessageCircle,
                        label: 'Live Chat',
                        value: 'Available 24/7 online'
                    }
                ]}
            >
                {status === 'success' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-[#000a1e] mb-2">Message Sent Successfully!</h3>
                        <p className="text-gray-500">Thank you for reaching out. Our team will contact you shortly.</p>
                    </div>
                ) : (
                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 w-full max-w-2xl mx-auto">
                        {status === 'error' && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 text-sm font-semibold border border-red-100 mb-6">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p>{errorMessage}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="from_name">Your Name</Label>
                                <Input id="from_name" type="text" name="from_name" required placeholder="John Doe" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="from_email">Email Address</Label>
                                <Input id="from_email" type="email" name="from_email" required placeholder="john@example.com" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="from_phone">Phone (Optional)</Label>
                                <Input id="from_phone" type="text" name="from_phone" placeholder="+91 92636 06941" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="subject">Subject</Label>
                                <Input id="subject" type="text" name="subject" required placeholder="How can we help?" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="message">Your Message</Label>
                            <Textarea
                                id="message"
                                name="message"
                                required
                                rows={4}
                                placeholder="Please provide details about your assignment..."
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full mt-2"
                        >
                            {status === 'loading' ? (
                                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Sending...</>
                            ) : (
                                <><Send className="w-4 h-4 mr-2" /> Send Message</>
                            )}
                        </Button>
                    </form>
                )}
            </ContactCard>
        </section>
    );
};
