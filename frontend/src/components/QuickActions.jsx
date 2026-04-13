import React, { useState } from 'react';
import { RefreshCw, Send, PhoneIncoming, FlaskConical } from 'lucide-react';
import api from '../lib/api';

const ActionButton = ({ icon: Icon, label, onClick, disabled = false, loading = false }) => (
    <button
        onClick={onClick}
        disabled={disabled || loading}
        style={{
            width: '100%',
            padding: '0.7rem 0.8rem',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: disabled ? 'var(--bg-subtle)' : 'var(--card-bg)',
            color: disabled ? 'var(--text-light)' : 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.8 : 1,
            transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
            if (!disabled) e.currentTarget.style.background = 'var(--primary-light)';
        }}
        onMouseLeave={(e) => {
            if (!disabled) e.currentTarget.style.background = 'var(--card-bg)';
        }}
    >
        <Icon size={15} className={loading ? 'animate-spin' : ''} />
        {label}
    </button>
);

const QuickActions = ({ patients = [], onRefresh }) => {
    const [loading, setLoading] = useState({ sms: false, missed: false, refresh: false });
    const [notice, setNotice] = useState(null);

    const setBusy = (key, value) => setLoading((prev) => ({ ...prev, [key]: value }));
    const hasPatients = Array.isArray(patients) && patients.length > 0;

    const triggerTestSms = async () => {
        if (!hasPatients) {
            setNotice({ type: 'info', text: 'No data yet. Add a patient first to run test SMS.' });
            return;
        }
        const target = patients[0];
        setBusy('sms', true);
        try {
            await api.post('/messages/send', {
                patientId: target.id,
                message: 'ClinicFlow test SMS: system checks are healthy.'
            });
            setNotice({ type: 'success', text: `Test SMS queued for ${target.name}.` });
        } catch (err) {
            setNotice({ type: 'error', text: err.response?.data?.error || 'Test SMS failed.' });
        } finally {
            setBusy('sms', false);
        }
    };

    const simulateMissedCall = async () => {
        setBusy('missed', true);
        try {
            await api.post('/recovery/test-trigger', {
                phone: '+30690000000',
                callSid: `simulate_${Date.now()}`
            });
            setNotice({ type: 'success', text: 'Missed call simulation executed.' });
        } catch (err) {
            setNotice({ type: 'error', text: err.response?.data?.error || 'Simulation failed.' });
        } finally {
            setBusy('missed', false);
        }
    };

    const refreshData = async () => {
        setBusy('refresh', true);
        try {
            if (onRefresh) onRefresh();
            setNotice({ type: 'success', text: 'Data refresh requested.' });
        } finally {
            setBusy('refresh', false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <ActionButton icon={Send} label="Trigger test SMS" onClick={triggerTestSms} loading={loading.sms} />
            <ActionButton icon={PhoneIncoming} label="Simulate missed call" onClick={simulateMissedCall} loading={loading.missed} />
            <ActionButton icon={RefreshCw} label="Refresh data" onClick={refreshData} loading={loading.refresh} />
            {!hasPatients && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', border: '1px dashed var(--border)', borderRadius: '10px', padding: '0.55rem 0.65rem' }}>
                    No data yet. Add at least one patient to test outbound SMS.
                </div>
            )}
            {notice && (
                <div style={{
                    marginTop: '0.25rem',
                    fontSize: '0.75rem',
                    borderRadius: '9px',
                    padding: '0.5rem 0.65rem',
                    background: notice.type === 'success' ? 'rgba(16,185,129,0.08)' : notice.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)',
                    color: notice.type === 'success' ? '#047857' : notice.type === 'error' ? '#b91c1c' : '#4338ca',
                }}>
                    <FlaskConical size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    {notice.text}
                </div>
            )}
        </div>
    );
};

export default QuickActions;
