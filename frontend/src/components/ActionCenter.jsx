import React, { useState } from 'react';
import {
    AlertCircle, Reply, Send, Clock, PhoneCall,
    PhoneMissed, Zap, MessageCircle, ChevronRight, RefreshCw
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import SendMessageModal from './SendMessageModal';
import Tooltip from './Tooltip';

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
            transition: 'all 0.2s ease',
            boxShadow: urgent ? `0 0 20px ${color}15` : 'none',
        }}
        onMouseEnter={e => { 
            if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = urgent ? `0 0 24px ${color}25` : '0 4px 12px rgba(0,0,0,0.08)';
            }
        }}
        onMouseLeave={e => { 
            e.currentTarget.style.transform = 'translateY(0)'; 
            e.currentTarget.style.boxShadow = urgent ? `0 0 20px ${color}15` : 'none';
        }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: urgentCount > 0 ? '0.3rem' : '0' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <AlertCircle size={14} color={urgentCount > 0 ? '#f59e0b' : '#10b981'} />
                    Κέντρο Δράσης
                </h3>
                <span style={{
                    fontSize: '0.72rem', fontWeight: '900', padding: '6px 12px', borderRadius: '99px',
                    background: urgentCount > 0 ? 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.12) 100%)' : 'rgba(16,185,129,0.1)',
                    color: urgentCount > 0 ? '#dc2626' : '#15803d',
                    border: `1.5px solid ${urgentCount > 0 ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.2)'}`,
                    boxShadow: urgentCount > 0 ? '0 0 16px rgba(239,68,68,0.2), 0 2px 8px rgba(239,68,68,0.15)' : 'none',
                    animation: urgentCount > 0 ? 'pulse-warning 2s ease-in-out infinite' : 'none',
                }}>
                    {urgentCount > 0 ? `⚠️ ${urgentCount} χρειάζονται δράση` : '✅ Όλα καλά'}
                </span>
            </div>

            {/* Urgent banner when there are actions needed */}
            {urgentCount > 0 && (
                <div style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.05) 100%)',
                    border: '1.5px solid rgba(239,68,68,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '0.3rem',
                    boxShadow: '0 0 20px rgba(239,68,68,0.1)',
                }}>
                    <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: '#dc2626',
                        boxShadow: '0 0 12px rgba(220,38,38,0.6)',
                        animation: 'pulse-dot 2s ease-in-out infinite',
                        flexShrink: 0
                    }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#991b1b', flex: 1 }}>
                        Υπάρχουν {urgentCount} ενέργει{urgentCount === 1 ? 'α' : 'ες'} που χρειάζ{urgentCount === 1 ? 'εται' : 'ονται'} την προσοχή σας
                    </span>
                </div>
            )}

            {/* Urgent actions */}
            {urgentCount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <SectionLabel>Χρειάζεται Δράση</SectionLabel>
                    {staleCount > 0 && (
                        <ActionRow
                            icon={Send}
                            color="#7c3aed"
                            label={`⚠️ ${staleCount} ασθενείς περιμένουν`}
                            sublabel={`€${(staleCount * 150).toLocaleString()} σε κίνδυνο`}
                            cta="Στείλε"
                            loading={sending.followup}
                            onClick={sendFollowUps}
                            urgent
                        />
                    )}
                    {patientRepliedCount > 0 && (
                        <ActionRow
                            icon={Reply}
                            color="#3b82f6"
                            label={`📩 ${patientRepliedCount} απάντησαν — κλείστε τώρα!`}
                            sublabel="Μην χάσετε τα ραντεβού"
                            cta="Απάντηση"
                            onClick={() => setShowReply(true)}
                            urgent
                        />
                    )}
                    {failedSmsCount > 0 && (
                        <ActionRow
                            icon={RefreshCw}
                            color="#dc2626"
                            label={`❌ ${failedSmsCount} μηνύματα απέτυχαν`}
                            sublabel={`€${(failedSmsCount * 150).toLocaleString()} χαμένα`}
                            cta="Επανάληψη"
                            loading={retryingAll}
                            onClick={retryFailedSms}
                            urgent
                        />
                    )}
                    {callbackCount > 0 && (
                        <ActionRow
                            icon={PhoneCall}
                            color="#7c3aed"
                            label={`📞 ${callbackCount} ζητάνε επανάκληση`}
                            sublabel="Καλέστε τώρα"
                            cta="Δείτε"
                            onClick={() => onNavigate && onNavigate('patients')}
                            urgent
                        />
                    )}
                    {pendingCount > 0 && (
                        <ActionRow
                            icon={Clock}
                            color="#d97706"
                            label={`⏰ ${pendingCount} ραντεβού χρειάζονται επιβεβαίωση`}
                            sublabel="Επιβεβαιώστε για να μη χαθούν"
                            cta="Δείτε"
                            onClick={() => onNavigate && onNavigate('appointments')}
                            urgent
                        />
                    )}
                </div>
            )}

            {urgentCount === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.08) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#065f46' }}>🎉 Όλα καλά — κανένα χαμένο ραντεβού!</span>
                </div>
            )}

            {/* Pipeline overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <SectionLabel>Pipeline Εβδομάδας</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', gridAutoRows: '1fr' }}>
                    {[
                        { icon: PhoneMissed, color: '#ef4444', value: missedThisWeek, label: 'Αναπάντητες', tooltip: 'Αναπάντητες κλήσεις αυτή την εβδομάδα' },
                        { icon: Zap, color: '#f59e0b', value: activeRecoveries, label: 'Ενεργές', tooltip: 'Ενεργές προσπάθειες ανάκτησης' },
                        { icon: MessageCircle, color: '#6366f1', value: awaitingReply, label: 'Αναμένουν', tooltip: 'Αναμένουν απάντηση από ασθενείς' },
                    ].map(({ icon: Icon, color, value, label, tooltip }) => (
                        <Tooltip key={label} text={tooltip} position="top" style={{ height: '100%' }}>
                            <div
                            onClick={() => onNavigate && onNavigate('analytics')}
                            style={{ 
                                padding: '14px 10px', 
                                borderRadius: '14px', 
                                background: `linear-gradient(135deg, ${color}10 0%, ${color}08 100%)`, 
                                border: `1.5px solid ${color}25`, 
                                cursor: 'pointer', 
                                textAlign: 'center',
                                transition: 'all 0.2s ease',
                                position: 'relative',
                                overflow: 'hidden',
                                height: '100%',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                                e.currentTarget.style.boxShadow = `0 8px 24px ${color}25`;
                                e.currentTarget.style.borderColor = `${color}40`;
                                e.currentTarget.style.background = `linear-gradient(135deg, ${color}15 0%, ${color}10 100%)`;
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.borderColor = `${color}25`;
                                e.currentTarget.style.background = `linear-gradient(135deg, ${color}10 0%, ${color}08 100%)`;
                            }}
                        >
                            {/* Background glow effect */}
                            <div style={{
                                position: 'absolute',
                                top: '-50%',
                                right: '-50%',
                                width: '100%',
                                height: '100%',
                                background: color,
                                borderRadius: '50%',
                                filter: 'blur(30px)',
                                opacity: 0.08,
                                pointerEvents: 'none'
                            }} />
                            
                            {/* Content */}
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    margin: '0 auto 8px',
                                    borderRadius: '10px',
                                    background: `${color}18`,
                                    border: `1px solid ${color}30`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'transform 0.2s ease'
                                }}>
                                    <Icon size={18} color={color} strokeWidth={2.5} />
                                </div>
                                <p style={{ 
                                    fontSize: '1.4rem', 
                                    fontWeight: '900', 
                                    color: 'var(--secondary)', 
                                    margin: '4px 0 2px', 
                                    letterSpacing: '-0.04em',
                                    lineHeight: 1
                                }}>{value}</p>
                                <p style={{ 
                                    fontSize: '0.74rem', 
                                    fontWeight: '700', 
                                    color: 'var(--text-light)', 
                                    margin: 0,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em',
                                    minHeight: '2.2em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>{label}</p>
                            </div>
                        </div>
                        </Tooltip>
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

            <style>{`
                @keyframes pulse-warning {
                    0%, 100% { 
                        box-shadow: 0 0 16px rgba(239,68,68,0.2), 0 2px 8px rgba(239,68,68,0.15);
                        transform: scale(1);
                    }
                    50% { 
                        box-shadow: 0 0 24px rgba(239,68,68,0.35), 0 4px 12px rgba(239,68,68,0.25);
                        transform: scale(1.02);
                    }
                }
                
                @keyframes pulse-dot {
                    0%, 100% { 
                        box-shadow: 0 0 12px rgba(220,38,38,0.6);
                        opacity: 1;
                    }
                    50% { 
                        box-shadow: 0 0 20px rgba(220,38,38,0.8);
                        opacity: 0.8;
                    }
                }
            `}</style>
        </div>
    );
};

export default ActionCenter;
