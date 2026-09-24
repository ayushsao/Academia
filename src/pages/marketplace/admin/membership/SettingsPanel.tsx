import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../../../lib/api';
import { currencyName } from '../../../../lib/money';
import { Spinner } from '../../../../components/writer/WriterBits';
import { inputClass } from '../../../../components/writer/FormKit';
import { cn } from '../../../../lib/utils';

type Settings = {
    currencies: { code: string; isActive: boolean }[];
    countryCurrency: Record<string, string>;
    defaultCurrency: string;
    manualPayment: { enabled: boolean; upiId: string; paypalUrl: string; bankDetails: string; instructions: string };
    reporting: { currency: string; ratesToReporting: Record<string, number> };
};

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-[#000a1e]">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-gray-500">{hint}</p>}
        <div className="mt-4">{children}</div>
    </section>
);

export default function SettingsPanel({ token }: { token: string }) {
    const [s, setS] = useState<Settings | null>(null);
    const [rates, setRates] = useState<Record<string, string>>({});
    const [razorpay, setRazorpay] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

    useEffect(() => {
        api<{ settings: Settings; razorpayEnabled: boolean }>('/admin/membership/settings', { token }).then(d => {
            setS(d.settings); setRazorpay(d.razorpayEnabled);
            setRates(Object.fromEntries(Object.entries(d.settings.reporting.ratesToReporting).map(([k, v]) => [k, String(v)])));
        }).catch(e => setMsg({ tone: 'err', text: e.message }));
    }, [token]);

    if (!s) return msg ? <p className="text-sm text-red-600">{msg.text}</p> : <div className="flex justify-center py-12"><Spinner className="h-7 w-7 text-[#fea520]" /></div>;
    const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS({ ...s, [k]: v }); setMsg(null); };
    const setManual = (patch: Partial<Settings['manualPayment']>) => set('manualPayment', { ...s.manualPayment, ...patch });

    const save = async () => {
        setBusy(true); setMsg(null);
        try {
            const ratesToReporting = Object.fromEntries(Object.entries(rates).filter(([c, v]) => v && c !== s.reporting.currency).map(([c, v]) => [c, Number(v)]));
            const d = await api<{ settings: Settings }>('/admin/membership/settings', { method: 'PUT', token, body: { ...s, reporting: { ...s.reporting, ratesToReporting } } });
            setS(d.settings); setMsg({ tone: 'ok', text: 'Settings saved.' });
        } catch (e) { setMsg({ tone: 'err', text: (e as Error).message }); } finally { setBusy(false); }
    };
    const addCurrency = () => {
        const code = newCode.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(code) || s.currencies.some(c => c.code === code)) return;
        set('currencies', [...s.currencies, { code, isActive: true }]); setNewCode('');
    };

    return (
        <div className="space-y-5">
            <Section title="Payment methods">
                <div className="space-y-4">
                    <p className="flex items-center gap-2 text-sm">
                        {razorpay ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-gray-400" />}
                        <span><strong>Online (Razorpay)</strong> — {razorpay ? 'enabled via server environment keys.' : 'not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET on the server to enable.'}</span>
                    </p>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input type="checkbox" checked={s.manualPayment.enabled} onChange={e => setManual({ enabled: e.target.checked })} className="h-4 w-4 accent-[#000a1e]" />
                        Manual payment (UPI / PayPal / bank transfer, verified by an admin)
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm font-semibold text-gray-700">UPI ID<input className={cn(inputClass, 'mt-1 py-2')} value={s.manualPayment.upiId} maxLength={80} onChange={e => setManual({ upiId: e.target.value })} /></label>
                        <label className="text-sm font-semibold text-gray-700">PayPal link (https)<input className={cn(inputClass, 'mt-1 py-2')} value={s.manualPayment.paypalUrl} maxLength={200} onChange={e => setManual({ paypalUrl: e.target.value })} placeholder="https://paypal.me/…" /></label>
                        <label className="text-sm font-semibold text-gray-700">Bank transfer details<textarea rows={3} className={cn(inputClass, 'mt-1 text-sm')} value={s.manualPayment.bankDetails} maxLength={600} onChange={e => setManual({ bankDetails: e.target.value })} /></label>
                        <label className="text-sm font-semibold text-gray-700">Extra instructions<textarea rows={3} className={cn(inputClass, 'mt-1 text-sm')} value={s.manualPayment.instructions} maxLength={600} onChange={e => setManual({ instructions: e.target.value })} /></label>
                    </div>
                </div>
            </Section>

            <Section title="Currencies" hint="Any ISO 4217 currency can be added. Writers only see currencies that are active and have a price on a plan.">
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {s.currencies.map((c, i) => (
                        <li key={c.code} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm">
                            <span><strong>{c.code}</strong> <span className="text-gray-500">{currencyName(c.code)}</span></span>
                            <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={c.isActive} onChange={e => set('currencies', s.currencies.map((x, j) => (j === i ? { ...x, isActive: e.target.checked } : x)))} className="h-4 w-4 accent-[#000a1e]" /> Active</label>
                        </li>
                    ))}
                </ul>
                <div className="mt-3 flex max-w-xs gap-2">
                    <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase().slice(0, 3))} placeholder="e.g. EUR" aria-label="New currency code" className={cn(inputClass, 'py-2 uppercase')} />
                    <button onClick={addCurrency} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 text-sm font-semibold"><Plus className="h-4 w-4" /> Add</button>
                </div>
                <label className="mt-4 block max-w-xs text-sm font-semibold text-gray-700">Default currency
                    <select className={cn(inputClass, 'mt-1 py-2')} value={s.defaultCurrency} onChange={e => set('defaultCurrency', e.target.value)}>
                        {s.currencies.filter(c => c.isActive).map(c => <option key={c.code}>{c.code}</option>)}
                    </select>
                </label>
            </Section>

            <Section title="Reporting" hint="Analytics always show exact per-currency figures. These rates only convert totals into one reporting currency; update them periodically.">
                <label className="block max-w-xs text-sm font-semibold text-gray-700">Reporting currency
                    <select className={cn(inputClass, 'mt-1 py-2')} value={s.reporting.currency} onChange={e => set('reporting', { ...s.reporting, currency: e.target.value })}>
                        {s.currencies.map(c => <option key={c.code}>{c.code}</option>)}
                    </select>
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {s.currencies.filter(c => c.code !== s.reporting.currency).map(c => (
                        <label key={c.code} className="flex items-center gap-2 text-sm">
                            <span className="w-24 text-gray-600">1 {c.code} =</span>
                            <input inputMode="decimal" value={rates[c.code] || ''} onChange={e => setRates(r => ({ ...r, [c.code]: e.target.value.replace(/[^\d.]/g, '') }))} className={cn(inputClass, 'py-1.5 tabular-nums')} aria-label={`Rate ${c.code} to ${s.reporting.currency}`} />
                            <span className="text-gray-500">{s.reporting.currency}</span>
                        </label>
                    ))}
                </div>
            </Section>

            <div className="flex items-center gap-3">
                <button onClick={save} disabled={busy} className="rounded-xl bg-[#000a1e] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save settings'}</button>
                {msg && <p className={cn('text-sm font-medium', msg.tone === 'ok' ? 'text-emerald-700' : 'text-red-600')}>{msg.text}</p>}
            </div>
        </div>
    );
}
