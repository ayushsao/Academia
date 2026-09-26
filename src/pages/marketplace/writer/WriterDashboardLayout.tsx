import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { MarketplaceNavbar as Navbar } from '../../../components/writer/MarketplaceNavbar';
import { LayoutDashboard, Briefcase, DollarSign, MessageSquare, Bell, UserCircle, Settings, LogOut, FolderOpen, Lock, ExternalLink, Crown, Inbox, History, Gavel } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { api } from '../../../lib/api';
import type { WriterMe } from '../../../lib/writerTypes';
import { WriterProvider, useWriter } from '../onboarding/WriterContext';
import { AvailabilityDot, Spinner, StatusBadge, WriterAvatar } from '../../../components/writer/WriterBits';
import { Notice } from '../../../components/writer/FormKit';
import { cn } from '../../../lib/utils';

const ONBOARDING_STEPS = ['COMPLETE_PROFILE', 'SUBMIT_APPLICATION'];

// Items flagged `memberOnly` need an ACTIVE writer, i.e. a live membership (enforced server-side too).
const NAV_ITEMS = [
    { path: '/writer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/writer/membership', label: 'Membership', icon: Crown, approvedOnly: true },
    { path: '/writer/opportunities', label: 'Opportunities', icon: Inbox, memberOnly: true },
    { path: '/writer/bidding', label: 'Bidding', icon: Gavel, memberOnly: true },
    { path: '/writer/orders', label: 'Client Orders', icon: Briefcase },
    { path: '/writer/assignments', label: 'My Assignments', icon: Briefcase, memberOnly: true },
    { path: '/writer/history', label: 'History', icon: History },
    { path: '/writer/earnings', label: 'Earnings', icon: DollarSign },
    { path: '/writer/messages', label: 'Messages', icon: MessageSquare, memberOnly: true },
    { path: '/writer/notifications', label: 'Notifications', icon: Bell },
    { path: '/writer/profile', label: 'My Profile', icon: UserCircle },
    { path: '/writer/documents', label: 'Documents', icon: FolderOpen },
    { path: '/writer/settings', label: 'Settings', icon: Settings },
];

const isWorking = (w: WriterMe) => ['APPROVED', 'ACTIVE'].includes(w.status);

