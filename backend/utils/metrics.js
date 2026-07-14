const promClient = require('prom-client');

// Create a Registry which registers the metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register, prefix: 'clinicflow_' });

// Custom metrics for ClinicFlow
const httpRequestsTotal = new promClient.Counter({
    name: 'clinicflow_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

const httpRequestDuration = new promClient.Histogram({
    name: 'clinicflow_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
});

const appointmentsBooked = new promClient.Counter({
    name: 'clinicflow_appointments_booked_total',
    help: 'Total appointments booked',
    labelNames: ['clinic_id', 'source', 'doctor_id'],
    registers: [register],
});

const appointmentsCancelled = new promClient.Counter({
    name: 'clinicflow_appointments_cancelled_total',
    help: 'Total appointments cancelled',
    labelNames: ['clinic_id', 'reason'],
    registers: [register],
});

const recoveryCasesTotal = new promClient.Counter({
    name: 'clinicflow_recovery_cases_total',
    help: 'Total recovery cases created',
    labelNames: ['clinic_id', 'state'],
    registers: [register],
});

const recoveryRate = new promClient.Gauge({
    name: 'clinicflow_recovery_rate_percent',
    help: 'Current recovery rate percentage by clinic',
    labelNames: ['clinic_id'],
    registers: [register],
});

const smsSent = new promClient.Counter({
    name: 'clinicflow_sms_sent_total',
    help: 'Total SMS messages sent',
    labelNames: ['clinic_id', 'type', 'status'],
    registers: [register],
});

const aiRequests = new promClient.Counter({
    name: 'clinicflow_ai_requests_total',
    help: 'Total AI command requests',
    labelNames: ['clinic_id', 'action', 'success'],
    registers: [register],
});

const voiceCalls = new promClient.Counter({
    name: 'clinicflow_voice_calls_total',
    help: 'Total voice calls initiated',
    labelNames: ['clinic_id', 'status'],
    registers: [register],
});

const activeClinics = new promClient.Gauge({
    name: 'clinicflow_active_clinics',
    help: 'Number of active clinics',
    registers: [register],
});

const subscriptionStatus = new promClient.Gauge({
    name: 'clinicflow_subscription_status',
    help: 'Subscription status by clinic (1=active, 0=inactive)',
    labelNames: ['clinic_id', 'plan', 'status'],
    registers: [register],
});

const webhookDeliveries = new promClient.Counter({
    name: 'clinicflow_webhook_deliveries_total',
    help: 'Total webhook delivery attempts',
    labelNames: ['event_type', 'success'],
    registers: [register],
});

const webhookDeadLetters = new promClient.Gauge({
    name: 'clinicflow_webhook_dead_letters',
    help: 'Current number of webhooks in dead letter queue',
    labelNames: ['clinic_id'],
    registers: [register],
});

const dbQueryDuration = new promClient.Histogram({
    name: 'clinicflow_db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register],
});

const redisOpsDuration = new promClient.Histogram({
    name: 'clinicflow_redis_operation_duration_seconds',
    help: 'Redis operation duration in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
    registers: [register],
});

// Helper functions to record metrics
function recordHttpRequest(method, route, statusCode, durationSeconds) {
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route }, durationSeconds);
}

function recordAppointmentBooked(clinicId, source, doctorId) {
    appointmentsBooked.inc({ clinic_id: clinicId, source, doctor_id: doctorId || 'none' });
}

function recordAppointmentCancelled(clinicId, reason) {
    appointmentsCancelled.inc({ clinic_id: clinicId, reason: reason || 'unknown' });
}

function recordRecoveryCase(clinicId, state) {
    recoveryCasesTotal.inc({ clinic_id: clinicId, state });
}

function updateRecoveryRate(clinicId, rate) {
    recoveryRate.set({ clinic_id: clinicId }, rate);
}

function recordSmsSent(clinicId, type, status) {
    smsSent.inc({ clinic_id: clinicId, type, status });
}

function recordAiRequest(clinicId, action, success) {
    aiRequests.inc({ clinic_id: clinicId, action, success: String(success) });
}

function recordVoiceCall(clinicId, status) {
    voiceCalls.inc({ clinic_id: clinicId, status });
}

function updateActiveClinics(count) {
    activeClinics.set(count);
}

function updateSubscriptionStatus(clinicId, plan, status) {
    subscriptionStatus.set({ clinic_id: clinicId, plan, status }, 1);
}

function recordWebhookDelivery(eventType, success) {
    webhookDeliveries.inc({ event_type: eventType, success: String(success) });
}

function updateDeadLetters(clinicId, count) {
    webhookDeadLetters.set({ clinic_id: clinicId }, count);
}

function recordDbQuery(operation, table, durationSeconds) {
    dbQueryDuration.observe({ operation, table }, durationSeconds);
}

function recordRedisOp(operation, durationSeconds) {
    redisOpsDuration.observe({ operation }, durationSeconds);
}

module.exports = {
    register,
    // Metrics
    httpRequestsTotal,
    httpRequestDuration,
    appointmentsBooked,
    appointmentsCancelled,
    recoveryCasesTotal,
    recoveryRate,
    smsSent,
    aiRequests,
    voiceCalls,
    activeClinics,
    subscriptionStatus,
    webhookDeliveries,
    webhookDeadLetters,
    dbQueryDuration,
    redisOpsDuration,
    // Helpers
    recordHttpRequest,
    recordAppointmentBooked,
    recordAppointmentCancelled,
    recordRecoveryCase,
    updateRecoveryRate,
    recordSmsSent,
    recordAiRequest,
    recordVoiceCall,
    updateActiveClinics,
    updateSubscriptionStatus,
    recordWebhookDelivery,
    updateDeadLetters,
    recordDbQuery,
    recordRedisOp,
};