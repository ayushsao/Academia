import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Briefcase, CheckCircle2, Star, Gauge, Timer, MessageCircle, Crown, Bell, ArrowRight, CircleCheck, Circle } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatDate, formatMoney } from '../../../lib/money';
import type { ByStatusCurrency } from '../../../lib/assignmentTypes';
import { AssignmentBadge, Countdown } from '../../../components/writer/AssignmentBits';
import { MembershipDisclaimer } from '../../../components/writer/MembershipBits';
import { Notice } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

type Dashboard = {
    profileCompletion: { percent: number; items: Record<string, boolean> };
    membership: { plan: string | null; status: string; renewsAt?: string; autoRenew?: boolean };
    opportunities: { available: number; active: number; completed: number };
    workload: { active: number; limit: number; availability: string };
    upcoming: { ref: string; title: string; status: any; dueAt: string }[];
    metrics: { rating: number; ratingCount: number; completedAssignments: number; qualityScore: number; responseRate: number; completionRate: number; onTimeRate: number };
    earnings: ByStatusCurrency;
    notifications: { unread: number; latest: { id: string; title: string; message: string; read: boolean; createdAt: string }[] };
    disclaimer: string;
};

const PROFILE_ITEM_LABELS: Record<string, string> = {
    profileComplete: 'Professional profile', photoUploaded: 'Profile photo',
    skillsAdded: 'Skills', resumeUploaded: 'Resume / CV', headline: 'Headline', timezone: 'Time zone (Settings)', writingSample: 'Writing sample', certificate: 'Certificate',
};

const money = (by?: Record<string, number>) => (by && Object.keys(by).length ? Object.entries(by).map(([c, v]) => formatMoney(v, c)).join(' · ') : '—');

function Tile({ icon: Icon, label, value, sub, to }: { icon: typeof Inbox; label: string; value: React.ReactNode; sub?: string; to?: string }) {
    const body = (
        <>
            <Icon className="h-5 w-5 text-[#b86e00]" />
            <p className="mt-3 text-sm text-slate-500">{label}</p>
            <p className="mt-0.5 text-2xl font-semibold text-[#0b1b33]">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </>
    );
    const cls = 'block rounded-2xl border border-slate-200 bg-white p-5 transition';
    return to ? <Link to={to} className={cn(cls, 'hover:border-[#002147]/30 hover:shadow-sm')}>{body}</Link> : <div className={cls}>{body}</div>;
}

