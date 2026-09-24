import React, { useRef, useState } from 'react';
import { Camera, Plus, Trash2, GraduationCap } from 'lucide-react';
import { api } from '../../../lib/api';
import type { Education, WriterMe } from '../../../lib/writerTypes';
import { ACADEMIC_LEVELS, EDUCATION_LEVELS, SUGGESTED_LANGUAGES, SUGGESTED_SUBJECTS } from '../../../lib/writerOptions';
import { ChipGroup, CountrySelect, Field, Notice, TagInput, inputClass } from '../../../components/writer/FormKit';
import { Spinner, WriterAvatar } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

const emptyEducation = (): Education => ({ degree: '', level: '', university: '', fieldOfStudy: '' });

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <section className="border-t border-slate-100 pt-8 first:border-0 first:pt-0">
            <h3 className="text-lg font-bold text-[#0b1b33]">{title}</h3>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            <div className="mt-5">{children}</div>
        </section>
    );
}

export function PhotoUploader({ writer, onUpdate, disabled }: { writer: WriterMe; onUpdate: (w: WriterMe) => void; disabled?: boolean }) {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const upload = async (file?: File) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('Photo must be 5 MB or smaller.'); return; }
        const form = new FormData();
        form.append('file', file);
        setBusy(true); setError('');
        try {
            const res = await api<{ writer: WriterMe }>('/writers/photo', { method: 'POST', body: form });
            onUpdate(res.writer);
        } catch (err) { setError((err as Error).message); } finally {
            setBusy(false);
            if (input.current) input.current.value = '';
        }
    };

    return (
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="relative">
                <WriterAvatar writerId={writer.id} name={writer.name} hasPhoto={writer.profile.hasPhoto} version={writer.profile.photoVersion} size={96} mode="private" className="ring-4 ring-white shadow-md" />
                {busy && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70"><Spinner className="text-[#002147]" /></span>}
            </div>
            <div>
                <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="photo-input" disabled={disabled || busy} onChange={e => upload(e.target.files?.[0])} />
                <label htmlFor="photo-input" className={cn('inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-[#002147] hover:bg-slate-50', (disabled || busy) && 'pointer-events-none opacity-50')}>
                    <Camera className="h-4 w-4" /> {writer.profile.hasPhoto ? 'Change photo' : 'Upload photo'}
                </label>
                <p className="mt-2 text-xs text-slate-500">A clear, professional headshot. JPG, PNG or WebP, up to 5 MB.</p>
                {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
            </div>
        </div>
    );
}

// onSaved fires after the form is saved; onUpdate (defaults to onSaved) after a photo change.
export default function ProfileForm({ writer, onSaved, onUpdate, submitLabel = 'Save profile' }: {
    writer: WriterMe; onSaved: (w: WriterMe) => void; onUpdate?: (w: WriterMe) => void; submitLabel?: string;
}) {
    const p = writer.profile;
    const locked = !writer.onboarding.canEdit;
    const [form, setForm] = useState({
        country: p.country || '', city: p.city || '', headline: p.headline || '', bio: p.bio || '',
        yearsExperience: String(p.yearsExperience ?? ''), writingExperience: p.writingExperience || '',
        expertiseAreas: p.expertiseAreas || [], subjects: p.subjects || [], academicLevels: p.academicLevels || [], languages: p.languages || [],
    });
    const [education, setEducation] = useState<Education[]>(p.education?.length ? p.education : [emptyEducation()]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => { setForm(f => ({ ...f, [key]: value })); setSaved(false); };
    const setEdu = (i: number, patch: Partial<Education>) => { setEducation(list => list.map((e, j) => (j === i ? { ...e, ...patch } : e))); setSaved(false); };

    const clientError = (): string => {
        if (!form.country || form.city.trim().length < 2) return 'Add your country and city.';
        if (form.bio.trim().length < 150) return `Your bio needs at least 150 characters (${form.bio.trim().length} so far).`;
        if (education.some(e => !e.degree.trim() || !e.level || !e.university.trim())) return 'Complete the degree, level and university for each education entry.';
        if (form.yearsExperience === '' || Number(form.yearsExperience) < 0) return 'Enter your years of experience.';
        if (form.writingExperience.trim().length < 50) return 'Describe your writing experience in at least 50 characters.';
        if (!form.expertiseAreas.length) return 'Add at least one area of expertise.';
        if (!form.subjects.length) return 'Add at least one subject.';
        if (!form.academicLevels.length) return 'Select the academic levels you support.';
        if (!form.languages.length) return 'Add at least one language.';
        return '';
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const problem = clientError();
        if (problem) { setError(problem); return; }
        setSaving(true); setError('');
        try {
            const res = await api<{ writer: WriterMe }>('/writers/profile', {
                method: 'PUT',
                body: {
                    ...form,
                    yearsExperience: Number.parseInt(form.yearsExperience, 10),
                    education: education.map(ed => ({
                        degree: ed.degree, level: ed.level, university: ed.university, fieldOfStudy: ed.fieldOfStudy || '',
                        ...(ed.graduationYear ? { graduationYear: Number(ed.graduationYear) } : {}),
                    })),
                },
            });
            setSaved(true);
            onSaved(res.writer);
        } catch (err) { setError((err as Error).message); } finally { setSaving(false); }
    };

    const bioLen = form.bio.trim().length;

    return (
        <form onSubmit={submit} className="space-y-8" noValidate>
            {locked && <Notice tone="warning">Your profile is locked while the review team assesses your application.</Notice>}

            <Section title="Profile photo">
                <PhotoUploader writer={writer} onUpdate={onUpdate ?? onSaved} disabled={locked} />
            </Section>

            <fieldset disabled={locked} className="space-y-8">
                <Section title="Location" description="Only your country is shown on your public profile.">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Country of residence" required htmlFor="pf-country"><CountrySelect id="pf-country" value={form.country} onChange={v => set('country', v)} /></Field>
                        <Field label="City" required htmlFor="pf-city"><input id="pf-city" className={inputClass} value={form.city} maxLength={80} onChange={e => set('city', e.target.value)} /></Field>
                    </div>
                </Section>

                <Section title="Professional summary">
                    <div className="space-y-5">
                        <Field label="Headline" htmlFor="pf-headline" hint="One line clients see first, e.g. “PhD economist · research methods & editing”.">
                            <input id="pf-headline" className={inputClass} maxLength={120} value={form.headline} onChange={e => set('headline', e.target.value)} />
                        </Field>
                        <Field label="Professional bio" required htmlFor="pf-bio"
                            hint={<span className={bioLen < 150 ? 'text-amber-700' : ''}>{bioLen}/3000 characters · minimum 150</span>}>
                            <textarea id="pf-bio" rows={6} maxLength={3000} className={cn(inputClass, 'resize-y')} value={form.bio} onChange={e => set('bio', e.target.value)}
                                placeholder="Your background, the kind of academic work you do best, and how you approach quality and deadlines." />
                        </Field>
                    </div>
                </Section>

                <Section title="Education" description="List your highest qualifications first. You may be asked for certificates.">
                    <div className="space-y-4">
                        {education.map((ed, i) => (
                            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                                <div className="mb-4 flex items-center justify-between">
                                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><GraduationCap className="h-4 w-4 text-[#b86e00]" /> Qualification {i + 1}</span>
                                    {education.length > 1 && (
                                        <button type="button" onClick={() => setEducation(list => list.filter((_, j) => j !== i))} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove qualification ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
                                    )}
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Level" required htmlFor={`ed-level-${i}`}>
                                        <select id={`ed-level-${i}`} className={inputClass} value={ed.level} onChange={e => setEdu(i, { level: e.target.value })}>
                                            <option value="">Select level</option>
                                            {EDUCATION_LEVELS.map(l => <option key={l}>{l}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Degree" required htmlFor={`ed-degree-${i}`}>
                                        <input id={`ed-degree-${i}`} className={inputClass} maxLength={120} placeholder="e.g. MSc Data Science" value={ed.degree} onChange={e => setEdu(i, { degree: e.target.value })} />
                                    </Field>
                                    <Field label="University / institution" required htmlFor={`ed-uni-${i}`}>
                                        <input id={`ed-uni-${i}`} className={inputClass} maxLength={160} value={ed.university} onChange={e => setEdu(i, { university: e.target.value })} />
                                    </Field>
                                    <div className="grid grid-cols-[1fr_7rem] gap-3">
                                        <Field label="Field of study" htmlFor={`ed-field-${i}`}>
                                            <input id={`ed-field-${i}`} className={inputClass} maxLength={120} value={ed.fieldOfStudy || ''} onChange={e => setEdu(i, { fieldOfStudy: e.target.value })} />
                                        </Field>
                                        <Field label="Year" htmlFor={`ed-year-${i}`}>
                                            <input id={`ed-year-${i}`} className={inputClass} inputMode="numeric" maxLength={4} placeholder="2020" value={ed.graduationYear || ''}
                                                onChange={e => setEdu(i, { graduationYear: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined })} />
                                        </Field>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {education.length < 6 && (
                            <button type="button" onClick={() => setEducation(list => [...list, emptyEducation()])} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-[#002147] hover:border-[#002147]">
                                <Plus className="h-4 w-4" /> Add another qualification
                            </button>
                        )}
                    </div>
                </Section>

                <Section title="Experience">
                    <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
                        <Field label="Years of experience" required htmlFor="pf-years">
                            <input id="pf-years" className={inputClass} inputMode="numeric" maxLength={2} value={form.yearsExperience} onChange={e => set('yearsExperience', e.target.value.replace(/\D/g, ''))} />
                        </Field>
                        <Field label="Writing experience" required htmlFor="pf-writing" hint="Publications, theses supervised or edited, types of documents you’ve produced.">
                            <textarea id="pf-writing" rows={4} maxLength={2000} className={cn(inputClass, 'resize-y')} value={form.writingExperience} onChange={e => set('writingExperience', e.target.value)} />
                        </Field>
                    </div>
                </Section>

                <Section title="Expertise & subjects" description="These drive which projects you’re matched with.">
                    <div className="space-y-5">
                        <Field label="Areas of expertise" required htmlFor="pf-expertise" hint="Press Enter or comma after each one. Up to 12.">
                            <TagInput id="pf-expertise" value={form.expertiseAreas} onChange={v => set('expertiseAreas', v)} max={12} placeholder="e.g. Qualitative research, Econometrics" />
                        </Field>
                        <Field label="Subjects" required htmlFor="pf-subjects" hint="Up to 25.">
                            <TagInput id="pf-subjects" value={form.subjects} onChange={v => set('subjects', v)} max={25} suggestions={SUGGESTED_SUBJECTS} placeholder="Start typing a subject" />
                        </Field>
                        <Field label="Academic levels you support" required>
                            <ChipGroup ariaLabel="Academic levels" options={ACADEMIC_LEVELS} value={form.academicLevels} onChange={v => set('academicLevels', v)} />
                        </Field>
                        <Field label="Languages you write in" required htmlFor="pf-languages" hint="Add proficiency if useful, e.g. “French (fluent)”.">
                            <TagInput id="pf-languages" value={form.languages} onChange={v => set('languages', v)} max={10} suggestions={SUGGESTED_LANGUAGES} placeholder="e.g. English" />
                        </Field>
                    </div>
                </Section>
            </fieldset>

            <div className="sticky bottom-0 -mx-5 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:flex-row sm:items-center sm:justify-end sm:px-8">
                {error && <p role="alert" className="text-sm font-medium text-red-600 sm:mr-auto">{error}</p>}
                {saved && !error && <p className="text-sm font-medium text-emerald-700 sm:mr-auto">Saved.</p>}
                <button type="submit" disabled={saving || locked}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white transition hover:bg-[#0b2f5c] disabled:opacity-50">
                    {saving && <Spinner className="h-4 w-4" />} {submitLabel}
                </button>
            </div>
        </form>
    );
}
