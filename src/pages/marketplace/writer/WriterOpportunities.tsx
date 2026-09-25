import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, FileText, Check, X, Inbox, Calendar, Crown, Paperclip } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import type { Offer } from '../../../lib/assignmentTypes';
import { Countdown, FileList } from '../../../components/writer/AssignmentBits';
import { MembershipDisclaimer } from '../../../components/writer/MembershipBits';
import { Notice, inputClass } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

function OfferCard({ offer, reasons, onDone }: { offer: Offer; reasons: Record<string, string>; onDone: (msg: string) => void }) {
    const navigate = useNavigate();
    const a = offer.assignment!;
    const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
    const [declining, setDeclining] = useState(false);
    const [code, setCode] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);

    const accept = async () => {
        setBusy('accept'); setError('');
        try {
            await api(`/assignments/writer/offers/${offer.offerId}/accept`, { method: 'POST' });
            navigate(`/writer/assignments/${a.ref}`);
        } catch (e) { setError((e as Error).message); setBusy(null); }
    };
    const decline = async () => {
        setBusy('decline'); setError('');
        try {
            await api(`/assignments/writer/offers/${offer.offerId}/decline`, { method: 'POST', body: { ...(code ? { code } : {}), reason } });
            onDone(`Declined “${a.title}”.`);
        } catch (e) { setError((e as Error).message); setBusy(null); }
    };

    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{a.ref}{a.service ? ` · ${a.service}` : ''}</p>
                    <h2 className="mt-1 text-lg font-bold text-[#0b1b33]">{a.title}</h2>
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-slate-400" />{a.subject}</span>
                        <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-slate-400" />{a.academicLevel}</span>
                        <span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4 text-slate-400" />{a.wordCount.toLocaleString()} words</span>
                    </p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                    <p className="text-2xl font-extrabold text-[#0b1b33]">{formatMoney(a.payout.amountMinor, a.payout.currency)}</p>
                    <p className="text-xs text-slate-500">payout</p>
                </div>
            </div>
            <div className="mt-4 flex flex-col gap-1 rounded-xl bg-slate-50 p-3 text-sm sm:flex-row sm:justify-between">
                <Countdown iso={a.writerDeadline} label="Deadline" />
                <Countdown iso={offer.expiresAt} label="Respond by" />
            </div>

            <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="mt-4 text-sm font-semibold text-[#002147] hover:underline">{open ? 'Hide details' : 'View requirements & files'}</button>
            {open && (
                <div className="mt-4 space-y-4 text-sm text-slate-700">
                    {a.requirements && <div><h3 className="font-semibold text-[#0b1b33]">Requirements</h3><p className="mt-1 whitespace-pre-line">{a.requirements}</p></div>}
                    {a.instructions && <div><h3 className="font-semibold text-[#0b1b33]">Instructions</h3><p className="mt-1 whitespace-pre-line">{a.instructions}</p></div>}
                    {a.deliverables.length > 0 && <div><h3 className="font-semibold text-[#0b1b33]">Deliverables</h3><ul className="mt-1 list-disc pl-5">{a.deliverables.map(d => <li key={d}>{d}</li>)}</ul></div>}
                    {a.requiredSkills.length > 0 && <p><span className="font-semibold text-[#0b1b33]">Required skills:</span> {a.requiredSkills.join(', ')}</p>}
                    <div><h3 className="mb-2 font-semibold text-[#0b1b33]">Reference files</h3><FileList files={a.referenceFiles} basePath={`/assignments/writer/assignments/${a.ref}/files`} onError={setError} /></div>
                </div>
            )}

            {error && <Notice tone="error" className="mt-4">{error}</Notice>}

            {declining ? (
                <div className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-[#0b1b33]">Why are you declining? <span className="font-normal text-slate-500">(optional — helps us send better matches)</span></p>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(reasons).map(([k, label]) => (
                            <button key={k} type="button" aria-pressed={code === k} onClick={() => setCode(c => (c === k ? '' : k))}
                                className={cn('rounded-full border px-3 py-1.5 text-sm', code === k ? 'border-[#002147] bg-[#002147] text-white' : 'border-slate-200 text-slate-700 hover:border-slate-400')}>{label}</button>
                        ))}
                    </div>
                    <textarea rows={2} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Anything else? (optional)" className={cn(inputClass, 'text-sm')} />
                    <div className="flex flex-wrap gap-2">
                        <button onClick={decline} disabled={busy !== null} className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === 'decline' ? 'Declining…' : 'Confirm decline'}</button>
                        <button onClick={() => setDeclining(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Back</button>
                    </div>
                </div>
            ) : (
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <button onClick={accept} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white hover:bg-[#0b2f5c] disabled:opacity-50">
                        {busy === 'accept' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />} Accept assignment
                    </button>
                    <button onClick={() => setDeclining(true)} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50">
                        <X className="h-4 w-4" /> Decline
                    </button>
                </div>
            )}
        </article>
    );
}

