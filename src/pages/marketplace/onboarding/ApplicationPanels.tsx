import React, { useState } from 'react';
import { Check, Circle, ArrowRight, MessageSquareWarning, ShieldAlert, BadgeCheck, Hourglass, XCircle } from 'lucide-react';
import { api } from '../../../lib/api';
import type { WriterMe } from '../../../lib/writerTypes';
import { Notice, inputClass } from '../../../components/writer/FormKit';
import { Spinner, StatusBadge } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

export type OnboardingSection = 'profile' | 'skills' | 'documents' | 'submit';

const CHECK_LABELS: Record<string, { label: string; section: OnboardingSection }> = {
    profileComplete: { label: 'Professional profile complete', section: 'profile' },
    photoUploaded: { label: 'Profile photo uploaded', section: 'profile' },
    skillsAdded: { label: 'At least one skill selected', section: 'skills' },
    resumeUploaded: { label: 'Resume / CV uploaded', section: 'documents' },
};

export function ReviewSubmit({ writer, onUpdate, onGoTo }: { writer: WriterMe; onUpdate: (w: WriterMe) => void; onGoTo: (s: OnboardingSection) => void }) {
    const [response, setResponse] = useState('');
    const [agree, setAgree] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const infoRequested = writer.application.status === 'INFO_REQUESTED';
    const { checks, canSubmit } = writer.onboarding;

    const submit = async () => {
        setBusy(true); setError('');
        try {
            onUpdate((await api<{ writer: WriterMe }>('/writers/application/submit', { method: 'POST', body: infoRequested ? { response } : {} })).writer);
        } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    };

    return (
        <div className="space-y-6">
            {infoRequested && writer.application.infoRequest && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <p className="flex items-center gap-2 font-semibold text-amber-900"><MessageSquareWarning className="h-5 w-5" /> The review team asked for more information</p>
                    <p className="mt-2 whitespace-pre-line text-sm text-amber-900/90">{writer.application.infoRequest.message}</p>
                </div>
            )}

            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {Object.entries(CHECK_LABELS).map(([key, meta]) => {
                    const ok = checks[key as keyof typeof checks];
                    return (
                        <li key={key} className="flex items-center gap-3 px-4 py-3.5">
                            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', ok ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300')}>
                                {ok && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                            </span>
                            <span className={cn('flex-1 text-sm', ok ? 'text-slate-700' : 'font-semibold text-[#0b1b33]')}>{meta.label}</span>
                            {!ok && <button type="button" onClick={() => onGoTo(meta.section)} className="text-sm font-semibold text-[#b86e00] hover:underline">Complete</button>}
                        </li>
                    );
                })}
            </ul>

            {infoRequested && (
                <div>
                    <label htmlFor="info-response" className="mb-1.5 block text-sm font-semibold text-[#0b1b33]">Your reply to the review team <span className="text-[#e36100]">*</span></label>
                    <textarea id="info-response" rows={4} maxLength={2000} value={response} onChange={e => setResponse(e.target.value)} className={cn(inputClass, 'resize-y')}
                        placeholder="Explain what you’ve updated or answer their question." />
                </div>
            )}

            <label className="flex items-start gap-3 text-sm text-slate-700">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#002147]" />
                I confirm the information and documents I’ve provided are accurate and my own, and I understand that misrepresentation will lead to rejection or suspension.
            </label>

            {error && <Notice tone="error">{error}</Notice>}

            <button type="button" onClick={submit} disabled={!canSubmit || !agree || busy || (infoRequested && response.trim().length < 5)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#fea520] px-6 py-4 font-bold text-[#0b1b33] transition hover:bg-[#f39200] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                {busy ? <Spinner className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />} {infoRequested ? 'Send reply & resubmit' : 'Submit application for review'}
            </button>
        </div>
    );
}

const STAGES = [
    { key: 'registered', label: 'Registered' },
    { key: 'submitted', label: 'Profile submitted' },
    { key: 'review', label: 'HR review' },
    { key: 'approved', label: 'Approved' },
    { key: 'membership', label: 'Membership' },
    { key: 'dashboard', label: 'Writer dashboard' },
];

