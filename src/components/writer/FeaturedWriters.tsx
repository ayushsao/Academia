// import React, { useEffect, useState } from 'react';
// import { Link } from 'react-router-dom';
// import { BadgeCheck } from 'lucide-react';
// import { api } from '../../lib/api';
// import type { PublicWriter } from '../../lib/writerTypes';
// import { WriterAvatar } from './WriterBits';

// // Real writers from the public directory for menus and teasers — names,
// // photos, degrees and ratings are the writers' own, never hardcoded personas.
// // One request per page load, shared by every menu that shows them.
// let featured: Promise<PublicWriter[]> | null = null;
// const loadFeatured = () => {
//     if (!featured) featured = api<{ writers: PublicWriter[] }>('/writers/public?limit=12').then(r => r.writers).catch(() => { featured = null; return []; });
//     return featured;
// };

// export function useFeaturedWriters() {
//     const [writers, setWriters] = useState<PublicWriter[] | null>(null);
//     useEffect(() => { let live = true; loadFeatured().then(w => { if (live) setWriters(w); }); return () => { live = false; }; }, []);
//     return writers;
// }

// // Shown only while no real writer is public. Always labelled "Sample profile",
// // with illustrated avatars (Notionists by Zoish, CC0 — public/avatars/samples)
// // rather than photos, no "verified" mark, and no ratings or order counts, so
// // nobody mistakes them for real people.
// const sampleAvatar = (slug: string) => `/avatars/samples/${slug}.svg`;
// export type SampleWriter = {
//     slug: string; name: string; country: string; area: string; avatar: string;
//     headline: string; qualification: string; yearsExperience: number;
//     subjects: string[]; levels: string[]; languages: string[]; services: string[]; bio: string;
// };
// const sample = (s: Omit<SampleWriter, 'avatar'>): SampleWriter => ({ ...s, avatar: sampleAvatar(s.slug) });
// export const SAMPLE_WRITERS: SampleWriter[] = [
//     sample({ slug: 'ananya-iyer', name: 'Ananya Iyer', country: 'India', area: 'Nursing & Healthcare', headline: 'Nursing care plans, reflective essays and evidence-based practice',
//         qualification: "Master's level", yearsExperience: 6, subjects: ['Nursing', 'Public Health', 'Healthcare Management'], levels: ['Undergraduate', "Master's"],
//         languages: ['English', 'Hindi'], services: ['Care plans', 'Reflective essays (Gibbs)', 'Literature reviews'],
//         bio: 'Writes nursing and healthcare work grounded in current clinical guidelines, from care plans and case studies to reflective essays using Gibbs and Driscoll.' }),
//     sample({ slug: 'james-whitfield', name: 'James Whitfield', country: 'United Kingdom', area: 'Law & Legal Studies', headline: 'Problem questions, case analysis and OSCOLA referencing',
//         qualification: "Master's level", yearsExperience: 8, subjects: ['Contract Law', 'Criminal Law', 'EU Law'], levels: ['Undergraduate', "Master's"],
//         languages: ['English'], services: ['Problem questions', 'Case notes', 'Dissertations'],
//         bio: 'Structures legal answers with IRAC, applies case law and statute precisely, and references in OSCOLA.' }),
//     sample({ slug: 'chloe-nguyen', name: 'Chloe Nguyen', country: 'Australia', area: 'Psychology', headline: 'Research methods, lab reports and APA 7 writing',
//         qualification: 'PhD level', yearsExperience: 7, subjects: ['Psychology', 'Research Methods', 'Statistics (SPSS)'], levels: ['Undergraduate', "Master's", 'PhD'],
//         languages: ['English', 'Vietnamese'], services: ['Lab reports', 'Literature reviews', 'Data analysis'],
//         bio: 'Helps with psychology research from design to write-up, including SPSS analysis and clear APA 7 reporting.' }),
//     sample({ slug: 'marcus-bell', name: 'Marcus Bell', country: 'United States', area: 'Business & Finance', headline: 'Business reports, case studies and financial analysis',
//         qualification: "Master's level (MBA)", yearsExperience: 9, subjects: ['Management', 'Finance', 'Marketing'], levels: ['Undergraduate', "Master's"],
//         languages: ['English'], services: ['Business reports', 'Case studies', 'Financial modelling'],
//         bio: 'Turns business briefs into structured reports and case analyses using SWOT, PESTLE and financial ratios.' }),
//     sample({ slug: 'lea-moreau', name: 'Léa Moreau', country: 'France', area: 'Literature & Humanities', headline: 'Literary analysis, comparative essays and critical theory',
//         qualification: 'PhD level', yearsExperience: 10, subjects: ['English Literature', 'Philosophy', 'History'], levels: ['Undergraduate', "Master's", 'PhD'],
//         languages: ['English', 'French'], services: ['Critical essays', 'Close reading', 'Dissertations'],
//         bio: 'Writes close readings and comparative essays that engage with critical theory and secondary criticism.' }),
//     sample({ slug: 'rahul-mehta', name: 'Rahul Mehta', country: 'India', area: 'Computer Science', headline: 'Programming assignments, algorithms and technical reports',
//         qualification: "Master's level", yearsExperience: 6, subjects: ['Computer Science', 'Data Structures', 'Machine Learning'], levels: ['Undergraduate', "Master's"],
//         languages: ['English', 'Hindi'], services: ['Python / Java / C++', 'Technical reports', 'Project documentation'],
//         bio: 'Builds and documents programming assignments with clean, commented code and clear technical write-ups.' }),
//     sample({ slug: 'olivia-grant', name: 'Olivia Grant', country: 'Canada', area: 'Education', headline: 'Lesson plans, education research and reflective practice',
//         qualification: "Master's level", yearsExperience: 7, subjects: ['Education', 'Early Childhood Studies', 'Educational Psychology'], levels: ['Undergraduate', "Master's"],
//         languages: ['English', 'French'], services: ['Lesson plans', 'Reflective journals', 'Research proposals'],
//         bio: 'Supports education students with lesson planning, pedagogy essays and practice-based reflection.' }),
//     sample({ slug: 'lukas-weber', name: 'Lukas Weber', country: 'Germany', area: 'Engineering', headline: 'Engineering calculations, lab reports and design projects',
//         qualification: "Master's level", yearsExperience: 8, subjects: ['Mechanical Engineering', 'Thermodynamics', 'MATLAB'], levels: ['Undergraduate', "Master's"],
//         languages: ['English', 'German'], services: ['Lab reports', 'Design reports', 'Calculations'],
//         bio: 'Works through engineering problems step by step and writes design and lab reports with clear figures.' }),
//     sample({ slug: 'fatima-khan', name: 'Fatima Khan', country: 'United Arab Emirates', area: 'Economics', headline: 'Econometrics, economic essays and policy analysis',
//         qualification: "Master's level", yearsExperience: 5, subjects: ['Economics', 'Econometrics', 'Development Studies'], levels: ['Undergraduate', "Master's"],
//         languages: ['English', 'Arabic', 'Urdu'], services: ['Economic essays', 'Stata / EViews analysis', 'Policy briefs'],
//         bio: 'Explains economic theory clearly and supports quantitative work with Stata and EViews.' }),
//     sample({ slug: 'daniel-okafor', name: 'Daniel Okafor', country: 'Nigeria', area: 'Accounting', headline: 'Financial accounting, auditing and management accounting',
//         qualification: "Master's level", yearsExperience: 6, subjects: ['Accounting', 'Auditing', 'Taxation'], levels: ['Undergraduate', "Master's"],
//         languages: ['English'], services: ['Financial statements', 'Case studies', 'Excel workings'],
//         bio: 'Prepares accounting workings and reports with clear, checkable calculations and IFRS references.' }),
// ];

