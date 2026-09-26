import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ChevronRight } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import type { WriterAssignment } from '../../../lib/assignmentTypes';
import { AssignmentBadge, Countdown } from '../../../components/writer/AssignmentBits';
import { Notice } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';

type ClientOrder = { orderId: string; topicTitle: string; subject: string; pages: number; wordCount?: number; deadline: string; status: string; writerPayout?: { amount: number; currency: string } };
const ORDER_STATUS: Record<string, string> = { in_progress: 'In progress', revision_required: 'Revision required', submitted: 'Submitted — in review', completed: 'Completed' };
const ACTIVE_ORDER = ['in_progress', 'revision_required', 'submitted'];

export default function WriterAssignments() {
    const [items, setItems] = useState<WriterAssignment[] | null>(null);
    const [orders, setOrders] = useState<ClientOrder[] | null>(null);
    const [error, setError] = useState('');
    useEffect(() => { api<{ assignments: WriterAssignment[] }>('/assignments/writer/assignments').then(d => setItems(d.assignments)).catch(e => { setItems([]); setError(e.message); }); }, []);
    // Client orders the writer accepted (or won by bidding) — managed on the Client Orders page.
    useEffect(() => { api<{ orders: ClientOrder[] }>('/order-workflow/writer/my-orders').then(d => setOrders((d.orders || []).filter(o => ACTIVE_ORDER.includes(o.status)))).catch(() => setOrders([])); }, []);
    const loading = !items || !orders;
    const empty = !loading && items.length === 0 && orders.length === 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">My assignments</h1>
                <p className="mt-1 text-slate-600">Work you’ve accepted, in progress or in review.</p>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            {loading && !error && <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#002147]" /></div>}
            {empty && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                    <Briefcase className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 font-semibold text-[#0b1b33]">No active assignments</p>
                    <p className="mt-1 text-sm text-slate-500">Accepted offers appear here. <Link to="/writer/opportunities" className="font-semibold text-[#002147] underline">See opportunities</Link></p>
                </div>
            )}
            {!loading && orders.length > 0 && (
                <ul className="space-y-3" aria-label="Client orders">
                    {orders.map(o => (
                        <li key={o.orderId}>
                            <Link to="/writer/orders" state={{ tab: 'my-orders' }} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-[#002147]/30 hover:shadow-sm sm:flex-row sm:items-center">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="truncate font-bold text-[#0b1b33]">{o.topicTitle}</h2>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{ORDER_STATUS[o.status] || o.status}</span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-600">{o.orderId} · Client order · {o.subject} · {o.pages} page{o.pages === 1 ? '' : 's'}{o.wordCount ? ` · ${o.wordCount.toLocaleString()} words` : ''}</p>
                                    <p className="mt-2 text-sm text-slate-500">Due {o.deadline}</p>
                                </div>
                                <div className="flex items-center justify-between gap-4 sm:justify-end">
                                    {o.writerPayout && <span className="text-lg font-bold text-[#0b1b33]">{o.writerPayout.currency} {o.writerPayout.amount}</span>}
                                    <ChevronRight className="h-5 w-5 text-slate-400" />
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <ul className="space-y-3">
                {items?.map(a => (
                    <li key={a.ref}>
                        <Link to={`/writer/assignments/${a.ref}`} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-[#002147]/30 hover:shadow-sm sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold text-[#0b1b33]">{a.title}</h2><AssignmentBadge status={a.status} /></div>
                                <p className="mt-1 text-sm text-slate-600">{a.ref} · {a.subject} · {a.academicLevel} · {a.wordCount.toLocaleString()} words</p>
                                <div className="mt-2"><Countdown iso={a.status === 'REVISION_REQUESTED' ? a.revisionDueAt : a.writerDeadline} label={a.status === 'REVISION_REQUESTED' ? 'Revision due' : 'Due'} /></div>
                            </div>
                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                                <span className="text-lg font-bold text-[#0b1b33]">{formatMoney(a.payout.amountMinor, a.payout.currency)}</span>
                                <ChevronRight className="h-5 w-5 text-slate-400" />
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
