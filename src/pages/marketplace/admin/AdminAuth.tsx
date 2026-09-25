import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Download, KeyRound, Shield, ShieldCheck, Smartphone, X } from 'lucide-react';
import { API } from '../../../lib/api';
import { ADMIN_COOKIE_SESSION } from '../../../lib/session';

// Admin sign-in with two-factor authentication, and the admin's own 2FA
// settings. The session itself is an httpOnly cookie set by the server; the
// page never stores a token (see lib/session.ts and main.tsx).

type SetupPayload = { secret: string; otpauthUrl: string; qrDataUrl: string };

async function post<T = any>(path: string, body: unknown, token?: string): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;   // the placeholder is stripped by the interceptor
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

function CodeInput({ value, onChange, autoFocus = true, dark = true }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; dark?: boolean }) {
    return (
        <input
            value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} autoFocus={autoFocus} aria-label="6-digit code" placeholder="123456"
            className={dark ? `${field} text-center text-2xl tracking-[0.5em] font-bold` : 'w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-xl font-bold tracking-[0.4em] focus:border-[#002147] focus:outline-none'}
        />
    );
}

export function RecoveryCodes({ codes, dark = true }: { codes: string[]; dark?: boolean }) {
    const [copied, setCopied] = useState(false);
    const text = codes.join('\n');
    const download = () => {
        const url = URL.createObjectURL(new Blob([`AssignmentMinds admin recovery codes\nEach code works once.\n\n${text}\n`], { type: 'text/plain' }));
        const a = document.createElement('a'); a.href = url; a.download = 'assignmentminds-admin-recovery-codes.txt'; a.click(); URL.revokeObjectURL(url);
    };
    return (
        <div>
            <ul className={`grid grid-cols-2 gap-2 rounded-2xl p-4 font-mono text-sm ${dark ? 'bg-black/30 text-white' : 'bg-gray-50 text-gray-900'}`} data-testid="recovery-codes">
                {codes.map(c => <li key={c} className="text-center tracking-wider">{c}</li>)}
            </ul>
            <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => setCopied(true)); }} className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" onClick={download} className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                    <Download className="h-4 w-4" /> Download
                </button>
            </div>
        </div>
    );
}

function SetupSteps({ setup, dark = true }: { setup: SetupPayload; dark?: boolean }) {
    return (
        <div className="space-y-4">
            <ol className={`list-decimal space-y-1 pl-5 text-sm ${dark ? 'text-white/70' : 'text-gray-600'}`}>
                <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password).</li>
                <li>Scan this QR code, or type the key below.</li>
                <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <div className="flex flex-col items-center gap-3">
                <img src={setup.qrDataUrl} alt="QR code for your authenticator app" width={180} height={180} className="rounded-xl bg-white p-2" data-testid="totp-qr" />
                <code className={`select-all break-all rounded-lg px-3 py-2 text-center text-xs tracking-wider ${dark ? 'bg-black/30 text-white/80' : 'bg-gray-100 text-gray-700'}`} data-testid="totp-key">{setup.secret}</code>
            </div>
        </div>
    );
}

type Step =
    | { kind: 'password' }
    | { kind: 'code'; challenge: string }
    | { kind: 'setup'; challenge: string; setup: SetupPayload }
    | { kind: 'codes'; codes: string[]; token: string };

