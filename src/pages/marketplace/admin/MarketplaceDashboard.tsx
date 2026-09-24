import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, PenTool, Crown, ClipboardList, Gauge } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Spinner } from '../../../components/writer/WriterBits';
import { StatTile } from './membership/MembershipAnalytics';

type Converted = { currency: string; amountMinor: number; unconverted: string[] };
type Money = { byCurrency: Record<string, number>; converted: Converted };
type Sections = {
    writers?: { total: number; active: number; paid: number; pending: number; approvedAwaitingMembership: number; suspended: number; rejected: number; newLast30Days: number };
    subscriptions?: { active: number; pastDue: number; monthly: number; annual: number; mrr: Money; arr: Money; revenueLast30Days: Money & { payments: number }; revenueLast12Months: Money; cancellationsLast30Days: number; cancellingAtPeriodEnd: number; pendingVerification: number; reportingCurrency: string };
    operations?: { active: number; awaitingReview: number; pending: number; needsAllocation: number; completed: number; completedLast30Days: number; availableWriters: number; activeMemberWriters: number };
    performance?: { averageRating: number | null; ratedAssignments: number; completionRate: number | null; onTimeRate: number | null; averageQualityScore: number | null };
};

const perCurrency = (by: Record<string, number>) => Object.entries(by).map(([c, v]) => formatMoney(v, c)).join(' · ') || '—';
const converted = (c: Converted) => <>{formatMoney(c.amountMinor, c.currency)}{c.unconverted.length > 0 && <span title={`No exchange rate for ${c.unconverted.join(', ')}`} className="ml-1 align-super text-xs text-amber-600">*</span>}</>;
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

function Section({ icon: Icon, title, children }: { icon: typeof PenTool; title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-500"><Icon className="h-4 w-4" /> {title}</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>
        </section>
    );
}

export default function MarketplaceDashboard({ token, onNavigate }: { token: string; onNavigate?: (tab: string) => void }) {
    const [data, setData] = useState<{ sections: Sections; generatedAt: string } | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try { setData(await api('/admin/insights/dashboard', { token })); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
    }, [token]);
    useEffect(() => { load(); }, [load]);

    if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>;
    if (!data) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>;
    const { writers: w, subscriptions: s, operations: o, performance: p } = data.sections;
    const link = (tab: string, text: string) => onNavigate && <button onClick={() => onNavigate(tab)} className="text-xs font-semibold text-[#002147] hover:underline">{text} →</button>;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Updated {new Date(data.generatedAt).toLocaleTimeString()}</p>
                <button onClick={load} aria-label="Refresh" className="rounded-xl border border-gray-200 bg-white p-2.5">{loading ? <Spinner className="h-4 w-4 text-gray-400" /> : <RefreshCw className="h-4 w-4 text-gray-500" />}</button>
            </div>

            {w && (
                <Section icon={PenTool} title="Writers">
                    <StatTile label="Total writers" value={w.total.toLocaleString()} sub={`${w.newLast30Days} joined in the last 30 days`} />
                    <StatTile label="Active (paid members)" value={w.active.toLocaleString()} sub={`${w.paid} with a live membership`} />
                    <StatTile label="Pending review" value={w.pending.toLocaleString()} sub={link('applications', 'Open review queue')} />
                    <StatTile label="Suspended" value={w.suspended.toLocaleString()} sub={`${w.approvedAwaitingMembership} approved, not yet subscribed`} />
                </Section>
            )}

            {s && (
                <Section icon={Crown} title="Subscriptions">
                    <StatTile label="Active subscriptions" value={s.active.toLocaleString()} sub={`${s.monthly} monthly · ${s.annual} annual · ${s.pastDue} past due`} />
                    <StatTile label={`MRR (${s.reportingCurrency})`} value={converted(s.mrr.converted)} sub={perCurrency(s.mrr.byCurrency)} />
                    <StatTile label="Revenue · last 30 days" value={converted(s.revenueLast30Days.converted)} sub={`Last 12 months: ${formatMoney(s.revenueLast12Months.converted.amountMinor, s.reportingCurrency)}`} />
                    <StatTile label="Cancellations · 30 days" value={s.cancellationsLast30Days} sub={`${s.cancellingAtPeriodEnd} set to cancel · ${s.pendingVerification} payments to verify`} />
                </Section>
            )}

            {o && (
                <Section icon={ClipboardList} title="Operations">
                    <StatTile label="Active assignments" value={o.active} sub={`${o.awaitingReview} awaiting review`} />
                    <StatTile label="Pending allocation" value={o.pending} sub={o.needsAllocation ? `${o.needsAllocation} need manual allocation` : 'None stuck'} />
                    <StatTile label="Completed" value={o.completed.toLocaleString()} sub={`${o.completedLast30Days} in the last 30 days`} />
                    <StatTile label="Available writers" value={o.availableWriters} sub={`of ${o.activeMemberWriters} active members`} />
                </Section>
            )}

            {p && (
                <Section icon={Gauge} title="Performance">
                    <StatTile label="Average rating" value={p.averageRating === null ? '—' : p.averageRating.toFixed(2)} sub={`${p.ratedAssignments} rated assignments`} />
                    <StatTile label="Completion rate" value={pct(p.completionRate)} sub="Approved vs. writer-fault cancellations" />
                    <StatTile label="On-time rate" value={pct(p.onTimeRate)} sub="First submission before deadline" />
                    <StatTile label="Avg quality score" value={p.averageQualityScore === null ? '—' : p.averageQualityScore} sub="Writers with completed work" />
                </Section>
            )}

            {!w && !s && !o && !p && <p className="text-sm text-gray-500">Your role has no dashboard metrics.</p>}
        </div>
    );
}
