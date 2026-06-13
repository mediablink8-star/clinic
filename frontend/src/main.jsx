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
    enabled: true,
    environment: import.meta.env.MODE || 'development',
    release: `clinicflow-frontend@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        mask: ['input[type="password"]', '[data-sentry-mask]']
      }),
    ],
    tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    beforeSend: createBeforeSend(),
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
  });
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';

axios.defaults.withCredentials = true;

const rawGoogleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const hasGoogleClientId = /^[\w-]+\.apps\.googleusercontent\.com$/.test(rawGoogleClientId);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
    },
  },
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
