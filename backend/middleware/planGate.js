/**
 * Plan-gating helpers.
 *
 * Two policies:
 *  - trialGuard: blocks write/state-changing endpoints once the trial has expired
 *    (or the subscription is in a "locked" state). Read-only endpoints stay open.
 *  - planGate: enforces that the active plan tier is high enough to access a feature.
 *
 * Both attach a `billing` object to req so downstream handlers can show context.
 */

const prisma = require('../services/prisma');
const AppError = require('../errors/AppError');
const { PLANS, PLAN_ORDER } = require('../services/planService');

const GRACE_DAYS = Number(process.env.BILLING_GRACE_DAYS) || 7;

const LOCKED_STATES = new Set(['expired', 'cancelled']);

/**
 * Returns a normalized billing state for a clinic.
 * - { isActive: boolean, isTrialing: boolean, isPastDue: boolean, isLocked: boolean,
 *     plan, planStatus, trialEndsAt, currentPeriodEnd, gracePeriodEndsAt, daysUntilLock }
 */
function getBillingState(clinic, now = new Date()) {
    const plan = PLANS[clinic.plan] ? clinic.plan : 'trial';
    const planStatus = clinic.planStatus || (plan === 'trial' ? 'trialing' : 'expired');
    const trialEndsAt = clinic.trialEndsAt ? new Date(clinic.trialEndsAt) : null;
    const currentPeriodEnd = clinic.currentPeriodEnd ? new Date(clinic.currentPeriodEnd) : null;
    const gracePeriodEndsAt = clinic.gracePeriodEndsAt ? new Date(clinic.gracePeriodEndsAt) : null;

    let isActive = false;
    let isTrialing = false;
    let isPastDue = false;
    let isLocked = false;
    let daysUntilLock = null;

    // Pre-onboarding clinics (created but not yet "go-live") are active and
    // unlocked until onboardingCompleted flips to true. Trial does not tick
    // down until then — the platform owner controls when each clinic's trial
    // starts (high-touch onboarding model).
    if (planStatus === 'trialing') {
        isTrialing = true;
        if (!trialEndsAt) {
            // No trial deadline set yet → not started, treat as active
            isActive = true;
        } else if (trialEndsAt > now) {
            isActive = true;
            daysUntilLock = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000));
        } else {
            isLocked = true;
        }
    } else if (planStatus === 'active') {
        isActive = true;
    } else if (planStatus === 'past_due') {
        isPastDue = true;
        if (gracePeriodEndsAt && gracePeriodEndsAt > now) {
            isActive = true; // Soft: keep features but show a banner
            daysUntilLock = Math.max(0, Math.ceil((gracePeriodEndsAt.getTime() - now.getTime()) / 86400000));
        } else {
            isLocked = true;
        }
    } else if (LOCKED_STATES.has(planStatus)) {
        isLocked = true;
    }

    return {
        plan, planStatus,
        isActive, isTrialing, isPastDue, isLocked,
        trialEndsAt, currentPeriodEnd, gracePeriodEndsAt,
        daysUntilLock,
    };
}

/**
 * Compute grace period end based on a payment failure timestamp.
 */
function computeGracePeriodEnd(failedAt = new Date(), days = GRACE_DAYS) {
    const end = new Date(failedAt);
    end.setDate(end.getDate() + days);
    return end;
}

/**
 * Attach `req.billing` based on req.clinic. Use after requireAuth.
 */
function attachBilling(req, _res, next) {
    req.billing = getBillingState(req.clinic);
    next();
}

/**
 * Block the request when the clinic's billing is in a locked state
 * (trial expired and no paid plan, or subscription cancelled/expired).
 *
 * Allows read-only access (GET) to keep the UI browsable so users can see
 * the "you need to upgrade" page; blocks everything else.
 */
function trialGuard(req, res, next) {
    const billing = req.billing || getBillingState(req.clinic);
    if (!billing.isLocked) return next();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    return next(new AppError(
        'BILLING_LOCKED',
        billing.isTrialing
            ? 'Your free trial has ended. Please choose a plan to continue.'
            : 'Your subscription is not active. Please update your billing to continue.',
        402,
        {
            plan: billing.plan,
            planStatus: billing.planStatus,
            trialEndsAt: billing.trialEndsAt,
        }
    ));
}

/**
 * Require a minimum plan tier. Use after requireAuth.
 *   router.post('/x', requireAuth, planGate('growth'), handler)
 */
function planGate(minimumPlanKey) {
    return (req, _res, next) => {
        const current = req.clinic?.plan || 'trial';
        const currentIdx = PLAN_ORDER.indexOf(current);
        const requiredIdx = PLAN_ORDER.indexOf(minimumPlanKey);
        if (requiredIdx === -1) return next(new AppError('VALIDATION_ERROR', `Unknown plan: ${minimumPlanKey}`, 500));
        if (currentIdx >= requiredIdx) return next();
        return next(new AppError(
            'PLAN_UPGRADE_REQUIRED',
            `This feature requires the ${PLANS[minimumPlanKey].name} plan or higher.`,
            402,
            { currentPlan: current, requiredPlan: minimumPlanKey }
        ));
    };
}

/**
 * Cross-check the DB state once per request, in case Stripe webhooks are lagging.
 * Cheap: single indexed lookup.
 */
async function refreshClinicBilling(clinicId) {
    return prisma.clinic.findUnique({
        where: { id: clinicId },
        select: {
            id: true, plan: true, planStatus: true,
            trialEndsAt: true, currentPeriodEnd: true, gracePeriodEndsAt: true,
            stripeCustomerId: true, stripeSubscriptionId: true,
        },
    });
}

module.exports = {
    getBillingState,
    computeGracePeriodEnd,
    attachBilling,
    trialGuard,
    planGate,
    refreshClinicBilling,
    GRACE_DAYS,
};
