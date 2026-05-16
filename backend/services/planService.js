/**
 * Plan definitions and enforcement.
 * Plans are enforced via clinic.plan field.
 * Admin can assign plans via /api/admin/clinics/:id/plan
 * Users can self-upgrade via /api/clinic/upgrade-plan
 */

const PLANS = {
    trial: {
        key: 'trial',
        name: 'Trial',
        price: 'Δωρεάν',
        smsMonthlyLimit: 30,
        dailyMessageCap: 10,
        aiMonthlyLimit: 100,
        features: ['Βασική αυτοματοποίηση', '30 SMS/μήνα', '100 AI requests/μήνα'],
    },
    pro: {
        key: 'pro',
        name: 'Pro',
        price: 'Δημοφιλές',
        smsMonthlyLimit: 500,
        dailyMessageCap: 200,
        aiMonthlyLimit: 1000,
        features: ['500 SMS/μήνα', '1000 AI requests/μήνα', 'Πλήρης αυτοματοποίηση', 'Webhooks'],
    },
    business: {
        key: 'business',
        name: 'Business',
        price: '€600/μήνα',
        smsMonthlyLimit: 1200,
        dailyMessageCap: 500,
        aiMonthlyLimit: 2500,
        features: ['1200 SMS/μήνα', '2500 AI requests/μήνα', 'Προηγμένα webhooks', 'Priority support', 'Custom workflows'],
    },
    scale: {
        key: 'scale',
        name: 'Scale',
        price: '€1000/μήνα',
        smsMonthlyLimit: 3000,
        dailyMessageCap: 1000,
        aiMonthlyLimit: 5000,
        features: ['3000+ SMS/μήνα', '5000 AI requests/μήνα', 'Custom workflows', 'Priority support', 'Dedicated account manager', 'SLA εγγύηση'],
    },
    unlimited: {
        key: 'unlimited',
        name: 'Unlimited',
        price: 'Custom',
        smsMonthlyLimit: 99999,
        dailyMessageCap: 9999,
        aiMonthlyLimit: 99999,
        features: ['Απεριόριστα SMS', 'Απεριόριστα AI requests', 'Full custom integration', 'Dedicated support'],
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
    const planOrder = ['trial', 'pro', 'business', 'scale', 'unlimited'];
    const currentIndex = planOrder.indexOf(currentPlanKey);
    if (currentIndex === -1) return Object.values(PLANS).filter(p => p.key !== 'unlimited');
    return planOrder
        .slice(currentIndex + 1)
        .filter(key => key !== 'unlimited')
        .map(key => PLANS[key]);
}

module.exports = { PLANS, DEFAULT_PLAN, getPlan, getPlanLimits, getUpgradeablePlans };
