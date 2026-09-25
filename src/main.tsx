import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useStore } from './store/useStore';

import { API } from './lib/api';
import { ADMIN_COOKIE_SESSION } from './lib/session';

// Global fetch interceptor for auth. Sessions are httpOnly cookies, so every API
// call is sent with credentials. A Bearer token is added only when the browser
// blocks the cookie and we fell back to an in-memory token (never stored).
const originalFetch = window.fetch;
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
    const memoryToken = useStore.getState().token;
    if (!cookieOnly && memoryToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${memoryToken}`);
    config.headers = headers;
    return originalFetch(resource, config);
  }
  return originalFetch.apply(this, args as any);
};

// On load: a token saved by an older version is moved out of localStorage (the
// store never persists it — see useStore) and kept in memory for this tab only.
// Then confirm the remembered customer still has a valid session cookie.
const legacyToken = useStore.getState().token;
if (legacyToken) useStore.setState({ token: legacyToken });   // rewrites storage without it
if (useStore.getState().user) {
  originalFetch(`${API}/auth/me`, { credentials: 'include' })
    .then(r => {
      if (r.ok) { if (useStore.getState().token) useStore.setState({ token: null }); }   // cookie works: no token needed
      else if (r.status === 401 && !useStore.getState().token) useStore.setState({ user: null, orders: [] });
    })
    .catch(() => { /* offline: keep the remembered profile */ });
}
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