function AvailabilityToggle({ writer, onUpdate }: { writer: WriterMe; onUpdate: (w: WriterMe) => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const { effectiveStatus, override } = writer.availability;
    const on = effectiveStatus === 'AVAILABLE';
    const disabled = busy || Boolean(override) || !isWorking(writer);

    // Availability only means something once the writer can take work.
    if (!isWorking(writer)) {
        return <p className="text-[11px] leading-snug text-slate-500">Availability can be set once you’re approved.</p>;
    }

    const toggle = async () => {
        setBusy(true); setError('');
        try {
            onUpdate((await api<{ writer: WriterMe }>('/writers/availability', { method: 'PATCH', body: { status: on ? 'UNAVAILABLE' : 'AVAILABLE' } })).writer);
        } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    };

    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <AvailabilityDot status={effectiveStatus} />
                <button type="button" role="switch" aria-checked={on} aria-label="Available for new work" onClick={toggle} disabled={disabled}
                    className={cn('relative h-6 w-11 shrink-0 rounded-full transition', on ? 'bg-emerald-500' : 'bg-slate-300', disabled && 'opacity-50')}>
                    <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
                </button>
            </div>
            {override && <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500"><Lock className="mt-0.5 h-3 w-3 shrink-0" /> Set by admin: {override.reason}</p>}
            {error && <p className="mt-2 text-[11px] font-medium text-red-600">{error}</p>}
        </div>
    );
}

// Unread notification count for the nav badge: refreshed on navigation, every
// minute, and whenever the notifications page reports a change.
function useUnreadCount(enabled: boolean) {
    const [unread, setUnread] = useState(0);
    const location = useLocation();
    useEffect(() => {
        if (!enabled) return;
        let live = true;
        const load = () => api<{ unread: number }>('/notifications/unread-count').then(d => live && setUnread(d.unread)).catch(() => {});
        load();
        const timer = window.setInterval(load, 60_000);
        window.addEventListener('notifications-changed', load);
        return () => { live = false; window.clearInterval(timer); window.removeEventListener('notifications-changed', load); };
    }, [enabled, location.pathname]);
    return unread;
}

const Badge = ({ n }: { n: number }) => (n > 0 ? <span className="ml-auto min-w-[20px] rounded-full bg-[#fea520] px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-[#0b1b33]" aria-label={`${n} unread`}>{n > 99 ? '99+' : n}</span> : null);

function LayoutInner() {
    const { writer, loading, error, setWriter } = useWriter();
    const logout = useStore(s => s.logoutWriter);
    const navigate = useNavigate();
    const unread = useUnreadCount(Boolean(writer));

    const handleLogout = async () => {
        try { await api('/writers/logout', { method: 'POST' }); } catch { /* signing out locally regardless */ }
        logout();   // the writer portal only — a customer session in this browser stays signed in
        navigate('/writer/login');
    };

    if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8 text-[#002147]" /></div>;
    if (error || !writer) return <div className="mx-auto max-w-xl px-4 pt-40"><Notice tone="error">{error || 'Could not load your writer account.'}</Notice></div>;
    if (ONBOARDING_STEPS.includes(writer.onboarding.nextStep)) return <Navigate to="/writer/onboarding" replace />;

    const items = NAV_ITEMS.map(item => ({ ...item, locked: (Boolean(item.memberOnly) && writer.status !== 'ACTIVE') || (Boolean(item.approvedOnly) && !isWorking(writer)) }));
    const linkClass = (locked: boolean) => ({ isActive }: { isActive: boolean }) => cn(
        'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
        isActive ? 'bg-[#002147] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-[#002147]',
        locked && 'pointer-events-none opacity-40',
    );

    return (
        <div className="flex flex-grow">
            {/* Sidebar (md+) */}
            <aside className="sticky top-[80px] hidden h-[calc(100vh-80px)] w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
                <div className="space-y-4 border-b border-slate-100 p-5">
                    <div className="flex items-center gap-3">
                        <WriterAvatar writerId={writer.id} name={writer.name} hasPhoto={writer.profile.hasPhoto} version={writer.profile.photoVersion} mode="private" size={44} />
                        <div className="min-w-0">
                            <p className="truncate font-bold text-[#0b1b33]">{writer.name}</p>
                            <StatusBadge status={writer.status} className="mt-1" />
                        </div>
                    </div>
                    <AvailabilityToggle writer={writer} onUpdate={setWriter} />
                </div>
                <nav className="flex-1 overflow-y-auto p-3" aria-label="Writer navigation">
                    <ul className="space-y-0.5">
                        {items.map(item => (
                            <li key={item.path}>
                                <NavLink to={item.path} className={linkClass(item.locked)} aria-disabled={item.locked} tabIndex={item.locked ? -1 : undefined}>
                                    <item.icon className="h-[18px] w-[18px]" /> <span className="flex-1">{item.label}</span>
                                    {item.locked && <Lock className="h-3.5 w-3.5" />}
                                    {item.path === '/writer/notifications' && <Badge n={unread} />}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="space-y-1 border-t border-slate-100 p-3">
                    {writer.status === 'ACTIVE' && writer.profile.visibility === 'PUBLIC' && (
                        <NavLink to={`/writer/${writer.id}`} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                            <ExternalLink className="h-[18px] w-[18px]" /> View public profile
                        </NavLink>
                    )}
                    <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
                        <LogOut className="h-[18px] w-[18px]" /> Sign out
                    </button>
                </div>
            </aside>

            <main className="relative min-w-0 flex-1 bg-slate-50/50">
                {/* Mobile header + scrollable nav */}
                <div className="sticky top-[64px] z-20 border-b border-slate-200 bg-white/95 backdrop-blur md:hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <WriterAvatar writerId={writer.id} name={writer.name} hasPhoto={writer.profile.hasPhoto} version={writer.profile.photoVersion} mode="private" size={32} />
                            <StatusBadge status={writer.status} />
                        </div>
                        <div className="w-40"><AvailabilityToggle writer={writer} onUpdate={setWriter} /></div>
                    </div>
                    <nav className="flex gap-1 overflow-x-auto px-3 pb-3" aria-label="Writer navigation">
                        {items.map(item => (
                            <NavLink key={item.path} to={item.path} className={linkClass(item.locked)} aria-disabled={item.locked}>
                                <item.icon className="h-4 w-4" /> {item.label}
                                {item.path === '/writer/notifications' && <Badge n={unread} />}
                            </NavLink>
                        ))}
                        <button onClick={handleLogout} className="flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-600"><LogOut className="h-4 w-4" /> Sign out</button>
                    </nav>
                </div>
                <div className="relative z-10 mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8 xl:px-10">
                    {/* Pages load on demand; keep the layout in place while one loads. */}
                    <Suspense fallback={<div className="flex justify-center py-24"><Spinner className="h-8 w-8 text-[#002147]" /></div>}>
                        <Outlet context={{ writer, setWriter }} />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}

export default function WriterDashboardLayout() {
    const writer = useStore(s => s.writer);
    if (!writer) return <Navigate to="/writer/login" replace />;
    return (
        <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
            <Navbar />
            <WriterProvider>
                <LayoutInner />
            </WriterProvider>
        </div>
    );
}
