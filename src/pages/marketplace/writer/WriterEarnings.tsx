import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import { formatDate, formatMoney } from '../../../lib/money';
import { EARNING_STATUS_LABEL, type ByStatusCurrency, type Earning } from '../../../lib/assignmentTypes';
import { Notice } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

const STAGES = [
    { key: 'PENDING', label: 'Pending', hint: 'Accepted work in progress' },
    { key: 'APPROVED', label: 'Approved', hint: 'Work approved, awaiting payout' },
    { key: 'PAID', label: 'Paid', hint: 'Sent to you' },
] as const;

const money = (by?: Record<string, number>) => (by && Object.keys(by).length ? Object.entries(by).map(([c, v]) => formatMoney(v, c)).join(' · ') : '—');

export default function WriterEarnings() {
    const [data, setData] = useState<{ totals: ByStatusCurrency; earnings: Earning[] } | null>(null);
    const [error, setError] = useState('');
    useEffect(() => { api<{ totals: ByStatusCurrency; earnings: Earning[] }>('/assignments/writer/earnings').then(setData).catch(e => setError(e.message)); }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Earnings</h1>
                <p className="mt-1 text-slate-600">Payouts move from pending to approved when your work is approved, then to paid when we send them.</p>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            {!data && !error && <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#002147]" /></div>}
            {data && (
                <>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {STAGES.map(s => (
                            <div key={s.key} className="rounded-2xl border border-slate-200 bg-white p-5">
                                <p className="text-sm text-slate-500">{s.label}</p>
                                <p className="mt-1 text-2xl font-semibold text-[#0b1b33]">{money(data.totals[s.key])}</p>
                                <p className="mt-1 text-xs text-slate-500">{s.hint}</p>
                            </div>
                        ))}
                    </div>
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                        <h2 className="mb-4 text-lg font-bold text-[#0b1b33]">History</h2>
                        {data.earnings.length === 0 ? <p className="text-sm text-slate-500">No earnings yet.</p> : (
                            <>
                                <div className="hidden overflow-x-auto md:block">
                                    <table className="w-full text-left text-sm">
                                        <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                                            <th className="py-2 pr-4 font-semibold">Assignment</th><th className="py-2 pr-4 font-semibold">Updated</th><th className="py-2 pr-4 font-semibold">Status</th>
                                            <th className="py-2 pr-4 text-right font-semibold">Amount</th><th className="py-2 font-semibold">Reference</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {data.earnings.map(e => (
                                                <tr key={e.id}>
                                                    <td className="py-3 pr-4">{e.assignment ? <Link to={`/writer/assignments/${e.assignment.ref}`} className="font-medium text-[#0b1b33] hover:underline">{e.assignment.title}</Link> : '—'}
                                                        {e.adjustments.length > 0 && <span className="block text-xs text-slate-500">{e.adjustments.map(a => `${a.amountMinor > 0 ? '+' : ''}${formatMoney(a.amountMinor, e.currency)} ${a.reason}`).join(' · ')}</span>}</td>
                                                    <td className="py-3 pr-4 text-slate-600">{formatDate(e.paidAt || e.approvedAt || e.createdAt)}</td>
                                                    <td className={cn('py-3 pr-4 font-semibold', e.status === 'PAID' ? 'text-emerald-700' : e.status === 'CANCELLED' ? 'text-slate-400' : 'text-slate-700')}>{EARNING_STATUS_LABEL[e.status]}</td>
                                                    <td className={cn('py-3 pr-4 text-right font-semibold tabular-nums', e.status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-[#0b1b33]')}>{formatMoney(e.amountMinor, e.currency)}</td>
                                                    <td className="py-3 font-mono text-xs text-slate-500">{e.payoutReference || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <ul className="divide-y divide-slate-100 md:hidden">
                                    {data.earnings.map(e => (
                                        <li key={e.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                                            <div className="min-w-0"><p className="truncate font-medium text-[#0b1b33]">{e.assignment?.title || '—'}</p><p className="text-xs text-slate-400">{formatDate(e.paidAt || e.approvedAt || e.createdAt)}{e.payoutReference ? ` · ${e.payoutReference}` : ''}</p></div>
                                            <div className="text-right"><p className="font-semibold tabular-nums">{formatMoney(e.amountMinor, e.currency)}</p><p className="text-xs text-slate-500">{EARNING_STATUS_LABEL[e.status]}</p></div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
