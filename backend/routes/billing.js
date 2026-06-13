/**
 * Billing routes — Stripe Checkout, Customer Portal, status, and webhook.
 *
 * Mounted at /api/billing. Webhook is mounted at the same prefix but does NOT
 * use requireAuth (Stripe signs the payload and we verify it directly).
 *
 * Plan on the clinic model is updated by the webhook so the source of truth
 * is Stripe — never trust a frontend claim that "I just paid".
 */

const express = require('express');
const router = express.Router();

const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/requireAuth');
const prisma = require('../services/prisma');
const AppError = require('../errors/AppError');
const logger = require('../utils/logger');
const { logAction } = require('../services/auditService');
const {
    isStripeConfigured,
    createCheckoutSession,
    createPortalSession,
    cancelSubscription,
    resumeSubscription,
    subscriptionStateForClinic,
    planKeyFromSubscription,
    verifyAndParseWebhook,
    getStripe,
} = require('../services/stripeService');
const { getBillingState, attachBilling, computeGracePeriodEnd } = require('../middleware/planGate');
const { PLANS, getPlanLimits } = require('../services/planService');

const requireOwner = (req, _res, next) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        return next(new AppError('FORBIDDEN', 'Owner role required.', 403));
    }
    next();
};

// All routes below (except webhook) require auth; webhook is verified by Stripe signature.
const authed = express.Router();
authed.use(requireAuth, attachBilling);
authed.use(requireOwner);

// ---- Public-ish (still behind auth): list plans with their Stripe price IDs ----
authed.get('/plans', asyncHandler(async (req, res) => {
    const currentPlan = req.clinic.plan || 'trial';
    res.json({
        currentPlan,
        billing: getBillingState(req.clinic),
        plans: Object.values(PLANS).map(p => ({
            key: p.key,
            name: p.name,
            nameEl: p.nameEl,
            price: p.price,
            priceNote: p.priceNote,
            smsMonthlyLimit: p.smsMonthlyLimit,
            dailyMessageCap: p.dailyMessageCap,
            aiMonthlyLimit: p.aiMonthlyLimit,
            doctorRange: p.doctorRange,
            features: p.features,
            checkoutable: ['starter', 'growth', 'scale'].includes(p.key),
        })),
    });
}));

// ---- Current billing status for the authenticated clinic ----
authed.get('/status', asyncHandler(async (req, res) => {
    const billing = getBillingState(req.clinic);
    const limits = getPlanLimits(req.clinic.plan);
    res.json({
        ...billing,
        planDetails: PLANS[req.clinic.plan] || PLANS.trial,
        limits,
        stripe: {
            customerId: req.clinic.stripeCustomerId || null,
            subscriptionId: req.clinic.stripeSubscriptionId || null,
            cancelAtPeriodEnd: req.clinic.cancelAtPeriodEnd || false,
            currentPeriodEnd: req.clinic.currentPeriodEnd || null,
            trialEndsAt: req.clinic.trialEndsAt || null,
        },
    });
}));

// ---- Invoice history ----
authed.get('/invoices', asyncHandler(async (req, res) => {
    const invoices = await prisma.invoice.findMany({
        where: { clinicId: req.clinicId },
        orderBy: { createdAt: 'desc' },
        take: 24,
    });
    res.json({ invoices });
}));

