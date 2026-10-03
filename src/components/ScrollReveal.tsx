import React, { Suspense, useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
    children: React.ReactNode;
    delay?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
    /** Space to reserve before the section renders (keeps the page height stable). */
    minHeight?: number;
}

// Below-the-fold sections render when they come near the screen, so a phone
// doesn't build and run the whole long home page before it can respond.
// Everything renders at once when someone jumps to a section (mountAllSections),
// on the first touch, scroll or key press, or 8 seconds after load, so
// in-page links work and search engines see the full page.
// (Sections no longer animate in; `delay` / `direction` are accepted and ignored.)

const MOUNT_ALL = 'sections:mount-all';
let allMounted = false;

/** Renders every deferred section now (e.g. before scrolling to one of them). */
export function mountAllSections() {
    if (allMounted) return;
    allMounted = true;
    window.dispatchEvent(new Event(MOUNT_ALL));
}

if (typeof window !== 'undefined') {
    const early = () => mountAllSections();
    ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(e => window.addEventListener(e, early, { once: true, passive: true }));
    window.addEventListener('load', () => setTimeout(mountAllSections, 8000), { once: true });
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, minHeight = 480 }) => {
    const [show, setShow] = useState(allMounted);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (show) return;
        const reveal = () => setShow(true);
        window.addEventListener(MOUNT_ALL, reveal);
        let observer: IntersectionObserver | null = null;
        if (typeof IntersectionObserver === 'undefined') reveal();
        else if (ref.current) {
            observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) reveal(); }, { rootMargin: '800px 0px' });
            observer.observe(ref.current);
        }
        return () => { window.removeEventListener(MOUNT_ALL, reveal); observer?.disconnect(); };
    }, [show]);

    if (show) return <Suspense fallback={<div style={{ minHeight }} />}>{children}</Suspense>;
    return <div ref={ref} style={{ minHeight }} aria-hidden="true" />;
};
