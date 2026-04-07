const {
    normalizeTwilioMessageStatus,
    shouldAdvanceMessageStatus,
    mapMissedCallStatusToRecoveryCaseState,
} = require('./recoveryTrackingService');

describe('recoveryTrackingService helpers', () => {
    test('normalizes Twilio delivery statuses to internal message statuses', () => {
        expect(normalizeTwilioMessageStatus('queued')).toBe('QUEUED');
        expect(normalizeTwilioMessageStatus('sent')).toBe('SENT');
        expect(normalizeTwilioMessageStatus('delivered')).toBe('DELIVERED');
        expect(normalizeTwilioMessageStatus('undelivered')).toBe('FAILED');
        expect(normalizeTwilioMessageStatus('received')).toBe('RECEIVED');
        expect(normalizeTwilioMessageStatus('unknown')).toBeNull();
    });

    test('prevents status downgrade after delivery', () => {
        expect(shouldAdvanceMessageStatus('DELIVERED', 'SENT')).toBe(false);
        expect(shouldAdvanceMessageStatus('DELIVERED', 'FAILED')).toBe(false);
    });

    test('allows forward-only outbound status transitions', () => {
        expect(shouldAdvanceMessageStatus('QUEUED', 'SENT')).toBe(true);
        expect(shouldAdvanceMessageStatus('QUEUED', 'FAILED')).toBe(true);
        expect(shouldAdvanceMessageStatus('SENT', 'DELIVERED')).toBe(true);
        expect(shouldAdvanceMessageStatus('SENT', 'FAILED')).toBe(true);
        expect(shouldAdvanceMessageStatus('SENT', 'QUEUED')).toBe(false);
        expect(shouldAdvanceMessageStatus('FAILED', 'DELIVERED')).toBe(false);
    });

    test('maps legacy missed call statuses to recovery case states', () => {
        expect(mapMissedCallStatusToRecoveryCaseState('DETECTED')).toBe('ACTIVE');
        expect(mapMissedCallStatusToRecoveryCaseState('RECOVERING')).toBe('ACTIVE');
        expect(mapMissedCallStatusToRecoveryCaseState('RECOVERED')).toBe('RECOVERED');
        expect(mapMissedCallStatusToRecoveryCaseState('LOST')).toBe('CLOSED_NO_RESPONSE');
    });
});
