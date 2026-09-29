import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

// Smooth, eased page scrolling on desktop (mouse wheel / trackpad) via Lenis.
// Touch devices keep the phone's native scrolling, and people who ask their
// system for reduced motion get normal scrolling too. Scrollable panels inside
// the page (order form, menus, dropdowns, drawers) scroll natively.

let lenis: Lenis | null = null;

/** Jumps to the top of the page at once, stopping any smooth scroll in progress. */
export function scrollToTopNow() {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

export function SmoothScroll() {
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        lenis = new Lenis({
            autoRaf: true,
            lerp: 0.1,
            smoothWheel: true,
            syncTouch: false,
            allowNestedScroll: true,
            stopInertiaOnNavigate: true,
        });
        // Screens that lock the page (overflow: hidden on <body>) pause smooth scrolling too.
        const syncLock = () => {
            const locked = getComputedStyle(document.body).overflow === 'hidden';
            if (locked) lenis?.stop(); else lenis?.start();
        };
        const observer = new MutationObserver(syncLock);
        observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
        return () => { observer.disconnect(); lenis?.destroy(); lenis = null; };
    }, []);
    return null;
}
