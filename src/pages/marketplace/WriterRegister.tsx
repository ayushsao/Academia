import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, Globe2, BadgeCheck, ArrowRight } from 'lucide-react';
import { isValidPhoneNumber, type CountryCode } from 'libphonenumber-js/min';
import { MarketplaceNavbar as Navbar } from '../../components/writer/MarketplaceNavbar';
import { Footer } from '../../components/Footer';
import { useStore } from '../../store/useStore';
import { api } from '../../lib/api';
import { guessCountry } from '../../lib/writerOptions';
import { CountrySelect, Field, Notice, PhoneField, inputClass } from '../../components/writer/FormKit';
import { Spinner } from '../../components/writer/WriterBits';
import { cn } from '../../lib/utils';

type Errors = Partial<Record<'name' | 'email' | 'password' | 'confirm' | 'country' | 'city' | 'phone' | 'terms', string>>;

function passwordScore(pw: string) {
    let s = 0;
    if (pw.length >= 12) s++;
    if (pw.length >= 16) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(4, s);
}

const STRENGTH = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['', 'bg-[#ff3b30]', 'bg-[#ff9f0a]', 'bg-[#34c759]', 'bg-[#34c759]'];

const PERKS = [
    { icon: Globe2, title: 'Open worldwide', text: 'Writers from every country are welcome, with international phone verification.' },
    { icon: ShieldCheck, title: 'Private by default', text: 'Your email and phone are never shown to clients or other writers.' },
    { icon: BadgeCheck, title: 'Reviewed by people', text: 'An HR specialist reviews every application personally.' },
];

const sectionTitle = 'text-[17px] font-semibold tracking-[-0.01em] text-[#1d1d1f]';

