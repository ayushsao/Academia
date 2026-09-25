import React, { useEffect, useState } from 'react';
import { X, Mail, Smartphone, Clock, ExternalLink, MapPin, MessageSquareWarning, Eye } from 'lucide-react';
import { api, openProtectedFile } from '../../../lib/api';
import type { WriterAdminView } from '../../../lib/writerTypes';
import { APPLICATION_STATUS_LABEL, DOCUMENT_TYPES, countryName } from '../../../lib/writerOptions';
import { AvailabilityDot, Spinner, StatusBadge, WriterAvatar, formatBytes } from '../../../components/writer/WriterBits';
import { Notice, inputClass } from '../../../components/writer/FormKit';
import { cn } from '../../../lib/utils';
import { formatMoney } from '../../../lib/money';
import { RiskBadge, RISK_KIND_LABEL } from './RiskBadge';

type Action = 'start_review' | 'approve' | 'reject' | 'request_info' | 'suspend' | 'reactivate' | 'deactivate';

// Mirrors the server's state machine so only valid actions are offered.
const ACTIONS: { id: Action; label: string; tone: string; needsReason: boolean; allowed: (w: WriterAdminView) => boolean }[] = [
    { id: 'start_review', label: 'Start review', tone: 'bg-sky-600 text-white hover:bg-sky-700', needsReason: false, allowed: w => w.application.status === 'SUBMITTED' },
    { id: 'approve', label: 'Approve', tone: 'bg-emerald-600 text-white hover:bg-emerald-700', needsReason: false, allowed: w => ['SUBMITTED', 'UNDER_REVIEW'].includes(w.application.status) },
    { id: 'request_info', label: 'Request more info', tone: 'bg-amber-100 text-amber-900 hover:bg-amber-200', needsReason: true, allowed: w => ['SUBMITTED', 'UNDER_REVIEW'].includes(w.application.status) },
    { id: 'reject', label: 'Reject', tone: 'bg-red-50 text-red-700 hover:bg-red-100', needsReason: true, allowed: w => ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(w.application.status) },
    { id: 'suspend', label: 'Suspend', tone: 'bg-red-600 text-white hover:bg-red-700', needsReason: true, allowed: w => ['APPROVED', 'ACTIVE', 'INACTIVE'].includes(w.status) },
    { id: 'deactivate', label: 'Mark inactive', tone: 'bg-slate-100 text-slate-700 hover:bg-slate-200', needsReason: true, allowed: w => ['APPROVED', 'ACTIVE'].includes(w.status) },
    { id: 'reactivate', label: 'Reactivate', tone: 'bg-emerald-600 text-white hover:bg-emerald-700', needsReason: false, allowed: w => ['SUSPENDED', 'INACTIVE'].includes(w.status) },
];

const ALL_TABS = ['Profile', 'Documents', 'Membership', 'Assignments', 'Performance', 'Earnings', 'Availability', 'History'] as const;
type TabName = typeof ALL_TABS[number];
const money = (by?: Record<string, number> | null) => (by && Object.keys(by).length ? Object.entries(by).map(([c, v]) => formatMoney(v, c)).join(' · ') : '—');

