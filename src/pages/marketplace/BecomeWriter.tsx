import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight, Check, UserRound, ShieldCheck, ClipboardCheck, BadgeCheck, Crown, Compass, Briefcase, Star, GraduationCap, PenLine, Globe2,
    FileText, Award, FolderOpen, ChevronDown, SlidersHorizontal, Target, Wallet, Lock, TrendingUp, Users, Mail, MessageCircle, Clock, Info,
} from 'lucide-react';
import { MarketplaceNavbar as Navbar } from '../../components/writer/MarketplaceNavbar';
import { Footer } from '../../components/Footer';
import { PREDEFINED_SKILLS } from '../../lib/writerOptions';
import { useStore } from '../../store/useStore';
import { useMarketplaceContent, DEFAULT_MARKETPLACE_CONTENT, type JourneyStep } from '../../lib/marketplaceContent';
import { Spinner } from '../../components/writer/WriterBits';

const STEP_ICONS: Record<JourneyStep['key'], React.ElementType> = {
    REGISTER: UserRound, PROFILE: ClipboardCheck, APPROVAL: BadgeCheck,
    MEMBERSHIP: Crown, OPPORTUNITIES: Compass, ASSIGNMENTS: Briefcase, RATING: Star,
};
const BENEFIT_ICONS = [SlidersHorizontal, Target, Wallet, Lock, TrendingUp, Users];
const REQUIREMENT_ICONS = [GraduationCap, PenLine, Globe2, ShieldCheck];
const DOCUMENT_ICONS = [FileText, Award, PenLine, FolderOpen];
const pick = <T,>(list: T[], i: number) => list[i % list.length];

