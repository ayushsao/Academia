import React, { useState } from 'react';
import { cn } from '../../../../lib/utils';
import { hasPermission, type AdminAccess } from '../access';
import MembershipAnalytics from './MembershipAnalytics';
import PaymentsPanel from './PaymentsPanel';
import SubscriptionsPanel from './SubscriptionsPanel';
import PlansPanel from './PlansPanel';
import SettingsPanel from './SettingsPanel';

// Each section lists the permissions that unlock it; the API enforces the same rules.
const SECTIONS = [
    { id: 'analytics', label: 'Analytics', perms: ['subscriptions.read'] },
    { id: 'payments', label: 'Payments', perms: ['payments.read'] },
    { id: 'subscriptions', label: 'Subscriptions', perms: ['subscriptions.read'] },
    { id: 'plans', label: 'Plans', perms: ['memberships.manage'] },
    { id: 'settings', label: 'Settings', perms: ['memberships.manage'] },
] as const;
type SectionId = typeof SECTIONS[number]['id'];

// Writer memberships admin: Finance and Super Admin.
export default function AdminMembershipTab({ token, access }: { token: string; access: AdminAccess | null }) {
    const sections = SECTIONS.filter(s => hasPermission(access, ...s.perms));
    const [picked, setSection] = useState<SectionId | null>(null);
    const section = sections.find(s => s.id === picked)?.id || sections[0]?.id;
    const [paymentFilter, setPaymentFilter] = useState('PENDING_VERIFICATION');
    const [planFilter, setPlanFilter] = useState('');
    const canSee = (id: SectionId) => sections.some(s => s.id === id);

    if (!section) return <p className="text-sm text-gray-500">Your role doesn’t include membership access.</p>;
    return (
        <div className="space-y-6">
            <nav className="flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Membership sections">
                {sections.map(s => (
                    <button key={s.id} onClick={() => { setSection(s.id); if (s.id === 'subscriptions') setPlanFilter(''); }} aria-current={section === s.id ? 'page' : undefined}
                        className={cn('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold', section === s.id ? 'border-[#fea520] text-[#000a1e]' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                        {s.label}
                    </button>
                ))}
            </nav>
            {section === 'analytics' && <MembershipAnalytics token={token} onOpenQueue={f => { if (!canSee('payments')) return; setPaymentFilter(f); setSection('payments'); }} />}
            {section === 'payments' && <React.Fragment key={paymentFilter}><PaymentsPanel token={token} initialFilter={paymentFilter} /></React.Fragment>}
            {section === 'subscriptions' && <React.Fragment key={planFilter}><SubscriptionsPanel token={token} canManage={hasPermission(access, 'subscriptions.manage')} initialPlan={planFilter} /></React.Fragment>}
            {section === 'plans' && <PlansPanel token={token} onViewSubscribers={canSee('subscriptions') ? code => { setPlanFilter(code); setSection('subscriptions'); } : undefined} />}
            {section === 'settings' && <SettingsPanel token={token} />}
        </div>
    );
}
