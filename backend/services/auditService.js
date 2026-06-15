const prisma = require('./prisma');
const logger = require('../utils/logger');

/**
 * Logs a system action for audit purposes.
 * @param {Object} params
 * @param {string} params.clinicId - The ID of the clinic.
 * @param {string} [params.userId] - The ID of the user performing the action.
 * @param {string} params.action - The action performed (e.g., CREATE_APPOINTMENT).
 * @param {string} params.entity - The entity affected (e.g., PATIENT).
 * @param {string} [params.entityId] - The ID of the affected entity.
 * @param {Object} [params.details] - Additional details about the action.
 * @param {string} [params.ipAddress] - The IP address of the requester.
 */
async function logAction({ clinicId, userId, action, entity, entityId, details, ipAddress }, tx) {
    try {
        const client = tx || prisma;
        await client.auditLog.create({
            data: {
                clinicId,
                userId,
                action,
                entity,
                entityId,
                details: details ? JSON.stringify(details) : null,
                ipAddress
            }
        });
    } catch (error) {
        // Audit log failures should not break the main flow, but must be visible
        logger.error('AUDIT_FAIL', { action, clinicId, error: error.message });
    }
}

module.exports = {
    logAction
};
