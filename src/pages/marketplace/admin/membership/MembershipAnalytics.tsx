import React, { useEffect, useState } from 'react';
import { RefreshCw, Table2, BarChart3 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { formatMoney } from '../../../../lib/money';
import { countryName } from '../../../../lib/writerOptions';
import { Spinner } from '../../../../components/writer/WriterBits';
import { cn } from '../../../../lib/utils';

type ByCurrency = Record<string, number>;
type Converted = { currency: string; amountMinor: number; unconverted: string[] };
type Group = { key: string; payments: number; byCurrency: ByCurrency; converted: Converted; planName?: string; activeSubscribers?: number };
type Analytics = {
    reportingCurrency: string;
    subscribers: Record<'total' | 'active' | 'pastDue' | 'suspended' | 'cancelled' | 'expired' | 'new' | 'cancelledInRange' | 'expiredInRange' | 'cancellingAtPeriodEnd', number>;
    mrr: { byCurrency: ByCurrency; converted: Converted };
    arr: { byCurrency: ByCurrency; converted: Converted };
    collected: { byCurrency: ByCurrency; converted: Converted; payments: number };
    collectedLast12Months: { byCurrency: ByCurrency; converted: Converted };
    revenueByPlan: Group[];
    revenueByCountry: Group[];
    revenueByCurrency: { currency: string; amountMinor: number; converted: Converted }[];
    monthly: { month: string; byCurrency: ByCurrency; newSubscribers: number; converted: Converted }[];
    queue: { pendingVerification: number; needsAttention: number };
};

const RANGES = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }, { days: 365, label: '12 months' }];
const BAR = '#2f6db5'; // validated: lightness band + ≥3:1 contrast on white
const compactNumber = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });

const perCurrency = (by: ByCurrency) => Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, v]) => formatMoney(v, c)).join(' · ') || '—';

function ConvertedValue({ c, compact }: { c: Converted; compact?: boolean }) {
    return <>{formatMoney(c.amountMinor, c.currency, { compact })}{c.unconverted.length > 0 && <span title={`No exchange rate set for ${c.unconverted.join(', ')} — excluded from this total`} className="ml-1 align-super text-xs text-amber-600">*</span>}</>;
}

export function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#000a1e]">{value}</p>
            {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
        </div>
    );
}

// Single-series column chart: ≤24px columns, 4px rounded tops, hairline grid,
// hover/focus tooltip, direct labels only on the peak and latest columns.
// Rounds up to 1, 2 or 5 × 10ⁿ so axis ticks land on readable values. Integer
// scales (counts) are kept even so the midpoint tick is a whole number too.
function niceMax(value: number, integer: boolean) {
    if (value <= 0) return integer ? 2 : 1;
    const pow = 10 ** Math.floor(Math.log10(value));
    const nice = [1, 2, 5, 10].map(m => m * pow).find(n => n >= value)!;
    return integer ? Math.max(2, Math.ceil(nice / 2) * 2) : nice;
}