// ─── Sign-in screen ───────────────────────────────────────────────────────────
export function AdminLogin({ onLogin, notice: initialNotice = '' }: { onLogin: (token: string) => void; notice?: string }) {
    const [step, setStep] = useState<Step>({ kind: 'password' });
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [recovery, setRecovery] = useState('');
    const [useRecovery, setUseRecovery] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState(initialNotice);
    const [loading, setLoading] = useState(false);

    const finish = async (token: string) => onLogin(await resolveAdminSession(token));
    const restart = (msg = '') => { setStep({ kind: 'password' }); setCode(''); setRecovery(''); setUseRecovery(false); setPassword(''); setError(msg); };

    const run = (fn: () => Promise<void>) => async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try { await fn(); }
        catch (err: any) {
            const msg = err?.message || 'Something went wrong.';
            if (/password again|expired/i.test(msg)) restart(msg); else setError(msg);
        } finally { setLoading(false); }
    };

    const submitPassword = run(async () => {
        const data = await post('/admin/login', { username: username.trim(), password });
        setPassword('');
        if (data.twoFactorRequired) { setStep({ kind: 'code', challenge: data.challenge }); return; }
        if (data.twoFactorSetupRequired) { setStep({ kind: 'setup', challenge: data.challenge, setup: data.setup }); return; }
        await finish(data.token);
    });

    const submitCode = run(async () => {
        if (step.kind !== 'code') return;
        const data = await post('/admin/login/2fa', useRecovery ? { challenge: step.challenge, recoveryCode: recovery } : { challenge: step.challenge, code });
        if (typeof data.recoveryCodesLeft === 'number' && data.recoveryCodesLeft <= 3)
            setNotice(`You have ${data.recoveryCodesLeft} recovery code${data.recoveryCodesLeft === 1 ? '' : 's'} left. Create new ones in Security.`);
        await finish(data.token);
    });

    const submitSetup = run(async () => {
        if (step.kind !== 'setup') return;
        const data = await post('/admin/login/2fa', { challenge: step.challenge, code });
        setStep({ kind: 'codes', codes: data.recoveryCodes || [], token: data.token });
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#000a1e] via-[#001233] to-[#002147] flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#fea520]/10 border border-[#fea520]/30 mb-4">
                        {step.kind === 'password' ? <Shield className="w-10 h-10 text-[#fea520]" /> : <ShieldCheck className="w-10 h-10 text-[#fea520]" />}
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

                    {step.kind === 'password' && (
                        <form onSubmit={submitPassword} className="space-y-5" aria-label="Sign in">
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
                            <button type="submit" disabled={loading} className={primary}>{loading ? 'Checking…' : 'Continue'}</button>
                        </form>
                    )}

                    {step.kind === 'code' && (
                        <form onSubmit={submitCode} className="space-y-5" aria-label="Two-factor code">
                            <div className="text-center">
                                <Smartphone className="mx-auto mb-2 h-6 w-6 text-[#fea520]" />
                                <h2 className="text-lg font-bold text-white">{useRecovery ? 'Enter a recovery code' : 'Enter your 6-digit code'}</h2>
                                <p className="mt-1 text-sm text-white/50">{useRecovery ? 'Each recovery code works once.' : 'Open your authenticator app for the current code.'}</p>
                            </div>
                            {useRecovery
                                ? <input value={recovery} onChange={e => setRecovery(e.target.value.toUpperCase())} autoFocus aria-label="Recovery code" placeholder="XXXX-XXXX" autoComplete="off" className={`${field} text-center font-mono tracking-widest`} />
                                : <CodeInput value={code} onChange={setCode} />}
                            <button type="submit" disabled={loading || (useRecovery ? recovery.trim().length < 8 : code.length !== 6)} className={primary}>{loading ? 'Verifying…' : 'Sign in'}</button>
                            <div className="flex justify-between text-sm">
                                <button type="button" onClick={() => { setUseRecovery(u => !u); setError(''); }} className="text-white/60 hover:text-white">{useRecovery ? 'Use the app code' : 'Lost your phone? Use a recovery code'}</button>
                                <button type="button" onClick={() => restart()} className="text-white/40 hover:text-white">Start again</button>
                            </div>
                        </form>
                    )}

                    {step.kind === 'setup' && (
                        <form onSubmit={submitSetup} className="space-y-5" aria-label="Set up two-factor authentication">
                            <div className="text-center">
                                <KeyRound className="mx-auto mb-2 h-6 w-6 text-[#fea520]" />
                                <h2 className="text-lg font-bold text-white">Set up two-factor authentication</h2>
                                <p className="mt-1 text-sm text-white/50">Required for every admin account. It takes a minute.</p>
                            </div>
                            <SetupSteps setup={step.setup} />
                            <CodeInput value={code} onChange={setCode} autoFocus={false} />
                            <button type="submit" disabled={loading || code.length !== 6} className={primary}>{loading ? 'Verifying…' : 'Turn on and continue'}</button>
                            <button type="button" onClick={() => restart()} className="block w-full text-center text-sm text-white/40 hover:text-white">Cancel</button>
                        </form>
                    )}

                    {step.kind === 'codes' && (
                        <div className="space-y-5" aria-label="Recovery codes">
                            <div className="text-center">
                                <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                                <h2 className="text-lg font-bold text-white">Two-factor authentication is on</h2>
                                <p className="mt-1 text-sm text-white/60">Save these recovery codes somewhere safe. If you lose your phone, each one lets you sign in once. They won’t be shown again.</p>
                            </div>
                            <RecoveryCodes codes={step.codes} />
                            <label className="flex items-center gap-2 text-sm text-white/70">
                                <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} className="h-4 w-4" /> I’ve saved my recovery codes
                            </label>
                            <button type="button" disabled={!saved} onClick={() => finish(step.token)} className={primary}>Go to dashboard</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Own security settings (header "Security" button) ─────────────────────────
export function AdminSecurityDialog({ token, onClose }: { token: string; onClose: () => void }) {
    const [me, setMe] = useState<{ twoFactorEnabled: boolean; twoFactorRequired: boolean } | null>(null);
    const [setup, setSetup] = useState<SetupPayload | null>(null);
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [codes, setCodes] = useState<string[] | null>(null);
    const [mode, setMode] = useState<'idle' | 'regenerate' | 'disable'>('idle');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const load = () => fetch(`${API}/admin/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setMe(d.admin)).catch(() => setError('Could not load your security settings.'));
    useEffect(() => { load(); }, []);

    const act = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Security">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#000a1e]"><ShieldCheck className="h-5 w-5 text-[#002147]" /> Security</h2>
                    <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                </div>
                {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                {!me ? <p className="text-sm text-gray-500">Loading…</p> : codes ? (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">Your new recovery codes. The old ones no longer work. Save these now — they won’t be shown again.</p>
                        <RecoveryCodes codes={codes} dark={false} />
                        <button onClick={onClose} className="w-full rounded-xl bg-[#000a1e] py-3 font-semibold text-white">Done</button>
                    </div>
                ) : me.twoFactorEnabled ? (
                    <div className="space-y-4">
                        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><Check className="h-4 w-4" /> Two-factor authentication is on</p>
                        {mode === 'idle' && (
                            <div className="flex flex-col gap-2">
                                <button onClick={() => setMode('regenerate')} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">Create new recovery codes</button>
                                {!me.twoFactorRequired && <button onClick={() => setMode('disable')} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">Turn off two-factor authentication</button>}
                            </div>
                        )}
                        {mode !== 'idle' && (
                            <form className="space-y-3" onSubmit={e => { e.preventDefault(); act(async () => {
                                if (mode === 'regenerate') { const d = await post('/admin/me/2fa/recovery-codes', { code }, token); setCodes(d.recoveryCodes); }
                                else { await post('/admin/me/2fa/disable', { password, code }, token); setMode('idle'); setCode(''); setPassword(''); await load(); }
                            }); }}>
                                {mode === 'disable' && <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" className="w-full rounded-xl border border-gray-200 px-4 py-3" />}
                                <p className="text-sm text-gray-600">Enter the current code from your authenticator app.</p>
                                <CodeInput value={code} onChange={setCode} dark={false} />
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setMode('idle'); setCode(''); }} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                                    <button type="submit" disabled={busy || code.length !== 6} className="flex-1 rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{mode === 'regenerate' ? 'Create codes' : 'Turn off'}</button>
                                </div>
                            </form>
                        )}
                    </div>
                ) : setup ? (
                    <form className="space-y-4" onSubmit={e => { e.preventDefault(); act(async () => { const d = await post('/admin/me/2fa/enable', { code }, token); setCodes(d.recoveryCodes); }); }}>
                        <SetupSteps setup={setup} dark={false} />
                        <CodeInput value={code} onChange={setCode} dark={false} autoFocus={false} />
                        <button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-xl bg-[#000a1e] py-3 font-semibold text-white disabled:opacity-50">Turn on</button>
                    </form>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">Protect your admin account with a 6-digit code from an authenticator app, in addition to your password.</p>
                        <button disabled={busy} onClick={() => act(async () => { const d = await post('/admin/me/2fa/setup', {}, token); setSetup(d.setup); })} className="w-full rounded-xl bg-[#000a1e] py-3 font-semibold text-white">Set up two-factor authentication</button>
                    </div>
                )}
            </div>
        </div>
    );
}
