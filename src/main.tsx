import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useStore } from './store/useStore';

import { API } from './lib/api';
import { ADMIN_COOKIE_SESSION, isWriterApi } from './lib/session';

// Global fetch interceptor for auth. Sessions are httpOnly cookies, so every API
// call is sent with credentials. A Bearer token is added only when the browser
// blocks the cookie and we fell back to an in-memory token (never stored) —
// the writer portal's token for writer APIs, the customer's for everything else.
const originalFetch = window.fetch;
const ADMIN_API = /\/api\/(admin|order-workflow\/admin)\//;
const ADMIN_SIGN_IN = /\/api\/admin\/login(\/|\?|$)/;
window.fetch = async function (...args) {
  let [resource, config] = args;
  if (typeof resource === 'string' && resource.includes('/api/')) {
    config = config || {};
    config.credentials = 'include';
    const headers = new Headers(config.headers);
    const cookieOnly = headers.has('X-No-Bearer');   // used to test whether the cookie works
    headers.delete('X-No-Bearer');
    // Admin panel on a cookie session: its placeholder "token" is not a credential.
    if (headers.get('Authorization') === `Bearer ${ADMIN_COOKIE_SESSION}`) headers.delete('Authorization');
    const { token, writerToken } = useStore.getState();
    const memoryToken = ADMIN_API.test(resource) ? null : isWriterApi(resource) ? writerToken : token;
    if (!cookieOnly && memoryToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${memoryToken}`);
    config.headers = headers;
    const res = await originalFetch(resource, config);
    // An expired or revoked admin session: send the console back to its sign-in
    // screen, whichever admin screen made the call. (Sign-in steps return 401 for
    // a wrong password or code, and session probes expect it, so they're skipped.)
    if (res.status === 401 && !cookieOnly && ADMIN_API.test(resource) && !ADMIN_SIGN_IN.test(resource))
      window.dispatchEvent(new Event('admin-unauthorized'));
    return res;
  }
  return originalFetch.apply(this, args as any);
};

// On load: a token saved by an older version is moved out of localStorage (the
// store never persists it — see useStore) and kept in memory for this tab only.
// A writer profile remembered as the customer account by an older version is
// dropped (writers now sign in to their own portal session).
// Then confirm each remembered session still has a valid session cookie.
const legacyToken = useStore.getState().token;
if (legacyToken) useStore.setState({ token: legacyToken });   // rewrites storage without it
if (useStore.getState().user?.role === 'WRITER') useStore.setState({ user: null, token: null, orders: [] });
const confirmSession = (path: string, hasToken: () => boolean, clear: () => void) =>
  originalFetch(`${API}${path}`, { credentials: 'include' })
    .then(r => { if (r.status === 401 && !hasToken()) clear(); })
    .catch(() => { /* offline: keep the remembered profile */ });
if (useStore.getState().user)
  confirmSession('/auth/me', () => Boolean(useStore.getState().token), () => useStore.setState({ user: null, orders: [] }));
if (useStore.getState().writer)
  confirmSession('/writers/me', () => Boolean(useStore.getState().writerToken), () => useStore.setState({ writer: null }));
localStorage.removeItem('ap_admin_token');   // admin sessions are cookie-based now

import { GoogleOAuthProvider } from '@react-oauth/google';

const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || 'placeholder_client_id';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
);