// ---- Subscription event history (audit trail) ----
authed.get('/events', asyncHandler(async (req, res) => {
    const events = await prisma.subscriptionEvent.findMany({
        where: { clinicId: req.clinicId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json({ events });
}));

// ---- Start a Stripe Checkout session for a plan ----
authed.post('/checkout', asyncHandler(async (req, res) => {
    if (!isStripeConfigured()) {
        throw new AppError('BILLING_NOT_CONFIGURED', 'Stripe is not configured on this server.', 503);
    }
    const { plan } = req.body || {};
    if (!['starter', 'growth', 'scale'].includes(plan)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid plan. Choose starter, growth, or scale.', 400);
    }

    const frontendUrl = process.env.FRONTEND_URL || require('../lib/config').FRONTEND_URL;
    const result = await createCheckoutSession({
        clinic: req.clinic,
        plan,
        successUrl: `${frontendUrl}/billing?status=success&plan=${plan}`,
        cancelUrl: `${frontendUrl}/billing?status=cancelled`,
    });

    await prisma.subscriptionEvent.create({
        data: {
            clinicId: req.clinicId,
            type: 'checkout.started',
            toPlan: plan,
            metadata: { sessionId: result.sessionId },
        },
    });

    res.json({ url: result.url, sessionId: result.sessionId });
}));

// ---- Open Stripe Customer Portal ----
authed.post('/portal', asyncHandler(async (req, res) => {
    if (!isStripeConfigured()) {
        throw new AppError('BILLING_NOT_CONFIGURED', 'Stripe is not configured on this server.', 503);
    }
    if (!req.clinic.stripeCustomerId) {
        throw new AppError('VALIDATION_ERROR', 'No active subscription to manage.', 400);
    }
    const frontendUrl = process.env.FRONTEND_URL || require('../lib/config').FRONTEND_URL;
    const { url } = await createPortalSession({
        clinic: req.clinic,
        returnUrl: `${frontendUrl}/billing`,
    });
    res.json({ url });
}));

// ---- Cancel at end of current billing period ----
authed.post('/cancel', asyncHandler(async (req, res) => {
    if (!isStripeConfigured()) {
        throw new AppError('BILLING_NOT_CONFIGURED', 'Stripe is not configured on this server.', 503);
    }
    if (!req.clinic.stripeSubscriptionId) {
        throw new AppError('VALIDATION_ERROR', 'No active subscription to cancel.', 400);
    }
    const sub = await cancelSubscription({ subscriptionId: req.clinic.stripeSubscriptionId, atPeriodEnd: true });
    const state = subscriptionStateForClinic(sub);

    await prisma.$transaction([
        prisma.clinic.update({
            where: { id: req.clinicId },
            data: { cancelAtPeriodEnd: true },
        }),
        prisma.subscriptionEvent.create({
            data: {
                clinicId: req.clinicId,
                type: 'subscription.cancel_scheduled',
                fromPlan: req.clinic.plan,
                metadata: { subscriptionId: sub.id, currentPeriodEnd: state.currentPeriodEnd },
            },
        }),
    ]);

    logAction({
        clinicId: req.clinicId,
        userId: req.user.userId,
        action: 'BILLING_CANCEL_SCHEDULED',
        entity: 'CLINIC',
        entityId: req.clinicId,
        ipAddress: req.ip,
    }).catch(err => logger.warn('audit log failed', { err: err.message }));

    res.json({ success: true, cancelAtPeriodEnd: true, currentPeriodEnd: state.currentPeriodEnd });
}));

// ---- Resume a cancelled-at-period-end subscription ----
authed.post('/resume', asyncHandler(async (req, res) => {
    if (!isStripeConfigured()) {
        throw new AppError('BILLING_NOT_CONFIGURED', 'Stripe is not configured on this server.', 503);
    }
    if (!req.clinic.stripeSubscriptionId) {
        throw new AppError('VALIDATION_ERROR', 'No subscription to resume.', 400);
    }
    const sub = await resumeSubscription({ subscriptionId: req.clinic.stripeSubscriptionId });

    await prisma.$transaction([
        prisma.clinic.update({
            where: { id: req.clinicId },
            data: { cancelAtPeriodEnd: false },
        }),
        prisma.subscriptionEvent.create({
            data: {
                clinicId: req.clinicId,
                type: 'subscription.resumed',
                fromPlan: req.clinic.plan,
                metadata: { subscriptionId: sub.id },
            },
        }),
    ]);

    res.json({ success: true, cancelAtPeriodEnd: false });
}));

// Mount the authed router under /api/billing
router.use('/', authed);

// =====================================================================
// Webhook — must use the raw body for HMAC signature verification.
//
// IMPORTANT: the global `express.json()` middleware (mounted in index.js
// before this router) consumes the body stream. The route-level
// `express.raw({ type: 'application/json' })` we used to have here was
// a no-op because the body was already parsed. We use `req.rawBody`
// (set by the global parser's `verify` callback) instead — that's the
// untouched request body that Stripe's signature is computed over.
// =====================================================================

router.post('/webhook', asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
        logger.warn('Stripe webhook missing signature');
        return res.status(400).send('Missing signature');
    }
    // req.rawBody is the raw, unparsed body as a string — set by the
    // global `express.json({ verify: ... })` middleware before parsing.
    const rawPayload = req.rawBody;
    if (!rawPayload) {
        logger.error('Stripe webhook received but req.rawBody is empty — global JSON parser verify callback missing?');
        return res.status(500).send('Server misconfigured: no raw body');
    }
    let event;
    try {
        event = verifyAndParseWebhook({ payload: rawPayload, signature });
    } catch (err) {
        logger.warn('Stripe webhook signature verification failed', { err: err.message });
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Process the event BEFORE responding — if the handler fails we return a
    // 500 so Stripe will retry.  Sending 200 before processing (the "fire and
    // forget" pattern) means a failed DB write would never be retried.
    try {
        await handleStripeEvent(event);
    } catch (err) {
        logger.error('Stripe webhook handler failed', { eventId: event.id, type: event.type, err: err.message });
        return res.status(500).json({ error: 'Webhook handler failed' });
    }

    res.status(200).json({ received: true });
}));

async function handleStripeEvent(event) {
    const obj = event.data?.object;
    if (!obj) return;

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = obj;
            const clinicId = session.metadata?.clinicId;
            if (!clinicId) return;
            const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
            const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

            // Use transaction to ensure clinic update + event recording are atomic
            await prisma.$transaction(async (tx) => {
                await tx.clinic.update({
                    where: { id: clinicId },
                    data: { stripeCustomerId, stripeSubscriptionId },
                });
                await tx.subscriptionEvent.upsert({
                    where: { stripeEventId: event.id },
                    update: {},
                    create: {
                        clinicId,
                        type: 'checkout.completed',
                        stripeEventId: event.id,
                        toPlan: session.metadata?.internalPlan || null,
                        metadata: { sessionId: session.id },
                    },
                });
            });

            // If a subscription is attached, fetch it for full state
            if (stripeSubscriptionId) {
                const sub = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
                await applySubscriptionState(clinicId, sub, event.id);
            }
            break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const sub = obj;
            const clinicId = sub.metadata?.clinicId;
            if (!clinicId) {
                logger.warn('Stripe subscription event without clinicId metadata', { eventId: event.id, type: event.type });
                return;
            }
            await applySubscriptionState(clinicId, sub, event.id);
            break;
        }
        case 'invoice.paid': {
            const invoice = obj;
            const clinicId = invoice.subscription_details?.metadata?.clinicId
                || (await findClinicIdBySubscription(invoice.subscription));
            if (!clinicId) return;

            // Transaction: invoice + event recording are atomic
            await prisma.$transaction(async (tx) => {
                await upsertInvoice(clinicId, invoice, tx);
                await tx.subscriptionEvent.upsert({
                    where: { stripeEventId: event.id },
                    update: {},
                    create: {
                        clinicId,
                        type: 'invoice.paid',
                        stripeEventId: event.id,
                        amount: invoice.amount_paid,
                        currency: invoice.currency,
                    },
                });
            });
            break;
        }
        case 'invoice.payment_failed': {
            const invoice = obj;
            const clinicId = invoice.subscription_details?.metadata?.clinicId
                || (await findClinicIdBySubscription(invoice.subscription));
            if (!clinicId) return;

            // Transaction: clinic update + invoice + event are atomic
            await prisma.$transaction(async (tx) => {
                await tx.clinic.update({
                    where: { id: clinicId },
                    data: {
                        planStatus: 'past_due',
                        gracePeriodEndsAt: computeGracePeriodEnd(),
                    },
                });
                await upsertInvoice(clinicId, invoice, tx);
                await tx.subscriptionEvent.upsert({
                    where: { stripeEventId: event.id },
                    update: {},
                    create: {
                        clinicId,
                        type: 'invoice.payment_failed',
                        stripeEventId: event.id,
                        amount: invoice.amount_due,
                        currency: invoice.currency,
                    },
                });
            });
            break;
        }
        case 'customer.subscription.trial_will_end': {
            const sub = obj;
            const clinicId = sub.metadata?.clinicId;
            if (!clinicId) return;
            await prisma.subscriptionEvent.upsert({
                where: { stripeEventId: event.id },
                update: {},
                create: {
                    clinicId,
                    type: 'trial.will_end',
                    stripeEventId: event.id,
                    toPlan: planKeyFromSubscription(sub),
                },
            });
            break;
        }
        default:
            logger.info('Stripe webhook event ignored', { type: event.type, eventId: event.id });
    }
}

