import React, { useEffect, useState } from 'react';
import { Mail, Smartphone, RotateCw, Pencil, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import type { WriterMe } from '../../../lib/writerTypes';
import { OtpInput, Notice, PhoneField } from '../../../components/writer/FormKit';
import { Spinner } from '../../../components/writer/WriterBits';

// One verification step (email or phone): send code, enter code, confirm.
// Codes are generated and checked server-side only.
export default function VerifyChannel({ channel, writer, onUpdate, initiallySent = false }: {
    channel: 'email' | 'phone'; writer: WriterMe; onUpdate: (w: WriterMe) => void; initiallySent?: boolean;
}) {
    const [code, setCode] = useState('');
    const [sent, setSent] = useState(initiallySent);
    const [cooldown, setCooldown] = useState(initiallySent ? 60 : 0);
    const [busy, setBusy] = useState<'send' | 'verify' | 'phone' | null>(null);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [editingPhone, setEditingPhone] = useState(false);
    const [phone, setPhone] = useState({ country: writer.phone.country, number: '' });

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const target = channel === 'email' ? writer.email : writer.phone.e164;
    const Icon = channel === 'email' ? Mail : Smartphone;

    const send = async () => {
        setBusy('send'); setError(''); setInfo('');
        try {
            const res = await api<{ message: string; resendInSeconds: number }>(`/writers/verify/${channel}/send`, { method: 'POST' });
            setSent(true); setCode('');
            setCooldown(res.resendInSeconds || 60);
            setInfo(res.message);
        } catch (err) {
            if (err instanceof ApiError && err.data?.retryAfter) { setSent(true); setCooldown(err.data.retryAfter); }
            setError((err as Error).message);
        } finally { setBusy(null); }
    };

    const verify = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (code.length !== 6) return;
        setBusy('verify'); setError('');
        try {
            const res = await api<{ writer: WriterMe }>(`/writers/verify/${channel}/confirm`, { method: 'POST', body: { code } });
            onUpdate(res.writer);
        } catch (err) {
            setError((err as Error).message);
            setCode('');
        } finally { setBusy(null); }
    };

    // Auto-submit once six digits are entered.
    useEffect(() => { if (code.length === 6 && busy === null) verify(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [code]);

    const savePhone = async () => {
        setBusy('phone'); setError('');
        try {
            const res = await api<{ writer: WriterMe }>('/writers/phone', { method: 'PATCH', body: { phoneCountry: phone.country, phoneNumber: phone.number } });
            onUpdate(res.writer);
            setEditingPhone(false); setSent(false); setCooldown(0); setCode('');
            setInfo('Number updated. Send a code to verify it.');
        } catch (err) { setError((err as Error).message); } finally { setBusy(null); }
    };

    return (
        <div>
            <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fea520]/15 text-[#b86e00]"><Icon className="h-6 w-6" /></span>
                <div className="min-w-0">
                    <h2 className="text-xl font-bold text-[#0b1b33] sm:text-2xl">{channel === 'email' ? 'Confirm your email' : 'Confirm your phone number'}</h2>
                    <p className="mt-1 text-slate-600">
                        {sent ? 'Enter the 6-digit code we sent to ' : 'We’ll send a 6-digit code to '}
                        <span className="break-all font-semibold text-[#0b1b33]">{channel === 'email' ? target : writer.phone.masked}</span>.
                    </p>
                </div>
            </div>

            <div className="mt-8 space-y-5">
                {error && <Notice tone="error">{error}</Notice>}
                {info && !error && <Notice tone="success">{info}</Notice>}

                {channel === 'phone' && editingPhone ? (
                    <div className="rounded-2xl border border-slate-200 p-5">
                        <PhoneField country={phone.country} number={phone.number} onChange={v => setPhone(v)} />
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button type="button" onClick={savePhone} disabled={busy !== null || phone.number.length < 4}
                                className="rounded-xl bg-[#002147] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                                {busy === 'phone' ? 'Saving…' : 'Save number'}
                            </button>
                            <button type="button" onClick={() => setEditingPhone(false)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                        </div>
                    </div>
                ) : !sent ? (
                    <button type="button" onClick={send} disabled={busy !== null}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#002147] px-6 py-3.5 font-semibold text-white transition hover:bg-[#0b2f5c] disabled:opacity-60">
                        {busy === 'send' ? <Spinner className="h-4 w-4" /> : <Icon className="h-4 w-4" />} Send code
                    </button>
                ) : (
                    <form onSubmit={verify} className="space-y-5">
                        <OtpInput value={code} onChange={setCode} disabled={busy === 'verify'} autoFocus />
                        <div className="flex flex-wrap items-center gap-3">
                            <button type="submit" disabled={code.length !== 6 || busy !== null}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#002147] px-6 py-3 font-semibold text-white transition hover:bg-[#0b2f5c] disabled:opacity-50">
                                {busy === 'verify' ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />} Verify
                            </button>
                            <button type="button" onClick={send} disabled={cooldown > 0 || busy !== null}
                                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold text-[#002147] hover:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-transparent">
                                <RotateCw className="h-4 w-4" /> {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">Codes expire after 10 minutes. {channel === 'email' ? 'Check your spam folder if it hasn’t arrived.' : 'International SMS can take a minute to arrive.'}</p>
                    </form>
                )}

                {channel === 'phone' && !editingPhone && (
                    <button type="button" onClick={() => { setEditingPhone(true); setError(''); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#002147]">
                        <Pencil className="h-3.5 w-3.5" /> Wrong number? Change it
                    </button>
                )}
            </div>
        </div>
    );
}
