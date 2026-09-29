import React from 'react';
import { cn } from '../../lib/utils';

// The small line of text above a section heading. Deliberately understated:
// sentence case, no pill or background, a short rule in front, like an
// editorial kicker. `tone="light"` is for dark backgrounds.
export function Eyebrow({ children, tone = 'brand', className }: {
    children: React.ReactNode; tone?: 'brand' | 'light'; className?: string;
}) {
    return (
        <p className={cn(
            'inline-flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.01em]',
            tone === 'light' ? 'text-[#fdba74]' : 'text-[#c2570c]',
            className,
        )}>
            <span aria-hidden="true" className="h-px w-6 bg-current opacity-70" />
            {children}
        </p>
    );
}
