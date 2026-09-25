// The admin panel passes a "token" down to every tab. With a cookie session
// there is no token in the page at all, so this placeholder is passed instead;
// the global fetch interceptor (main.tsx) strips it before any request is sent.
export const ADMIN_COOKIE_SESSION = 'cookie-session';

// Writers and customers have completely separate sessions (separate cookies on
// the server). These API areas belong to the writer portal and use the writer
// session; every other API uses the customer's. Keep in step with WRITER_AREA
// in server/middleware.js.
const WRITER_API = /\/api\/(writers|membership|assignments|notifications|order-workflow\/writer)(\/|\?|$)/;
export const isWriterApi = (url: string) => WRITER_API.test(url);
