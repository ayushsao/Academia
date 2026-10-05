import React from 'react';
import { cn } from '../../lib/utils';

// Shown while a page's code loads: the wordmark over a thin sliding bar (same
// look as the first-load preloader in index.html). It fades in after 200 ms,
// so quick loads never flash it.
export function Preloader({ className }: { className?: string }) {
    return (
        <div role="status" aria-label="Loading" className={cn('am-route-loader flex min-h-[60vh] flex-col items-center justify-center gap-4', className)}>
            <p className="text-[22px] font-extrabold tracking-[-0.02em] text-[#000a1e]">Assignment<span className="text-[#eb6200]">Minds</span></p>
            <div className="h-[3px] w-[120px] overflow-hidden rounded-full bg-[#eef1f5]">
                <div className="am-route-bar h-full w-2/5 rounded-full bg-gradient-to-r from-[#fea520] to-[#eb6200]" />
            </div>
        </div>
    );
}
