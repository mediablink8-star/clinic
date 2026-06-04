/**
 * Plan definitions and enforcement.
 * Plans are enforced via clinic.plan field.
 * Admin can assign plans via /api/admin/clinics/:id/plan
 * Users can self-upgrade via /api/clinic/upgrade-plan
 *
 * Pricing is based on clinic size (number of doctors):
 *   Starter (1 doctor)       → $350/mo
 *   Growth (2-3 doctors)     → $600/mo
 *   Scale (4-7 doctors)      → $1000/mo
 *   Enterprise (custom)      → Custom pricing
 */

const PLANS = {
    trial: {
        key: 'trial',
        name: 'Trial',
        nameEl: 'Δοκιμαστικό',
        price: 'Δωρεάν',
        priceNote: '14 ημέρες',
        smsMonthlyLimit: 30,
        dailyMessageCap: 10,
        aiMonthlyLimit: 20,
        doctorRange: '1',
        features: ['Βασική αυτοματοποίηση', '30 SMS/μήνα', '20 AI requests/μήνα'],
    },
    starter: {
        key: 'starter',
        name: 'Starter',
        nameEl: 'Starter',
        price: '€350',
        priceNote: '/μήνα',
        smsMonthlyLimit: 200,
        dailyMessageCap: 100,
        aiMonthlyLimit: 100,
        doctorRange: '1 γιατρός',
        features: ['200 SMS/μήνα', '100 AI requests/μήνα', 'Πλήρης αυτοματοποίηση', 'Webhooks', 'Voice AI'],
    },
    growth: {
        key: 'growth',
        name: 'Growth',
        nameEl: 'Growth',
        price: '€600',
        priceNote: '/μήνα',
        smsMonthlyLimit: 600,
        dailyMessageCap: 200,
        aiMonthlyLimit: 250,
        doctorRange: '2-3 γιατροί',
        features: ['600 SMS/μήνα', '250 AI requests/μήνα', 'Προηγμένα webhooks', 'Priority support', 'Custom workflows', 'Διαχείριση γιατρών'],
    },
    scale: {
        key: 'scale',
        name: 'Scale',
        nameEl: 'Scale',
        price: '€1000',
        priceNote: '/μήνα',
        smsMonthlyLimit: 1500,
        dailyMessageCap: 500,
        aiMonthlyLimit: 600,
        doctorRange: '4-7 γιατροί',
        features: ['1500 SMS/μήνα', '600 AI requests/μήνα', 'Custom workflows', 'Priority support', 'Dedicated account manager', 'SLA εγγύηση'],
    },
    enterprise: {
        key: 'enterprise',
        name: 'Enterprise',
        nameEl: 'Enterprise',
        price: 'Custom',
        priceNote: '',
        smsMonthlyLimit: 99999,
        dailyMessageCap: 9999,
        aiMonthlyLimit: 99999,
        doctorRange: 'Custom',
        features: ['Απεριόριστα SMS', 'Απεριόριστα AI requests', 'Full custom integration', 'Dedicated support', 'On-premise deployment', 'Custom SLA'],
    },
};

const DEFAULT_PLAN = 'trial';

const PLAN_ORDER = ['trial', 'starter', 'growth', 'scale', 'enterprise'];

function getPlan(planKey) {
    return PLANS[planKey] || PLANS[DEFAULT_PLAN];
}

function getPlanLimits(planKey) {
    const plan = getPlan(planKey);
    return {
        plan: plan.key,
        smsMonthlyLimit: plan.smsMonthlyLimit,
        dailyMessageCap: plan.dailyMessageCap,
        aiMonthlyLimit: plan.aiMonthlyLimit,
    };
}

function getPlanKeyByClinic(clinic) {
    if (!clinic) return DEFAULT_PLAN;
    return PLANS[clinic.plan] ? clinic.plan : DEFAULT_PLAN;
}

function validateUpgrade(currentPlanKey, targetPlanKey) {
    if (!PLANS[targetPlanKey]) return 'Invalid plan';
    const currentIdx = PLAN_ORDER.indexOf(currentPlanKey);
    const targetIdx = PLAN_ORDER.indexOf(targetPlanKey);
    if (targetIdx <= currentIdx) return 'Can only upgrade to a higher plan';
    return null;
}

function getUpgradeablePlans(currentPlanKey) {
    const currentIndex = PLAN_ORDER.indexOf(currentPlanKey);
    if (currentIndex === -1) return Object.values(PLANS).filter(p => p.key !== 'trial' && p.key !== 'enterprise');
    return PLAN_ORDER
        .slice(currentIndex + 1)
        .map(key => PLANS[key]);
}

module.exports = { PLANS, DEFAULT_PLAN, PLAN_ORDER, getPlan, getPlanLimits, getPlanKeyByClinic, validateUpgrade, getUpgradeablePlans };