// // Full details of a sample profile, clearly marked as an example.
// export function SampleWriterDialog({ s, onClose, onOrder }: { s: SampleWriter; onClose: () => void; onOrder?: () => void }) {
//     useEffect(() => {
//         const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
//         window.addEventListener('keydown', onKey);
//         return () => window.removeEventListener('keydown', onKey);
//     }, [onClose]);
//     const row = (label: string, value: React.ReactNode) => (
//         <div>
//             <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</dt>
//             <dd className="mt-1 text-sm text-[#0b1b33]">{value}</dd>
//         </div>
//     );
//     const chips = (items: string[]) => <span className="flex flex-wrap gap-1.5">{items.map(i => <span key={i} className="rounded-md bg-[#002147]/[0.05] px-2 py-1 text-xs font-medium text-[#002147]">{i}</span>)}</span>;
//     return (
//         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#000a1e]/50 p-4 backdrop-blur-sm" onClick={onClose}>
//             <div role="dialog" aria-modal="true" aria-labelledby="sample-writer-name" onClick={e => e.stopPropagation()}
//                 className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
//                 {/* Cover with the avatar */}
//                 <div className="relative h-28 rounded-t-3xl bg-gradient-to-br from-[#000a1e] via-[#002147] to-[#0b3a6e]">
//                     <div aria-hidden="true" className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#fea520]/20 blur-2xl" />
//                     <p className="absolute left-5 top-4 text-[11px] font-medium text-white/60">Sample profile · an example of how writer profiles appear</p>
//                     <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-3 rounded-full bg-white/10 px-2.5 py-1 text-white/80 hover:bg-white/20 hover:text-white">✕</button>
//                     <img src={s.avatar} alt={`${s.name} avatar`} className="absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-white shadow-lg ring-4 ring-white" />
//                 </div>
//                 <div className="px-6 pb-6 pt-14">
//                     <div className="min-w-0">
//                         <h2 id="sample-writer-name" className="text-2xl font-bold text-[#0b1b33]">{s.name}</h2>
//                         <p className="mt-0.5 text-sm text-slate-600">{s.headline}</p>
//                         <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
//                             <span className="rounded-full bg-[#fea520]/15 px-3 py-1 text-[#b86e00]">{s.area}</span>
//                             <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{s.country}</span>
//                             <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{s.yearsExperience} yrs experience</span>
//                         </div>
//                     </div>
//                     <p className="mt-5 text-sm leading-relaxed text-slate-700">{s.bio}</p>
//                     <dl className="mt-5 grid gap-4 sm:grid-cols-2">
//                         {row('Main area', s.area)}
//                         {row('Country', s.country)}
//                         {row('Qualification', s.qualification)}
//                         {row('Experience', `${s.yearsExperience} years`)}
//                         <div className="sm:col-span-2">{row('Subjects', chips(s.subjects))}</div>
//                         <div className="sm:col-span-2">{row('Can help with', chips(s.services))}</div>
//                         {row('Academic levels', s.levels.join(', '))}
//                         {row('Languages', s.languages.join(', '))}
//                     </dl>
//                     {onOrder && (
//                         <button type="button" onClick={onOrder} className="mt-5 w-full rounded-xl bg-[#000a1e] py-3 text-sm font-bold text-white hover:bg-[#002147]">Order in {s.area}</button>
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// }

