/**
 * Plan definitions and enforcement.
 * Plans are enforced via clinic.plan field.
 * Admin can assign plans via /api/admin/clinics/:id/plan
 */

const PLANS = {
    trial: {
        name: 'Trial',
        smsMonthlyLimit: 30,
        dailyMessageCap: 10,
        aiMonthlyLimit: 100,
    },
    starter: {
        name: 'Starter',
        smsMonthlyLimit: 100,
        dailyMessageCap: 50,
        aiMonthlyLimit: 300,
    },
    pro: {
        name: 'Pro',
        smsMonthlyLimit: 500,
        dailyMessageCap: 200,
        aiMonthlyLimit: 1000,
    },
    unlimited: {
        name: 'Unlimited',
        smsMonthlyLimit: 99999,
        dailyMessageCap: 9999,
        aiMonthlyLimit: 99999,
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

module.exports = { PLANS, DEFAULT_PLAN, getPlan, getPlanLimits };
