import React from 'react';

interface ScrollRevealProps {
    children: React.ReactNode;
    delay?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
}

/**
 * Sections stay put while the page scrolls. (They used to start transparent and
 * 40px lower and slide in, which showed the page background as a band between
 * sections and made neighbouring sections overlap mid-scroll.)
 * `delay` / `direction` are accepted for compatibility and ignored.
 */
export const ScrollReveal: React.FC<ScrollRevealProps> = ({ children }) => <>{children}</>;
