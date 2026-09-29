import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, XCircle } from 'lucide-react';

// Site-wide replacements for window.alert / confirm / prompt: a centred,
// branded dialog instead of the browser's box at the top of the page.
// Call showAlert / showConfirm / showPrompt from anywhere; <DialogHost />
// (mounted once in App) renders them one at a time.

type Tone = 'info' | 'success' | 'error' | 'danger' | 'question';
type Options = { title?: string; confirmText?: string; cancelText?: string; tone?: Tone };
type Request =
    | { kind: 'alert'; message: string; opts: Options; resolve: (v: void) => void }
    | { kind: 'confirm'; message: string; opts: Options; resolve: (v: boolean) => void }
    | { kind: 'prompt'; message: string; opts: Options & { defaultValue?: string }; resolve: (v: string | null) => void };

const queue: Request[] = [];
let notify: (() => void) | null = null;
const push = (r: Request) => { queue.push(r); notify?.(); };

export const showAlert = (message: string, opts: Options = {}) =>
    new Promise<void>(resolve => push({ kind: 'alert', message, opts, resolve }));
export const showConfirm = (message: string, opts: Options = {}) =>
    new Promise<boolean>(resolve => push({ kind: 'confirm', message, opts, resolve }));
export const showPrompt = (message: string, defaultValue = '', opts: Options = {}) =>
    new Promise<string | null>(resolve => push({ kind: 'prompt', message, opts: { ...opts, defaultValue }, resolve }));

// Picks a tone from the wording when the caller didn't set one.
function toneOf(r: Request): Tone {
    if (r.opts.tone) return r.opts.tone;
    const m = r.message.toLowerCase();
    if (r.kind === 'confirm') return /delete|cannot be undone|remove|reset/.test(m) ? 'danger' : 'question';
    if (r.kind === 'prompt') return 'question';
    if (/fail|couldn|could not|can’t|can't|error|expired|invalid|please (login|sign in|enter|select|wait)/.test(m)) return 'error';
    if (/success|thank|approved|submitted|requested|attached|saved/.test(m)) return 'success';
    return 'info';
}

const TONES: Record<Tone, { icon: React.ElementType; ring: string; iconColor: string; title: string }> = {
    info: { icon: Info, ring: 'bg-[#eef3fb]', iconColor: 'text-[#1e3a5f]', title: 'Please note' },
    success: { icon: CheckCircle2, ring: 'bg-[#ecfaf1]', iconColor: 'text-[#16a34a]', title: 'Done' },
    error: { icon: XCircle, ring: 'bg-[#fdf0ef]', iconColor: 'text-[#dc2626]', title: 'Something needs attention' },
    danger: { icon: AlertTriangle, ring: 'bg-[#fdf0ef]', iconColor: 'text-[#dc2626]', title: 'Are you sure?' },
    question: { icon: HelpCircle, ring: 'bg-[#fff5e8]', iconColor: 'text-[#eb6200]', title: 'Please confirm' },
};

export function DialogHost() {
    const [current, setCurrent] = useState<Request | null>(null);
    const [value, setValue] = useState('');
    const confirmRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const open = useRef<Request | null>(null);

    useEffect(() => {
        const next = () => {
            if (open.current || !queue.length) return;
            const r = queue.shift()!;
            open.current = r;
            if (r.kind === 'prompt') setValue(r.opts.defaultValue || '');
            setCurrent(r);
        };
        notify = next;
        next();
        return () => { notify = null; };
    }, []);

    const close = (result: 'ok' | 'cancel') => {
        const r = current;
        if (!r) return;
        if (r.kind === 'alert') r.resolve();
        else if (r.kind === 'confirm') r.resolve(result === 'ok');
        else r.resolve(result === 'ok' ? value : null);
        open.current = null;
        setCurrent(null);
        // Show the next queued dialog after this one has closed.
        setTimeout(() => notify?.(), 180);
    };

    useEffect(() => {
        if (!current) return;
        const t = setTimeout(() => (current.kind === 'prompt' ? inputRef.current : confirmRef.current)?.focus(), 60);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); close(current.kind === 'alert' ? 'ok' : 'cancel'); }
        };
        document.addEventListener('keydown', onKey);
        return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
    });

    const tone = current ? toneOf(current) : 'info';
    const t = TONES[tone];
    const Icon = t.icon;
    const danger = tone === 'danger';

    return (
        <AnimatePresence>
            {current && (
                <motion.div
                    key="dialog"
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
                >
                    <div className="absolute inset-0 bg-[#000a1e]/45 backdrop-blur-[6px]" onClick={() => close(current.kind === 'alert' ? 'ok' : 'cancel')} />
                    <motion.div
                        role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"
                        className="relative w-full max-w-[420px] rounded-[28px] bg-white p-7 text-center shadow-[0_30px_80px_rgba(0,10,30,0.28)] ring-1 ring-black/5"
                        initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    >
                        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${t.ring}`}>
                            <Icon className={`h-7 w-7 ${t.iconColor}`} strokeWidth={2.2} />
                        </div>
                        <h2 id="app-dialog-title" className="text-[19px] font-bold tracking-tight text-[#1d1d1f]">
                            {current.opts.title || t.title}
                        </h2>
                        <p id="app-dialog-message" className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[#515154]">
                            {current.message}
                        </p>
                        <form
                            onSubmit={e => { e.preventDefault(); close('ok'); }}
                            className="mt-6"
                        >
                            {current.kind === 'prompt' && (
                                <input
                                    ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
                                    className="mb-5 w-full rounded-2xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-3 text-[15px] text-[#1d1d1f] outline-none transition focus:border-[#eb6200] focus:bg-white focus:ring-4 focus:ring-[#eb6200]/15"
                                />
                            )}
                            <div className={`flex gap-3 ${current.kind === 'alert' ? '' : 'flex-col-reverse sm:flex-row'}`}>
                                {current.kind !== 'alert' && (
                                    <button
                                        type="button" onClick={() => close('cancel')}
                                        className="flex-1 rounded-full bg-[#f5f5f7] px-5 py-3 text-[15px] font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed] active:scale-[0.98]"
                                    >
                                        {current.opts.cancelText || 'Cancel'}
                                    </button>
                                )}
                                <button
                                    ref={confirmRef} type="submit"
                                    className={`flex-1 rounded-full px-5 py-3 text-[15px] font-semibold text-white shadow-sm transition active:scale-[0.98] ${danger ? 'bg-[#dc2626] hover:bg-[#b91c1c]' : 'bg-[#000a1e] hover:bg-[#1e3a5f]'}`}
                                >
                                    {current.opts.confirmText || (current.kind === 'alert' ? 'OK' : danger ? 'Yes, continue' : 'Confirm')}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
