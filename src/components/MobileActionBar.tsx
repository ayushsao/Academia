import React, { useEffect } from 'react';
import { MessageCircle, Calculator, ArrowRight } from 'lucide-react';

const WHATSAPP_URL = `https://wa.me/919263606941?text=${encodeURIComponent('Hi AssignmentMinds, I need help with an assignment.')}`;

// Phones: the three main actions stay at the bottom of the screen, so a
// visitor (often arriving from an ad) can act without scrolling. While it's
// shown, the page gets extra bottom space and the chat bubble sits above it
// (see .has-mobile-bar in index.css).
export function MobileActionBar({ onQuote, onOrder }: { onQuote: () => void; onOrder: () => void }) {
    useEffect(() => {
        document.body.classList.add('has-mobile-bar');
        return () => document.body.classList.remove('has-mobile-bar');
    }, []);

    return (
        <nav aria-label="Quick actions"
            className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-2 border-t border-gray-200 bg-white/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(0,10,30,0.08)] backdrop-blur md:hidden">
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer"
                className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold text-[#128C7E] active:bg-emerald-50">
                <MessageCircle className="h-5 w-5" aria-hidden="true" /> WhatsApp
            </a>
            <button type="button" onClick={onQuote}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold text-[#000a1e] active:bg-gray-100">
                <Calculator className="h-5 w-5" aria-hidden="true" /> Free Quote
            </button>
            <button type="button" onClick={onOrder}
                className="flex flex-[1.6] items-center justify-center gap-1.5 rounded-xl bg-[#eb6200] px-3 text-sm font-bold text-white shadow-sm active:bg-[#c2570c]">
                Order Now <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
        </nav>
    );
}
