import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Printer, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatOrderTotal } from '../lib/money';
import { BrandLogo } from '../components/AcademiaLogo';

// Customer's payment receipt for a paid order. "Save as PDF" uses the browser's
// print dialog; the page prints as a clean single sheet, watermark included.
type Receipt = {
    number: string; issuedAt: string; paidAt: string; status: 'PAID';
    business: { name: string; email: string; phone: string; website: string };
    billedTo: { name: string; email: string };
    order: { orderId: string; topicTitle: string; service: string; subject: string; academicLevel: string; pages: number; wordCount: number | null; deadline: string; placedAt: string };
    lines: { label: string; amount: number }[];
    // Orders with coupon/tax: Subtotal → Coupon Discount → Tax → Final Total (major units).
    breakdown: { subtotal: number; couponCode: string; discountPercent: number; discount: number; taxPercent: number; tax: number; total: number } | null;
    total: number; currency: string; method: string; reference: string;
};

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// Faint diagonal "AssignmentMinds" text behind the whole receipt.
function Watermark() {
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden select-none">
            <div className="absolute -inset-1/2 flex rotate-[-28deg] flex-col justify-center gap-16">
                {Array.from({ length: 14 }, (_, row) => (
                    <div key={row} className={`flex gap-14 whitespace-nowrap ${row % 2 ? 'pl-40' : ''}`}>
                        {Array.from({ length: 8 }, (_, i) => (
                            <span key={i} className="text-[34px] font-bold uppercase tracking-[0.08em] text-[#000a1e]/[0.035]">AssignmentMinds</span>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

const Label = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8e8e93]">{children}</p>
);

export function ReceiptPage() {
    const { orderId = '' } = useParams();
    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api<{ receipt: Receipt }>(`/orders/${encodeURIComponent(orderId)}/receipt`)
            .then(r => setReceipt(r.receipt))
            .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load the receipt.'));
    }, [orderId]);
    useEffect(() => {
        if (!receipt) return;
        const previous = document.title;
        document.title = `Receipt ${receipt.number} — AssignmentMinds`;   // also the default PDF file name
        return () => { document.title = previous; };
    }, [receipt]);

    const money = (n: number) => (receipt ? formatOrderTotal(n, receipt.currency) : '');

    return (
        <div className="min-h-screen bg-[#f2f1ee] px-4 py-8 font-sans print:bg-white print:p-0 sm:py-12">
            {/* Print only the receipt sheet (no chat button or other floating widgets). */}
            <style>{'@page { size: A4; margin: 8mm; } @media print { html, body { height: auto !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body * { visibility: hidden !important; } .receipt-sheet, .receipt-sheet * { visibility: visible !important; } .receipt-sheet { position: absolute; left: 0; top: 0; width: 100%; break-inside: avoid; page-break-after: avoid; } }'}</style>
            <div className="mx-auto max-w-[840px]">
                <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
                    <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6e6e73] hover:text-[#1d1d1f]"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
                    {receipt && (
                        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002147]">
                            <Printer className="h-4 w-4" /> Print / Save as PDF
                        </button>
                    )}
                </div>

                {error && <p role="alert" className="rounded-2xl bg-white p-8 text-center text-[#1d1d1f] shadow-sm">{error}</p>}
                {!receipt && !error && <div className="flex justify-center py-24" role="status" aria-label="Loading"><span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#002147]" /></div>}

                {receipt && (
                    <article className="receipt-sheet relative overflow-hidden rounded-[28px] border border-[#e5e5ea] bg-white shadow-[0_30px_80px_-40px_rgba(0,10,30,0.35)] print:rounded-none print:border-0 print:shadow-none">
                        <Watermark />
                        {/* Brand band */}
                        <div className="relative h-2 bg-gradient-to-r from-[#000a1e] via-[#002147] to-[#000a1e]">
                            <div className="absolute inset-y-0 left-0 w-32 bg-[#fea520]" />
                        </div>

                        <div className="relative p-7 sm:p-11 print:p-6">
                            {/* Header */}
                            <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between">
                                <div>
                                    <BrandLogo iconClassName="h-11" textClassName="text-[26px]" />
                                    <p className="mt-3 text-xs leading-relaxed text-[#6e6e73]">
                                        {receipt.business.email} · {receipt.business.phone}<br />{receipt.business.website.replace(/^https?:\/\//, '')}
                                    </p>
                                </div>
                                <div className="sm:text-right print:text-right">
                                    <Label>Payment receipt</Label>
                                    <p className="mt-1.5 font-mono text-[22px] font-semibold tracking-tight text-[#1d1d1f]">{receipt.number}</p>
                                    <p className="mt-1 text-xs text-[#6e6e73]">Issued {date(receipt.issuedAt)}</p>
                                </div>
                            </header>

                            {/* Amount paid */}
                            <section className="relative mt-9 overflow-hidden rounded-2xl bg-[#000a1e] px-6 py-7 text-white sm:px-8 print:mt-5 print:py-4">
                                <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#fea520]/15 blur-2xl" />
                                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Amount paid</p>
                                        <p className="mt-2 text-[40px] font-bold leading-none tracking-tight tabular-nums print:text-[32px]">{money(receipt.total)}</p>
                                        <p className="mt-2 text-xs text-white/60">Paid on {date(receipt.paidAt)} · {receipt.currency}</p>
                                    </div>
                                    {/* Stamp */}
                                    <div className="flex h-[92px] w-[92px] print:h-[76px] print:w-[76px] shrink-0 rotate-[-12deg] flex-col items-center justify-center rounded-full border-2 border-[#fea520] text-[#fea520] sm:mr-2">
                                        <CheckCircle2 className="h-5 w-5" />
                                        <span className="mt-0.5 text-[15px] font-extrabold uppercase tracking-[0.2em]">Paid</span>
                                    </div>
                                </div>
                            </section>

                            {/* Parties */}
                            <section className="mt-8 grid gap-6 sm:grid-cols-3 print:mt-5 print:grid-cols-3 print:gap-4">
                                <div>
                                    <Label>Billed to</Label>
                                    <p className="mt-2 font-semibold text-[#1d1d1f]">{receipt.billedTo.name}</p>
                                    <p className="break-all text-sm text-[#6e6e73]">{receipt.billedTo.email}</p>
                                </div>
                                <div>
                                    <Label>Received by</Label>
                                    <p className="mt-2 font-semibold text-[#1d1d1f]">{receipt.business.name}</p>
                                    <p className="text-sm text-[#6e6e73]">{receipt.business.email}</p>
                                </div>
                                <div className="sm:text-right">
                                    <Label>Order</Label>
                                    <p className="mt-2 font-mono font-semibold text-[#1d1d1f]">{receipt.order.orderId}</p>
                                    <p className="text-sm text-[#6e6e73]">Placed {date(receipt.order.placedAt)}</p>
                                </div>
                            </section>

                            {/* Order details */}
                            <section className="mt-7 rounded-2xl border border-[#ececf0] bg-[#fafaf8]/80 p-5 print:mt-4 print:p-4">
                                <p className="text-[17px] font-semibold text-[#1d1d1f]">{receipt.order.topicTitle}</p>
                                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4 print:grid-cols-4">
                                    {([
                                        ['Service', receipt.order.service],
                                        ['Subject', receipt.order.subject],
                                        ['Level', receipt.order.academicLevel],
                                        ['Length', `${receipt.order.pages} page${receipt.order.pages === 1 ? '' : 's'}${receipt.order.wordCount ? ` · ${receipt.order.wordCount.toLocaleString()} words` : ''}`],
                                    ] as const).map(([k, v]) => (
                                        <div key={k}>
                                            <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8e8e93]">{k}</dt>
                                            <dd className="mt-0.5 font-medium text-[#1d1d1f]">{v}</dd>
                                        </div>
                                    ))}
                                </dl>
                                <p className="mt-3 text-xs text-[#6e6e73]">Deadline {receipt.order.deadline}</p>
                            </section>

                            {/* Lines */}
                            <table className="mt-8 w-full text-sm print:mt-5">
                                <thead>
                                    <tr className="border-b border-[#1d1d1f] text-left">
                                        <th className="pb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1d1d1f]">Description</th>
                                        <th className="pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1d1d1f]">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receipt.lines.map((l, i) => (
                                        <tr key={i} className="border-b border-[#ececf0]">
                                            <td className="py-3.5 pr-4 text-[#1d1d1f] print:py-2">{l.label}</td>
                                            <td className="py-3.5 text-right tabular-nums text-[#1d1d1f] print:py-2">{l.amount < 0 ? '−' : ''}{money(Math.abs(l.amount))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Totals */}
                            <div className="mt-5 flex justify-end">
                                <dl className="w-full max-w-sm space-y-2 text-sm">
                                    {receipt.breakdown && ([
                                        ['Subtotal', money(receipt.breakdown.subtotal)],
                                        [`Coupon Discount${receipt.breakdown.couponCode ? ` (${receipt.breakdown.couponCode} · ${receipt.breakdown.discountPercent}%)` : ''}`, `−${money(receipt.breakdown.discount)}`],
                                        [`Tax (${receipt.breakdown.taxPercent}%)`, money(receipt.breakdown.tax)],
                                    ] as const).map(([k, v]) => (
                                        <div key={k} className="flex justify-between gap-4">
                                            <dt className="text-[#6e6e73]">{k}</dt>
                                            <dd className="tabular-nums text-[#1d1d1f]">{v}</dd>
                                        </div>
                                    ))}
                                    <div className="flex items-baseline justify-between gap-4 border-t-2 border-[#1d1d1f] pt-3">
                                        <dt className="font-semibold text-[#1d1d1f]">{receipt.breakdown ? 'Final Total' : 'Total paid'}</dt>
                                        <dd className="text-2xl font-bold tabular-nums text-[#1d1d1f]">{money(receipt.total)}</dd>
                                    </div>
                                </dl>
                            </div>

                            {/* Payment */}
                            <section className="mt-9 grid gap-5 rounded-2xl border border-[#ececf0] p-5 text-sm sm:grid-cols-2 print:mt-5 print:grid-cols-2 print:p-4">
                                <div>
                                    <Label>Payment method</Label>
                                    <p className="mt-1.5 text-[#1d1d1f]">{receipt.method}</p>
                                </div>
                                {receipt.reference && (
                                    <div className="sm:text-right">
                                        <Label>Payment reference</Label>
                                        <p className="mt-1.5 break-all font-mono text-[13px] text-[#1d1d1f]">{receipt.reference}</p>
                                    </div>
                                )}
                            </section>

                            {/* Refund note */}
                            <section className="mt-5 flex items-start gap-3 rounded-2xl border border-[#fea520]/40 bg-[#fff7ec] p-4 text-sm print:mt-4 print:p-3">
                                <span className="mt-0.5 shrink-0 rounded-full bg-[#fea520] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#000a1e]">Note</span>
                                <p className="text-[#1d1d1f]">
                                    <strong className="font-semibold">This payment is non-refundable.</strong>{' '}
                                    <span className="text-[#6e6e73]">Please keep this receipt for your records.</span>
                                </p>
                            </section>

                            <footer className="mt-10 flex flex-col items-center gap-2 border-t border-dashed border-[#d9d9de] pt-6 text-center print:mt-5 print:pt-4">
                                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1d1d1f]"><ShieldCheck className="h-4 w-4 text-[#fea520]" /> Thank you for choosing AssignmentMinds.</p>
                                <p className="max-w-md text-xs leading-relaxed text-[#6e6e73]">
                                    This receipt confirms the payment above for order {receipt.order.orderId}. It is computer generated and needs no signature. Questions? {receipt.business.email}
                                </p>
                            </footer>
                        </div>
                    </article>
                )}
            </div>
        </div>
    );
}
