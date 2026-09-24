import React from 'react';
import { Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WriterWorkDashboard from './WriterWorkDashboard';
import { useWriter } from '../onboarding/WriterContext';
import { ApplicationTracker, StatusExplainer } from '../onboarding/ApplicationPanels';
import { MembershipDisclaimer } from '../../../components/writer/MembershipBits';

// Writers not yet approved (or suspended/rejected) see their application status instead of job stats.
function ApplicationOverview() {
    const { writer } = useWriter();
    const navigate = useNavigate();
    if (!writer) return null;
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Your application</h1>
                <p className="mt-1 text-slate-600">Track where you are in the writer onboarding process.</p>
            </div>
            <StatusExplainer writer={writer} onGoTo={() => navigate('/writer/onboarding')} />
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Your journey</h2>
                <ApplicationTracker writer={writer} />
            </div>
        </div>
    );
}

// Approved writers without a live membership: the next step is choosing a plan.
function MembershipPrompt() {
    const { writer } = useWriter();
    const navigate = useNavigate();
    if (!writer) return null;
    const lapsed = ['EXPIRED', 'CANCELLED', 'SUSPENDED'].includes(writer.membership.status);
    const pending = writer.membership.status === 'PENDING';
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-2xl border border-[#fea520]/40 bg-gradient-to-r from-[#fff7e8] to-white p-5 sm:flex-row sm:items-center sm:p-6">
                <Crown className="h-8 w-8 shrink-0 text-[#b86e00]" />
                <div className="flex-1">
                    <p className="font-bold text-[#0b1b33]">{pending ? 'Your membership is being set up' : lapsed ? 'Your membership has ended' : 'You’re approved! Activate your writer membership'}</p>
                    <p className="text-sm text-slate-600">{pending ? 'Finish your payment, or wait while we verify it.' : 'A membership unlocks assignment opportunities and your public profile.'}</p>
                </div>
                <button onClick={() => navigate('/writer/membership')} className="rounded-xl bg-[#002147] px-5 py-3 font-semibold text-white">{pending ? 'View membership' : lapsed ? 'Rejoin' : 'Choose a plan'}</button>
            </div>
            <MembershipDisclaimer />
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Your journey</h2>
                <ApplicationTracker writer={writer} />
            </div>
        </div>
    );
}

export default function WriterOverview() {
    const { writer } = useWriter();
    if (writer?.status === 'APPROVED') return <MembershipPrompt />;
    if (writer && writer.status !== 'ACTIVE') return <ApplicationOverview />;
    return <WriterWorkDashboard />;
}
