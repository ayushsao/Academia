import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { isValidPhoneNumber, type CountryCode } from 'libphonenumber-js/min';
import { COUNTRIES } from '../../lib/writerOptions';
import { cn } from '../../lib/utils';

// `fk-input` lets index.css neutralise the browser's blue autofill background.
export const inputClass =
    'fk-input w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] leading-6 text-[#1d1d1f] placeholder:text-[#a1a1a6] outline-none transition-[border-color,box-shadow] duration-200 hover:border-[#b0b0b5] focus:border-[#002147]/60 focus:ring-4 focus:ring-[#002147]/[0.08] disabled:bg-[#f5f5f7] disabled:text-[#86868b]';

export function Field({ label, hint, error, required, children, className, htmlFor }: {
    label: string; hint?: React.ReactNode; error?: string; required?: boolean; children: React.ReactNode; className?: string; htmlFor?: string;
}) {
    return (
        <div className={className}>
            <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-medium tracking-[-0.01em] text-[#1d1d1f]">
                {label}{required && <span className="ml-0.5 text-[#86868b]" aria-hidden>*</span>}
            </label>
            {children}
            {error ? <p className="mt-2 text-[12px] font-medium leading-5 text-[#d70015]">{error}</p>
                : hint ? <p className="mt-2 text-[12px] leading-5 text-[#86868b]">{hint}</p> : null}
        </div>
    );
}

export function CountrySelect({ value, onChange, id, disabled, placeholder = 'Select country' }: {
    value: string; onChange: (code: string) => void; id?: string; disabled?: boolean; placeholder?: string;
}) {
    return (
        <select id={id} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={cn(inputClass, 'appearance-none pr-10 bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%2364748b%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_14px_center] bg-no-repeat')}>
            <option value="">{placeholder}</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
    );
}

// Country dial-code picker + national number with live formatting/validation.
export function PhoneField({ country, number, onChange, id, disabled }: {
    country: string; number: string; onChange: (v: { country: string; number: string }) => void; id?: string; disabled?: boolean;
}) {
    const dial = COUNTRIES.find(c => c.code === country)?.dialCode;
    const valid = number.length > 3 && country ? isValidPhoneNumber(number, country as CountryCode) : null;
    return (
        <div>
            <div className="flex gap-2">
                <select aria-label="Country dialling code" value={country} disabled={disabled}
                    onChange={e => onChange({ country: e.target.value, number })}
                    className={cn(inputClass, 'w-[7.5rem] shrink-0 px-3')}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.code} {c.dialCode}</option>)}
                </select>
                <div className="relative flex-1">
                    <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" disabled={disabled}
                        value={number}
                        onChange={e => onChange({ country, number: e.target.value.replace(/[^\d\s()-]/g, '').slice(0, 20) })}
                        placeholder="Phone number" className={cn(inputClass, 'pr-10')} />
                    {valid && <Check className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600" aria-label="Valid number" />}
                </div>
            </div>
            <p className={cn('mt-2 text-[12px] leading-5', valid === false ? 'font-medium text-[#d70015]' : 'text-[#86868b]')}>
                {valid === false ? `That doesn't look like a valid ${dial} number.` : 'We’ll send a code by SMS. Your number is never shown publicly.'}
            </p>
        </div>
    );
}

// Toggleable option chips, with an optional "add your own" input.
export function ChipGroup({ options, value, onChange, allowCustom, max, customPlaceholder = 'Add your own…', ariaLabel }: {
    options: string[]; value: string[]; onChange: (v: string[]) => void; allowCustom?: boolean; max?: number; customPlaceholder?: string; ariaLabel: string;
}) {
    const [custom, setCustom] = useState('');
    const lower = value.map(v => v.toLowerCase());
    const all = useMemo(() => [...options, ...value.filter(v => !options.some(o => o.toLowerCase() === v.toLowerCase()))], [options, value]);
    const atMax = max !== undefined && value.length >= max;

    const toggle = (opt: string) => {
        const idx = lower.indexOf(opt.toLowerCase());
        if (idx >= 0) onChange(value.filter((_, i) => i !== idx));
        else if (!atMax) onChange([...value, opt]);
    };
    const addCustom = () => {
        const v = custom.trim().replace(/\s+/g, ' ');
        if (v.length >= 2 && !lower.includes(v.toLowerCase()) && !atMax) onChange([...value, v]);
        setCustom('');
    };

    return (
        <div>
            <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
                {all.map(opt => {
                    const on = lower.includes(opt.toLowerCase());
                    return (
                        <button key={opt} type="button" aria-pressed={on} onClick={() => toggle(opt)} disabled={!on && atMax}
                            className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition',
                                on ? 'border-[#002147] bg-[#002147] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 disabled:opacity-40')}>
                            {on && <Check className="h-3.5 w-3.5" />}{opt}
                        </button>
                    );
                })}
            </div>
            {allowCustom && (
                <div className="mt-3 flex max-w-md gap-2">
                    <input value={custom} onChange={e => setCustom(e.target.value)} maxLength={40} disabled={atMax}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                        placeholder={atMax ? `Maximum of ${max} reached` : customPlaceholder} className={cn(inputClass, 'py-2.5')} />
                    <button type="button" onClick={addCustom} disabled={atMax || custom.trim().length < 2}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#002147] hover:bg-slate-50 disabled:opacity-40">
                        <Plus className="h-4 w-4" /> Add
                    </button>
                </div>
            )}
        </div>
    );
}

