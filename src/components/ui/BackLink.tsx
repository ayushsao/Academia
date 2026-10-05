import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

// A "back" control: a quiet white pill with the arrow in its own circle, which
// fills navy and nudges left on hover. Give it `to` for a fixed destination,
// or `fallback` to go back in history (when there is one) and otherwise to
// `fallback`, so a page opened from a link never sends people off the site.
export function BackLink({ label, to, fallback, className }: {
    label: string; to?: string; fallback?: string; className?: string;
}) {
    const navigate = useNavigate();
    const { key } = useLocation();
    const classes = cn(
        'group inline-flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/90 py-1.5 pl-1.5 pr-4',
        'text-[13.5px] font-semibold tracking-[-0.01em] text-[#0b1b33] shadow-[0_1px_2px_rgba(15,23,42,0.06)] backdrop-blur',
        'transition-all duration-200 hover:border-slate-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eb6200]/40',
        className,
    );
    const inner = (
        <>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1f4f9] text-[#002147] transition-all duration-200 group-hover:-translate-x-0.5 group-hover:bg-[#002147] group-hover:text-white">
                <ArrowLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            </span>
            {label}
        </>
    );
    if (to) return <Link to={to} className={classes}>{inner}</Link>;
    // 'default' is the key of the first page loaded in this tab: there's nothing to go back to.
    const back = () => (key !== 'default' ? navigate(-1) : navigate(fallback || '/'));
    return <button type="button" onClick={back} className={classes}>{inner}</button>;
}
