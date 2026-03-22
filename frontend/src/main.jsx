import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react";
import './index.css'
import App from './App.jsx'

Sentry.init({
  dsn: "https://placeholder@sentry.io/456",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId="825946112933-2jkgj8mj9n7lkk2p9r48m8v9n5h9j9j9.apps.googleusercontent.com">
        <App />
      </GoogleOAuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