// A customer order the admin released to the marketplace. Open to every writer
// with a live membership plan, whatever their subject; the first to accept gets it.
type ClientOrder = {
    orderId: string; service: string; subject: string; academicLevel?: string; topicTitle: string;
    description?: string; instructions?: string; pages: number; wordCount?: number; deadline: string;
    totalAmount?: number; currency?: string; files?: string[];
    turnitinReport?: boolean; topExpert?: boolean; abstractPage?: boolean;
};
type ClientOrders = { orders: ClientOrder[]; requiresMembership?: boolean };

function ClientOrderCard({ order, onTaken }: { order: ClientOrder; onTaken: (msg: string) => void }) {
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);
    const brief = order.instructions || order.description || '';
    const extras = [order.turnitinReport && 'Turnitin report', order.topExpert && 'Top expert', order.abstractPage && 'Abstract page'].filter(Boolean) as string[];

    const accept = async () => {
        if (!window.confirm(`Accept order ${order.orderId}? You'll be responsible for delivering it by the deadline.`)) return;
        setBusy(true); setError('');
        try {
            await api(`/order-workflow/writer/accept/${encodeURIComponent(order.orderId)}`, { method: 'POST' });
            navigate('/writer/orders', { state: { tab: 'my-orders' } });
        } catch (e) {
            // Someone else took it first: drop it from the list.
            if ((e as { status?: number }).status === 409) onTaken((e as Error).message);
            else setError((e as Error).message);
            setBusy(false);
        }
    };

    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{order.orderId}{order.service ? ` · ${order.service}` : ''}</p>
                    <h3 className="mt-1 text-lg font-bold text-[#0b1b33]">{order.topicTitle}</h3>
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-slate-400" />{order.subject}</span>
                        {order.academicLevel && <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-slate-400" />{order.academicLevel}</span>}
                        <span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4 text-slate-400" />{order.pages} page{order.pages === 1 ? '' : 's'}{order.wordCount ? ` · ${order.wordCount.toLocaleString()} words` : ''}</span>
                        <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" />Due {order.deadline}</span>
                    </p>
                </div>
                {Boolean(order.totalAmount) && (
                    <div className="shrink-0 text-left sm:text-right">
                        <p className="text-2xl font-extrabold text-[#0b1b33]">{order.currency || ''} {order.totalAmount}</p>
                        <p className="text-xs text-slate-500">order value</p>
                    </div>
                )}
            </div>

            {(brief || extras.length > 0 || (order.files?.length ?? 0) > 0) && (
                <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="mt-4 text-sm font-semibold text-[#002147] hover:underline">{open ? 'Hide details' : 'View brief'}</button>
            )}
            {open && (
                <div className="mt-4 space-y-4 text-sm text-slate-700">
                    {brief && <div><h4 className="font-semibold text-[#0b1b33]">Instructions</h4><p className="mt-1 whitespace-pre-line">{brief}</p></div>}
                    {extras.length > 0 && <p><span className="font-semibold text-[#0b1b33]">Extras:</span> {extras.join(', ')}</p>}
                    {(order.files?.length ?? 0) > 0 && (
                        <p className="inline-flex items-center gap-2"><Paperclip className="h-4 w-4 text-slate-400" />{order.files!.length} reference file{order.files!.length === 1 ? '' : 's'} — available to download after you accept.</p>
                    )}
                </div>
            )}

            {error && <Notice tone="error" className="mt-4">{error}</Notice>}

            <div className="mt-5">
                <button onClick={accept} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white hover:bg-[#0b2f5c] disabled:opacity-50">
                    {busy ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />} Accept order
                </button>
            </div>
        </article>
    );
}

