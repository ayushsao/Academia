import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Spinner } from '../../../../components/writer/WriterBits';
import { cn } from '../../../../lib/utils';
import { StatTile } from '../membership/MembershipAnalytics';
import { hasPermission, type AdminAccess } from '../access';
import { BASE, useCatalogOptions } from './shared';
import { SubjectsSection, ServicesSection, ProjectsSection, PricingSection } from './CatalogSections';
import WordConfigPanel from './WordConfigPanel';
import ContentManager from './ContentManager';
import { MediaLibrary } from './MediaLibrary';
import type { EntityType } from '../../../../lib/catalogContent';

type Section = 'dashboard' | 'subjects' | 'services' | 'projects' | 'media' | 'pricing' | 'words';
const SECTIONS: { id: Section; label: string; perms: string[] }[] = [
    { id: 'dashboard', label: 'Dashboard', perms: ['catalog.manage', 'pricing.manage'] },
    { id: 'subjects', label: 'Subjects', perms: ['catalog.manage'] },
    { id: 'services', label: 'Services', perms: ['catalog.manage'] },
    { id: 'projects', label: 'Projects', perms: ['catalog.manage'] },
    { id: 'media', label: 'Media library', perms: ['catalog.manage'] },
    { id: 'pricing', label: 'Pricing', perms: ['pricing.manage'] },
    { id: 'words', label: 'Word/Page config', perms: ['pricing.manage'] },
];

