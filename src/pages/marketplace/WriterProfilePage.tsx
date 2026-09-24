import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Star, MapPin, BadgeCheck, GraduationCap, FileText, Languages, Layers, Award, Gauge, MessageCircle, ArrowLeft, ExternalLink, Crown } from 'lucide-react';
import { MarketplaceNavbar as Navbar } from '../../components/writer/MarketplaceNavbar';
import { Footer } from '../../components/Footer';
import { API, api } from '../../lib/api';
import type { PublicWriter } from '../../lib/writerTypes';
import { countryName } from '../../lib/writerOptions';
import { AvailabilityDot, Spinner, WriterAvatar } from '../../components/writer/WriterBits';

function Chips({ items, tone = 'plain' }: { items: string[]; tone?: 'plain' | 'strong' }) {
    return (
        <div className="flex flex-wrap gap-2">
            {items.map(i => <span key={i} className={tone === 'strong' ? 'rounded-lg bg-[#002147] px-3 py-1.5 text-sm font-medium text-white' : 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700'}>{i}</span>)}
        </div>
    );
}

function Block({ title, icon: Icon, children }: { title: string; icon: typeof Star; children: React.ReactNode }) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-[#0b1b33]"><Icon className="h-5 w-5 text-[#b86e00]" /> {title}</h2>
            {children}
        </section>
    );
}

export default function WriterProfilePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [writer, setWriter] = useState<PublicWriter | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api<{ writer: PublicWriter }>(`/writers/public/${id}`)
            .then(d => setWriter(d.writer))
            .catch(() => setWriter(null))
            .finally(() => setLoading(false));
    }, [id]);

    const requestWriter = () => {
        navigate('/');
        setTimeout(() => window.dispatchEvent(new Event('open-order-modal')), 300);
    };

    if (loading) return <div className="min-h-screen bg-[#f6f8fc]"><Navbar /><div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8 text-[#002147]" /></div></div>;
    if (!writer) return (
        <div className="min-h-screen bg-[#f6f8fc]"><Navbar />
            <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
                <h1 className="text-2xl font-bold text-[#0b1b33]">This profile isn’t available</h1>
                <p className="mt-2 text-slate-600">The writer may have hidden their profile, or the link is incorrect.</p>
                <Link to="/hire-writers" className="mt-6 rounded-xl bg-[#002147] px-5 py-3 font-semibold text-white">Browse writers</Link>
            </div>
        </div>
    );

    const m = writer.metrics;
    const stats = [
        { label: 'Rating', value: m.ratingCount ? m.rating.toFixed(1) : 'New', sub: m.ratingCount ? `${m.ratingCount} reviews` : 'No reviews yet', icon: Star },
        { label: 'Completed', value: String(m.completedAssignments), sub: 'assignments', icon: FileText },
        { label: 'Quality score', value: m.completedAssignments ? `${Math.round(m.qualityScore)}%` : '—', sub: 'editorial QA', icon: Gauge },
        { label: 'Response rate', value: m.completedAssignments ? `${Math.round(m.responseRate)}%` : '—', sub: 'to client messages', icon: MessageCircle },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-[#f6f8fc] font-sans">
            <Navbar activeSection="writers" />
            <main className="mx-auto w-full max-w-6xl flex-grow px-4 pb-24 pt-8 sm:px-6 lg:pt-12">
                <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#002147]"><ArrowLeft className="h-4 w-4" /> Back</button>

                {/* Header */}
                <header className="relative overflow-hidden rounded-3xl bg-[#002147] p-6 text-white sm:p-10">
                    <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[36px] border-[#fea520]/15" />
                    <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                        <WriterAvatar writerId={writer.id} name={writer.name} hasPhoto={writer.hasPhoto} version={writer.photoVersion} size={112} className="ring-4 ring-white/15" />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{writer.name}</h1>
                                <BadgeCheck className="h-6 w-6 text-[#fea520]" aria-label="Verified writer" />
                                {writer.membershipPlan && <span className="inline-flex items-center gap-1 rounded-full bg-[#fea520] px-2.5 py-0.5 text-xs font-bold text-[#0b1b33]"><Crown className="h-3 w-3" />{writer.membershipPlan}</span>}
                            </div>
                            {writer.headline && <p className="mt-1 text-lg text-white/80">{writer.headline}</p>}
                            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70">
                                <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{countryName(writer.country)}</span>
                                <span>{writer.yearsExperience} yrs experience</span>
                                <span className="rounded-full bg-white px-2 py-0.5"><AvailabilityDot status={writer.availability} /></span>
                            </div>
                        </div>
                        <button onClick={requestWriter} disabled={writer.availability !== 'AVAILABLE'}
                            className="shrink-0 rounded-xl bg-[#fea520] px-6 py-3.5 font-bold text-[#0b1b33] transition hover:bg-[#f39200] disabled:cursor-not-allowed disabled:opacity-60">
                            {writer.availability === 'AVAILABLE' ? 'Request this writer' : 'Currently unavailable'}
                        </button>
                    </div>
                </header>

                {/* Metrics */}
                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {stats.map(s => (
                        <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                            <s.icon className="h-5 w-5 text-[#b86e00]" />
                            <p className="mt-3 text-2xl font-extrabold text-[#0b1b33]">{s.value}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
                            <p className="text-xs text-slate-400">{s.sub}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
                    <div className="space-y-6">
                        <Block title="About" icon={Award}>
                            <div className="space-y-3 text-slate-700">{writer.bio?.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>
                        </Block>
                        {writer.writingExperience && (
                            <Block title="Writing experience" icon={FileText}>
                                <p className="whitespace-pre-line text-slate-700">{writer.writingExperience}</p>
                            </Block>
                        )}
                        <Block title="Education" icon={GraduationCap}>
                            <ol className="space-y-5 border-l-2 border-slate-100 pl-5">
                                {writer.education?.map((e, i) => (
                                    <li key={i} className="relative">
                                        <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#fea520]" />
                                        <p className="font-semibold text-[#0b1b33]">{e.degree}</p>
                                        <p className="text-sm text-slate-600">{e.university}{e.graduationYear ? ` · ${e.graduationYear}` : ''}</p>
                                        <p className="text-xs text-slate-400">{e.level}{e.fieldOfStudy ? ` · ${e.fieldOfStudy}` : ''}</p>
                                    </li>
                                ))}
                            </ol>
                        </Block>
                        {!!writer.writingSamples?.length && (
                            <Block title="Writing samples" icon={FileText}>
                                <ul className="grid gap-3 sm:grid-cols-2">
                                    {writer.writingSamples.map(s => (
                                        <li key={s.id}>
                                            <a href={`${API}/writers/documents/${s.id}/file`} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-[#002147]">
                                                <FileText className="h-5 w-5 shrink-0 text-[#002147]" />
                                                <span className="min-w-0 flex-1 truncate font-medium text-[#0b1b33]">{s.title}</span>
                                                <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </Block>
                        )}
                    </div>

                    <aside className="space-y-6">
                        <Block title="Expertise" icon={Layers}><Chips items={writer.expertiseAreas} tone="strong" /></Block>
                        <Block title="Subjects" icon={GraduationCap}><Chips items={writer.subjects} /></Block>
                        <Block title="Skills" icon={Award}><Chips items={writer.skills} /></Block>
                        <Block title="Academic levels" icon={Layers}><Chips items={writer.academicLevels} /></Block>
                        <Block title="Languages" icon={Languages}><Chips items={writer.languages} /></Block>
                        <p className="px-2 text-xs text-slate-500">Member since {new Date(writer.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}. Contact happens through the platform; personal contact details are never shared.</p>
                    </aside>
                </div>
            </main>
            <Footer />
        </div>
    );
}