// // While few real writers are public, the sample profiles are listed after them
// // (always under a "Sample profiles" label).
// export const SAMPLE_FILL_BELOW = 8;
// export const showSampleWriters = (realCount: number | null | undefined) => realCount != null && realCount < SAMPLE_FILL_BELOW;

// export function SampleWriterItem({ s, compact, onClick }: { s: SampleWriter; compact?: boolean; onClick?: () => void }) {
//     return (
//         <button type="button" onClick={onClick} title="Sample profile"
//             className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${compact ? 'hover:bg-gray-100' : 'border border-transparent hover:border-gray-200 hover:bg-gray-50'}`}>
//             <img src={s.avatar} alt="" aria-hidden loading="lazy" decoding="async" className={`shrink-0 rounded-full bg-white object-cover ring-2 ring-[#fea520]/25 ${compact ? 'h-8 w-8' : 'h-10 w-10'}`} />
//             <span className="min-w-0 overflow-hidden">
//                 <span className={`block truncate font-bold text-[#000a1e] ${compact ? 'text-xs' : 'text-[13px]'}`}>{s.name}</span>
//                 <span className="block truncate text-[10px] font-bold uppercase text-gray-400">{s.area} · {s.country}</span>
//             </span>
//         </button>
//     );
// }

// const summary = (w: PublicWriter) => w.topDegree || w.headline || w.subjects[0] || 'Academic writer';
// const rating = (w: PublicWriter) => (w.metrics.ratingCount ? `★ ${w.metrics.rating.toFixed(1)}/5` : 'New');

