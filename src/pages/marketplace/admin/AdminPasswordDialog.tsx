import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { api } from '../../../lib/api';
import { inputClass } from '../../../components/writer/FormKit';
import { cn } from '../../../lib/utils';

// Any admin can change their own password (POST /api/admin/me/password, audited).
export default function AdminPasswordDialog({ token, onClose }: { token: string; onClose: () => void }) {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        if (next.length < 12) return setError('Use at least 12 characters.');
        if (next !== confirm) return setError('The new passwords don’t match.');
        setBusy(true);
        try { await api('/admin/me/password', { method: 'POST', token, body: { currentPassword: current, newPassword: next } }); setDone(true); }
        catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Change password">
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[#000a1e]">Change password</h2>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                {done ? (
                    <div className="space-y-4 text-sm text-gray-600">
                        <p className="flex items-center gap-2 font-semibold text-emerald-700"><Check className="h-5 w-5" /> Password changed.</p>
                        <p>Use your new password next time you sign in.</p>
                        <button onClick={onClose} className="w-full rounded-xl bg-[#000a1e] py-2.5 font-semibold text-white">Done</button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-600">Current password<input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required className={cn(inputClass, 'mt-1 py-2 text-sm')} /></label>
                        <label className="block text-xs font-semibold text-gray-600">New password<input type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} required minLength={12} className={cn(inputClass, 'mt-1 py-2 text-sm')} /><span className="mt-1 block font-normal text-gray-400">At least 12 characters. A passphrase works well.</span></label>
                        <label className="block text-xs font-semibold text-gray-600">Confirm new password<input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required className={cn(inputClass, 'mt-1 py-2 text-sm')} /></label>
                        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                        <button disabled={busy} className="w-full rounded-xl bg-[#000a1e] py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Change password'}</button>
                    </form>
                )}
            </div>
        </div>
    );
}
