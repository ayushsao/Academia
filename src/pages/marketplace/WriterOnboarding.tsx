import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Smartphone, UserRound, Sparkles, FolderOpen, Send, Check, Lock, LayoutDashboard, Activity } from 'lucide-react';
import { MarketplaceNavbar as Navbar } from '../../components/writer/MarketplaceNavbar';
import { useStore } from '../../store/useStore';
import type { WriterMe } from '../../lib/writerTypes';
import { Notice } from '../../components/writer/FormKit';
import { Spinner } from '../../components/writer/WriterBits';
import { cn } from '../../lib/utils';
import { WriterProvider, useWriter } from './onboarding/WriterContext';
import VerifyChannel from './onboarding/VerifyChannel';
import ProfileForm from './onboarding/ProfileForm';
import SkillsForm from './onboarding/SkillsForm';
import DocumentsManager from './onboarding/DocumentsManager';
import { ApplicationTracker, ReviewSubmit, StatusExplainer, type OnboardingSection } from './onboarding/ApplicationPanels';

type Section = OnboardingSection | 'status';

const SECTIONS: { id: OnboardingSection; label: string; sub: string; icon: typeof Mail }[] = [
    { id: 'email', label: 'Verify email', sub: 'Confirm your address', icon: Mail },
    { id: 'phone', label: 'Verify phone', sub: 'SMS code', icon: Smartphone },
    { id: 'profile', label: 'Profile', sub: 'Photo, education, expertise', icon: UserRound },
    { id: 'skills', label: 'Skills', sub: 'What you deliver', icon: Sparkles },
    { id: 'documents', label: 'Documents', sub: 'CV, certificates, samples', icon: FolderOpen },
    { id: 'submit', label: 'Review & submit', sub: 'Send to HR', icon: Send },
];

function sectionDone(w: WriterMe, id: OnboardingSection) {
    const c = w.onboarding.checks;
    switch (id) {
        case 'email': return c.emailVerified;
        case 'phone': return c.phoneVerified;
        case 'profile': return c.profileComplete && c.photoUploaded;
        case 'skills': return c.skillsAdded;
        case 'documents': return c.resumeUploaded;
        case 'submit': return !['DRAFT', 'INFO_REQUESTED'].includes(w.application.status);
    }
}

const isReachable = (w: WriterMe, id: OnboardingSection) =>
    id === 'email' || (id === 'phone' ? w.emailVerified : w.emailVerified && w.phoneVerified);

function initialSection(w: WriterMe): Section {
    switch (w.onboarding.nextStep) {
        case 'VERIFY_EMAIL': return 'email';
        case 'VERIFY_PHONE': return 'phone';
        case 'SUBMIT_APPLICATION': return 'submit';
        case 'COMPLETE_PROFILE': return (['profile', 'skills', 'documents'] as const).find(s => !sectionDone(w, s)) || 'submit';
        default: return 'status';
    }
}