// export function FeaturedWriterLink({ w, compact, onNavigate }: { w: PublicWriter; compact?: boolean; onNavigate?: () => void }) {
//     return (
//         <Link to={`/writer/${w.id}`} onClick={onNavigate}
//             className={compact ? 'flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-100' : 'group/writer flex items-center gap-3 rounded-lg border border-transparent p-2 transition-all hover:border-gray-200 hover:bg-gray-50'}>
//             <span className="relative shrink-0">
//                 <WriterAvatar writerId={w.id} name={w.name} hasPhoto={w.hasPhoto} version={w.photoVersion} size={compact ? 32 : 40} />
//                 {w.availability === 'AVAILABLE' && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" aria-label="Available" />}
//             </span>
//             <span className="min-w-0 overflow-hidden">
//                 <span className={`flex items-center gap-1 truncate font-bold text-[#000a1e] ${compact ? 'text-xs' : 'text-[13px] transition-colors group-hover/writer:text-[#fea520]'}`}>
//                     <span className="truncate">{w.name}</span>
//                     {w.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#b86e00]" aria-label="Verified writer" />}
//                 </span>
//                 <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400">
//                     <span className="truncate">{summary(w)}</span>
//                     <span className="h-1 w-1 shrink-0 rounded-full bg-gray-300" />
//                     <span className="shrink-0 text-[#fea520]">{rating(w)}</span>
//                 </span>
//             </span>
//         </Link>
//     );
// }

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { api } from '../../lib/api';
import type { PublicWriter } from '../../lib/writerTypes';
import { WriterAvatar } from './WriterBits';

// Real writers from the public directory for menus and teasers — names,
// photos, degrees and ratings are the writers' own, never hardcoded personas.
// One request per page load, shared by every menu that shows them.
let featured: Promise<PublicWriter[]> | null = null;
const loadFeatured = () => {
    if (!featured) featured = api<{ writers: PublicWriter[] }>('/writers/public?limit=12').then(r => r.writers).catch(() => { featured = null; return []; });
    return featured;
};

export function useFeaturedWriters() {
    const [writers, setWriters] = useState<PublicWriter[] | null>(null);
    useEffect(() => { let live = true; loadFeatured().then(w => { if (live) setWriters(w); }); return () => { live = false; }; }, []);
    return writers;
}

