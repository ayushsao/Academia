import React, { useCallback, useEffect, useState } from 'react';
import { Mail, Trash2, Copy, Check, ShieldCheck } from 'lucide-react';
import { api } from '../../../lib/api';
import { Spinner } from '../../../components/writer/WriterBits';
import { inputClass } from '../../../components/writer/FormKit';
import { cn } from '../../../lib/utils';

type Role = { id: string; label: string; permissions: string[] };
type AdminRow = { _id: string; username: string; email?: string; role: string; roleLabel: string; isSelf: boolean; createdAt: string; lastLoginAt?: string };

const ROLE_BLURB: Record<string, string> = {
    SUPER_ADMIN: 'Full access, including team management and the audit log.',
    HR: 'Writers and applications: review, approve, documents, contact details.',
    OPERATIONS: 'Assignments and customer orders; read-only writer profiles.',
    FINANCE: 'Membership plans, subscriptions, payments and writer payouts.',
    MARKETING: 'Recruitment funnel, enquiries (leads) and site analytics.',
};

export default function AdminTeamTab({ token }: { token: string }) {
    const [admins, setAdmins] = useState<AdminRow[] | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [perms, setPerms] = useState<Record<string, string>>({});
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('HR');
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [invite, setInvite] = useState<{ username: string; password: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const load = useCallback(async () => {
        const d = await api<{ admins: AdminRow[]; roles: Role[]; permissions: Record<string, string> }>('/admin/managers', { token });
        setAdmins(d.admins); setRoles(d.roles); setPerms(d.permissions);
    }, [token]);
    useEffect(() => { load().catch(e => setMsg({ ok: false, text: e.message })); }, [load]);

    const doInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy('invite'); setMsg(null); setInvite(null);
        try {
            const d = await api<{ admin: { username: string; role: string }; plainPassword: string }>('/admin/managers', { method: 'POST', token, body: { email, role } });
            setInvite({ username: d.admin.username, password: d.plainPassword });
            // Existing practice: also try to email the credentials via EmailJS.
            try {
                const cfg = {
                    serviceId: (import.meta as any).env.VITE_EMAILJS_SERVICE_ID || 'service_089l13d',
                    templateId: (import.meta as any).env.VITE_EMAILJS_ADMIN_TEMPLATE_ID || 'template_omo2hya',
                    publicKey: (import.meta as any).env.VITE_EMAILJS_PUBLIC_KEY || 'u1Lnz6UEF9jlDevVZ',
                };
                const emailjs = (await import('@emailjs/browser')).default;
                await emailjs.send(cfg.serviceId, cfg.templateId, {
                    to_name: 'Team member', to_email: email, admin_username: d.admin.username, admin_password: d.plainPassword,
                    login_url: `${window.location.origin}/admin`, email,
                    message: `You have been given ${roles.find(r => r.id === role)?.label} access to the AssignmentMinds admin console.\n\nLogin: ${window.location.origin}/admin\nUsername: ${d.admin.username}\nPassword: ${d.plainPassword}`,
                    app_url: window.location.origin,
                }, cfg.publicKey);
                setMsg({ ok: true, text: 'Invitation emailed. The password is also shown below once — share it securely if the email doesn’t arrive.' });
            } catch {
                setMsg({ ok: true, text: 'Admin created, but the invitation email could not be sent. Share the credentials below securely.' });
            }
            setEmail('');
            load();
        } catch (err) { setMsg({ ok: false, text: (err as Error).message }); } finally { setBusy(''); }
    };

    const changeRole = async (a: AdminRow, next: string) => {
        setBusy(a._id); setMsg(null);
        try { await api(`/admin/managers/${a._id}/role`, { method: 'PATCH', token, body: { role: next } }); setMsg({ ok: true, text: `${a.username} is now ${roles.find(r => r.id === next)?.label}. The change applies immediately.` }); load(); }
        catch (err) { setMsg({ ok: false, text: (err as Error).message }); } finally { setBusy(''); }
    };
    const remove = async (a: AdminRow) => {
        setBusy(a._id); setMsg(null);
        try { await api(`/admin/managers/${a._id}`, { method: 'DELETE', token }); setConfirmDelete(null); setMsg({ ok: true, text: `${a.username} removed. Their session ends immediately.` }); load(); }
        catch (err) { setMsg({ ok: false, text: (err as Error).message }); } finally { setBusy(''); }
    };

    if (!admins) return msg ? <p className="text-sm text-red-600">{msg.text}</p> : <div className="flex justify-center py-12"><Spinner className="h-7 w-7 text-[#fea520]" /></div>;

    return (
        <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 font-bold text-[#000a1e]"><Mail className="h-4 w-4 text-[#fea520]" /> Invite a team member</h3>
                    <form onSubmit={doInvite} className="mt-4 space-y-3">
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" className={cn(inputClass, 'py-2.5 text-sm')} aria-label="Email" />
                        <div className="grid gap-2 sm:grid-cols-2">
                            {roles.map(r => (
                                <label key={r.id} className={cn('flex cursor-pointer gap-2 rounded-xl border p-3 text-sm', role === r.id ? 'border-[#000a1e] ring-2 ring-[#000a1e]/10' : 'border-gray-200')}>
                                    <input type="radio" name="role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} className="mt-0.5 accent-[#000a1e]" />
                                    <span><span className="block font-semibold text-[#000a1e]">{r.label}</span><span className="text-xs text-gray-500">{ROLE_BLURB[r.id]}</span></span>
                                </label>
                            ))}
                        </div>
                        <button type="submit" disabled={busy === 'invite'} className="rounded-xl bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === 'invite' ? 'Inviting…' : 'Send invite'}</button>
                    </form>
                    {invite && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                            <p className="font-semibold text-amber-900">Shown once — copy it now</p>
                            <p className="mt-1 font-mono text-xs text-amber-900">{invite.username} / {invite.password}</p>
                            <button onClick={() => { navigator.clipboard?.writeText(`${invite.username}\n${invite.password}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-900">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy</button>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 font-bold text-[#000a1e]"><ShieldCheck className="h-4 w-4 text-[#fea520]" /> What each role can do</h3>
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[520px] text-xs">
                            <thead><tr className="text-left text-gray-400"><th className="py-1.5 pr-2 font-semibold">Permission</th>{roles.map(r => <th key={r.id} className="px-1 py-1.5 text-center font-semibold">{r.label}</th>)}</tr></thead>
                            <tbody className="divide-y divide-gray-50">
                                {Object.entries(perms).map(([k, label]) => (
                                    <tr key={k}><td className="py-1.5 pr-2 text-gray-600">{label}</td>
                                        {roles.map(r => <td key={r.id} className="px-1 py-1.5 text-center">{r.permissions.includes(k) ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-600" aria-label="Yes" /> : <span className="text-gray-200" aria-label="No">—</span>}</td>)}</tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {msg && <p className={cn('rounded-lg px-3 py-2 text-sm', msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>{msg.text}</p>}

            <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <h3 className="border-b border-gray-100 px-5 py-3 font-bold text-[#000a1e]">Team <span className="text-sm font-normal text-gray-400">({admins.length})</span></h3>
                <ul className="divide-y divide-gray-100">
                    {admins.map(a => (
                        <li key={a._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-[#000a1e]">{a.username}{a.isSelf && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">You</span>}</p>
                                <p className="text-xs text-gray-400">Added {new Date(a.createdAt || Date.now()).toLocaleDateString()} · {a.lastLoginAt ? `last sign-in ${new Date(a.lastLoginAt).toLocaleString()}` : 'never signed in'}</p>
                            </div>
                            <select value={a.role} disabled={a.isSelf || busy === a._id} onChange={e => changeRole(a, e.target.value)} aria-label={`Role for ${a.username}`}
                                className={cn(inputClass, 'w-auto py-2 text-sm')}>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                            </select>
                            {!a.isSelf && (confirmDelete === a._id ? (
                                <span className="flex gap-2">
                                    <button onClick={() => remove(a)} disabled={busy === a._id} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">Remove</button>
                                    <button onClick={() => setConfirmDelete(null)} className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100">Keep</button>
                                </span>
                            ) : <button onClick={() => setConfirmDelete(a._id)} aria-label={`Remove ${a.username}`} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>)}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
