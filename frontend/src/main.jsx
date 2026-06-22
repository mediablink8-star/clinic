import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react";
import axios from 'axios';
import './index.css'
import App from './App.jsx'
import { createBeforeSend } from './lib/sentryConfig.js';

const sentryDsn = (import.meta.env.VITE_SENTRY_DSN || '').trim();

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: false,  // DISABLED — suspected cause of i.getTime crash in Web Worker
    environment: import.meta.env.MODE || 'development',
    release: `clinicflow-frontend@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Sentry.replayIntegration({  // DISABLED — causes i.getTime crash in Web Worker
      //   maskAllText: true,
      //   blockAllMedia: true,
      //   mask: ['input[type="password"]', '[data-sentry-mask]']
      // }),
    ],
    tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    beforeSend: createBeforeSend(),
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
  });
}

import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';

axios.defaults.withCredentials = true;

const rawGoogleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const hasGoogleClientId = /^[\w-]+\.apps\.googleusercontent\.com$/.test(rawGoogleClientId);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30000,
      cacheTime: 0,  // DISABLE CACHE — test if React Query cache causes .getTime crash
      structuralSharing: false,  // Disable structural sharing — prevents date serialization issues
    },
  },
  // Disable query persistence/broadcast
  queryCache: new QueryCache({
    onError: (error) => console.error('[QueryCache Error]', error),
  }),
});

// SAFETY NET: Override Date.prototype.getTime to never crash
// If .getTime() is called on a non-Date object, log the error and return NaN
const originalGetTime = Date.prototype.getTime;
Date.prototype.getTime = function() {
  if (!(this instanceof Date)) {
    console.error('[SAFETY] .getTime() called on non-Date:', typeof this, this, new Error().stack);
    return NaN;
  }
  try {
    return originalGetTime.call(this);
  } catch (e) {
    console.error('[SAFETY] .getTime() threw:', e);
    return NaN;
  }
};

// Global error handler — catches uncaught JS errors and shows visible error
window.onerror = function(message, source, lineno, colno, error) {
  console.error('[GLOBAL_ERROR]', message, '\nStack:', error?.stack || 'no stack');
  // Show visible error on screen
  const root = document.getElementById('root');
  if (root && !root.querySelector('.global-error-fallback')) {
    const div = document.createElement('div');
    div.className = 'global-error-fallback';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0f172a;color:#e2e8f0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;z-index:99999;font-family:system-ui,sans-serif;';
    div.innerHTML = `
      <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
      <h1 style="font-size:1.5rem;font-weight:800;margin-bottom:0.5rem">Σφάλμα εφαρμογής</h1>
      <p style="color:#94a3b8;max-width:400px;margin-bottom:1.5rem">${message}</p>
      <button onclick="window.location.reload()" style="padding:10px 24px;border-radius:8px;border:none;background:#635bff;color:white;font-weight:700;cursor:pointer;font-size:0.9rem">Επαναφόρτωση</button>
      ${error?.stack ? `<pre style="margin-top:2rem;color:#64748b;font-size:0.7rem;text-align:left;max-width:600px;overflow:auto;max-height:200px">${error.stack}</pre>` : ''}
    `;
    root.appendChild(div);
  }
  return false;
};

// Catch unhandled promise rejections too
window.addEventListener('unhandledrejection', function(event) {
  console.error('[UNHANDLED_REJECTION]', event.reason);
});

const appTree = hasGoogleClientId ? (
  <GoogleOAuthProvider clientId={rawGoogleClientId}>
    <App />
  </GoogleOAuthProvider>
) : (
  <App />
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {appTree}
    </QueryClientProvider>
  </StrictMode>,
)