// Shown only while no real writer is public. Always labelled "Sample profile",
// with illustrated avatars (Notionists by Zoish, CC0 — public/avatars/samples)
// rather than photos, no "verified" mark, and no ratings or order counts, so
// nobody mistakes them for real people.
const sampleAvatar = (slug: string) => `/avatars/samples/${slug}.svg`;
export type SampleWriter = {
    slug: string; name: string; country: string; area: string; avatar: string;
    headline: string; qualification: string; yearsExperience: number;
    subjects: string[]; levels: string[]; languages: string[]; services: string[]; bio: string;
};
const sample = (s: Omit<SampleWriter, 'avatar'>): SampleWriter => ({ ...s, avatar: sampleAvatar(s.slug) });
export const SAMPLE_WRITERS: SampleWriter[] = [
    sample({ slug: 'ananya-iyer', name: 'Ananya Iyer', country: 'India', area: 'Nursing & Healthcare', headline: 'Nursing care plans, reflective essays and evidence-based practice',
        qualification: "Master's level", yearsExperience: 6, subjects: ['Nursing', 'Public Health', 'Healthcare Management'], levels: ['Undergraduate', "Master's"],
        languages: ['English', 'Hindi'], services: ['Care plans', 'Reflective essays (Gibbs)', 'Literature reviews'],
        bio: 'Writes nursing and healthcare work grounded in current clinical guidelines, from care plans and case studies to reflective essays using Gibbs and Driscoll.' }),
    sample({ slug: 'james-whitfield', name: 'James Whitfield', country: 'United Kingdom', area: 'Law & Legal Studies', headline: 'Problem questions, case analysis and OSCOLA referencing',
        qualification: "Master's level", yearsExperience: 8, subjects: ['Contract Law', 'Criminal Law', 'EU Law'], levels: ['Undergraduate', "Master's"],
        languages: ['English'], services: ['Problem questions', 'Case notes', 'Dissertations'],
        bio: 'Structures legal answers with IRAC, applies case law and statute precisely, and references in OSCOLA.' }),
    sample({ slug: 'chloe-nguyen', name: 'Chloe Nguyen', country: 'Australia', area: 'Psychology', headline: 'Research methods, lab reports and APA 7 writing',
        qualification: 'PhD level', yearsExperience: 7, subjects: ['Psychology', 'Research Methods', 'Statistics (SPSS)'], levels: ['Undergraduate', "Master's", 'PhD'],
        languages: ['English', 'Vietnamese'], services: ['Lab reports', 'Literature reviews', 'Data analysis'],
        bio: 'Helps with psychology research from design to write-up, including SPSS analysis and clear APA 7 reporting.' }),
    sample({ slug: 'marcus-bell', name: 'Marcus Bell', country: 'United States', area: 'Business & Finance', headline: 'Business reports, case studies and financial analysis',
        qualification: "Master's level (MBA)", yearsExperience: 9, subjects: ['Management', 'Finance', 'Marketing'], levels: ['Undergraduate', "Master's"],
        languages: ['English'], services: ['Business reports', 'Case studies', 'Financial modelling'],
        bio: 'Turns business briefs into structured reports and case analyses using SWOT, PESTLE and financial ratios.' }),
    sample({ slug: 'lea-moreau', name: 'Léa Moreau', country: 'France', area: 'Literature & Humanities', headline: 'Literary analysis, comparative essays and critical theory',
        qualification: 'PhD level', yearsExperience: 10, subjects: ['English Literature', 'Philosophy', 'History'], levels: ['Undergraduate', "Master's", 'PhD'],
        languages: ['English', 'French'], services: ['Critical essays', 'Close reading', 'Dissertations'],
        bio: 'Writes close readings and comparative essays that engage with critical theory and secondary criticism.' }),
    sample({ slug: 'rahul-mehta', name: 'Rahul Mehta', country: 'India', area: 'Computer Science', headline: 'Programming assignments, algorithms and technical reports',
        qualification: "Master's level", yearsExperience: 6, subjects: ['Computer Science', 'Data Structures', 'Machine Learning'], levels: ['Undergraduate', "Master's"],
        languages: ['English', 'Hindi'], services: ['Python / Java / C++', 'Technical reports', 'Project documentation'],
        bio: 'Builds and documents programming assignments with clean, commented code and clear technical write-ups.' }),
    sample({ slug: 'olivia-grant', name: 'Olivia Grant', country: 'Canada', area: 'Education', headline: 'Lesson plans, education research and reflective practice',
        qualification: "Master's level", yearsExperience: 7, subjects: ['Education', 'Early Childhood Studies', 'Educational Psychology'], levels: ['Undergraduate', "Master's"],
        languages: ['English', 'French'], services: ['Lesson plans', 'Reflective journals', 'Research proposals'],
        bio: 'Supports education students with lesson planning, pedagogy essays and practice-based reflection.' }),
    sample({ slug: 'lukas-weber', name: 'Lukas Weber', country: 'Germany', area: 'Engineering', headline: 'Engineering calculations, lab reports and design projects',
        qualification: "Master's level", yearsExperience: 8, subjects: ['Mechanical Engineering', 'Thermodynamics', 'MATLAB'], levels: ['Undergraduate', "Master's"],
        languages: ['English', 'German'], services: ['Lab reports', 'Design reports', 'Calculations'],
        bio: 'Works through engineering problems step by step and writes design and lab reports with clear figures.' }),
    sample({ slug: 'fatima-khan', name: 'Fatima Khan', country: 'United Arab Emirates', area: 'Economics', headline: 'Econometrics, economic essays and policy analysis',
        qualification: "Master's level", yearsExperience: 5, subjects: ['Economics', 'Econometrics', 'Development Studies'], levels: ['Undergraduate', "Master's"],
        languages: ['English', 'Arabic', 'Urdu'], services: ['Economic essays', 'Stata / EViews analysis', 'Policy briefs'],
        bio: 'Explains economic theory clearly and supports quantitative work with Stata and EViews.' }),
    sample({ slug: 'daniel-okafor', name: 'Daniel Okafor', country: 'Nigeria', area: 'Accounting', headline: 'Financial accounting, auditing and management accounting',
        qualification: "Master's level", yearsExperience: 6, subjects: ['Accounting', 'Auditing', 'Taxation'], levels: ['Undergraduate', "Master's"],
        languages: ['English'], services: ['Financial statements', 'Case studies', 'Excel workings'],
        bio: 'Prepares accounting workings and reports with clear, checkable calculations and IFRS references.' }),
];

