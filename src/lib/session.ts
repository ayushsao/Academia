// The admin panel passes a "token" down to every tab. With a cookie session
// there is no token in the page at all, so this placeholder is passed instead;
// the global fetch interceptor (main.tsx) strips it before any request is sent.
export const ADMIN_COOKIE_SESSION = 'cookie-session';

// Writers and customers have separate accounts: each signs in to their own area.
type Account = { role?: string } | null | undefined;
export const isWriterAccount = (user: Account) => user?.role === 'WRITER';
export const accountHome = (user: Account) => (isWriterAccount(user) ? '/writer/dashboard' : '/dashboard');
