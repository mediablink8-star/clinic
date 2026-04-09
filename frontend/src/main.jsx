import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react";
import './index.css'
import App from './App.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

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
