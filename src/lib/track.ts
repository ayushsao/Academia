// Conversion events for the Meta Pixel (both pixels initialised in index.html).
// fbq() queues calls until the pixel library loads, so these are safe to call
// at any time. Nothing personal (names, emails, phone numbers) is sent.

type PixelEvent = 'Contact' | 'Lead' | 'InitiateCheckout' | 'Purchase';
type Fbq = (...args: unknown[]) => void;

export function trackEvent(event: PixelEvent, params: Record<string, unknown> = {}, eventId?: string) {
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    if (typeof fbq !== 'function') return;
    try {
        // An event ID lets Meta drop duplicates (e.g. one purchase reported twice).
        if (eventId) fbq('track', event, params, { eventID: eventId });
        else fbq('track', event, params);
    } catch { /* tracking must never break the page */ }
}

// Every WhatsApp or phone link on the site counts as a "Contact", wherever it is.
let contactTracking = false;
export function installContactTracking() {
    if (contactTracking || typeof document === 'undefined') return;
    contactTracking = true;
    document.addEventListener('click', (e) => {
        const link = (e.target as Element | null)?.closest?.('a[href]');
        const href = link?.getAttribute('href') || '';
        if (/wa\.me\/|api\.whatsapp\.com/i.test(href)) trackEvent('Contact', { method: 'whatsapp' });
        else if (href.startsWith('tel:')) trackEvent('Contact', { method: 'phone' });
    }, { capture: true });
}