// Free-text tags with typeahead suggestions (Enter or comma to add).
export function TagInput({ value, onChange, suggestions = [], max = 20, placeholder, id }: {
    value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; max?: number; placeholder?: string; id?: string;
}) {
    const [draft, setDraft] = useState('');
    const listId = useId();
    const add = (raw: string) => {
        const v = raw.trim().replace(/\s+/g, ' ');
        if (v && value.length < max && !value.some(x => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
        setDraft('');
    };
    return (
        <div className={cn(inputClass, 'flex flex-wrap items-center gap-2 py-2 focus-within:border-[#002147] focus-within:ring-4 focus-within:ring-[#002147]/10')}>
            {value.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-lg bg-[#002147]/[0.06] px-2.5 py-1 text-sm font-medium text-[#002147]">
                    {tag}
                    <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter(t => t !== tag))} className="rounded p-0.5 hover:bg-[#002147]/10"><X className="h-3.5 w-3.5" /></button>
                </span>
            ))}
            <input id={id} list={listId} value={draft} maxLength={60}
                onChange={e => { const v = e.target.value; if (v.endsWith(',')) add(v.slice(0, -1)); else setDraft(v); }}
                onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); add(draft); }
                    if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
                }}
                onBlur={() => draft && add(draft)}
                placeholder={value.length >= max ? '' : placeholder} disabled={value.length >= max}
                className="min-w-[8rem] flex-1 border-0 bg-transparent py-1 text-[15px] outline-none" />
            <datalist id={listId}>{suggestions.filter(s => !value.includes(s)).map(s => <option key={s} value={s} />)}</datalist>
        </div>
    );
}

// Six single-digit boxes; supports paste and SMS autofill (one-time-code).
export function OtpInput({ value, onChange, disabled, autoFocus }: { value: string; onChange: (v: string) => void; disabled?: boolean; autoFocus?: boolean }) {
    const refs = useRef<(HTMLInputElement | null)[]>([]);
    useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);
    const digits = value.padEnd(6, ' ').slice(0, 6).split('');

    const setAt = (i: number, d: string) => {
        const next = digits.map((c, j) => (j === i ? d : c)).join('').replace(/\s+$/, '');
        onChange(next.replace(/ /g, ''));
    };
    return (
        <div className="flex justify-between gap-2 sm:justify-start" onPaste={e => {
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (pasted) { e.preventDefault(); onChange(pasted); refs.current[Math.min(pasted.length, 5)]?.focus(); }
        }}>
            {digits.map((d, i) => (
                <input key={i} ref={el => { refs.current[i] = el; }} value={d.trim()} disabled={disabled}
                    inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={i === 0 ? 6 : 1}
                    aria-label={`Digit ${i + 1}`}
                    onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (raw.length > 1) { onChange(raw.slice(0, 6)); refs.current[Math.min(raw.length, 5)]?.focus(); return; }
                        setAt(i, raw);
                        if (raw && i < 5) refs.current[i + 1]?.focus();
                    }}
                    onKeyDown={e => { if (e.key === 'Backspace' && !d.trim() && i > 0) refs.current[i - 1]?.focus(); }}
                    className="h-14 w-11 rounded-xl border border-slate-200 bg-white text-center text-2xl font-bold text-[#002147] outline-none transition focus:border-[#002147] focus:ring-4 focus:ring-[#002147]/10 sm:w-12" />
            ))}
        </div>
    );
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: React.ReactNode; className?: string }) {
    const tones = {
        info: 'bg-[#f0f6ff] text-[#0b3d7a]',
        error: 'bg-[#fff1f2] text-[#b3001b]',
        success: 'bg-[#effaf3] text-[#0a6b35]',
        warning: 'bg-[#fff8e6] text-[#7a4b00]',
    };
    return <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-2xl px-4 py-3 text-[14px] leading-5', tones[tone], className)}>{children}</div>;
}
