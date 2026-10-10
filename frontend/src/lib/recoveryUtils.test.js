import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  EVENT_TYPES,
  getEvent,
  getPatientLabel,
  formatTime,
  getReplyPreview,
  getRevenue,
  getInitials,
} from './recoveryUtils';

describe('recoveryUtils', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps terminal recovery statuses to their events', () => {
    expect(getEvent({ status: 'RECOVERED' })).toBe(EVENT_TYPES.RECOVERED);
    expect(getEvent({ status: 'LOST' })).toBe(EVENT_TYPES.LOST);
    expect(getEvent({ status: 'DETECTED' })).toBe(EVENT_TYPES.DETECTED);
  });

  it('maps failed, scheduled and pending SMS statuses', () => {
    expect(getEvent({ status: 'DETECTED', smsStatus: 'failed' })).toBe(EVENT_TYPES.SMS_FAILED);
    expect(getEvent({ status: 'DETECTED', smsStatus: 'scheduled' })).toBe(EVENT_TYPES.PENDING);
    expect(getEvent({ status: 'DETECTED', smsStatus: 'pending' })).toBe(EVENT_TYPES.PENDING);
  });

  it('recognizes pending voice calls and inbound recovery replies', () => {
    expect(getEvent({
      status: 'DETECTED',
      smsStatus: 'pending',
      aiConversation: JSON.stringify([{ role: 'system', content: 'vapi_call_id: abc' }]),
    })).toBe(EVENT_TYPES.VOICE_CALL);
    expect(getEvent({
      status: 'RECOVERING',
      aiConversation: JSON.stringify([{ role: 'user', content: 'Yes, please book it' }]),
    })).toBe(EVENT_TYPES.RECOVERING);
    expect(getEvent({ status: 'RECOVERING', smsStatus: 'sent' })).toBe(EVENT_TYPES.SMS_SENT);
  });

  it('handles malformed conversation data without throwing', () => {
    expect(getEvent({ status: 'RECOVERING', aiConversation: '{bad json' })).toBe(EVENT_TYPES.RECOVERING);
    expect(getReplyPreview({ aiConversation: '{bad json' })).toBeNull();
  });

  it('formats patient labels from names and phone numbers', () => {
    expect(getPatientLabel({ patientName: 'Maria Papadopoulou' })).toBe('Maria P.');
    expect(getPatientLabel({ patient: { name: 'Nikos' } })).toBe('Nikos');
    expect(getPatientLabel({ fromNumber: '+306912345678' })).toBe('+30 691 *** 5678');
    expect(getPatientLabel({ fromNumber: '123' })).toBe('Άγνωστος');
  });

  it('formats recent, minute, hour, day and invalid timestamps', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-10T12:00:00Z').getTime());
    expect(formatTime('2026-10-10T11:59:40Z')).toBe('τώρα');
    expect(formatTime('2026-10-10T11:30:00Z')).toBe('30λ');
    expect(formatTime('2026-10-10T09:00:00Z')).toBe('3ω');
    expect(formatTime('2026-10-08T12:00:00Z')).not.toBe('');
    expect(formatTime('not-a-date')).toBe('');
  });

  it('returns the latest inbound reply and truncates long previews', () => {
    expect(getReplyPreview({
      aiConversation: JSON.stringify([
        { role: 'user', content: 'Older reply' },
        { role: 'assistant', content: 'Acknowledged' },
        { role: 'user', content: 'Latest reply' },
      ]),
    })).toBe('Latest reply');
    expect(getReplyPreview({
      aiConversation: [{ direction: 'inbound', body: 'x'.repeat(70) }],
    })).toBe('x'.repeat(55) + '...');
    expect(getReplyPreview({ aiConversation: [] })).toBeNull();
  });

  it('calculates revenue and patient initials with safe fallbacks', () => {
    expect(getRevenue({ estimatedRevenue: 120, status: 'RECOVERED' })).toBe(120);
    expect(getRevenue({ status: 'RECOVERING' })).toBe(80);
    expect(getRevenue({ status: 'LOST' })).toBeNull();
    expect(getInitials({ patientName: 'Maria' })).toBe('M');
    expect(getInitials({ patient: { name: 'Nikos' } })).toBe('N');
    expect(getInitials({})).toBe('?');
  });
});
