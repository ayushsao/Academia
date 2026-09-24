import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe2, BadgeCheck, CalendarClock } from 'lucide-react';

// Home-page entry point for writer recruitment.
export const JoinAsWriterSection: React.FC = () => (
    <section id="join-as-writer" className="px-4 py-16 sm:px-6 lg:py-20">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#002147] px-6 py-12 text-white sm:px-12 lg:py-16">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border-[48px] border-[#fea520]/15" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#fea520]/10 blur-3xl" />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#fea520]">Become a writer · Join as a freelancer</p>
                    <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">Are you an academic expert? Work with AssignmentMinds.</h2>
                    <p className="mt-4 max-w-xl text-white/75">Researchers, editors and subject specialists from around the world join our vetted network to take on projects in their field, on their own schedule.</p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <Link to="/become-a-writer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#fea520] px-6 py-3.5 font-bold text-[#0b1b33] transition hover:bg-[#f39200]">
                            Apply as a writer <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link to="/writer/login" className="inline-flex items-center justify-center rounded-xl border border-white/25 px-6 py-3.5 font-bold text-white transition hover:bg-white/10">
                            Writer sign in
                        </Link>
                    </div>
                </div>
                <ul className="grid gap-3">
                    {[
                        { icon: Globe2, title: 'Open to every country', text: 'International phone verification and multilingual profiles.' },
                        { icon: BadgeCheck, title: 'Reviewed by real people', text: 'Our HR team checks every application and credential.' },
                        { icon: CalendarClock, title: 'Choose your own workload', text: 'Set yourself available or unavailable whenever you need.' },
                    ].map(item => (
                        <li key={item.title} className="flex gap-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                            <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-[#fea520]" />
                            <span><span className="block font-semibold">{item.title}</span><span className="text-sm text-white/65">{item.text}</span></span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    </section>
);