export default function BecomeWriter() {
    const isWriter = useStore(s => Boolean(s.writer));
    const { data, error } = useMarketplaceContent();
    const primaryHref = isWriter ? '/writer/onboarding' : '/writer/register';
    const primaryLabel = isWriter ? 'Continue your application' : 'Start your application';

    const contentData = data || DEFAULT_MARKETPLACE_CONTENT;
    const { recruitment: r, faq, contact } = contentData.content;

    return (
        <div className="flex min-h-screen flex-col bg-[#f6f8fc] font-sans">
            <Navbar />
            <main className="flex-grow pb-24 pt-6 lg:pt-8">
                {/* Hero + journey */}
                <section className="mx-auto grid max-w-7xl items-start gap-12 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-8">
                    <div className="lg:self-center">
                        {r.hero.eyebrow && (
                            <p className="inline-flex items-center gap-2 rounded-full border border-[#002147]/10 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#002147]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#fea520]" /> {r.hero.eyebrow}
                            </p>
                        )}
                        <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0b1b33] sm:text-6xl">
                            {r.hero.title}
                            {r.hero.highlight && (<><br />
                                <span className="relative inline-block">
                                    <span className="relative z-10">{r.hero.highlight}</span>
                                    <span aria-hidden className="absolute bottom-1 left-0 z-0 h-3 w-full bg-[#fea520]/40 sm:bottom-2 sm:h-4" />
                                </span></>)}
                        </h1>
                        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">{r.hero.subtitle}</p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link to={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#002147] px-7 py-4 font-bold text-white shadow-lg shadow-[#002147]/20 transition hover:bg-[#0b2f5c]">
                                {primaryLabel} <ArrowRight className="h-5 w-5" />
                            </Link>
                            <Link to="/writer-membership" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-4 font-bold text-[#002147] transition hover:border-[#002147]">
                                See membership plans
                            </Link>
                        </div>
                        <p className="mt-4 text-sm text-slate-500">{r.hero.note}</p>
                        <p className="mt-2 text-sm text-slate-500">Already applied? <Link to="/writer/login" className="font-semibold text-[#002147] hover:underline">Writer sign in</Link></p>
                    </div>

                    <div className="relative">
                        <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-[#fea520]/25 via-transparent to-[#002147]/15 blur-2xl" />
                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,33,71,0.5)] sm:p-8">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">How it works</p>
                            <ol className="mt-6">
                                {r.steps.map((step, i) => {
                                    const Icon = STEP_ICONS[step.key] || Check;
                                    return (
                                        <li key={step.key} className="relative flex gap-4 pb-5 last:pb-0">
                                            {i < r.steps.length - 1 && <span aria-hidden className="absolute left-[19px] top-11 h-[calc(100%-2.5rem)] w-px bg-slate-200" />}
                                            <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${i === 0 ? 'bg-[#fea520] text-[#0b1b33]' : 'bg-[#002147]/[0.06] text-[#002147]'}`}>
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <div className="pt-0.5">
                                                <p className="font-semibold text-[#0b1b33]"><span className="mr-1.5 text-xs font-bold text-slate-400">{i + 1}</span>{step.title}</p>
                                                <p className="text-sm leading-relaxed text-slate-500">{step.text}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    </div>
                </section>

                {/* Benefits */}
                {r.benefits.length > 0 && (
                    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
                        <h2 className="text-3xl font-extrabold tracking-tight text-[#0b1b33]">Why writers choose AssignmentMinds</h2>
                        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {r.benefits.map((b, i) => {
                                const Icon = pick(BENEFIT_ICONS, i);
                                return (
                                    <div key={b.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fea520]/15 text-[#b86e00]"><Icon className="h-5 w-5" /></span>
                                        <h3 className="mt-4 font-bold text-[#0b1b33]">{b.title}</h3>
                                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{b.text}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Disciplines */}
                <section className="border-y border-slate-200 bg-white py-10">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6">
                        <p className="text-center text-sm font-semibold text-slate-500">We’re recruiting across disciplines, including</p>
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                            {PREDEFINED_SKILLS.filter(s => s !== 'Other').map(s => (
                                <span key={s} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">{s}</span>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Requirements + documents */}
                <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.3fr_1fr]">
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-[#0b1b33]">Who we’re looking for</h2>
                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            {r.requirements.map((req, i) => {
                                const Icon = pick(REQUIREMENT_ICONS, i);
                                return (
                                    <div key={req.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                                        <Icon className="h-6 w-6 text-[#b86e00]" />
                                        <h3 className="mt-4 font-bold text-[#0b1b33]">{req.title}</h3>
                                        <p className="mt-1 text-sm text-slate-600">{req.text}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="rounded-3xl bg-[#002147] p-6 text-white sm:p-8">
                        <h2 className="text-2xl font-extrabold">Have these ready</h2>
                        <p className="mt-2 text-white/70">PDF, Word or image files. Documents are stored privately and seen only by our review team.</p>
                        <ul className="mt-6 space-y-3">
                            {r.documents.map((d, i) => {
                                const Icon = pick(DOCUMENT_ICONS, i);
                                return (
                                    <li key={d.title} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-4 py-3">
                                        <Icon className="h-5 w-5 shrink-0 text-[#fea520]" />
                                        <span className="flex-1 text-sm font-medium">{d.title}</span>
                                        {d.required && <span className="rounded-full bg-[#fea520] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0b1b33]">Required</span>}
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="mt-6 flex items-start gap-2 text-sm text-white/70"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#fea520]" /> Your phone number and email are never shown on your public profile.</p>
                    </div>
                </section>

                {/* Membership note */}
                <section className="mx-auto max-w-7xl px-4 sm:px-6">
                    <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
                        <div>
                            <h2 className="text-2xl font-extrabold text-[#0b1b33]">Membership comes after approval</h2>
                            <p className="mt-2 max-w-2xl text-slate-600">Applying is free. Once our team approves your application, you can choose a monthly or annual membership to access the platform.</p>
                            <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#002147]" />{data.disclaimer}</p>
                        </div>
                        <Link to="/writer-membership" className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#002147] px-6 py-3 font-bold text-[#002147] hover:bg-[#002147]/5 md:self-center">
                            Compare plans <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </section>

                {/* FAQ */}
                {faq.length > 0 && (
                    <section className="mx-auto mt-16 max-w-3xl px-4 sm:px-6">
                        <h2 className="text-center text-3xl font-extrabold tracking-tight text-[#0b1b33]">Questions from applicants</h2>
                        <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                            {faq.map(f => (
                                <details key={f.q} className="group px-5 py-4 sm:px-6">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#0b1b33]">
                                        {f.q}<ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
                                    </summary>
                                    <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600">{f.a}</p>
                                </details>
                            ))}
                        </div>
                        <ContactStrip contact={contact} />
                    </section>
                )}

                {/* Final CTA */}
                <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
                    <div className="flex flex-col items-start gap-6 rounded-3xl border border-[#fea520]/40 bg-gradient-to-r from-[#fff4df] to-white p-8 sm:flex-row sm:items-center sm:p-10">
                        <div className="flex-1">
                            <h2 className="text-2xl font-extrabold text-[#0b1b33] sm:text-3xl">{r.cta.title}</h2>
                            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                                {r.cta.points.map(t => <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-600" />{t}</li>)}
                            </ul>
                            <p className="mt-3 text-xs text-slate-500">By applying you agree to the <Link to="/writer-terms" className="font-semibold text-[#002147] underline">writer terms</Link>.</p>
                        </div>
                        <Link to={primaryHref} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#002147] px-7 py-4 font-bold text-white hover:bg-[#0b2f5c] sm:w-auto">{primaryLabel} <ArrowRight className="h-5 w-5" /></Link>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}

export function ContactStrip({ contact }: { contact: { email: string; phone: string; whatsapp: string; hours: string } }) {
    if (!contact.email && !contact.phone && !contact.whatsapp) return null;
    const wa = contact.whatsapp.replace(/[^\d]/g, '');
    return (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-white px-5 py-4 text-sm text-slate-600 ring-1 ring-slate-200 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
            <span className="font-semibold text-[#0b1b33]">Still have questions?</span>
            {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 hover:text-[#002147]"><Mail className="h-4 w-4" />{contact.email}</a>}
            {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-[#002147]">{contact.phone}</a>}
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-[#002147]"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
            {contact.hours && <span className="inline-flex items-center gap-1.5 text-slate-500"><Clock className="h-4 w-4" />{contact.hours}</span>}
        </div>
    );
}
