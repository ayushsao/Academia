// The admin panel passes a "token" down to every tab. With a cookie session
// there is no token in the page at all, so this placeholder is passed instead;
// the global fetch interceptor (main.tsx) strips it before any request is sent.
export const ADMIN_COOKIE_SESSION = 'cookie-session';
