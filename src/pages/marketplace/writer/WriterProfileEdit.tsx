import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, ExternalLink, Mail, Smartphone, CheckCircle2 } from 'lucide-react';
import { api } from '../../../lib/api';
import type { WriterMe } from '../../../lib/writerTypes';
import { useWriter } from '../onboarding/WriterContext';
import ProfileForm from '../onboarding/ProfileForm';
import SkillsForm from '../onboarding/SkillsForm';
import { Spinner } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

function Card({ title, description, children, aside }: { title: string; description?: string; children: React.ReactNode; aside?: React.ReactNode }) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-[#0b1b33]">{title}</h2>
                    {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
                </div>
                {aside}
            </div>
            {children}
        </section>
    );
}

function VisibilityControl({ writer, onUpdate }: { writer: WriterMe; onUpdate: (w: WriterMe) => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const visible = writer.profile.visibility === 'PUBLIC';
    const listed = writer.status === 'ACTIVE';

    const set = async (visibility: 'PUBLIC' | 'HIDDEN') => {
        setBusy(true); setError('');
        try { onUpdate((await api<{ writer: WriterMe }>('/writers/settings', { method: 'PATCH', body: { visibility } })).writer); }
        catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    };

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
                {([['PUBLIC', Eye, 'Visible', 'Clients can find you in the writer directory.'], ['HIDDEN', EyeOff, 'Hidden', 'Your profile is removed from search and public links.']] as const).map(([value, Icon, label, text]) => (
                    <button key={value} type="button" disabled={busy} onClick={() => set(value)} aria-pressed={writer.profile.visibility === value}
                        className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition', writer.profile.visibility === value ? 'border-[#002147] bg-[#002147]/[0.04] ring-2 ring-[#002147]/15' : 'border-slate-200 hover:border-slate-300')}>
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#002147]" />
                        <span><span className="block font-semibold text-[#0b1b33]">{label}</span><span className="text-sm text-slate-500">{text}</span></span>
                    </button>
                ))}
            </div>
            {busy && <Spinner className="h-4 w-4 text-[#002147]" />}
            {!listed && <p className="text-xs text-slate-500">Your profile appears publicly once your application is approved and your membership is active.</p>}
            {listed && visible && (
                <Link to={`/writer/${writer.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#002147] hover:underline"><ExternalLink className="h-4 w-4" /> View my public profile</Link>
            )}
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>
    );
}

export default function WriterProfileEdit() {
    const { writer, setWriter } = useWriter();
    if (!writer) return null;
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">My profile</h1>
                <p className="mt-1 text-slate-600">What clients see about you. Your email and phone are never shown publicly.</p>
            </div>

            <Card title="Private contact details" description="Used for verification and account notices only.">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Email</dt><dd className="break-all font-medium text-[#0b1b33]">{writer.email}</dd></div>{writer.emailVerified && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" aria-label="Verified" />}</div>
                    <div className="flex items-center gap-3"><Smartphone className="h-4 w-4 text-slate-400" /><div><dt className="text-xs text-slate-500">Phone</dt><dd className="font-medium text-[#0b1b33]">{writer.phone.e164}</dd></div>{writer.phoneVerified && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" aria-label="Verified" />}</div>
                </dl>
            </Card>

            <Card title="Profile visibility"><VisibilityControl writer={writer} onUpdate={setWriter} /></Card>
            <Card title="Professional profile"><ProfileForm writer={writer} onSaved={setWriter} /></Card>
            <Card title="Skills"><SkillsForm writer={writer} onSaved={setWriter} /></Card>
        </div>
    );
}
