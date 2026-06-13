/**
 * Stripe billing service.
 *
 * Wraps the Stripe SDK with helpers tailored to ClinicFlow:
 *  - getOrCreateCustomer (re-uses stripeCustomerId on the clinic)
 *  - createCheckoutSession (returns a Stripe-hosted Checkout URL)
 *  - createPortalSession (Stripe-hosted billing management)
 *  - cancelSubscription / resumeSubscription
 *  - mapStripeStatusToPlanStatus (trialing/active/past_due/cancelled/expired)
 *  - priceIdForPlan / planForPriceId (Stripe Price ↔ internal plan key)
 *  - verifyAndParseWebhook
 *
 * The Stripe SDK is loaded lazily so that development environments without
 * a STRIPE_SECRET_KEY can still start the rest of the backend.
 */

const logger = require('../utils/logger');
const AppError = require('../errors/AppError');

let _stripe = null;
function getStripe() {
    if (_stripe) return _stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new AppError(
            'BILLING_NOT_CONFIGURED',
            'Stripe is not configured on this server. Set STRIPE_SECRET_KEY.',
            503
        );
    }
    // Pin a recent API version for predictable behaviour
    const Stripe = require('stripe');
    _stripe = new Stripe(key, {
        apiVersion: '2024-12-18.acacia',
        typescript: false,
        appInfo: { name: 'ClinicFlow', version: '1.0.0' },
    });
    return _stripe;
}

function isStripeConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
}

const PRICE_IDS = {
    starter: () => process.env.STRIPE_PRICE_STARTER_MONTHLY,
    growth:  () => process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    scale:   () => process.env.STRIPE_PRICE_SCALE_MONTHLY,
};

function priceIdForPlan(planKey) {
    const getter = PRICE_IDS[planKey];
    if (!getter) throw new AppError('VALIDATION_ERROR', `Unknown plan: ${planKey}`, 400);
    const id = getter();
    if (!id) {
        throw new AppError(
            'BILLING_NOT_CONFIGURED',
            `Stripe price for plan "${planKey}" is not configured. Set STRIPE_PRICE_${planKey.toUpperCase()}_MONTHLY to a Stripe Price ID (looks like price_1ABC...).`,
            503
        );
    }
    if (typeof id !== 'string' || !id.startsWith('price_')) {
        throw new AppError(
            'BILLING_NOT_CONFIGURED',
            `STRIPE_PRICE_${planKey.toUpperCase()}_MONTHLY is set to "${id}" but it should be a Stripe Price ID (e.g. price_1ABC...). ` +
            `Set it in Render env: https://dashboard.stripe.com/test/products → click product → copy "API ID" (price_...). ` +
            `Do NOT paste the price amount (e.g. 35000 cents) — Stripe needs the Price object reference, not the number.`,
            503
        );
    }
    return id;
}

function planForPriceId(priceId) {
    if (!priceId) return null;
    for (const [plan, getter] of Object.entries(PRICE_IDS)) {
        if (getter() === priceId) return plan;
    }
    return null;
}

async function getOrCreateCustomer(clinic) {
    const stripe = getStripe();
    if (clinic.stripeCustomerId) {
        try {
            return await stripe.customers.retrieve(clinic.stripeCustomerId);
        } catch (err) {
            logger.warn('Stripe customer lookup failed, recreating', {
                clinicId: clinic.id,
                customerId: clinic.stripeCustomerId,
                err: err.message,
            });
        }
    }
    const customer = await stripe.customers.create({
        name: clinic.name,
        email: clinic.email || undefined,
        phone: clinic.phone || undefined,
        metadata: {
            clinicId: clinic.id,
            internalPlan: clinic.plan || 'trial',
        },
    });
    return customer;
}

async function createCheckoutSession({ clinic, plan, successUrl, cancelUrl }) {
    if (plan === 'trial' || plan === 'enterprise') {
        throw new AppError('VALIDATION_ERROR', 'Cannot checkout for trial or enterprise plans', 400);
    }
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(clinic);
    const priceId = priceIdForPlan(plan);

    let taxRates = [];
    try {
        const vatRate = await getOrCreateGreekVatRate();
        taxRates = [vatRate.id];
    } catch (err) {
        logger.error('[stripe] Failed to resolve Greek VAT tax rate, continuing without tax', { err: err.message });
    }

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        line_items: [{ price: priceId, quantity: 1, tax_rates: taxRates }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        automatic_tax: { enabled: false },
        subscription_data: {
            metadata: {
                clinicId: clinic.id,
                internalPlan: plan,
            },
        },
        metadata: {
            clinicId: clinic.id,
            internalPlan: plan,
        },
    });

    return { url: session.url, sessionId: session.id };
}

