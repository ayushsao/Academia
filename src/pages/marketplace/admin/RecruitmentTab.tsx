import React, { useEffect, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { api } from '../../../lib/api';
import { countryName } from '../../../lib/writerOptions';
import { Spinner } from '../../../components/writer/WriterBits';
import { ColumnChart, StatTile } from './membership/MembershipAnalytics';
import { cn } from '../../../lib/utils';

type Data = {
    funnel: { key: string; label: string; n: number; ofPrevious: number | null; ofRegistered: number | null }[];
    byCountry: { country: string; registered: number; approved: number }[];
    weeklyRegistrations: { week: string; registrations: number }[];
    leads: { total: number; unread: number; last30Days: number };
};

const BAR = '#2f6db5'; // validated single-series colour (see membership analytics)

// Writer acquisition for Marketing/HR. Aggregates only — no personal data.
export default function RecruitmentTab({ token, canSeeLeads, onOpenLeads }: { token: string; canSeeLeads?: boolean; onOpenLeads?: () => void }) {
    const [d, setD] = useState<Data | null>(null);
    const [error, setError] = useState('');
    const [asTable, setAsTable] = useState(false);
    useEffect(() => { api<Data>('/admin/insights/recruitment', { token }).then(setD).catch(e => setError(e.message)); }, [token]);

    if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>;
    if (!d) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>;
    const top = Math.max(1, d.funnel[0]?.n || 0);
    const approvalRate = d.funnel.find(f => f.key === 'approved')?.ofRegistered;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile label="Registered writers" value={d.funnel[0]?.n ?? 0} />
                <StatTile label="Applications submitted" value={d.funnel.find(f => f.key === 'submitted')?.n ?? 0} />
                <StatTile label="Approval rate" value={approvalRate === null || approvalRate === undefined ? '—' : `${approvalRate}%`} sub="of registrations" />
                <StatTile label="Contact enquiries" value={d.leads.total} sub={<>{d.leads.last30Days} in 30 days · {d.leads.unread} unread{canSeeLeads && onOpenLeads && <> · <button onClick={onOpenLeads} className="font-semibold text-[#002147] hover:underline">Open</button></>}</>} />
            </div>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#000a1e]">Application funnel</h3>
                    <button onClick={() => setAsTable(v => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100">
                        {asTable ? <><BarChart3 className="h-4 w-4" /> Chart view</> : <><Table2 className="h-4 w-4" /> Table view</>}
                    </button>
                </div>
                {asTable ? (
                    <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs uppercase tracking-wider text-gray-400"><th className="py-2 font-semibold">Stage</th><th className="py-2 text-right font-semibold">Writers</th><th className="py-2 text-right font-semibold">From previous</th><th className="py-2 text-right font-semibold">Of registered</th></tr></thead>
                        <tbody className="divide-y divide-gray-50">{d.funnel.map(f => (
                            <tr key={f.key}><td className="py-2">{f.label}</td><td className="py-2 text-right tabular-nums">{f.n}</td><td className="py-2 text-right tabular-nums text-gray-500">{f.ofPrevious === null ? '—' : `${f.ofPrevious}%`}</td><td className="py-2 text-right tabular-nums text-gray-500">{f.ofRegistered === null ? '—' : `${f.ofRegistered}%`}</td></tr>
                        ))}</tbody>
                    </table>
                ) : (
                    <ol className="space-y-3">
                        {d.funnel.map(f => (
                            <li key={f.key} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_6rem]">
                                <span className="truncate text-gray-600">{f.label}</span>
                                <span className="relative h-6" title={`${f.label}: ${f.n}`}>
                                    <span className="absolute inset-y-1 left-0 max-w-full rounded-r-[4px]" style={{ width: `${(f.n / top) * 100}%`, minWidth: f.n ? 2 : 0, background: BAR }} />
                                </span>
                                <span className="text-right tabular-nums"><span className="font-semibold text-[#000a1e]">{f.n}</span>{f.ofPrevious !== null && <span className="ml-1 text-xs text-gray-400">{f.ofPrevious}%</span>}</span>
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    {d.weeklyRegistrations.length ? (
                        <ColumnChart title="Registrations per week (last 12 weeks)" ariaUnit="registrations" integer format={v => String(Math.round(v))}
                            data={d.weeklyRegistrations.map(w => ({ label: w.week.slice(5), value: w.registrations, detail: w.week }))} />
                    ) : <p className="text-sm text-gray-500">No registrations in the last 12 weeks.</p>}
                </section>
                <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <h3 className="border-b border-gray-100 px-5 py-3 text-sm font-bold text-[#000a1e]">Top countries</h3>
                    {d.byCountry.length === 0 ? <p className="px-5 py-6 text-sm text-gray-400">No data yet.</p> : (
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs uppercase tracking-wider text-gray-400"><th className="px-5 py-2 font-semibold">Country</th><th className="px-5 py-2 text-right font-semibold">Registered</th><th className="px-5 py-2 text-right font-semibold">Approved</th></tr></thead>
                            <tbody className="divide-y divide-gray-50">{d.byCountry.map(c => (
                                <tr key={c.country}><td className="px-5 py-2.5">{countryName(c.country)}</td><td className="px-5 py-2.5 text-right tabular-nums">{c.registered}</td><td className={cn('px-5 py-2.5 text-right tabular-nums', c.approved ? 'text-[#000a1e]' : 'text-gray-400')}>{c.approved}</td></tr>
                            ))}</tbody>
                        </table>
                    )}
                </section>
            </div>
        </div>
    );
}
