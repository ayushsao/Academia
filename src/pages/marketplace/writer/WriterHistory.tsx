import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import { formatDate, formatMoney } from '../../../lib/money';
import type { WriterAssignment } from '../../../lib/assignmentTypes';
import { Notice } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

type Item = { outcome: 'COMPLETED' | 'CANCELLED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN' | 'RELEASED'; at: string; reason?: string; rating?: number | null; assignment: WriterAssignment };
type Counts = { accepted: number; declined: number; expired: number; completed: number; cancelled: number };

const OUTCOME: Record<Item['outcome'], { label: string; className: string }> = {
    COMPLETED: { label: 'Completed', className: 'bg-emerald-50 text-emerald-800' },
    CANCELLED: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600' },
    DECLINED: { label: 'Declined', className: 'bg-slate-100 text-slate-700' },
    EXPIRED: { label: 'Expired', className: 'bg-amber-50 text-amber-800' },
    WITHDRAWN: { label: 'Taken by another writer', className: 'bg-slate-50 text-slate-500' },
    RELEASED: { label: 'Reassigned', className: 'bg-red-50 text-red-700' },
};
const FILTERS = ['ALL', 'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'] as const;

export default function WriterHistory() {
    const [data, setData] = useState<{ items: Item[]; counts: Counts } | null>(null);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<typeof FILTERS[number]>('ALL');
    useEffect(() => { api<{ items: Item[]; counts: Counts }>('/assignments/writer/assignments?view=history').then(setData).catch(e => setError(e.message)); }, []);

    const items = data?.items.filter(i => filter === 'ALL' || i.outcome === filter) || [];
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">History</h1>
                <p className="mt-1 text-slate-600">Every offer and assignment outcome.</p>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            {!data && !error && <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#002147]" /></div>}
            {data && (
                <>
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {([['Accepted', data.counts.accepted], ['Completed', data.counts.completed], ['Declined', data.counts.declined], ['Expired', data.counts.expired], ['Cancelled', data.counts.cancelled]] as const).map(([k, v]) => (
                            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4"><dt className="text-sm text-slate-500">{k}</dt><dd className="mt-1 text-2xl font-semibold text-[#0b1b33]">{v}</dd></div>
                        ))}
                    </dl>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {FILTERS.map(f => (
                            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn('whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-semibold', filter === f ? 'border-[#002147] bg-[#002147] text-white' : 'border-slate-200 bg-white text-slate-600')}>
                                {f === 'ALL' ? 'All' : OUTCOME[f].label}
                            </button>
                        ))}
                    </div>
                    {items.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">Nothing here yet.</p> : (
                        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                            {items.map((i, idx) => {
                                const clickable = ['COMPLETED', 'CANCELLED', 'RELEASED'].includes(i.outcome);
                                const body = (
                                    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold text-[#0b1b33]">{i.assignment.title}</p>
                                            <p className="text-sm text-slate-500">{i.assignment.ref} · {i.assignment.subject} · {formatDate(i.at)}{i.reason ? ` · ${i.reason}` : ''}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {i.rating != null && <span className="text-sm font-semibold text-[#0b1b33]">★ {i.rating.toFixed(2)}</span>}
                                            <span className="text-sm tabular-nums text-slate-600">{formatMoney(i.assignment.payout.amountMinor, i.assignment.payout.currency)}</span>
                                            <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', OUTCOME[i.outcome].className)}>{OUTCOME[i.outcome].label}</span>
                                        </div>
                                    </div>
                                );
                                return <li key={`${i.assignment.ref}-${i.outcome}-${idx}`}>{clickable ? <Link to={`/writer/assignments/${i.assignment.ref}`} className="block hover:bg-slate-50">{body}</Link> : body}</li>;
                            })}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}
