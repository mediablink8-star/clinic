const prisma = require('./prisma');
const AppError = require('../errors/AppError');

const CATEGORIES = ['VOICE_AI', 'TELEPHONY', 'SMS', 'HOSTING', 'DATABASE', 'SOFTWARE', 'PAYMENT_FEES', 'OTHER'];

function getMonthRange(month) {
    const value = month || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(value)) {
        throw new AppError('VALIDATION_ERROR', 'month must use YYYY-MM format', 400);
    }
    const [year, monthNumber] = value.split('-').map(Number);
    if (monthNumber < 1 || monthNumber > 12) {
        throw new AppError('VALIDATION_ERROR', 'month must use YYYY-MM format', 400);
    }
    return {
        month: value,
        start: new Date(Date.UTC(year, monthNumber - 1, 1)),
        end: new Date(Date.UTC(year, monthNumber, 1)),
    };
}

async function getCostReport(month) {
    const range = getMonthRange(month);
    const [clinics, invoices, costs] = await Promise.all([
        prisma.clinic.findMany({
            select: { id: true, name: true, plan: true, planStatus: true },
            orderBy: { name: 'asc' },
        }),
        prisma.invoice.findMany({
            where: {
                status: 'paid',
                paidAt: { gte: range.start, lt: range.end },
                currency: 'eur',
            },
            select: { clinicId: true, amountPaid: true, paidAt: true, stripeInvoiceId: true },
        }),
        prisma.operatingCost.findMany({
            where: { occurredAt: { gte: range.start, lt: range.end } },
            include: { clinic: { select: { id: true, name: true } } },
            orderBy: { occurredAt: 'desc' },
            take: 500,
        }),
    ]);

    const revenueByClinic = new Map();
    for (const invoice of invoices) {
        revenueByClinic.set(invoice.clinicId, (revenueByClinic.get(invoice.clinicId) || 0) + invoice.amountPaid);
    }
    const costByClinic = new Map();
    let platformCostsCents = 0;
    let totalCostsCents = 0;
    const byCategory = {};
    for (const cost of costs) {
        totalCostsCents += cost.amountCents;
        byCategory[cost.category] = (byCategory[cost.category] || 0) + cost.amountCents;
        if (cost.clinicId) {
            costByClinic.set(cost.clinicId, (costByClinic.get(cost.clinicId) || 0) + cost.amountCents);
        } else {
            platformCostsCents += cost.amountCents;
        }
    }
    const perClinic = clinics.map(clinic => {
        const revenueCents = revenueByClinic.get(clinic.id) || 0;
        const costCents = costByClinic.get(clinic.id) || 0;
        return {
            clinicId: clinic.id,
            clinicName: clinic.name,
            plan: clinic.plan,
            planStatus: clinic.planStatus,
            revenueCents,
            directCostCents: costCents,
            contributionCents: revenueCents - costCents,
            marginPercent: revenueCents > 0 ? Math.round(((revenueCents - costCents) / revenueCents) * 1000) / 10 : null,
        };
    });
    const revenueCents = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
    return {
        success: true,
        month: range.month,
        summary: {
            revenueCents,
            directClinicCostsCents: [...costByClinic.values()].reduce((sum, amount) => sum + amount, 0),
            platformCostsCents,
            totalCostsCents,
            estimatedOperatingProfitCents: revenueCents - totalCostsCents,
            marginPercent: revenueCents > 0 ? Math.round(((revenueCents - totalCostsCents) / revenueCents) * 1000) / 10 : null,
            paidInvoiceCount: invoices.length,
            costEntryCount: costs.length,
        },
        byCategory: Object.entries(byCategory).map(([category, amountCents]) => ({ category, amountCents })),
        perClinic,
        costs: costs.map(cost => ({
            id: cost.id,
            clinicId: cost.clinicId,
            clinicName: cost.clinic?.name || 'Platform-wide',
            category: cost.category,
            provider: cost.provider,
            description: cost.description,
            amountCents: cost.amountCents,
            currency: cost.currency,
            occurredAt: cost.occurredAt,
            isRecurring: cost.isRecurring,
        })),
        categories: CATEGORIES,
    };
}

async function createCostEntry(input, createdBy) {
    const { clinicId = null, category, provider, description, amount, occurredAt, isRecurring = false } = input || {};
    if (!CATEGORIES.includes(category)) throw new AppError('VALIDATION_ERROR', 'Invalid cost category', 400);
    if (typeof provider !== 'string' || !provider.trim() || provider.trim().length > 120) throw new AppError('VALIDATION_ERROR', 'Provider is required (max 120 characters)', 400);
    if (typeof description !== 'string' || !description.trim() || description.trim().length > 500) throw new AppError('VALIDATION_ERROR', 'Description is required (max 500 characters)', 400);
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 10000000) throw new AppError('VALIDATION_ERROR', 'Amount must be greater than 0 and no more than 10,000,000 EUR', 400);
    if (typeof isRecurring !== 'boolean') throw new AppError('VALIDATION_ERROR', 'isRecurring must be boolean', 400);
    if (clinicId !== null && (typeof clinicId !== 'string' || !(await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } })))) {
        throw new AppError('VALIDATION_ERROR', 'Unknown clinicId', 400);
    }
    const date = occurredAt ? new Date(occurredAt) : new Date();
    if (Number.isNaN(date.getTime())) throw new AppError('VALIDATION_ERROR', 'Invalid occurredAt date', 400);

    const entry = await prisma.operatingCost.create({
        data: {
            clinicId,
            category,
            provider: provider.trim(),
            description: description.trim(),
            amountCents: Math.round(numericAmount * 100),
            occurredAt: date,
            isRecurring,
            createdBy: typeof createdBy === 'string' ? createdBy : null,
        },
        include: { clinic: { select: { name: true } } },
    });
    return {
        id: entry.id,
        clinicId: entry.clinicId,
        clinicName: entry.clinic?.name || 'Platform-wide',
        category: entry.category,
        provider: entry.provider,
        description: entry.description,
        amountCents: entry.amountCents,
        occurredAt: entry.occurredAt,
        isRecurring: entry.isRecurring,
    };
}

module.exports = { CATEGORIES, getCostReport, createCostEntry };