export default function WriterOpportunities() {
    const [data, setData] = useState<{ offers: Offer[]; declineReasons: Record<string, string>; disclaimer: string } | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const load = useCallback(() => api<typeof data>('/assignments/writer/opportunities').then(setData).catch(e => setError(e.message)), []);
    useEffect(() => { load(); }, [load]);
    const [clientOrders, setClientOrders] = useState<ClientOrders | null>(null);
    const [ordersError, setOrdersError] = useState('');
    const loadOrders = useCallback(() => api<ClientOrders>('/order-workflow/writer/available').then(setClientOrders).catch(e => setOrdersError(e.message)), []);
    useEffect(() => { loadOrders(); }, [loadOrders]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Opportunities</h1>
                <p className="mt-1 text-slate-600">Client orders open to every writer on a membership plan, and assignments offered to you based on your subjects, skills, levels and availability.</p>
            </div>

            <section aria-labelledby="client-orders" className="space-y-4">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 id="client-orders" className="text-lg font-bold text-[#0b1b33]">Client orders{clientOrders && !clientOrders.requiresMembership ? ` (${clientOrders.orders.length})` : ''}</h2>
                    <Link to="/writer/orders" className="text-sm font-semibold text-[#002147] hover:underline">My client orders →</Link>
                </div>
                {ordersError && <Notice tone="error">{ordersError}</Notice>}
                {!clientOrders && !ordersError && <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-[#002147]" /></div>}
                {clientOrders?.requiresMembership && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-amber-900"><Crown className="mr-1.5 inline h-4 w-4" />Choose a membership plan to see and accept client orders from every subject.</p>
                        <Link to="/writer/membership" className="shrink-0 rounded-xl bg-[#002147] px-4 py-2.5 text-center text-sm font-semibold text-white">View plans</Link>
                    </div>
                )}
                {clientOrders && !clientOrders.requiresMembership && clientOrders.orders.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">No open client orders right now. We’ll notify you as soon as one is approved.</p>
                )}
                {clientOrders?.orders.map(o => <React.Fragment key={o.orderId}><ClientOrderCard order={o} onTaken={m => { setMessage(m); loadOrders(); }} /></React.Fragment>)}
            </section>

            <h2 className="text-lg font-bold text-[#0b1b33]">Assignment offers</h2>
            {data && <MembershipDisclaimer text={data.disclaimer} />}
            {message && <Notice tone="success">{message}</Notice>}
            {error && <Notice tone="error">{error}</Notice>}
            {!data && !error && <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#002147]" /></div>}
            {data && data.offers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                    <Inbox className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 font-semibold text-[#0b1b33]">No open offers right now</p>
                    <p className="mt-1 text-sm text-slate-500">We’ll notify you when an assignment matches your profile. Keeping your availability on, subjects accurate and <Link to="/writer/settings" className="font-semibold text-[#002147] underline">time zone set</Link> helps.</p>
                </div>
            )}
            <div className="space-y-4">
                {data?.offers.map(o => <React.Fragment key={o.offerId}><OfferCard offer={o} reasons={data.declineReasons} onDone={m => { setMessage(m); load(); }} /></React.Fragment>)}
            </div>
        </div>
    );
}
