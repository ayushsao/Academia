import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Printer } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatOrderTotal } from '../lib/money';
import { BrandLogo } from '../components/AcademiaLogo';

// Customer's payment receipt for a paid order. "Save as PDF" uses the browser's
// print dialog; the page prints as a clean single sheet.
type Receipt = {
    number: string; issuedAt: string; paidAt: string; status: 'PAID';
    business: { name: string; email: string; phone: string; website: string };
    billedTo: { name: string; email: string };
    order: { orderId: string; topicTitle: string; service: string; subject: string; academicLevel: string; pages: number; wordCount: number | null; deadline: string; placedAt: string };
    lines: { label: string; amount: number }[];
    total: number; currency: string; method: string; reference: string;
};

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

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

    return (
        <div className="min-h-screen bg-[#f6f6fa] px-4 py-8 font-sans print:bg-white print:p-0 sm:py-12">
            {/* Print only the receipt sheet (no chat button or other floating widgets). */}
            <style>{'@page { size: A4; margin: 14mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body * { visibility: hidden !important; } .receipt-sheet, .receipt-sheet * { visibility: visible !important; } .receipt-sheet { position: absolute; left: 0; top: 0; width: 100%; } }'}</style>
            <div className="mx-auto max-w-[820px]">
                <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
                    <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6e6e73] hover:text-[#1d1d1f]"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
                    {receipt && (
                        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#002147]">
                            <Printer className="h-4 w-4" /> Print / Save as PDF
                        </button>
                    )}
                </div>

                {error && <p role="alert" className="rounded-2xl bg-white p-8 text-center text-[#1d1d1f] shadow-sm">{error}</p>}
                {!receipt && !error && <div className="flex justify-center py-24" role="status" aria-label="Loading"><span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#002147]" /></div>}

                {receipt && (
                    <article className="receipt-sheet overflow-hidden rounded-2xl border border-[#e5e5ea] bg-white shadow-[0_20px_60px_-30px_rgba(0,10,30,0.25)] print:rounded-none print:border-0 print:shadow-none">
                        <div className="h-1.5 bg-[#000a1e]"><div className="h-full w-28 bg-[#fea520]" /></div>
                        <div className="p-7 sm:p-10">
                            {/* Header */}
                            <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <BrandLogo iconClassName="h-10" textClassName="text-[24px]" />
                                    <p className="mt-3 text-xs leading-relaxed text-[#6e6e73]">{receipt.business.email} · {receipt.business.phone}<br />{receipt.business.website.replace(/^https?:\/\//, '')}</p>
                                </div>
                                <div className="sm:text-right">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6e6e73]">Payment receipt</p>
                                    <p className="mt-1 text-2xl font-bold text-[#1d1d1f]">{receipt.number}</p>
                                    <p className="mt-1 text-sm text-[#6e6e73]">Issued {date(receipt.issuedAt)}</p>
                                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#000a1e] px-3 py-1 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5 text-[#fea520]" /> Paid</span>
                                </div>
                            </header>

                            {/* Parties */}
                            <section className="mt-9 grid gap-6 border-t border-[#e5e5ea] pt-7 sm:grid-cols-2">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">Billed to</p>
                                    <p className="mt-2 font-semibold text-[#1d1d1f]">{receipt.billedTo.name}</p>
                                    <p className="text-sm text-[#6e6e73]">{receipt.billedTo.email}</p>
                                </div>
                                <div className="sm:text-right">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">Received by</p>
                                    <p className="mt-2 font-semibold text-[#1d1d1f]">{receipt.business.name}</p>
                                    <p className="text-sm text-[#6e6e73]">Paid on {date(receipt.paidAt)}</p>
                                </div>
                            </section>

                            {/* Order */}
                            <section className="mt-7 rounded-xl bg-[#f6f6fa] p-5 print:bg-[#f6f6fa]">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">Order {receipt.order.orderId}</p>
                                <p className="mt-1.5 text-lg font-semibold text-[#1d1d1f]">{receipt.order.topicTitle}</p>
                                <p className="mt-1 text-sm text-[#6e6e73]">
                                    {receipt.order.service} · {receipt.order.subject} · {receipt.order.academicLevel} · {receipt.order.pages} page{receipt.order.pages === 1 ? '' : 's'}{receipt.order.wordCount ? ` · ${receipt.order.wordCount.toLocaleString()} words` : ''} · Deadline {receipt.order.deadline}
                                </p>
                            </section>

                            {/* Lines */}
                            <table className="mt-7 w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[#e5e5ea] text-left text-[11px] uppercase tracking-[0.14em] text-[#6e6e73]">
                                        <th className="pb-3 font-semibold">Description</th>
                                        <th className="pb-3 text-right font-semibold">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receipt.lines.map((l, i) => (
                                        <tr key={i} className="border-b border-[#f0f0f3]">
                                            <td className="py-3 pr-4 text-[#1d1d1f]">{l.label}</td>
                                            <td className="py-3 text-right tabular-nums text-[#1d1d1f]">{l.amount < 0 ? '−' : ''}{formatOrderTotal(Math.abs(l.amount), receipt.currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="mt-5 flex justify-end">
                                <div className="w-full max-w-xs rounded-xl border border-[#e5e5ea] p-4">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-sm font-semibold text-[#1d1d1f]">Total paid</span>
                                        <span className="text-2xl font-bold tabular-nums text-[#1d1d1f]">{formatOrderTotal(receipt.total, receipt.currency)}</span>
                                    </div>
                                    <p className="mt-1 text-right text-xs text-[#6e6e73]">{receipt.currency}</p>
                                </div>
                            </div>

                            {/* Payment */}
                            <section className="mt-7 grid gap-4 border-t border-[#e5e5ea] pt-6 text-sm sm:grid-cols-2">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">Payment method</p>
                                    <p className="mt-1.5 text-[#1d1d1f]">{receipt.method}</p>
                                </div>
                                {receipt.reference && (
                                    <div className="sm:text-right">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">Payment reference</p>
                                        <p className="mt-1.5 break-all font-mono text-[13px] text-[#1d1d1f]">{receipt.reference}</p>
                                    </div>
                                )}
                            </section>

                            <footer className="mt-10 border-t border-[#e5e5ea] pt-6 text-center">
                                <p className="text-sm font-semibold text-[#1d1d1f]">Thank you for choosing AssignmentMinds.</p>
                                <p className="mt-1 text-xs text-[#6e6e73]">This receipt confirms the payment above for order {receipt.order.orderId}. Questions? {receipt.business.email}</p>
                            </footer>
                        </div>
                    </article>
                )}
            </div>
        </div>
    );
}