function stageIndex(w: WriterMe) {
    if (w.status === 'ACTIVE') return 5;
    if (w.status === 'APPROVED') return 4;
    if (['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(w.application.status)) return 2;
    return 1;
}

// The full onboarding journey with the writer's current position.
export function ApplicationTracker({ writer, compact }: { writer: WriterMe; compact?: boolean }) {
    const current = stageIndex(writer);
    const halted = ['REJECTED', 'SUSPENDED', 'INACTIVE'].includes(writer.status);
    return (
        <ol className={cn('grid gap-y-3', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-6 sm:gap-x-2')}>
            {STAGES.map((s, i) => {
                const done = !halted && i < current;
                const active = !halted && i === current;
                return (
                    <li key={s.key} className={cn('flex items-center gap-3', !compact && 'sm:flex-col sm:items-start sm:gap-2')}>
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            done ? 'bg-emerald-500 text-white' : active ? 'bg-[#fea520] text-[#0b1b33] ring-4 ring-[#fea520]/25' : 'bg-slate-100 text-slate-400')}>
                            {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                        </span>
                        {!compact && <span className="hidden h-0.5 w-full rounded bg-slate-100 sm:block"><span className={cn('block h-full rounded bg-emerald-500 transition-all', done ? 'w-full' : 'w-0')} /></span>}
                        <span className={cn('text-sm', active ? 'font-bold text-[#0b1b33]' : done ? 'text-slate-600' : 'text-slate-400')}>{s.label}</span>
                    </li>
                );
            })}
        </ol>
    );
}

// Explains the writer's current status and what happens next.
export function StatusExplainer({ writer, onGoTo }: { writer: WriterMe; onGoTo?: (s: OnboardingSection) => void }) {
    const app = writer.application;
    let tone = 'bg-white border-slate-200', Icon: typeof Circle = Hourglass, title = '', body: React.ReactNode = null, action: React.ReactNode = null;

    if (app.status === 'INFO_REQUESTED') {
        tone = 'bg-amber-50 border-amber-200'; Icon = MessageSquareWarning; title = 'Action needed: more information requested';
        body = <p className="whitespace-pre-line">{app.infoRequest?.message}</p>;
        action = onGoTo && <button onClick={() => onGoTo('submit')} className="rounded-xl bg-[#002147] px-5 py-2.5 text-sm font-semibold text-white">Respond now</button>;
    } else if (['SUBMITTED', 'UNDER_REVIEW'].includes(app.status)) {
        title = app.status === 'SUBMITTED' ? 'Your application is in the queue' : 'Our HR team is reviewing your application';
        body = <p>Reviews usually take 2–5 working days. We’ll email you as soon as there’s a decision. Your profile is locked while it’s being reviewed.</p>;
    } else if (writer.status === 'APPROVED') {
        tone = 'bg-emerald-50 border-emerald-200'; Icon = BadgeCheck; title = 'You’re approved!';
        body = <p>{app.decisionReason ? `Reviewer note: ${app.decisionReason}. ` : ''}The last step is choosing a writer membership plan from your dashboard.</p>;
    } else if (writer.status === 'ACTIVE') {
        tone = 'bg-emerald-50 border-emerald-200'; Icon = BadgeCheck; title = 'Your writer account is active';
    } else if (writer.status === 'REJECTED') {
        tone = 'bg-slate-50 border-slate-200'; Icon = XCircle; title = 'Your application wasn’t approved';
        body = <p>{app.decisionReason || 'Thank you for your interest. Unfortunately we can’t offer you a place at this time.'}</p>;
    } else if (writer.status === 'SUSPENDED') {
        tone = 'bg-red-50 border-red-200'; Icon = ShieldAlert; title = 'Your account is suspended';
        body = <p>You can’t take on new work while suspended. Contact support if you believe this is a mistake.</p>;
    } else if (writer.status === 'INACTIVE') {
        tone = 'bg-slate-50 border-slate-200'; Icon = Circle; title = 'Your account is inactive';
        body = <p>Contact support to reactivate your account.</p>;
    } else {
        title = 'Finish your application';
        body = <p>Complete the remaining steps and submit your application for review.</p>;
    }

    return (
        <div className={cn('rounded-2xl border p-5 sm:p-6', tone)}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Icon className="h-7 w-7 shrink-0 text-[#002147]" />
                <div className="flex-1 space-y-2 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold text-[#0b1b33]">{title}</h3><StatusBadge status={writer.status} /></div>
                    {body}
                </div>
                {action}
            </div>
        </div>
    );
}