type Tally = { total: number; active: number; published: number };
type Dashboard = {
    subjects: Tally; services: Tally; projects: Tally;
    pricing: { total: number; inEffect: number; scheduled: number; currencies: string[] };
    unpricedServices: { count: number; sample: { id: string; name: string }[] };
    wordConfig: { defaultWordsPerPage: number; rounding: string; defaultSpacing: string } | null;
    recent: { action: string; by: string; reason: string; at: string }[];
};
const humanAction = (a: string) => a.replace(/^CATALOG_/, '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());

function CatalogDashboard({ token, go, canPricing }: { token: string; go: (s: Section) => void; canPricing: boolean }) {
    const [data, setData] = useState<Dashboard | null>(null);
    const [error, setError] = useState('');
    const load = useCallback(() => { setError(''); api<Dashboard>(`${BASE}/dashboard`, { token }).then(setData).catch(e => setError(e.message)); }, [token]);
    useEffect(() => { load(); }, [load]);
    if (error) return <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error} <button onClick={load} className="ml-2 underline">Try again</button></p>;
    if (!data) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>;
    const tile = (label: string, t: Tally, s: Section) => (
        <button onClick={() => go(s)} className="text-left"><StatTile label={label} value={t.total} sub={`${t.active} active · ${t.published} live`} /></button>
    );
    return (
        <div className="space-y-6">
            <div className="flex justify-end"><button onClick={load} aria-label="Refresh" className="rounded-xl border border-gray-200 bg-white p-2.5 hover:bg-gray-50"><RefreshCw className="h-4 w-4 text-gray-500" /></button></div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {tile('Subjects', data.subjects, 'subjects')}
                {tile('Services', data.services, 'services')}
                {tile('Projects', data.projects, 'projects')}
                <button onClick={() => canPricing && go('pricing')} className="text-left"><StatTile label="Price rules in effect" value={data.pricing.inEffect} sub={`${data.pricing.scheduled} scheduled · ${data.pricing.currencies.join(', ') || 'no currencies yet'}`} /></button>
            </div>
            {data.unpricedServices.count > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p><strong>{data.unpricedServices.count} active {data.unpricedServices.count === 1 ? 'service has' : 'services have'} no price in effect</strong> ({data.unpricedServices.sample.map(s => s.name).join(', ')}{data.unpricedServices.count > data.unpricedServices.sample.length ? '…' : ''}). Add a subject- or service-level rule{canPricing ? <> in <button onClick={() => go('pricing')} className="font-semibold underline">Pricing</button></> : ''}.</p>
                </div>
            )}
            <div className="grid items-start gap-5 xl:grid-cols-[1fr_1.4fr]">
                {data.wordConfig && (
                    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <h3 className="font-bold text-[#000a1e]">Word/page settings</h3>
                        <dl className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between"><dt className="text-gray-500">Default words per page</dt><dd className="font-semibold text-[#000a1e]">{data.wordConfig.defaultWordsPerPage}</dd></div>
                            <div className="flex justify-between"><dt className="text-gray-500">Rounding</dt><dd className="font-semibold text-[#000a1e]">{data.wordConfig.rounding.toLowerCase()}</dd></div>
                            <div className="flex justify-between"><dt className="text-gray-500">Default spacing</dt><dd className="font-semibold text-[#000a1e]">{data.wordConfig.defaultSpacing.toLowerCase()}</dd></div>
                        </dl>
                        <button onClick={() => go('words')} className="mt-3 text-sm font-semibold text-[#002147] hover:underline">Edit settings →</button>
                    </section>
                )}
                <section className={cn('rounded-2xl border border-gray-100 bg-white p-5 shadow-sm', !data.wordConfig && 'xl:col-span-2')}>
                    <h3 className="font-bold text-[#000a1e]">Recent changes</h3>
                    {data.recent.length === 0 ? <p className="mt-3 text-sm text-gray-400">No catalogue changes yet.</p> : (
                        <ul className="mt-3 divide-y divide-gray-50 text-sm">
                            {data.recent.map((r, i) => (
                                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                                    <span className="min-w-0"><span className="font-semibold text-[#000a1e]">{humanAction(r.action)}</span>{r.reason && <span className="text-gray-500"> — {r.reason}</span>}</span>
                                    <span className="text-xs text-gray-400">{r.by} · {new Date(r.at).toLocaleString()}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}

// Admin CRM core: academic catalogue (Subject → Service → Project) and pricing.
export default function CatalogTab({ token, access }: { token: string; access: AdminAccess | null }) {
    const sections = SECTIONS.filter(s => hasPermission(access, ...s.perms));
    const [picked, setPicked] = useState<Section | null>(null);
    const section = sections.find(s => s.id === picked)?.id || sections[0]?.id;
    const { options, reload } = useCatalogOptions(token);
    // Page builder for one entity; lists remount after it closes with changes.
    const [content, setContent] = useState<{ type: EntityType; id: string } | null>(null);
    const [listKey, setListKey] = useState(0);
    const openContent = (type: EntityType) => (id: string) => setContent({ type, id });
    if (!section) return <p className="text-sm text-gray-500">Your role doesn’t include catalogue access.</p>;
    return (
        <div className="space-y-6">
            <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 [scrollbar-width:none]" aria-label="Catalog sections">
                {sections.map(s => (
                    <button key={s.id} onClick={() => setPicked(s.id)} aria-current={section === s.id ? 'page' : undefined}
                        className={cn('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold', section === s.id ? 'border-[#fea520] text-[#000a1e]' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                        {s.label}
                    </button>
                ))}
            </nav>
            {section === 'dashboard' && <CatalogDashboard token={token} go={setPicked} canPricing={hasPermission(access, 'pricing.manage')} />}
            <React.Fragment key={listKey}>
            {section === 'subjects' && <SubjectsSection token={token} onChanged={reload} onContent={openContent('SUBJECT')} />}
            {section === 'services' && <ServicesSection token={token} options={options} onChanged={reload} onContent={openContent('SERVICE')} />}
            {section === 'projects' && <ProjectsSection token={token} options={options} onChanged={reload} onContent={openContent('PROJECT')} />}
            </React.Fragment>
            {section === 'media' && <MediaLibrary token={token} />}
            {section === 'pricing' && <PricingSection token={token} options={options} />}
            {section === 'words' && <WordConfigPanel token={token} />}
            {content && <ContentManager token={token} target={content} options={options} onClose={changed => { setContent(null); if (changed) { setListKey(k => k + 1); reload(); } }} />}
        </div>
    );
}