export default function WriterRegister() {
    const navigate = useNavigate();
    const login = useStore(s => s.login);
    const defaultCountry = guessCountry();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', country: defaultCountry as string, city: '' });
    const [phone, setPhone] = useState({ country: defaultCountry as string, number: '' });
    const [showPw, setShowPw] = useState(false);
    const [terms, setTerms] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [serverError, setServerError] = useState('');
    const [loading, setLoading] = useState(false);

    const set = (key: keyof typeof form, value: string) => {
        setForm(f => ({ ...f, [key]: value }));
        // Keep the phone country in step with the residence country until the user picks one explicitly.
        if (key === 'country' && value && !phone.number) setPhone(p => ({ ...p, country: value }));
        setErrors(e => ({ ...e, [key]: undefined }));
    };

    const validate = (): Errors => {
        const e: Errors = {};
        if (!/^[\p{L}\p{M}' .-]{2,80}$/u.test(form.name.trim())) e.name = 'Enter your full name (letters, spaces, apostrophes and hyphens).';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
        if (form.password.length < 12) e.password = 'Use at least 12 characters.';
        if (form.confirm !== form.password) e.confirm = 'Passwords don’t match.';
        if (!form.country) e.country = 'Select your country.';
        if (form.city.trim().length < 2) e.city = 'Enter your city.';
        if (!phone.number || !isValidPhoneNumber(phone.number, phone.country as CountryCode)) e.phone = 'Enter a valid mobile number for SMS verification.';
        if (!terms) e.terms = 'You need to accept the writer terms to continue.';
        return e;
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validate();
        setErrors(errs);
        if (Object.keys(errs).length) return;
        setLoading(true); setServerError('');
        try {
            const data = await api<{ token: string; user: { id: string; name: string; email: string; role: string }; emailCode: { sent: boolean } }>('/writers/register', {
                method: 'POST',
                body: {
                    name: form.name.trim(), email: form.email.trim(), password: form.password,
                    phoneCountry: phone.country, phoneNumber: phone.number, country: form.country, city: form.city.trim(), acceptTerms: true,
                },
            });
            login(data.user.email, data.user.name, data.token, data.user.id, data.user.role);
            navigate('/writer/onboarding', { replace: true, state: { emailCodeSent: data.emailCode.sent } });
        } catch (err) {
            setServerError((err as Error).message);
        } finally { setLoading(false); }
    };

    const score = passwordScore(form.password);

    return (
        <div className="flex min-h-screen flex-col bg-[#f5f5f7] font-sans antialiased">
            <Navbar />
            <main className="flex-grow px-4 pb-24 pt-10 sm:px-6 lg:pt-14">
                {/* Page heading */}
                <header className="mx-auto mb-8 max-w-2xl text-center sm:mb-12">
                    <p className="text-[13px] font-medium text-[#86868b]">Step 1 of 6</p>
                    <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f] sm:text-[44px]">Create your writer account</h1>
                    <p className="mx-auto mt-4 max-w-xl text-[17px] leading-7 text-[#6e6e73]">About 15 minutes from start to finish. Your progress is saved, so you can pick up where you left off.</p>
                </header>

                <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_28px_64px_-28px_rgba(0,0,0,0.14)] ring-1 ring-black/[0.04] lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
                    {/* Side panel */}
                    <aside className="flex flex-col justify-between gap-10 bg-gradient-to-b from-[#0b2a52] to-[#001733] p-8 text-white sm:p-10 lg:p-12">
                        <ul className="space-y-8">
                            {PERKS.map(item => (
                                <li key={item.title} className="flex gap-4">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] ring-1 ring-inset ring-white/10">
                                        <item.icon className="h-[18px] w-[18px] text-[#fea520]" />
                                    </span>
                                    <span className="pt-0.5">
                                        <span className="block text-[15px] font-medium tracking-[-0.01em]">{item.title}</span>
                                        <span className="mt-1 block text-[14px] leading-6 text-white/60">{item.text}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="text-[14px] text-white/60">Already applied? <Link to="/writer/login" className="font-medium text-white underline-offset-4 hover:underline">Sign in</Link></p>
                    </aside>

                    {/* Form */}
                    <form onSubmit={submit} noValidate className="p-6 sm:p-10 lg:p-12">
                        {serverError && <Notice tone="error" className="mb-8">{serverError}</Notice>}

                        <section aria-labelledby="sec-details">
                            <h2 id="sec-details" className={sectionTitle}>Your details</h2>
                            <div className="mt-6 grid gap-x-5 gap-y-6 sm:grid-cols-2">
                                <Field label="Full name" required error={errors.name} htmlFor="r-name" className="sm:col-span-2">
                                    <input id="r-name" autoComplete="name" className={inputClass} value={form.name} maxLength={80} onChange={e => set('name', e.target.value)} />
                                </Field>
                                <Field label="Email" required error={errors.email} htmlFor="r-email" className="sm:col-span-2">
                                    <input id="r-email" type="email" autoComplete="email" className={inputClass} value={form.email} maxLength={254} onChange={e => set('email', e.target.value)} />
                                </Field>
                                <Field label="Country of residence" required error={errors.country} htmlFor="r-country">
                                    <CountrySelect id="r-country" value={form.country} onChange={v => set('country', v)} />
                                </Field>
                                <Field label="City" required error={errors.city} htmlFor="r-city">
                                    <input id="r-city" autoComplete="address-level2" className={inputClass} value={form.city} maxLength={80} onChange={e => set('city', e.target.value)} />
                                </Field>
                                <Field label="Mobile number" required error={errors.phone} htmlFor="r-phone" className="sm:col-span-2">
                                    <PhoneField id="r-phone" country={phone.country} number={phone.number} onChange={v => { setPhone(v); setErrors(e => ({ ...e, phone: undefined })); }} />
                                </Field>
                            </div>
                        </section>

                        <section aria-labelledby="sec-password" className="mt-10 border-t border-black/[0.06] pt-10">
                            <h2 id="sec-password" className={sectionTitle}>Choose a password</h2>
                            <div className="mt-6 grid gap-x-5 gap-y-6 sm:grid-cols-2">
                                <Field label="Password" required error={errors.password} htmlFor="r-pw">
                                    <div className="relative">
                                        <input id="r-pw" type={showPw ? 'text' : 'password'} autoComplete="new-password" className={cn(inputClass, 'pr-12')} value={form.password} maxLength={128} onChange={e => set('password', e.target.value)} />
                                        <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#86868b] transition-colors hover:text-[#1d1d1f]">
                                            {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                                        </button>
                                    </div>
                                </Field>
                                <Field label="Confirm password" required error={errors.confirm} htmlFor="r-confirm">
                                    <input id="r-confirm" type={showPw ? 'text' : 'password'} autoComplete="new-password" className={inputClass} value={form.confirm} maxLength={128} onChange={e => set('confirm', e.target.value)} />
                                </Field>
                            </div>
                            <div className="mt-4 flex items-center gap-4">
                                <div className="flex flex-1 gap-1.5" aria-hidden>
                                    {[1, 2, 3, 4].map(i => (
                                        <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', form.password && i <= score ? STRENGTH_COLOR[score] : 'bg-black/[0.06]')} />
                                    ))}
                                </div>
                                <span className="shrink-0 text-[12px] text-[#86868b]" aria-live="polite">
                                    {form.password ? `${STRENGTH[form.password.length < 12 ? 0 : score]} · 12+ characters` : 'Use 12 or more characters'}
                                </span>
                            </div>
                        </section>

                        <div className="mt-10 border-t border-black/[0.06] pt-8">
                            <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-5 text-[#6e6e73]">
                                <input type="checkbox" checked={terms} onChange={e => { setTerms(e.target.checked); setErrors(er => ({ ...er, terms: undefined })); }} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#002147]" />
                                <span>I agree to the <Link to="/writer-terms" target="_blank" className="font-semibold text-[#002147] underline">writer terms</Link> and confirm I’ll only provide original work and genuine credentials.</span>
                            </label>
                            {errors.terms && <p className="mt-2 pl-[30px] text-[12px] font-medium text-[#d70015]">{errors.terms}</p>}

                            <button type="submit" disabled={loading}
                                className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#002147] px-6 text-[15px] font-medium tracking-[-0.01em] text-white transition-[background-color,transform] duration-200 hover:bg-[#0b2f5c] active:scale-[0.99] disabled:opacity-60">
                                {loading ? <Spinner className="h-4 w-4" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                            </button>
                            <p className="mt-4 text-center text-[12px] text-[#86868b]">Next, we’ll email you a 6-digit code to verify your address.</p>
                        </div>
                    </form>
                </div>
            </main>
            <Footer />
        </div>
    );
}