export default function WriterWorkDashboard() {
    const [d, setD] = useState<Dashboard | null>(null);
    const [error, setError] = useState('');
    useEffect(() => { api<Dashboard>('/assignments/writer/dashboard').then(setD).catch(e => setError(e.message)); }, []);

    if (error) return <Notice tone="error">{error}</Notice>;
    if (!d) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8 text-[#002147]" /></div>;
    const m = d.metrics;
    const hasHistory = m.completedAssignments > 0;
    const pctOr = (v: number) => (hasHistory ? `${Math.round(v)}%` : '—');
    const missing = Object.entries(d.profileCompletion.items).filter(([, ok]) => !ok);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Dashboard</h1>
                    <p className="mt-1 text-slate-600">Workload {d.workload.active}/{d.workload.limit} · {d.workload.availability === 'AVAILABLE' ? 'available for new work' : 'not taking new work'}</p>
                </div>
                {d.opportunities.available > 0 && (
                    <Link to="/writer/opportunities" className="inline-flex items-center gap-2 self-start rounded-xl bg-[#fea520] px-5 py-3 font-bold text-[#0b1b33] sm:self-auto">
                        {d.opportunities.available} new opportunit{d.opportunities.available === 1 ? 'y' : 'ies'} <ArrowRight className="h-4 w-4" />
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile icon={Inbox} label="Available" value={d.opportunities.available} sub="Offers awaiting your reply" to="/writer/opportunities" />
                <Tile icon={Briefcase} label="Assigned" value={d.opportunities.active} sub="In progress or in review" to="/writer/assignments" />
                <Tile icon={CheckCircle2} label="Completed" value={d.opportunities.completed} to="/writer/history" />
                <Tile icon={Star} label="Rating" value={m.ratingCount ? m.rating.toFixed(2) : 'New'} sub={m.ratingCount ? `${m.ratingCount} rated assignment${m.ratingCount === 1 ? '' : 's'}` : 'No ratings yet'} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Performance</h2>
                    <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {[
                            { icon: Gauge, label: 'Quality score', value: hasHistory ? Math.round(m.qualityScore) : '—' },
                            { icon: CheckCircle2, label: 'Completion', value: pctOr(m.completionRate) },
                            { icon: Timer, label: 'On time', value: pctOr(m.onTimeRate) },
                            { icon: MessageCircle, label: 'Response rate', value: m.responseRate || d.opportunities.completed ? `${Math.round(m.responseRate)}%` : '—' },
                        ].map(x => (
                            <div key={x.label}><dt className="flex items-center gap-1.5 text-xs text-slate-500"><x.icon className="h-3.5 w-3.5" />{x.label}</dt><dd className="mt-1 text-xl font-semibold text-[#0b1b33]">{x.value}</dd></div>
                        ))}
                    </dl>
                    <p className="mt-4 text-xs text-slate-500">Scores update automatically from completed work, on-time delivery, revisions and how quickly you respond to offers.</p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Earnings</h2>
                        <Link to="/writer/earnings" className="text-sm font-semibold text-[#002147] hover:underline">Details</Link>
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                        {(['PENDING', 'APPROVED', 'PAID'] as const).map(k => (
                            <div key={k} className="flex items-baseline justify-between gap-3">
                                <dt className="text-slate-600">{{ PENDING: 'Pending (in progress)', APPROVED: 'Approved (awaiting payout)', PAID: 'Paid' }[k]}</dt>
                                <dd className="text-right font-semibold tabular-nums text-[#0b1b33]">{money(d.earnings[k])}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Upcoming deadlines</h2>
                    {d.upcoming.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nothing in progress.</p> : (
                        <ul className="mt-3 divide-y divide-slate-100">
                            {d.upcoming.map(u => (
                                <li key={u.ref}>
                                    <Link to={`/writer/assignments/${u.ref}`} className="flex flex-col gap-1 py-3 hover:opacity-80">
                                        <span className="flex items-center justify-between gap-2"><span className="truncate font-semibold text-[#0b1b33]">{u.title}</span><AssignmentBadge status={u.status} /></span>
                                        <Countdown iso={u.dueAt} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500"><Bell className="h-4 w-4" /> Notifications {d.notifications.unread > 0 && <span className="rounded-full bg-[#fea520] px-2 text-xs text-[#0b1b33]">{d.notifications.unread}</span>}</h2>
                        <Link to="/writer/notifications" className="text-sm font-semibold text-[#002147] hover:underline">All</Link>
                    </div>
                    <ul className="mt-3 space-y-3">
                        {d.notifications.latest.map(n => (
                            <li key={n.id} className="text-sm">
                                <p className={cn('font-semibold', n.read ? 'text-slate-600' : 'text-[#0b1b33]')}>{!n.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#fea520]" />}{n.title}</p>
                                <p className="line-clamp-2 text-slate-500">{n.message}</p>
                            </li>
                        ))}
                        {!d.notifications.latest.length && <li className="text-sm text-slate-500">No notifications yet.</li>}
                    </ul>
                </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Profile completion</h2>
                        <span className="text-sm font-semibold text-[#0b1b33]">{d.profileCompletion.percent}%</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[#002147]/10" role="meter" aria-valuenow={d.profileCompletion.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
                        <div className="h-full rounded-full bg-[#002147]" style={{ width: `${d.profileCompletion.percent}%` }} />
                    </div>
                    {missing.length > 0 ? (
                        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                            {Object.entries(d.profileCompletion.items).map(([k, ok]) => (
                                <li key={k} className={cn('flex items-center gap-2', ok ? 'text-slate-500' : 'font-medium text-[#0b1b33]')}>{ok ? <CircleCheck className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-300" />}{PROFILE_ITEM_LABELS[k] || k}</li>
                            ))}
                        </ul>
                    ) : <p className="mt-3 text-sm text-slate-500">Your profile is complete.</p>}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500"><Crown className="h-4 w-4" /> Membership</h2>
                        <Link to="/writer/membership" className="text-sm font-semibold text-[#002147] hover:underline">Manage</Link>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-[#0b1b33]">{d.membership.plan || 'No plan'} <span className="text-sm font-normal text-slate-500">· {d.membership.status.toLowerCase().replace('_', ' ')}</span></p>
                    {d.membership.renewsAt && <p className="text-sm text-slate-600">{d.membership.autoRenew ? 'Renews' : 'Ends'} {formatDate(d.membership.renewsAt)}</p>}
                    <MembershipDisclaimer text={d.disclaimer} className="mt-4" />
                </section>
            </div>
        </div>
    );
}
