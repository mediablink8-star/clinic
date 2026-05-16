/**
 * Plan definitions and enforcement.
 * Plans are enforced via clinic.plan field.
 * Admin can assign plans via /api/admin/clinics/:id/plan
 * Users can self-upgrade via /api/clinic/upgrade-plan
 *
 * Pricing is based on clinic size (number of doctors):
 *   Solo (1 doctor)      → €349/mo
 *   Team (2-3 doctors)   → €599/mo
 *   Multi (4-6 doctors)  → €899/mo
 *   Enterprise (7+)      → €1200+/mo
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
        aiMonthlyLimit: 100,
        doctorRange: '1',
        features: ['Βασική αυτοματοποίηση', '30 SMS/μήνα', '100 AI requests/μήνα'],
    },
    solo: {
        key: 'solo',
        name: 'Solo',
        nameEl: 'Solo',
        price: '€349',
        priceNote: '/μήνα',
        smsMonthlyLimit: 500,
        dailyMessageCap: 200,
        aiMonthlyLimit: 1000,
        doctorRange: '1 γιατρός',
        features: ['500 SMS/μήνα', '1000 AI requests/μήνα', 'Πλήρης αυτοματοποίηση', 'Webhooks', 'Voice AI'],
    },
    team: {
        key: 'team',
        name: 'Team',
        nameEl: 'Team',
        price: '€599',
        priceNote: '/μήνα',
        smsMonthlyLimit: 1200,
        dailyMessageCap: 500,
        aiMonthlyLimit: 2500,
        doctorRange: '2-3 γιατροί',
        features: ['1200 SMS/μήνα', '2500 AI requests/μήνα', 'Προηγμένα webhooks', 'Priority support', 'Custom workflows', 'Διαχείριση γιατρών'],
    },
    multi: {
        key: 'multi',
        name: 'Multi',
        nameEl: 'Multi',
        price: '€899',
        priceNote: '/μήνα',
        smsMonthlyLimit: 3000,
        dailyMessageCap: 1000,
        aiMonthlyLimit: 5000,
        doctorRange: '4-6 γιατροί',
        features: ['3000+ SMS/μήνα', '5000 AI requests/μήνα', 'Custom workflows', 'Priority support', 'Dedicated account manager', 'SLA εγγύηση'],
    },
    enterprise: {
        key: 'enterprise',
        name: 'Enterprise',
        nameEl: 'Enterprise',
        price: '€1200+',
        priceNote: '/μήνα',
        smsMonthlyLimit: 99999,
        dailyMessageCap: 9999,
        aiMonthlyLimit: 99999,
        doctorRange: '7+ γιατροί',
        features: ['Απεριόριστα SMS', 'Απεριόριστα AI requests', 'Full custom integration', 'Dedicated support', 'On-premise deployment', 'Custom SLA'],
    },
};

const DEFAULT_PLAN = 'trial';

function getPlan(planKey) {
    return PLANS[planKey] || PLANS[DEFAULT_PLAN];
}

function getPlanLimits(planKey) {
    const plan = getPlan(planKey);
    return {
        smsMonthlyLimit: plan.smsMonthlyLimit,
        dailyMessageCap: plan.dailyMessageCap,
        aiMonthlyLimit: plan.aiMonthlyLimit,
    };
}

function getUpgradeablePlans(currentPlanKey) {
    const planOrder = ['trial', 'solo', 'team', 'multi', 'enterprise'];
    const currentIndex = planOrder.indexOf(currentPlanKey);
    if (currentIndex === -1) return Object.values(PLANS).filter(p => p.key !== 'trial' && p.key !== 'enterprise');
    return planOrder
        .slice(currentIndex + 1)
        .map(key => PLANS[key]);
}

module.exports = { PLANS, DEFAULT_PLAN, getPlan, getPlanLimits, getUpgradeablePlans };
