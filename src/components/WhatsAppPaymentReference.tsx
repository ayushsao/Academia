import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';

// After paying on WhatsApp, the customer sends the payment reference (UTR /
// transaction ID). Our team checks it and confirms the payment, which issues
// the receipt in the dashboard.
export function WhatsAppPaymentReference({ orderId, initialReference = '', onSaved, compact = false }: {
    orderId: string;
    initialReference?: string;
    onSaved?: (order: any) => void;
    compact?: boolean;
}) {
    const token = useStore(s => s.token);
    const [reference, setReference] = useState(initialReference);
    const [saved, setSaved] = useState(Boolean(initialReference));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const ref = reference.trim();
        if (ref.length < 4) { setError('Enter the payment reference / UTR / transaction ID.'); return; }
        setBusy(true); setError('');
        try {
            const { order } = await api<{ order: any }>(`/orders/${encodeURIComponent(orderId)}/payment-reference`, { method: 'POST', body: { reference: ref }, token: token || undefined });
            setSaved(true);
            onSaved?.(order);
        } catch (err: any) {
            setError(err?.message || 'Could not save the reference. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    if (saved && !busy) {
        return (
            <div className={`flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 ${compact ? 'p-2.5 text-[11px]' : 'p-3.5 text-xs'} text-left`}>
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                    Payment reference <strong className="font-mono">{reference.trim()}</strong> received. We’ll verify it and your receipt will appear in your dashboard.{' '}
                    <button type="button" onClick={() => setSaved(false)} className="font-bold underline underline-offset-2">Change</button>
                </span>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className={`rounded-xl border border-[#d1e4ff] bg-[#f8f9ff] text-left ${compact ? 'p-2.5' : 'p-4'} space-y-2`}>
            <label htmlFor={`wa-ref-${orderId}`} className={`block font-bold text-[#000a1e] ${compact ? 'text-[11px]' : 'text-xs uppercase'}`}>
                Paid on WhatsApp? Enter your payment reference
            </label>
            <div className="flex gap-2">
                <input
                    id={`wa-ref-${orderId}`}
                    type="text"
                    value={reference}
                    maxLength={120}
                    onChange={(e) => { setReference(e.target.value); if (error) setError(''); }}
                    placeholder="UTR / Transaction ID"
                    className={`min-w-0 flex-1 bg-white border border-[#d1e4ff] rounded-lg ${compact ? 'px-2.5 py-1.5 text-xs' : 'p-3 text-sm'} font-semibold text-[#000a1e] outline-none focus:border-[#fea520]`}
                />
                <button type="submit" disabled={busy}
                    className={`shrink-0 rounded-lg bg-[#000a1e] font-bold text-white hover:bg-[#002147] disabled:opacity-60 ${compact ? 'px-3 text-[11px]' : 'px-4 text-sm'}`}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                </button>
            </div>
            {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
            {!compact && <p className="text-[11px] text-[#708ab5]">Find it in your UPI or bank app after paying. Your receipt is issued once our team confirms the payment.</p>}
        </form>
    );
}
