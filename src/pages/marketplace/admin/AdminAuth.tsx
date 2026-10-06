import React, { useState } from 'react';
import { AlertCircle, Shield } from 'lucide-react';
import { API } from '../../../lib/api';
import { ADMIN_COOKIE_SESSION } from '../../../lib/session';

// Admin sign-in (username and password). The session itself is an httpOnly
// cookie set by the server; the page never stores a token (see lib/session.ts
// and main.tsx).

async function post<T = any>(path: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data as T;
}

/** Uses the cookie session when the browser keeps it; otherwise the token stays in memory only. */
export async function resolveAdminSession(token: string): Promise<string> {
    try {
        const r = await fetch(`${API}/admin/me`, { headers: { 'X-No-Bearer': '1' } });
        if (r.ok) return ADMIN_COOKIE_SESSION;
    } catch { /* fall through */ }
    return token;
}

/** Restores a session from the cookie on page load; resolves '' when signed out. */
export async function restoreAdminSession(): Promise<string> {
    try {
        const r = await fetch(`${API}/admin/me`, { headers: { 'X-No-Bearer': '1' } });
        return r.ok ? ADMIN_COOKIE_SESSION : '';
    } catch { return ''; }
}

export const signOutAdmin = () => fetch(`${API}/admin/logout`, { method: 'POST' }).catch(() => undefined);

const field = 'w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#fea520]/50 focus:ring-2 focus:ring-[#fea520]/20 placeholder:text-white/20 font-medium';
const primary = 'w-full bg-[#fea520] hover:bg-[#e09510] disabled:opacity-60 text-[#000a1e] font-extrabold py-3.5 rounded-[12px] transition-all flex items-center justify-center gap-2';

// ─── Sign-in screen ───────────────────────────────────────────────────────────
export function AdminLogin({ onLogin, notice = '' }: { onLogin: (token: string) => void; notice?: string }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const data = await post('/admin/login', { username: username.trim(), password });
            setPassword('');
            onLogin(await resolveAdminSession(data.token));
        } catch (err: any) {
            setError(err?.message || 'Something went wrong.');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#000a1e] via-[#001233] to-[#002147] flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#fea520]/10 border border-[#fea520]/30 mb-4">
                        <Shield className="w-10 h-10 text-[#fea520]" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-1">Admin Console</h1>
                    <p className="text-white/40 text-sm">AssignmentMinds Control Centre</p>
                </div>

                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 shadow-2xl space-y-5">
                    {error && (
                        <div role="alert" className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                        </div>
                    )}
                    {notice && <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">{notice}</div>}

                    <form onSubmit={submit} className="space-y-5" aria-label="Sign in">
                        <div>
                            <label htmlFor="admin-username" className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Username</label>
                            <input id="admin-username" type="text" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Enter admin username"
                                autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" name="username" className={field} />
                        </div>
                        <div>
                            <label htmlFor="admin-password" className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Password</label>
                            <input id="admin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter password"
                                autoComplete="current-password" name="password" className={field} />
                        </div>
                        <button type="submit" disabled={loading} className={primary}>{loading ? 'Signing in…' : 'Sign in'}</button>
                    </form>
                </div>
            </div>
        </div>
    );
}