function OnboardingInner() {
    const { writer, loading, error, setWriter } = useWriter();
    const location = useLocation();
    const navigate = useNavigate();
    const [section, setSection] = useState<Section | null>(null);
    const emailCodeSent = Boolean((location.state as any)?.emailCodeSent);

    useEffect(() => { if (writer && section === null) setSection(initialSection(writer)); }, [writer, section]);
    useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [section]);

    const submitted = writer ? !['DRAFT', 'INFO_REQUESTED'].includes(writer.application.status) : false;
    const progress = useMemo(() => writer ? SECTIONS.filter(s => sectionDone(writer, s.id)).length : 0, [writer]);

    if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="h-8 w-8 text-[#002147]" /></div>;
    if (error || !writer || !section) return <div className="mx-auto max-w-xl px-4 py-24"><Notice tone="error">{error || 'Could not load your application.'}</Notice></div>;

    const goNext = (w: WriterMe, from: OnboardingSection) => {
        setWriter(w);
        const order = SECTIONS.map(s => s.id);
        const next = order.slice(order.indexOf(from) + 1).find(s => !sectionDone(w, s) && isReachable(w, s));
        setSection(next || 'submit');
    };

    const afterSubmit = (w: WriterMe) => { setWriter(w); if (!['DRAFT', 'INFO_REQUESTED'].includes(w.application.status)) setSection('status'); };

    const current = SECTIONS.find(s => s.id === section);

    return (
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:pt-12">
            {/* Header */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b86e00]">Writer application</p>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0b1b33] sm:text-4xl">Welcome, {writer.name.split(' ')[0]}</h1>
                    <p className="mt-1 text-slate-600">{submitted ? 'Your application has been submitted.' : `${progress} of ${SECTIONS.length} steps complete. Your progress saves as you go.`}</p>
                </div>
                {['APPROVED', 'ACTIVE'].includes(writer.status) && (
                    <button onClick={() => navigate('/writer/dashboard')} className="inline-flex items-center gap-2 self-start rounded-xl bg-[#002147] px-5 py-3 text-sm font-semibold text-white sm:self-auto">
                        <LayoutDashboard className="h-4 w-4" /> Go to dashboard
                    </button>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[17rem_1fr] lg:gap-10">
                {/* Step navigation: horizontal scroller on small screens, vertical rail on large */}
                <nav aria-label="Application steps" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
                    <ol className="flex gap-2 lg:sticky lg:top-[120px] lg:flex-col lg:gap-1">
                        {submitted && (
                            <li>
                                <button onClick={() => setSection('status')} aria-current={section === 'status' ? 'step' : undefined}
                                    className={cn('flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left transition lg:whitespace-normal',
                                        section === 'status' ? 'bg-[#002147] text-white' : 'bg-white text-slate-700 hover:bg-slate-100 lg:bg-transparent')}>
                                    <Activity className="h-5 w-5 shrink-0" /><span className="text-sm font-semibold">Application status</span>
                                </button>
                            </li>
                        )}
                        {SECTIONS.map((s, i) => {
                            const done = sectionDone(writer, s.id);
                            const reachable = isReachable(writer, s.id);
                            const active = section === s.id;
                            return (
                                <li key={s.id}>
                                    <button disabled={!reachable} onClick={() => setSection(s.id)} aria-current={active ? 'step' : undefined}
                                        className={cn('group flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left transition lg:whitespace-normal',
                                            active ? 'bg-[#002147] text-white shadow-lg shadow-[#002147]/20' : 'bg-white text-slate-700 hover:bg-slate-100 lg:bg-transparent',
                                            !reachable && 'cursor-not-allowed opacity-50 hover:bg-white lg:hover:bg-transparent')}>
                                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                                            done ? 'bg-emerald-500 text-white' : active ? 'bg-[#fea520] text-[#0b1b33]' : 'bg-slate-100 text-slate-500')}>
                                            {done ? <Check className="h-4 w-4" strokeWidth={3} /> : !reachable ? <Lock className="h-3.5 w-3.5" /> : i + 1}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold">{s.label}</span>
                                            <span className={cn('hidden text-xs lg:block', active ? 'text-white/70' : 'text-slate-500')}>{s.sub}</span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </nav>

                {/* Content */}
                <main className="min-w-0 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(0,33,71,0.25)] sm:p-8">
                    {section === 'status' ? (
                        <div className="space-y-8">
                            <StatusExplainer writer={writer} onGoTo={setSection} />
                            <div>
                                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Your journey</h2>
                                <ApplicationTracker writer={writer} />
                            </div>
                            <p className="text-sm text-slate-500">You can still view the details you submitted using the steps on the left.</p>
                        </div>
                    ) : (
                        <>
                            {current && section !== 'email' && section !== 'phone' && (
                                <header className="mb-8">
                                    <h2 className="text-xl font-bold text-[#0b1b33] sm:text-2xl">{current.label}</h2>
                                    <p className="mt-1 text-slate-600">{{
                                        profile: 'Tell clients and our review team about your background. Fields marked * are required.',
                                        skills: 'Choose the services and disciplines you’re strongest in.',
                                        documents: 'Upload evidence of your qualifications and writing ability.',
                                        submit: 'Check everything is complete, then send your application to our HR team.',
                                    }[section as string]}</p>
                                </header>
                            )}
                            {section === 'email' && <VerifyChannel channel="email" writer={writer} initiallySent={emailCodeSent} onUpdate={w => (w.emailVerified ? goNext(w, 'email') : setWriter(w))} />}
                            {section === 'phone' && (writer.phoneVerified
                                ? <Notice tone="success">Your phone number {writer.phone.masked} is verified.</Notice>
                                : <VerifyChannel channel="phone" writer={writer} onUpdate={w => (w.phoneVerified ? goNext(w, 'phone') : setWriter(w))} />)}
                            {section === 'email' && writer.emailVerified && <Notice tone="success" className="mt-6">Your email {writer.email} is verified.</Notice>}
                            {section === 'profile' && <ProfileForm writer={writer} onUpdate={setWriter} onSaved={w => goNext(w, 'profile')} submitLabel="Save & continue" />}
                            {section === 'skills' && <SkillsForm writer={writer} onSaved={w => goNext(w, 'skills')} submitLabel="Save & continue" />}
                            {section === 'documents' && (
                                <>
                                    <DocumentsManager writer={writer} onUpdate={setWriter} />
                                    {writer.onboarding.canEdit && (
                                        <div className="mt-8 flex justify-end border-t border-slate-100 pt-5">
                                            <button onClick={() => setSection('submit')} className="rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white">Continue</button>
                                        </div>
                                    )}
                                </>
                            )}
                            {section === 'submit' && (submitted
                                ? <StatusExplainer writer={writer} />
                                : <ReviewSubmit writer={writer} onUpdate={afterSubmit} onGoTo={setSection} />)}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

export default function WriterOnboarding() {
    const user = useStore(s => s.user);
    if (!user) return <Navigate to="/writer/login" replace state={{ from: '/writer/onboarding' }} />;
    return (
        <div className="min-h-screen bg-[#f6f8fc] font-sans">
            <Navbar activeSection="" />
            <WriterProvider>
                <OnboardingInner />
            </WriterProvider>
        </div>
    );
}
