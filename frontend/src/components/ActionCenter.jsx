import React, { useState } from 'react';
import {
    AlertCircle, Reply, Send, Clock, PhoneCall,
    PhoneMissed, Zap, MessageCircle, ChevronRight, RefreshCw
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import SendMessageModal from './SendMessageModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// ─── Single action row ────────────────────────────────────────────────────────
const ActionRow = ({ icon: Icon, color, label, sublabel, cta, onClick, loading, urgent }) => (
    <div
        onClick={!loading ? onClick : undefined}
        style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 14px', borderRadius: '14px',
            background: urgent ? `${color}0d` : 'var(--bg-subtle)',
            border: `1px solid ${urgent ? color + '28' : 'var(--border)'}`,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.18s ease',
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={16} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
            {sublabel && <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '600', margin: '1px 0 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{sublabel}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: '700', color, flexShrink: 0 }}>
            {loading ? '...' : cta}
            {!loading && <ChevronRight size={13} color={color} />}
        </div>
    </div>
);

// ─── Divider between sections ─────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 2px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{children}</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
);

// ─── Main ActionCenter ────────────────────────────────────────────────────────
const ActionCenter = ({ pendingCount = 0, recoveryLog = [], recoveryInsights = {}, token, onNavigate }) => {
    const [sending, setSending] = useState({});
    const [retryingAll, setRetryingAll] = useState(false);
    const [showReply, setShowReply] = useState(false);

    const { staleNoReply = [], patientEngaged = [], failedSms: failedInsights = [], callbackRequested = [], summary = {} } = recoveryInsights;
    const logs = Array.isArray(recoveryLog) ? recoveryLog : [];

    const failedSmsCount = summary.failedCount ?? logs.filter(l => l?.smsStatus === 'failed').length;
    const patientRepliedCount = summary.engagedCount ?? 0;
    const staleCount = summary.staleCount ?? 0;
    const callbackCount = summary.callbackCount ?? 0;

    // Pipeline stats
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const missedThisWeek = logs.filter(l => l && new Date(l.createdAt) >= week).length;
    const activeRecoveries = logs.filter(l => l && l.status === 'RECOVERING').length;
    const awaitingReply = logs.filter(l => l && l.status === 'RECOVERING' && l.smsStatus === 'sent').length;

    const urgentCount = staleCount + patientRepliedCount + failedSmsCount + callbackCount + (pendingCount > 0 ? 1 : 0);

    const retryFailedSms = async () => {
        const toRetry = failedInsights.length > 0 ? failedInsights : logs.filter(l => l && l.smsStatus === 'failed');
        if (!toRetry.length) return;
        setRetryingAll(true);
        let retried = 0;
        for (const mc of toRetry.slice(0, 10)) {
            try {
                await axios.post(API_BASE + '/recovery/' + mc.id + '/retry', {}, { headers: { Authorization: 'Bearer ' + token } });
                retried++;
            } catch {}
        }
        setRetryingAll(false);
        if (retried > 0) toast.success(retried + ' SMS επαναστάλθηκαν!');
        else toast.error('Αποτυχία επανάληψης SMS');
    };

    const sendFollowUps = async () => {
        if (!staleNoReply.length) return;
        setSending(s => ({ ...s, followup: true }));
        let sent = 0;
        for (const mc of staleNoReply.slice(0, 10)) {
            try {
                await axios.post(`${API_BASE}/recovery/${mc.id}/followup`, {}, { headers: { Authorization: `Bearer ${token}` } });
                sent++;
            } catch { /* continue */ }
        }
        setSending(s => ({ ...s, followup: false }));
        if (sent > 0) toast.success(`Follow-up SMS εστάλη σε ${sent} ασθενείς`);
        else toast.error('Αποτυχία αποστολής follow-up');
    };

    return (
        <div className="card-glass" style={{ padding: '1.1rem 1.25rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <AlertCircle size={14} color={urgentCount > 0 ? '#f59e0b' : '#10b981'} />
                    Κέντρο Δράσης
                </h3>
                <span style={{
                    fontSize: '0.7rem', fontWeight: '800', padding: '3px 9px', borderRadius: '99px',
                    background: urgentCount > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.1)',
                    color: urgentCount > 0 ? '#b45309' : '#15803d',
                    border: `1px solid ${urgentCount > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.2)'}`,
                }}>
                    {urgentCount > 0 ? `${urgentCount} εκκρεμή` : 'Όλα εντάξει'}
                </span>
            </div>

            {/* Urgent actions */}
            {urgentCount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <SectionLabel>Χρειάζεται Δράση</SectionLabel>
                    {staleCount > 0 && (
                        <ActionRow icon={Send} color="#7c3aed" label={`${staleCount} ασθενείς δεν απάντησαν (24h+)`} sublabel="Αποστολή follow-up" cta="Στείλε" loading={sending.followup} onClick={sendFollowUps} urgent />
                    )}
                    {patientRepliedCount > 0 && (
                        <ActionRow icon={Reply} color="#3b82f6" label={`${patientRepliedCount} ασθενής απάντησε`} sublabel="Απαντήστε τώρα" cta="Απάντηση" onClick={() => setShowReply(true)} urgent />
                    )}
                    {failedSmsCount > 0 && (
                        <ActionRow icon={RefreshCw} color="#dc2626" label={`${failedSmsCount} αποτυχία SMS`} sublabel="Επανάληψη αποστολής" cta="Retry" loading={retryingAll} onClick={retryFailedSms} urgent />
                    )}
                    {callbackCount > 0 && (
                        <ActionRow icon={PhoneCall} color="#7c3aed" label={`${callbackCount} ασθενής ζητά επανάκληση`} sublabel="Καλέστε τώρα" cta="Δείτε" onClick={() => onNavigate && onNavigate('patients')} urgent />
                    )}
                    {pendingCount > 0 && (
                        <ActionRow icon={Clock} color="#d97706" label={`${pendingCount} εκκρεμή ραντεβού`} sublabel="Επιβεβαίωση" cta="Δείτε" onClick={() => onNavigate && onNavigate('appointments')} urgent />
                    )}
                </div>
            )}

            {urgentCount === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px rgba(16,185,129,0.5)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#065f46' }}>Όλα εντάξει — δεν υπάρχουν εκκρεμότητες</span>
                </div>
            )}

            {/* Pipeline overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <SectionLabel>Pipeline Εβδομάδας</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                    {[
                        { icon: PhoneMissed, color: '#ef4444', value: missedThisWeek, label: 'Αναπάντητες' },
                        { icon: Zap, color: '#f59e0b', value: activeRecoveries, label: 'Ενεργές' },
                        { icon: MessageCircle, color: '#6366f1', value: awaitingReply, label: 'Αναμένουν' },
                    ].map(({ icon: Icon, color, value, label }) => (
                        <div
                            key={label}
                            onClick={() => onNavigate && onNavigate('analytics')}
                            style={{ padding: '10px 8px', borderRadius: '12px', background: `${color}0d`, border: `1px solid ${color}20`, cursor: 'pointer', textAlign: 'center' }}
                        >
                            <Icon size={14} color={color} style={{ marginBottom: '4px' }} />
                            <p style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--secondary)', margin: '2px 0 1px', letterSpacing: '-0.03em' }}>{value}</p>
                            <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-light)', margin: 0 }}>{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {showReply && patientEngaged.length > 0 && (
                <SendMessageModal 
                    patients={patientEngaged} 
                    preSelectedPatient={patientEngaged.length === 1 ? patientEngaged[0] : null}
                    token={token} 
                    onClose={() => setShowReply(false)}
                    title="Απάντηση σε Ασθενή"
                    subtitle={`${patientEngaged.length} ασθενής απάντησε`}
                />
            )}
        </div>
    );
};

export default ActionCenter;
