import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useStore } from './store/useStore';

// Global fetch interceptor for auth
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  let [resource, config] = args;
  if (typeof resource === 'string' && resource.includes('/api/')) {
    config = config || {};
    config.credentials = 'include'; // Always send cookies cross-origin

    // Also attach Bearer token from Zustand if present (double-layered auth),
    // unless the caller already set one (e.g. the admin panel's admin token).
    const storeState = useStore.getState();
    const headers = new Headers(config.headers);
    if (storeState.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${storeState.token}`);
    }
    config.headers = headers;
    return originalFetch(resource, config);
  }
  return originalFetch.apply(this, args as any);
};

import { GoogleOAuthProvider } from '@react-oauth/google';

const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || 'placeholder_client_id';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
);
