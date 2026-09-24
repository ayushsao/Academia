import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../Navbar';

// The site Navbar expects modal handlers that only exist on the home page.
// Outside it, send visitors home and open the matching modal there.
export function MarketplaceNavbar({ activeSection = '' }: { activeSection?: string }) {
    const navigate = useNavigate();
    const goHomeAnd = (event?: string) => () => {
        navigate('/');
        if (event) setTimeout(() => window.dispatchEvent(new Event(event)), 300);
    };
    return (
        <Navbar
            activeSection={activeSection}
            onOpenOrder={goHomeAnd('open-order-modal')}
            onOpenSignIn={goHomeAnd()}
            onOpenDrawer={() => {}}
            onNavigate={() => navigate('/')}
        />
    );
}
