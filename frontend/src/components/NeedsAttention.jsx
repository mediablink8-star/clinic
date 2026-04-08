import { AlertCircle, ChevronRight, Clock, Reply, PhoneOff, Send } from 'lucide-react';
import axios from 'axios';
import { useState } from 'react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const AttentionItem = ({ icon: Icon, color, bg, label, sublabel, action, onClick, loading }) => (
    <div
        onClick={!loading ? onClick : undefined}
        style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', borderRadius: '12px',
            background: bg, border: `1px solid ${color}18`,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s ease'
        }}
        className="hover-lift"
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={13} />
            </div>
            <div>
                <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '1px' }}>{label}</p>
                {sublabel && <p style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{sublabel}</p>}
            </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem', fontWeight: '700', color, flexShrink: 0 }}>
            {loading ? '...' : action}
            {!loading && <ChevronRight size={11} color={color} />}
        </div>
    </div>
);

const NeedsAttention = ({ pendingCount = 0, recoveryLog = [], recoveryInsights = {}, token, onNavigate }) => {
    const [sending, setSending] = useState({});

    const { staleNoReply = [], patientEngaged = [], failedSms: failedInsights = [], summary = {} } = recoveryInsights;

    // Fallback counts from log if insights not loaded yet
    const failedSmsCount = summary.failedCount ?? (Array.isArray(recoveryLog) ? recoveryLog.filter(l => l?.smsStatus === 'failed').length : 0);
    const patientRepliedCount = summary.engagedCount ?? 0;
    const staleCount = summary.staleCount ?? 0;

    const total = staleCount + patientRepliedCount + failedSmsCount + (pendingCount > 0 ? 1 : 0);

    const sendFollowUps = async () => {
        if (!staleNoReply.length) return;
        setSending(s => ({ ...s, followup: true }));
        let sent = 0;
        for (const mc of staleNoReply.slice(0, 10)) {
            try {
                await axios.post(`${API_BASE}/recovery/${mc.id}/followup`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                sent++;
            } catch { /* continue */ }
        }
        setSending(s => ({ ...s, followup: false }));
        if (sent > 0) toast.success(`Follow-up SMS εστάλη σε ${sent} ασθενείς`);
        else toast.error('Αποτυχία αποστολής follow-up');
    };

    return (
        <div className="card-glass" style={{
            padding: '1rem 1.25rem', borderRadius: '20px',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <AlertCircle size={15} /> ΧΡΕΙΑΖΕΤΑΙ ΠΡΟΣΟΧΗ
                </h3>
                <span style={{
                    fontSize: '0.62rem', fontWeight: '700', padding: '3px 7px',
                    background: total > 0 ? '#fef3c7' : '#f0fdf4',
                    color: total > 0 ? '#b45309' : '#15803d', borderRadius: '6px'
                }}>
                    {total > 0 ? `${total} ΕΚΚΡΕΜΟΤΗΤΕΣ` : 'ΟΛΑ ΟΚ'}
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {/* Stale — no reply in 24h — most important, show first */}
                {staleCount > 0 && (
                    <AttentionItem
                        icon={Send}
                        color="#7c3aed"
                        bg="#f5f3ff"
                        label={`${staleCount} ασθενείς δεν απάντησαν (24h+)`}
                        sublabel="ΑΠΟΣΤΟΛΗ FOLLOW-UP"
                        action="Στείλε τώρα"
                        loading={sending.followup}
                        onClick={sendFollowUps}
                    />
                )}

                {/* Patient replied — needs human response */}
                {patientRepliedCount > 0 && (
                    <AttentionItem
                        icon={Reply}
                        color="#3b82f6"
                        bg="#eff6ff"
                        label={`${patientRepliedCount} ασθενής απάντησε`}
                        sublabel="ΑΠΑΝΤΗΣΤΕ ΤΩΡΑ"
                        action="Δείτε"
                        onClick={() => onNavigate && onNavigate('dashboard')}
                    />
                )}

                {/* Failed SMS */}
                {failedSmsCount > 0 && (
                    <AttentionItem
                        icon={PhoneOff}
                        color="#dc2626"
                        bg="#fef2f2"
                        label={`${failedSmsCount} αποτυχία αποστολής SMS`}
                        sublabel="ΕΠΑΝΑΛΗΨΗ"
                        action="Retry"
                        onClick={() => onNavigate && onNavigate('dashboard')}
                    />
                )}

                {/* Pending appointments */}
                {pendingCount > 0 && (
                    <AttentionItem
                        icon={Clock}
                        color="#d97706"
                        bg="#fffbeb"
                        label={`${pendingCount} εκκρεμή ραντεβού`}
                        sublabel="ΕΠΙΒΕΒΑΙΩΣΗ"
                        action="Δείτε"
                        onClick={() => onNavigate && onNavigate('appointments')}
                    />
                )}

                {total === 0 && (
                    <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.78rem' }}>
                        Δεν υπάρχουν εκκρεμότητες 🎉
                    </div>
                )}
            </div>
        </div>
    );
};

export default NeedsAttention;