function Dl({ items }: { items: [string, React.ReactNode][] }) {
    return (
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            {items.map(([k, v]) => <div key={k}><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">{k}</dt><dd className="mt-0.5 text-slate-800">{v || '—'}</dd></div>)}
        </dl>
    );
}

const Chips = ({ items }: { items: string[] }) => <div className="flex flex-wrap gap-1.5">{items.map(i => <span key={i} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{i}</span>)}</div>;

export default function AdminWriterDrawer({ writerId, token, onClose, onChanged }: {
    writerId: string; token: string; onClose: () => void; onChanged: () => void;
}) {
    const [contact, setContact] = useState<{ email: string; phone: string } | null>(null);
    const [writer, setWriter] = useState<WriterAdminView | null>(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<TabName>('Profile');
    const [pending, setPending] = useState<typeof ACTIONS[number] | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [override, setOverride] = useState({ status: 'UNAVAILABLE' as 'AVAILABLE' | 'UNAVAILABLE', reason: '' });

    useEffect(() => {
        api<{ writer: WriterAdminView }>(`/admin/writers/${writerId}`, { token }).then(d => setWriter(d.writer)).catch(e => setError(e.message));
    }, [writerId, token]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const run = async (fn: () => Promise<{ writer: WriterAdminView }>) => {
        setBusy(true); setError('');
        try { setWriter((await fn()).writer); onChanged(); return true; }
        catch (e) { setError((e as Error).message); return false; }
        finally { setBusy(false); }
    };

    const confirmAction = async () => {
        if (!pending) return;
        const ok = await run(() => api(`/admin/writers/${writerId}/actions`, { method: 'POST', token, body: { action: pending.id, reason } }));
        if (ok) { setPending(null); setReason(''); }
    };

    const reviewDoc = (docId: string, reviewStatus: 'VERIFIED' | 'REJECTED' | 'PENDING', note = '') =>
        run(() => api(`/admin/writers/documents/${docId}`, { method: 'PATCH', token, body: { reviewStatus, note } }));

    const setAvailabilityOverride = (active: boolean) =>
        run(() => api(`/admin/writers/${writerId}/availability-override`, { method: 'PUT', token, body: active ? { active, ...override } : { active: false } }))
            .then(ok => ok && setOverride(o => ({ ...o, reason: '' })));

    const actions = writer?.permissions.review ? ACTIONS.filter(a => a.allowed(writer)) : [];
    const tabs = ALL_TABS.filter(t => !writer || (t === 'Performance' ? writer.permissions.performance : t === 'Earnings' ? writer.permissions.earnings : true));

    // Contact details are fetched on demand; each reveal is audited server-side.
    const revealContact = async () => {
        setError('');
        try { setContact(await api<{ email: string; phone: string }>(`/admin/writers/${writerId}/contact`, { method: 'POST', token })); }
        catch (e) { setError((e as Error).message); }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Writer details">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="relative flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-start gap-4 border-b border-slate-100 p-5 sm:p-6">
                    {writer ? (
                        <>
                            <WriterAvatar writerId={writer.id} name={writer.name} hasPhoto={writer.profile.hasPhoto} version={writer.profile.photoVersion} mode="private" token={token} size={56} />
                            <div className="min-w-0 flex-1">
                                <h2 className="truncate text-xl font-bold text-[#0b1b33]">{writer.name}</h2>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <StatusBadge status={writer.status} />
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Application: {APPLICATION_STATUS_LABEL[writer.application.status]}</span>
                                    <AvailabilityDot status={writer.availability.effectiveStatus} />
                                </div>
                                {writer.lastReview && <p className="mt-1.5 text-xs text-slate-500">Last reviewed by <span className="font-semibold text-slate-700">{writer.lastReview.by}</span> · {new Date(writer.lastReview.at).toLocaleString()}</p>}
                                {writer.risk && writer.risk.level !== 'NONE' && <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600"><RiskBadge risk={writer.risk} />{writer.risk.flags.map(f => RISK_KIND_LABEL[f] || f).join(' · ')} <span className="text-slate-400">— review under Trust &amp; Safety</span></p>}
                            </div>
                        </>
                    ) : <div className="flex-1" />}
                    <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
                </div>

                {!writer ? (
                    <div className="flex flex-1 items-center justify-center">{error ? <Notice tone="error">{error}</Notice> : <Spinner className="h-8 w-8 text-[#002147]" />}</div>
                ) : (
                    <>
                        {/* Private contact + verification */}
                        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4 text-sm sm:grid-cols-3 sm:px-6">
                            <span className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{contact?.email || writer.email || 'Hidden'}</span></span>
                            <span className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-slate-400" />{contact?.phone || writer.phone.e164}</span>
                            <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{writer.profile.city}, {countryName(writer.profile.country)}</span>
                            {writer.canRevealContact && !contact && (
                                <button onClick={revealContact} className="inline-flex items-center gap-1.5 justify-self-start text-xs font-semibold text-[#002147] hover:underline sm:col-span-3">
                                    <Eye className="h-3.5 w-3.5" /> Reveal contact details <span className="font-normal text-slate-400">(logged)</span>
                                </button>
                            )}
                        </div>

                        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] border-b border-slate-100 px-4 sm:px-5">
                            {tabs.map(t => (
                                <button key={t} onClick={() => setTab(t)} className={cn('whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold', tab === t ? 'border-[#fea520] text-[#0b1b33]' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                                    {t}{t === 'Documents' ? ` (${writer.documents.length})` : ''}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
                            {error && <Notice tone="error">{error}</Notice>}

                            {writer.application.infoRequest && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                                    <p className="flex items-center gap-2 font-semibold text-amber-900"><MessageSquareWarning className="h-4 w-4" /> Information requested</p>
                                    <p className="mt-1 whitespace-pre-line text-amber-900/90">{writer.application.infoRequest.message}</p>
                                    {writer.application.infoRequest.response && <p className="mt-3 whitespace-pre-line border-t border-amber-200 pt-3 text-slate-800"><span className="font-semibold">Writer’s reply:</span> {writer.application.infoRequest.response}</p>}
                                </div>
                            )}

                            {tab === 'Profile' && (
                                <div className="space-y-6">
                                    {writer.profile.headline && <p className="text-lg font-medium text-slate-800">{writer.profile.headline}</p>}
                                    <Dl items={[
                                        ['Years of experience', writer.profile.yearsExperience],
                                        ['Academic levels', writer.profile.academicLevels.join(', ')],
                                        ['Languages', writer.profile.languages.join(', ')],
                                        ['Profile visibility', writer.profile.visibility === 'PUBLIC' ? 'Public' : 'Hidden'],
                                        ['Registered', new Date(writer.createdAt).toLocaleString()],
                                        ['Submitted', writer.application.submittedAt ? new Date(writer.application.submittedAt).toLocaleString() : null],
                                    ]} />
                                    <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Bio</h3><p className="whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{writer.profile.bio || '—'}</p></section>
                                    <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Writing experience</h3><p className="whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{writer.profile.writingExperience || '—'}</p></section>
                                    <section>
                                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Education</h3>
                                        <ul className="space-y-2">{writer.profile.education.map((e, i) => (
                                            <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm"><span className="font-semibold">{e.degree}</span> · {e.level}<br /><span className="text-slate-500">{e.university}{e.fieldOfStudy ? ` · ${e.fieldOfStudy}` : ''}{e.graduationYear ? ` · ${e.graduationYear}` : ''}</span></li>
                                        ))}</ul>
                                    </section>
                                    <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Expertise</h3><Chips items={writer.profile.expertiseAreas} /></section>
                                    <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Subjects</h3><Chips items={writer.profile.subjects} /></section>
                                    <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Skills</h3><Chips items={writer.skills.map(s => s.isCustom ? `${s.name} (custom)` : s.name)} /></section>
                                </div>
                            )}

                            {tab === 'Documents' && (
                                <div className="space-y-5">
                                    {writer.documents.length === 0 && <p className="text-sm text-slate-500">No documents uploaded.</p>}
                                    {DOCUMENT_TYPES.map(t => {
                                        const docs = writer.documents.filter(d => d.type === t.value);
                                        if (!docs.length) return null;
                                        return (
                                            <section key={t.value}>
                                                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t.label}</h3>
                                                <ul className="space-y-2">{docs.map(d => (
                                                    <li key={d.id} className="rounded-xl border border-slate-200 p-3">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-sm font-semibold text-[#0b1b33]">{d.title || d.originalName}</p>
                                                                <p className="text-xs text-slate-500">{d.size !== undefined ? `${d.originalName} · ${formatBytes(d.size)} · ` : ''}{new Date(d.createdAt).toLocaleDateString()}{d.isPublic ? ' · public sample' : ''}</p>
                                                            </div>
                                                            {writer.permissions.documents && <button onClick={() => openProtectedFile(`/admin/writers/documents/${d.id}/file`, token).catch(e => setError(e.message))} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#002147] hover:bg-slate-100"><ExternalLink className="h-3.5 w-3.5" /> Open</button>}
                                                            {writer.permissions.documents && <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
                                                                {(['PENDING', 'VERIFIED', 'REJECTED'] as const).map(s => (
                                                                    <button key={s} disabled={busy} onClick={() => reviewDoc(d.id, s)}
                                                                        className={cn('px-2.5 py-1.5', d.reviewStatus === s ? (s === 'VERIFIED' ? 'bg-emerald-600 text-white' : s === 'REJECTED' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white') : 'bg-white text-slate-600 hover:bg-slate-50')}>
                                                                        {s === 'PENDING' ? <Clock className="h-3.5 w-3.5" aria-label="Pending" /> : s === 'VERIFIED' ? 'Verify' : 'Reject'}
                                                                    </button>
                                                                ))}
                                                            </div>}
                                                        </div>
                                                    </li>
                                                ))}</ul>
                                            </section>
                                        );
                                    })}
                                </div>
                            )}

                            {tab === 'Membership' && (
                                <div className="space-y-4 text-sm">
                                    {writer.subscriptions.length === 0 ? <p className="text-slate-500">No membership yet.</p> : (
                                        <ul className="space-y-2">
                                            {writer.subscriptions.map(s => (
                                                <li key={s.subscriptionId} className="rounded-xl border border-slate-200 p-3">
                                                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-[#0b1b33]">{s.planName} · {s.billingPeriod.toLowerCase()}</span><span className="text-xs font-semibold text-slate-600">{s.status.toLowerCase().replace('_', ' ')}</span></div>
                                                    <p className="mt-1 text-xs text-slate-500">{s.subscriptionId}{s.startDate ? ` · since ${new Date(s.startDate).toLocaleDateString()}` : ''}{s.currentPeriodEnd && !s.endedAt ? ` · ${s.autoRenew ? 'renews' : 'ends'} ${new Date(s.currentPeriodEnd).toLocaleDateString()}` : ''}{s.endedAt ? ` · ended ${new Date(s.endedAt).toLocaleDateString()} (${(s.endReason || 'ended').toLowerCase().replace(/_/g, ' ')})` : ''}{s.amountMinor !== undefined && s.currency ? ` · ${formatMoney(s.amountMinor, s.currency)}` : ''}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {writer.revenue ? <p className="text-slate-600">Membership revenue from this writer: <span className="font-semibold text-[#0b1b33]">{money(writer.revenue.byCurrency)}</span> ({writer.revenue.payments} payments)</p>
                                        : <p className="text-xs text-slate-400">Payment amounts are visible to Finance.</p>}
                                </div>
                            )}

                            {tab === 'Assignments' && (
                                <div className="space-y-4 text-sm">
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(writer.assignments.byStatus).map(([k, n]) => <span key={k} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{k.toLowerCase().replace(/_/g, ' ')}: {n}</span>)}
                                        {writer.assignments.total === 0 && <span className="text-slate-500">No assignments yet.</span>}
                                    </div>
                                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                                        {writer.assignments.recent.map(x => (
                                            <li key={x.ref} className="flex items-center justify-between gap-3 px-4 py-2.5"><span className="min-w-0"><span className="block truncate font-medium text-[#0b1b33]">{x.title}</span><span className="text-xs text-slate-400">{x.ref} · due {new Date(x.writerDeadline).toLocaleDateString()}</span></span><span className="text-xs font-semibold text-slate-600">{x.status.toLowerCase().replace(/_/g, ' ')}</span></li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {tab === 'Performance' && writer.metrics && (
                                <Dl items={[
                                    ['Rating', writer.metrics.ratingCount ? `${writer.metrics.rating.toFixed(2)} (${writer.metrics.ratingCount} rated)` : 'Unrated'],
                                    ['Quality score', writer.metrics.completedAssignments ? Math.round(writer.metrics.qualityScore) : '—'],
                                    ['Completed assignments', writer.metrics.completedAssignments],
                                    ['Active assignments', writer.metrics.activeAssignments ?? 0],
                                    ['Completion rate', writer.metrics.completedAssignments ? `${writer.metrics.completionRate ?? 0}%` : '—'],
                                    ['On-time rate', writer.metrics.completedAssignments ? `${writer.metrics.onTimeRate ?? 0}%` : '—'],
                                    ['Response rate', `${writer.metrics.responseRate ?? 0}%`],
                                    ['Revision rate', writer.metrics.completedAssignments ? `${writer.metrics.revisionRate ?? 0}%` : '—'],
                                ]} />
                            )}

                            {tab === 'Earnings' && writer.earnings && (
                                <Dl items={[
                                    ['Pending (in progress)', money(writer.earnings.PENDING)],
                                    ['Approved (to pay)', money(writer.earnings.APPROVED)],
                                    ['Paid', money(writer.earnings.PAID)],
                                    ['Cancelled', money(writer.earnings.CANCELLED)],
                                ]} />
                            )}

                            {tab === 'Availability' && (
                                <div className="space-y-5 text-sm">
                                    <Dl items={[
                                        ['Effective status', <AvailabilityDot status={writer.availability.effectiveStatus} />],
                                        ['Writer’s own setting', writer.availability.status === 'AVAILABLE' ? 'Available' : 'Unavailable'],
                                    ]} />
                                    {writer.availability.override ? (
                                        <Notice tone="warning">Admin override active: <strong>{writer.availability.override.status.toLowerCase()}</strong> — {writer.availability.override.reason}</Notice>
                                    ) : <p className="text-slate-500">No override. The writer controls their own availability.</p>}
                                    {writer.permissions.availability ? (
                                        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                                            <p className="font-semibold text-[#0b1b33]">Override availability</p>
                                            <div className="flex flex-col gap-3 sm:flex-row">
                                                <select value={override.status} onChange={e => setOverride(o => ({ ...o, status: e.target.value as 'AVAILABLE' | 'UNAVAILABLE' }))} className={cn(inputClass, 'sm:w-48')}>
                                                    <option value="UNAVAILABLE">Unavailable</option><option value="AVAILABLE">Available</option>
                                                </select>
                                                <input value={override.reason} onChange={e => setOverride(o => ({ ...o, reason: e.target.value }))} maxLength={300} placeholder="Reason (shown to the writer)" className={inputClass} />
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button disabled={busy || override.reason.trim().length < 5} onClick={() => setAvailabilityOverride(true)} className="rounded-lg bg-[#002147] px-4 py-2 font-semibold text-white disabled:opacity-50">Apply override</button>
                                                {writer.availability.override && <button disabled={busy} onClick={() => setAvailabilityOverride(false)} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Clear override</button>}
                                            </div>
                                        </div>
                                    ) : <p className="text-xs text-slate-500">Your role can’t override availability.</p>}
                                </div>
                            )}

                            {tab === 'History' && (
                                <ol className="space-y-4 border-l-2 border-slate-100 pl-5">
                                    {[...writer.application.history].reverse().map((h, i) => (
                                        <li key={i} className="relative text-sm">
                                            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#fea520]" />
                                            <p className="font-semibold text-[#0b1b33]">{h.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}</p>
                                            <p className="text-xs text-slate-500">{new Date(h.at).toLocaleString()} · {h.actorType === 'ADMIN' ? h.actorName || 'Admin' : h.actorType.toLowerCase()}{h.toStatus ? ` · → ${h.toStatus}` : ''}</p>
                                            {h.note && <p className="mt-1 whitespace-pre-line text-slate-700">{h.note}</p>}
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>

                        {/* Action bar */}
                        {/* Right padding keeps buttons clear of the site's floating chat button. */}
                        <div className="border-t border-slate-100 bg-white p-4 pr-24 sm:p-5 sm:pr-24">
                            {pending ? (
                                <div className="space-y-3">
                                    <label htmlFor="action-reason" className="block text-sm font-semibold text-[#0b1b33]">
                                        {pending.label}: {pending.needsReason ? 'reason (sent to the writer)' : 'note (optional, sent to the writer)'}
                                    </label>
                                    <textarea id="action-reason" rows={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className={cn(inputClass, 'resize-y')} autoFocus
                                        placeholder={pending.id === 'request_info' ? 'e.g. Please upload your master’s degree certificate.' : ''} />
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <button onClick={() => { setPending(null); setReason(''); }} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                                        <button onClick={confirmAction} disabled={busy || (pending.needsReason && reason.trim().length < 5)} className={cn('inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50', pending.tone)}>
                                            {busy && <Spinner className="h-4 w-4" />} Confirm {pending.label.toLowerCase()}
                                        </button>
                                    </div>
                                </div>
                            ) : actions.length ? (
                                <div className="flex flex-wrap justify-end gap-2">
                                    {actions.map(a => <button key={a.id} onClick={() => { setPending(a); setError(''); }} className={cn('rounded-xl px-4 py-2.5 text-sm font-semibold transition', a.tone)}>{a.label}</button>)}
                                </div>
                            ) : (
                                <p className="text-right text-sm text-slate-500">{writer.application.status === 'DRAFT' ? 'The writer hasn’t submitted their application yet.' : 'No actions available in this state.'}</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