// Full details of a sample profile, clearly marked as an example.
export function SampleWriterDialog({ s, onClose, onOrder }: { s: SampleWriter; onClose: () => void; onOrder?: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const row = (label: string, value: React.ReactNode) => (
        <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm text-[#0b1b33]">{value}</dd>
        </div>
    );
    const chips = (items: string[]) => <span className="flex flex-wrap gap-1.5">{items.map(i => <span key={i} className="rounded-md bg-[#002147]/[0.05] px-2 py-1 text-xs font-medium text-[#002147]">{i}</span>)}</span>;
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#000a1e]/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="sample-writer-name" onClick={e => e.stopPropagation()}
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
                {/* Cover with the avatar */}
                <div className="relative h-28 rounded-t-3xl bg-gradient-to-br from-[#000a1e] via-[#002147] to-[#0b3a6e]">
                    <div aria-hidden="true" className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#fea520]/20 blur-2xl" />
                    <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-3 rounded-full bg-white/10 px-2.5 py-1 text-white/80 hover:bg-white/20 hover:text-white">✕</button>
                    <img src={s.avatar} alt={`${s.name} avatar`} className="absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-white shadow-lg ring-4 ring-white" />
                </div>
                <div className="px-6 pb-6 pt-14">
                    <div className="min-w-0">
                        <h2 id="sample-writer-name" className="text-2xl font-bold text-[#0b1b33]">{s.name}</h2>
                        <p className="mt-0.5 text-sm text-slate-600">{s.headline}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-[#fea520]/15 px-3 py-1 text-[#b86e00]">{s.area}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{s.country}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{s.yearsExperience} yrs experience</span>
                        </div>
                    </div>
                    <p className="mt-5 text-sm leading-relaxed text-slate-700">{s.bio}</p>
                    <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                        {row('Main area', s.area)}
                        {row('Country', s.country)}
                        {row('Qualification', s.qualification)}
                        {row('Experience', `${s.yearsExperience} years`)}
                        <div className="sm:col-span-2">{row('Subjects', chips(s.subjects))}</div>
                        <div className="sm:col-span-2">{row('Can help with', chips(s.services))}</div>
                        {row('Academic levels', s.levels.join(', '))}
                        {row('Languages', s.languages.join(', '))}
                    </dl>
                    {onOrder && (
                        <button type="button" onClick={onOrder} className="mt-5 w-full rounded-xl bg-[#000a1e] py-3 text-sm font-bold text-white hover:bg-[#002147]">Order in {s.area}</button>
                    )}
                </div>
            </div>
        </div>
    );
}

// While few real writers are public, the sample profiles are listed after them
// (always under a "Sample profiles" label).
export const SAMPLE_FILL_BELOW = 8;
export const showSampleWriters = (realCount: number | null | undefined) => realCount != null && realCount < SAMPLE_FILL_BELOW;

export function SampleWriterItem({ s, compact, onClick }: { s: SampleWriter; compact?: boolean; onClick?: () => void }) {
    return (
        <button type="button" onClick={onClick} title="Sample profile"
            className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${compact ? 'hover:bg-gray-100' : 'border border-transparent hover:border-gray-200 hover:bg-gray-50'}`}>
            <img src={s.avatar} alt="" aria-hidden loading="lazy" decoding="async" className={`shrink-0 rounded-full bg-white object-cover ring-2 ring-[#fea520]/25 ${compact ? 'h-8 w-8' : 'h-10 w-10'}`} />
            <span className="min-w-0 overflow-hidden">
                <span className={`block truncate font-bold text-[#000a1e] ${compact ? 'text-xs' : 'text-[13px]'}`}>{s.name}</span>
                <span className="block truncate text-[10px] font-bold uppercase text-gray-400">{s.area} · {s.country}</span>
            </span>
        </button>
    );
}

const summary = (w: PublicWriter) => w.topDegree || w.headline || w.subjects[0] || 'Academic writer';
const rating = (w: PublicWriter) => (w.metrics.ratingCount ? `★ ${w.metrics.rating.toFixed(1)}/5` : 'New');

export function FeaturedWriterLink({ w, compact, onNavigate }: { w: PublicWriter; compact?: boolean; onNavigate?: () => void }) {
    return (
        <Link to={`/writer/${w.id}`} onClick={onNavigate}
            className={compact ? 'flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-100' : 'group/writer flex items-center gap-3 rounded-lg border border-transparent p-2 transition-all hover:border-gray-200 hover:bg-gray-50'}>
            <span className="relative shrink-0">
                <WriterAvatar writerId={w.id} name={w.name} hasPhoto={w.hasPhoto} version={w.photoVersion} size={compact ? 32 : 40} />
                {w.availability === 'AVAILABLE' && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" aria-label="Available" />}
            </span>
            <span className="min-w-0 overflow-hidden">
                <span className={`flex items-center gap-1 truncate font-bold text-[#000a1e] ${compact ? 'text-xs' : 'text-[13px] transition-colors group-hover/writer:text-[#fea520]'}`}>
                    <span className="truncate">{w.name}</span>
                    {w.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#b86e00]" aria-label="Verified writer" />}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400">
                    <span className="truncate">{summary(w)}</span>
                    <span className="h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                    <span className="shrink-0 text-[#fea520]">{rating(w)}</span>
                </span>
            </span>
        </Link>
    );
}
