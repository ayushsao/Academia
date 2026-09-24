import React, { useState } from 'react';
import { api } from '../../../lib/api';
import type { WriterMe } from '../../../lib/writerTypes';
import { MAX_SKILLS, PREDEFINED_SKILLS } from '../../../lib/writerOptions';
import { ChipGroup, Notice } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';

export default function SkillsForm({ writer, onSaved, submitLabel = 'Save skills' }: {
    writer: WriterMe; onSaved: (w: WriterMe) => void; submitLabel?: string;
}) {
    const [skills, setSkills] = useState<string[]>(writer.skills.map(s => s.name));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const locked = !writer.onboarding.canEdit;

    const save = async () => {
        if (!skills.length) { setError('Select at least one skill.'); return; }
        setSaving(true); setError('');
        try {
            const res = await api<{ writer: WriterMe }>('/writers/skills', { method: 'PUT', body: { skills } });
            setSaved(true);
            onSaved(res.writer);
        } catch (err) { setError((err as Error).message); } finally { setSaving(false); }
    };

    return (
        <div className="space-y-6">
            {locked && <Notice tone="warning">Skills can’t be changed while your application is in review.</Notice>}
            <p className="text-sm text-slate-600">Pick everything you can deliver to a professional standard, and add specialist skills that aren’t listed (for example “SPSS”, “APA 7th”, “Python”). <span className="font-semibold text-slate-800">{skills.length}/{MAX_SKILLS}</span> selected.</p>
            <fieldset disabled={locked}>
                <ChipGroup ariaLabel="Skills" options={PREDEFINED_SKILLS} value={skills} onChange={v => { setSkills(v); setSaved(false); }}
                    allowCustom max={MAX_SKILLS} customPlaceholder="Add a custom skill" />
            </fieldset>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
                {error && <p role="alert" className="text-sm font-medium text-red-600 sm:mr-auto">{error}</p>}
                {saved && !error && <p className="text-sm font-medium text-emerald-700 sm:mr-auto">Saved.</p>}
                <button type="button" onClick={save} disabled={saving || locked}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white transition hover:bg-[#0b2f5c] disabled:opacity-50">
                    {saving && <Spinner className="h-4 w-4" />} {submitLabel}
                </button>
            </div>
        </div>
    );
}
