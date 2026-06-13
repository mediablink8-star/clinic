/**
 * Billing API client.
 *
 * Thin wrapper around `api` for Stripe-backed billing endpoints.
 * The shape mirrors the backend routes/billing.js response payloads.
 */
import api from './api';

export async function getBillingStatus() {
    const { data } = await api.get('/billing/status');
    return data;
}

export async function getBillingPlans() {
    const { data } = await api.get('/billing/plans');
    return data;
}

export async function startCheckout(planKey) {
    const { data } = await api.post('/billing/checkout', { plan: planKey });
    return data; // { url, sessionId }
}

export async function openBillingPortal() {
    const { data } = await api.post('/billing/portal');
    return data; // { url }
}

export async function cancelSubscription() {
    const { data } = await api.post('/billing/cancel');
    return data;
}

export async function resumeSubscription() {
    const { data } = await api.post('/billing/resume');
    return data;
}

export async function getInvoices() {
    const { data } = await api.get('/billing/invoices');
    return data; // { invoices: [...] }
}

export async function getSubscriptionEvents() {
    const { data } = await api.get('/billing/events');
    return data; // { events: [...] }
}