export function ColumnChart({ data, format, title, ariaUnit, integer = false }: { data: { label: string; value: number; detail?: string }[]; format: (v: number) => string; title: string; ariaUnit: string; integer?: boolean }) {
    const [hover, setHover] = useState<number | null>(null);
    const max = niceMax(Math.max(0, ...data.map(d => d.value)), integer);
    const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
    const ticks = [max, max / 2, 0];
    return (
        <figure>
            <figcaption className="mb-3 text-sm font-semibold text-[#000a1e]">{title}</figcaption>
            <div className="relative flex h-48 gap-2 pl-12">
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0">
                    {ticks.map((t, i) => (
                        <div key={i} className="absolute left-0 right-0 flex items-center" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
                            <span className="w-11 -translate-y-1/2 pr-2 text-right text-[11px] tabular-nums text-gray-400">{format(t)}</span>
                            <span className="h-px flex-1 bg-gray-100" />
                        </div>
                    ))}
                </div>
                {data.map((d, i) => {
                    const h = (d.value / max) * 100;
                    const showLabel = d.value > 0 && (i === peak || i === data.length - 1);
                    return (
                        <div key={d.label} className="relative flex flex-1 flex-col items-center justify-end" tabIndex={0}
                            aria-label={`${d.label}: ${format(d.value)} ${ariaUnit}`}
                            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                            {showLabel && <span className="mb-1 text-[11px] font-semibold tabular-nums text-gray-700">{format(d.value)}</span>}
                            <div className="w-full max-w-[24px] rounded-t-[4px] transition-[filter]" style={{ height: `${h}%`, minHeight: d.value > 0 ? 2 : 0, background: BAR, filter: hover === i ? 'brightness(1.15)' : undefined }} />
                            {hover === i && (
                                <div role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[14rem] rounded-lg bg-[#000a1e] px-3 py-2 text-xs text-white shadow-lg">
                                    <p className="text-sm font-semibold">{format(d.value)}</p>
                                    <p className="text-white/70">{d.label}</p>
                                    {d.detail && <p className="mt-1 text-white/70">{d.detail}</p>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 flex gap-2 pl-12">
                {data.map(d => <span key={d.label} className="flex-1 text-center text-[11px] text-gray-400">{d.label}</span>)}
            </div>
        </figure>
    );
}

function BreakdownTable({ title, rows, keyLabel, extra }: { title: string; rows: Group[]; keyLabel: string; extra?: (g: Group) => React.ReactNode }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <h3 className="border-b border-gray-100 px-5 py-3 text-sm font-bold text-[#000a1e]">{title}</h3>
            {rows.length === 0 ? <p className="px-5 py-6 text-sm text-gray-400">No payments in this period.</p> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                            <th className="px-5 py-2 font-semibold">{keyLabel}</th><th className="px-5 py-2 text-right font-semibold">Payments</th>
                            <th className="px-5 py-2 text-right font-semibold">Collected</th><th className="px-5 py-2 text-right font-semibold">Total</th>
                            {extra && <th className="px-5 py-2 text-right font-semibold">Active</th>}</tr></thead>
                        <tbody className="divide-y divide-gray-50">
                            {rows.map(r => (
                                <tr key={r.key}>
                                    <td className="px-5 py-2.5 font-medium text-[#000a1e]">{r.planName || r.key}</td>
                                    <td className="px-5 py-2.5 text-right tabular-nums text-gray-600">{r.payments}</td>
                                    <td className="px-5 py-2.5 text-right tabular-nums text-gray-600">{perCurrency(r.byCurrency)}</td>
                                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-[#000a1e]"><ConvertedValue c={r.converted} /></td>
                                    {extra && <td className="px-5 py-2.5 text-right tabular-nums text-gray-600">{extra(r)}</td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function MembershipAnalytics({ token, onOpenQueue }: { token: string; onOpenQueue: (status: string) => void }) {
    const [days, setDays] = useState(30);
    const [data, setData] = useState<Analytics | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [asTable, setAsTable] = useState(false);

    const load = async () => {
        setLoading(true); setError('');
        const to = new Date(), from = new Date(Date.now() - days * 86400000);
        try { setData(await api<Analytics>(`/admin/membership/analytics?from=${from.toISOString()}&to=${to.toISOString()}`, { token })); }
        catch (e) { setError((e as Error).message); } finally { setLoading(false); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [days, token]);

    if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>;
    if (!data) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#fea520]" /></div>;

    const rc = data.reportingCurrency;
    const s = data.subscribers;
    const hasUnconverted = [data.mrr, data.collected, data.collectedLast12Months].some(x => x.converted.unconverted.length);
    const rangeLabel = RANGES.find(r => r.days === days)?.label;

    return (
        <div className="space-y-6">
            {/* Filters: one row above the charts */}
            <div className="flex flex-wrap items-center gap-2">
                {RANGES.map(r => (
                    <button key={r.days} onClick={() => setDays(r.days)} aria-pressed={days === r.days}
                        className={cn('rounded-xl border px-3.5 py-2 text-sm font-semibold', days === r.days ? 'border-[#000a1e] bg-[#000a1e] text-white' : 'border-gray-200 bg-white text-gray-600')}>{r.label}</button>
                ))}
                <button onClick={load} aria-label="Refresh" className="ml-auto rounded-xl border border-gray-200 bg-white p-2.5">{loading ? <Spinner className="h-4 w-4 text-gray-400" /> : <RefreshCw className="h-4 w-4 text-gray-500" />}</button>
            </div>

            {(data.queue.pendingVerification > 0 || data.queue.needsAttention > 0) && (
                <div className="flex flex-wrap gap-3">
                    {data.queue.pendingVerification > 0 && <button onClick={() => onOpenQueue('PENDING_VERIFICATION')} className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">{data.queue.pendingVerification} manual payment{data.queue.pendingVerification === 1 ? '' : 's'} to verify →</button>}
                    {data.queue.needsAttention > 0 && <button onClick={() => onOpenQueue('ATTENTION')} className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 ring-1 ring-red-200">{data.queue.needsAttention} payment{data.queue.needsAttention === 1 ? '' : 's'} need attention →</button>}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Active subscribers" value={s.active.toLocaleString()} sub={`${s.total} ever subscribed · ${s.pastDue} past due`} />
                <StatTile label={`MRR (${rc})`} value={<ConvertedValue c={data.mrr.converted} />} sub={perCurrency(data.mrr.byCurrency)} />
                <StatTile label={`Annual run-rate (${rc})`} value={<ConvertedValue c={data.arr.converted} />} sub={`Collected last 12 months: ${formatMoney(data.collectedLast12Months.converted.amountMinor, rc)}`} />
                <StatTile label={`Collected · ${rangeLabel}`} value={<ConvertedValue c={data.collected.converted} />} sub={`${data.collected.payments} payments · ${perCurrency(data.collected.byCurrency)}`} />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile label={`New · ${rangeLabel}`} value={s.new} />
                <StatTile label={`Cancelled · ${rangeLabel}`} value={s.cancelledInRange} sub={`${s.cancellingAtPeriodEnd} set to end at period end`} />
                <StatTile label={`Expired · ${rangeLabel}`} value={s.expiredInRange} sub="Renewal not paid" />
                <StatTile label="Suspended" value={s.suspended} />
            </div>
            {hasUnconverted && <p className="text-xs text-amber-700">* Some currencies have no exchange rate to {rc} and are excluded from converted totals. Set rates under Settings; per-currency figures are always exact.</p>}

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#000a1e]">Last 12 months</h3>
                    <button onClick={() => setAsTable(v => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100">
                        {asTable ? <><BarChart3 className="h-4 w-4" /> Chart view</> : <><Table2 className="h-4 w-4" /> Table view</>}
                    </button>
                </div>
                {asTable ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs uppercase tracking-wider text-gray-400"><th className="py-2 pr-4 font-semibold">Month</th><th className="py-2 pr-4 text-right font-semibold">New subscribers</th><th className="py-2 pr-4 text-right font-semibold">Collected</th><th className="py-2 text-right font-semibold">Total ({rc})</th></tr></thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.monthly.map(m => (
                                    <tr key={m.month}><td className="py-2 pr-4">{m.month}</td><td className="py-2 pr-4 text-right tabular-nums">{m.newSubscribers}</td>
                                        <td className="py-2 pr-4 text-right tabular-nums text-gray-600">{perCurrency(m.byCurrency)}</td><td className="py-2 text-right font-semibold tabular-nums"><ConvertedValue c={m.converted} /></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grid gap-8 lg:grid-cols-2">
                        <ColumnChart title={`Revenue collected (${rc} equivalent)`} ariaUnit={rc}
                            format={v => formatMoney(Math.round(v), rc, { compact: true })}
                            data={data.monthly.map(m => ({ label: monthLabel(m.month), value: m.converted.amountMinor, detail: perCurrency(m.byCurrency) }))} />
                        <ColumnChart title="New subscribers" ariaUnit="new subscribers" integer format={v => compactNumber(Math.round(v))}
                            data={data.monthly.map(m => ({ label: monthLabel(m.month), value: m.newSubscribers }))} />
                    </div>
                )}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <BreakdownTable title={`Revenue by plan · ${rangeLabel}`} keyLabel="Plan" rows={data.revenueByPlan} extra={r => r.activeSubscribers ?? 0} />
                <BreakdownTable title={`Revenue by country · ${rangeLabel}`} keyLabel="Country" rows={data.revenueByCountry.map(r => ({ ...r, planName: r.key === 'Unknown' ? 'Unknown' : countryName(r.key) }))} />
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <h3 className="border-b border-gray-100 px-5 py-3 text-sm font-bold text-[#000a1e]">Revenue by currency · {rangeLabel}</h3>
                {data.revenueByCurrency.length === 0 ? <p className="px-5 py-6 text-sm text-gray-400">No payments in this period.</p> : (
                    <ul className="divide-y divide-gray-50">
                        {data.revenueByCurrency.map(r => {
                            const total = data.collected.converted.amountMinor || 1;
                            const share = r.converted.unconverted.length ? null : Math.round((r.converted.amountMinor / total) * 100);
                            return (
                                <li key={r.currency} className="flex items-center gap-4 px-5 py-3 text-sm">
                                    <span className="w-12 font-semibold text-[#000a1e]">{r.currency}</span>
                                    <span className="flex-1 tabular-nums text-gray-700">{formatMoney(r.amountMinor, r.currency)}</span>
                                    <span className="tabular-nums text-gray-500">{r.converted.unconverted.length ? 'no rate' : `≈ ${formatMoney(r.converted.amountMinor, rc)}`}</span>
                                    <span className="w-12 text-right tabular-nums text-gray-500">{share !== null ? `${share}%` : '—'}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            <p className="text-xs text-gray-400">MRR counts active subscriptions (annual plans ÷ 12). Run-rate = MRR × 12. “Collected” is money actually received in the period.</p>
        </div>
    );
}
