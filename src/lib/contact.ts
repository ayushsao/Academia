// Contact details asked for by the price calculators. The price is shown once
// both are filled in, and the order form passes them on so we can reach the
// customer.

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
export const isValidPhone = (phone: string) => /^\d{6,15}$/.test(phone.replace(/[\s()+-]/g, ''));

/** The message to show under each field that isn't filled in correctly. */
export function checkContact(email: string, phone: string) {
    const errs: { email?: string; phone?: string } = {};
    if (!isValidEmail(email)) errs.email = email.trim() ? 'Enter a valid email address.' : 'Email is required.';
    if (!isValidPhone(phone)) errs.phone = phone.trim() ? 'Enter a valid phone number.' : 'Phone number is required.';
    return errs;
}
