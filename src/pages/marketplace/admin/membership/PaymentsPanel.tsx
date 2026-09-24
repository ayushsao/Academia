import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../../../lib/api';
import { formatDate, formatMoney } from '../../../../lib/money';
import { PAYMENT_STATUS_LABEL, PERIOD_LABEL, type MembershipPayment } from '../../../../lib/membershipTypes';
import { Spinner } from '../../../../components/writer/WriterBits';
import { inputClass } from '../../../../components/writer/FormKit';
import { cn } from '../../../../lib/utils';

type AdminPayment = MembershipPayment & {
    id: string; subscriptionRef?: string; writerName?: string; writerEmail?: string; country?: string;
    needsAttention?: string; reviewNote?: string; providerOrderId?: string; providerPaymentId?: string;
};

const FILTERS = [
    { key: 'PENDING_VERIFICATION', label: 'To verify' },
    { key: 'ATTENTION', label: 'Needs attention' },
    { key: 'PAID', label: 'Paid' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: '', label: 'All' },
];

function ReviewRow({ p, token, onDone }: { p: AdminPayment; token: string; onDone: () => void }) {
    const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submit = async () => {
        setBusy(true); setError('');
        try { await api(`/admin/membership/payments/${p.id}/review`, { method: 'POST', token, body: { decision: mode, note } }); onDone(); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const resolve = async () => {
        setBusy(true);
        try { await api(`/admin/membership/payments/${p.id}/resolve`, { method: 'POST', token }); onDone(); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };

    return (
        <li className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#000a1e]">{p.writerName} <span className="font-normal text-gray-400">· {p.writerEmail}</span></p>
                    <p className="text-sm text-gray-600">{p.planName} · {PERIOD_LABEL[p.billingPeriod]} · {p.kind === 'NEW' ? 'New' : p.kind === 'RENEWAL' ? 'Renewal' : 'Upgrade'} · {p.paymentRef} · {p.subscriptionRef}</p>
                    {p.manual && (
                        <p className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                            <span className="text-gray-500">{p.manual.method.replace('_', ' ')}</span>
                            <span className="font-mono font-semibold text-[#000a1e]">{p.manual.reference}</span>
                            <span className="text-gray-400">submitted {formatDate(p.manual.submittedAt)}</span>
                        </p>
                    )}
                    {p.provider === 'RAZORPAY' && p.providerPaymentId && <p className="mt-1 font-mono text-xs text-gray-400">{p.providerOrderId} · {p.providerPaymentId}</p>}
                    {p.needsAttention && <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{p.needsAttention}</p>}
                    {p.reviewNote && p.status !== 'PENDING_VERIFICATION' && <p className="mt-1 text-xs text-gray-500">Note: {p.reviewNote}</p>}
                </div>
                <div className="flex items-center gap-4 lg:flex-col lg:items-end">
                    <p className="text-lg font-bold tabular-nums text-[#000a1e]">{formatMoney(p.amountMinor, p.currency)}</p>
                    <span className={cn('text-xs font-semibold', p.status === 'PAID' ? 'text-emerald-700' : p.status === 'REJECTED' ? 'text-red-700' : 'text-gray-500')}>{PAYMENT_STATUS_LABEL[p.status]}{p.paidAt ? ` · ${formatDate(p.paidAt)}` : ''}</span>
                </div>
            </div>
            {p.status === 'PENDING_VERIFICATION' && (
                mode ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-gray-200 p-3">
                        <textarea rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} className={cn(inputClass, 'text-sm')}
                            placeholder={mode === 'approve' ? 'Optional note, e.g. “Matched in bank statement 12 Sep”' : 'Why is it rejected? (shown to the writer)'} />
                        <div className="flex flex-wrap gap-2">
                            <button disabled={busy || (mode === 'reject' && note.trim().length < 5)} onClick={submit}
                                className={cn('rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50', mode === 'approve' ? 'bg-emerald-600' : 'bg-red-600')}>
                                {busy ? 'Saving…' : mode === 'approve' ? 'Confirm — payment received' : 'Confirm rejection'}
                            </button>
                            <button onClick={() => setMode(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => setMode('approve')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" /> Verify & activate</button>
                        <button onClick={() => setMode('reject')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"><XCircle className="h-4 w-4" /> Reject</button>
                    </div>
                )
            )}
            {p.needsAttention && <button onClick={resolve} disabled={busy} className="mt-3 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Mark as resolved</button>}
            {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        </li>
    );
}

export default function PaymentsPanel({ token, initialFilter = 'PENDING_VERIFICATION' }: { token: string; initialFilter?: string }) {
    const [filter, setFilter] = useState(initialFilter);
    const [payments, setPayments] = useState<AdminPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try { setPayments((await api<{ payments: AdminPayment[] }>(`/admin/membership/payments?status=${filter}&limit=50`, { token })).payments); }
        catch (e) { setError((e as Error).message); } finally { setLoading(false); }
    }, [filter, token]);
    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)} className={cn('whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-semibold', filter === f.key ? 'border-[#000a1e] bg-[#000a1e] text-white' : 'border-gray-200 bg-white text-gray-600')}>{f.label}</button>
                ))}
            </div>
            {filter === 'PENDING_VERIFICATION' && <p className="text-sm text-gray-500">Check each reference against your UPI, PayPal or bank statement before verifying. Verifying activates the writer’s membership immediately.</p>}
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {loading ? <div className="flex justify-center py-12"><Spinner className="h-7 w-7 text-[#fea520]" /></div>
                    : payments.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">Nothing here.</p>
                        : <ul className="divide-y divide-gray-100">{payments.map(p => <React.Fragment key={p.id}><ReviewRow p={p} token={token} onDone={load} /></React.Fragment>)}</ul>}
            </div>
        </div>
    );
}