async function createPortalSession({ clinic, returnUrl }) {
    const stripe = getStripe();
    if (!clinic.stripeCustomerId) {
        throw new AppError('VALIDATION_ERROR', 'No Stripe customer for this clinic', 400);
    }
    const session = await stripe.billingPortal.sessions.create({
        customer: clinic.stripeCustomerId,
        return_url: returnUrl,
    });
    return { url: session.url };
}

async function cancelSubscription({ subscriptionId, atPeriodEnd = true }) {
    const stripe = getStripe();
    if (atPeriodEnd) {
        return await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    }
    return await stripe.subscriptions.cancel(subscriptionId);
}

async function resumeSubscription({ subscriptionId }) {
    const stripe = getStripe();
    return await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
}

function mapStripeStatusToPlanStatus(stripeStatus) {
    // stripeStatus: incomplete | incomplete_expired | trialing | active | past_due | canceled | unpaid | paused
    //
    // 'incomplete' means the FIRST payment attempt failed but Stripe is
    // still retrying (default 3 days). We treat it as past_due so the
    // customer gets the grace-period treatment instead of being locked
    // out immediately. They can update their card in the Customer Portal
    // and the next successful retry flips them to 'active'.
    // 'incomplete_expired' means the retry window closed without success
    // — that one IS truly expired.
    switch (stripeStatus) {
        case 'trialing':            return 'trialing';
        case 'active':              return 'active';
        case 'past_due':            return 'past_due';
        case 'canceled':            return 'cancelled';
        case 'incomplete':          return 'past_due';
        case 'incomplete_expired':  return 'expired';
        case 'unpaid':              return 'expired';
        case 'paused':              return 'past_due';
        default:                    return 'expired';
    }
}

function planKeyFromSubscription(subscription) {
    if (!subscription) return null;
    const item = subscription.items?.data?.[0];
    if (!item) return null;
    return planForPriceId(item.price?.id);
}

function subscriptionStateForClinic(subscription) {
    if (!subscription) {
        return { planStatus: 'expired', currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, cancelledAt: null };
    }
    return {
        planStatus: mapStripeStatusToPlanStatus(subscription.status),
        currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
        currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        cancelledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    };
}

async function verifyAndParseWebhook({ payload, signature }) {
    const stripe = getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        throw new AppError('BILLING_NOT_CONFIGURED', 'STRIPE_WEBHOOK_SECRET not set', 503);
    }
    return stripe.webhooks.constructEvent(payload, signature, secret);
}

async function getOrCreateGreekVatRate() {
    const stripe = getStripe();
    const cachedId = process.env.STRIPE_GREEK_VAT_TAX_RATE_ID;
    if (cachedId) {
        try {
            const existing = await stripe.taxRates.retrieve(cachedId);
            if (existing && existing.percentage === 24 && existing.country === 'GR' && existing.active) {
                return existing;
            }
            logger.warn('[stripe] Cached STRIPE_GREEK_VAT_TAX_RATE_ID does not match expected 24% GR rate, recreating', { cachedId });
        } catch (err) {
            logger.warn('[stripe] Cached STRIPE_GREEK_VAT_TAX_RATE_ID lookup failed, recreating', { err: err.message });
        }
    }

    const lookup = await stripe.taxRates.list({ limit: 100, active: true });
    const match = lookup.data.find(t => t.percentage === 24 && t.country === 'GR' && t.active);
    if (match) return match;

    const created = await stripe.taxRates.create({
        display_name: 'ΦΠΑ 24% (Ελλάδα)',
        description: 'Greek standard VAT rate (24%) for B2C medical SaaS subscriptions',
        percentage: 24,
        country: 'GR',
        tax_type: 'vat',
        inclusive: false,
        jurisdiction: { country: 'GR' },
        metadata: { clinicflow: 'true', country: 'GR' }
    });
    return created;
}

module.exports = {
    getStripe,
    isStripeConfigured,
    getOrCreateCustomer,
    createCheckoutSession,
    createPortalSession,
    cancelSubscription,
    resumeSubscription,
    mapStripeStatusToPlanStatus,
    planKeyFromSubscription,
    planForPriceId,
    priceIdForPlan,
    subscriptionStateForClinic,
    verifyAndParseWebhook,
    getOrCreateGreekVatRate,
};
