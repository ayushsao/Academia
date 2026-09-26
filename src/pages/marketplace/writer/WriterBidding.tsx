import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Calendar, Crown, FileText, GraduationCap, Gavel, Paperclip } from 'lucide-react';
import { api } from '../../../lib/api';
import { Notice, inputClass } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';
import { cn } from '../../../lib/utils';

// Bidding for writers: projects an admin opened for bids, with the writer budget.
// Writers never see the customer's price — only the budget range.
type Bid = { id: string; amount: number; currency: string; note: string; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'; updatedAt: string };
type Project = {
    orderId: string; service: string; subject: string; academicLevel?: string; topicTitle: string; description?: string; instructions?: string;
    pages: number; wordCount?: number; deadline: string; turnitinReport?: boolean; topExpert?: boolean; abstractPage?: boolean; filesCount: number;
    budget: { min: number; max: number; currency: string } | null; currency?: string; postedAt: string; myBid: Bid | null;
};
type Data = { projects: Project[]; requiresMembership: boolean };

const STATUS_TEXT: Record<Bid['status'], string> = {
    PENDING: 'Bid sent — waiting for the admin', ACCEPTED: 'Accepted', REJECTED: 'Not selected', WITHDRAWN: 'Withdrawn',
};

function ProjectCard({ project, highlight, onChanged }: { project: Project; highlight: boolean; onChanged: (msg: string) => void }) {
    const ref = useRef<HTMLElement>(null);
    const [open, setOpen] = useState(highlight);
    const [amount, setAmount] = useState(project.myBid && project.myBid.status !== 'WITHDRAWN' ? String(project.myBid.amount) : '');
    const [note, setNote] = useState(project.myBid?.note || '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    // Optional admin budget; without one the writer names their price.
    const b = project.budget;
    const currency = b?.currency || project.currency || 'GBP';
    const brief = project.instructions || project.description || '';
    const extras = [project.turnitinReport && 'Turnitin report', project.topExpert && 'Top expert', project.abstractPage && 'Abstract page'].filter(Boolean) as string[];
    const bidOpen = !project.myBid || ['PENDING', 'WITHDRAWN'].includes(project.myBid.status);
    useEffect(() => { if (highlight) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [highlight]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const value = Number(amount);
        if (!(value > 0)) return setError('Enter your price for this project.');
        if (b && !(value >= b.min && value <= b.max)) return setError(`Your bid must be between ${b.currency} ${b.min} and ${b.max}.`);
        setBusy(true); setError('');
        try {
            await api(`/order-workflow/writer/bidding/${encodeURIComponent(project.orderId)}/bid`, { method: 'POST', body: { amount: value, note } });
            onChanged(`Bid of ${currency} ${value} sent for ${project.orderId}.`);
        } catch (err) { setError((err as Error).message); }
        finally { setBusy(false); }
    };
    const withdraw = async () => {
        setBusy(true); setError('');
        try { await api(`/order-workflow/writer/bidding/${encodeURIComponent(project.orderId)}/bid`, { method: 'DELETE' }); onChanged(`Bid on ${project.orderId} withdrawn.`); setAmount(''); }
        catch (err) { setError((err as Error).message); }
        finally { setBusy(false); }
    };

    return (
        <article ref={ref} id={`bid-${project.orderId}`} className={cn('scroll-mt-28 rounded-2xl border bg-white p-5 sm:p-6', highlight ? 'border-[#002147]' : 'border-slate-200')}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{project.orderId}{project.service ? ` · ${project.service}` : ''}</p>
                    <h2 className="mt-1 text-lg font-bold text-[#0b1b33]">{project.topicTitle}</h2>
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-slate-400" />{project.subject}</span>
                        {project.academicLevel && <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-slate-400" />{project.academicLevel}</span>}
                        <span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4 text-slate-400" />{project.pages} page{project.pages === 1 ? '' : 's'}{project.wordCount ? ` · ${project.wordCount.toLocaleString()} words` : ''}</span>
                        <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" />Due {project.deadline}</span>
                    </p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                    {b ? <>
                        <p className="text-xl font-extrabold text-[#0b1b33]">{b.currency} {b.min}–{b.max}</p>
                        <p className="text-xs text-slate-500">writer budget</p>
                    </> : <p className="text-sm font-semibold text-slate-600">Name your price</p>}
                </div>
            </div>

            {project.myBid && <p className={cn('mt-4 rounded-xl px-3 py-2 text-sm', project.myBid.status === 'ACCEPTED' ? 'bg-[#f5f5f7] font-semibold text-[#0b1b33]' : 'bg-slate-50 text-slate-600')}>
                Your bid: {project.myBid.currency} {project.myBid.amount} · {STATUS_TEXT[project.myBid.status]}
            </p>}

            <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="mt-4 text-sm font-semibold text-[#002147] hover:underline">{open ? 'Hide details' : 'View details & bid'}</button>
            {open && (
                <div className="mt-4 space-y-4 text-sm text-slate-700">
                    {brief && <div><h3 className="font-semibold text-[#0b1b33]">Instructions</h3><p className="mt-1 whitespace-pre-line">{brief}</p></div>}
                    {extras.length > 0 && <p><span className="font-semibold text-[#0b1b33]">Extras:</span> {extras.join(', ')}</p>}
                    {project.filesCount > 0 && <p className="inline-flex items-center gap-2"><Paperclip className="h-4 w-4 text-slate-400" />{project.filesCount} reference file{project.filesCount === 1 ? '' : 's'} — available after your bid is accepted.</p>}
                    {bidOpen && (
                        <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 p-4">
                            <label htmlFor={`amount-${project.orderId}`} className="block font-semibold text-[#0b1b33]">Your bid ({currency}) <span className="font-normal text-slate-500">— {b ? `between ${b.min} and ${b.max}` : 'your price to complete this project'}</span></label>
                            <input id={`amount-${project.orderId}`} type="number" inputMode="decimal" step="0.01" min={b ? b.min : 0.01} max={b ? b.max : undefined} value={amount} onChange={e => setAmount(e.target.value)} required className={cn(inputClass, 'max-w-[200px]')} />
                            <textarea rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Why you're a good fit (optional)" aria-label="Note to the admin" className={cn(inputClass, 'text-sm')} />
                            <div className="flex flex-wrap gap-2">
                                <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#002147] px-5 py-2.5 font-semibold text-white disabled:opacity-50">
                                    {busy ? <Spinner className="h-4 w-4" /> : <Gavel className="h-4 w-4" />}{project.myBid?.status === 'PENDING' ? 'Update bid' : 'Place bid'}
                                </button>
                                {project.myBid?.status === 'PENDING' && <button type="button" onClick={withdraw} disabled={busy} className="rounded-xl px-4 py-2.5 font-semibold text-slate-600 hover:bg-slate-100">Withdraw</button>}
                            </div>
                        </form>
                    )}
                </div>
            )}
            {error && <Notice tone="error" className="mt-4">{error}</Notice>}
        </article>
    );
}

export default function WriterBidding() {
    const [params] = useSearchParams();
    const focus = params.get('order');
    const [data, setData] = useState<Data | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const load = useCallback(() => api<Data>('/order-workflow/writer/bidding').then(setData).catch(e => setError(e.message)), []);
    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Bidding</h1>
                <p className="mt-1 text-slate-600">Orders approved for writers. Place your bid (within the budget, if one is set); the admin assigns each project from the bids.</p>
            </div>
            {message && <Notice tone="success">{message}</Notice>}
            {error && <Notice tone="error">{error}</Notice>}
            {!data && !error && <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-[#002147]" /></div>}
            {data?.requiresMembership && (
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-700"><Crown className="mr-1.5 inline h-4 w-4" />Choose a membership plan to see projects and place bids.</p>
                    <Link to="/writer/membership" className="shrink-0 rounded-xl bg-[#002147] px-4 py-2.5 text-center text-sm font-semibold text-white">View plans</Link>
                </div>
            )}
            {data && !data.requiresMembership && data.projects.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">No projects are open for bids right now. We’ll notify you when one is.</p>
            )}
            <div className="space-y-4">
                {data?.projects.map(p => (
                    <React.Fragment key={p.orderId}>
                        <ProjectCard project={p} highlight={p.orderId === focus} onChanged={m => { setMessage(m); load(); }} />
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