async function applySubscriptionState(clinicId, sub, eventId) {
    const state = subscriptionStateForClinic(sub);
    const planKey = planKeyFromSubscription(sub) || 'starter';
    const newLimits = getPlanLimits(planKey);

    const previous = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { plan: true, planStatus: true, trialEndsAt: true },
    });

    await prisma.clinic.update({
        where: { id: clinicId },
        data: {
            stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
            stripeSubscriptionId: sub.id,
            plan: planKey,
            planStatus: state.planStatus,
            trialEndsAt: state.trialEnd || state.currentPeriodEnd,
            currentPeriodStart: state.currentPeriodStart,
            currentPeriodEnd: state.currentPeriodEnd,
            cancelAtPeriodEnd: state.cancelAtPeriodEnd,
            cancelledAt: state.cancelledAt,
            gracePeriodEndsAt: state.planStatus === 'past_due' ? computeGracePeriodEnd() : null,
            // Propagate plan limits onto the clinic row
            smsMonthlyLimit: newLimits.smsMonthlyLimit,
            aiMonthlyLimit: newLimits.aiMonthlyLimit,
            dailyMessageCap: newLimits.dailyMessageCap,
        },
    });

    await prisma.subscriptionEvent.upsert({
        where: { stripeEventId: eventId },
        update: {},
        create: {
            clinicId,
            type: sub.status === 'canceled' ? 'subscription.deleted' : (previous?.planStatus !== state.planStatus ? 'subscription.updated' : 'subscription.created'),
            stripeEventId: eventId,
            fromPlan: previous?.plan || null,
            toPlan: planKey,
        },
    });
}

async function upsertInvoice(clinicId, invoice, tx = prisma) {
    await tx.invoice.upsert({
        where: { stripeInvoiceId: invoice.id },
        update: {
            number: invoice.number,
            amountPaid: invoice.amount_paid,
            amountDue: invoice.amount_due,
            currency: invoice.currency,
            status: invoice.status,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            invoicePdf: invoice.invoice_pdf,
            periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
            periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
            paidAt: invoice.status === 'paid' && invoice.status_transitions?.paid_at
                ? new Date(invoice.status_transitions.paid_at * 1000)
                : null,
        },
        create: {
            clinicId,
            stripeInvoiceId: invoice.id,
            number: invoice.number,
            amountPaid: invoice.amount_paid,
            amountDue: invoice.amount_due,
            currency: invoice.currency,
            status: invoice.status,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            invoicePdf: invoice.invoice_pdf,
            periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
            periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
            paidAt: invoice.status === 'paid' && invoice.status_transitions?.paid_at
                ? new Date(invoice.status_transitions.paid_at * 1000)
                : null,
        },
    });
}

async function findClinicIdBySubscription(stripeSubscriptionId) {
    if (!stripeSubscriptionId) return null;
    const c = await prisma.clinic.findFirst({
        where: { stripeSubscriptionId },
        select: { id: true },
    });
    return c?.id || null;
}

module.exports = router;
