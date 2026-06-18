import React, { useState } from 'react';
import { API_BASE } from '../lib/constants';
import {
    AlertCircle, Reply, Send, Clock, PhoneCall,
    PhoneMissed, Zap, MessageCircle, ChevronRight, RefreshCw, X
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import SendMessageModal from './SendMessageModal';
import Tooltip from './Tooltip';


// ─── Single action row ────────────────────────────────────────────────────────
const ActionRow = ({ icon: Icon, color, label, sublabel, cta, onClick, loading, urgent, onDismiss }) => (
    <div className="action-row"
        onClick={!loading ? onClick : undefined}
        style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px', borderRadius: '16px',
            background: urgent ? `${color}10` : 'var(--bg-subtle)',
            border: `1.1px solid ${urgent ? color + '30' : 'var(--border)'}`,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: urgent ? `0 4px 12px ${color}10` : 'none',
            position: 'relative',
        }}
        onMouseEnter={e => { 
            if (!loading) {
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.background = urgent ? `${color}15` : 'white';
                e.currentTarget.style.boxShadow = urgent ? `0 8px 20px ${color}20` : 'var(--shadow-md)';
                e.currentTarget.style.borderColor = color;
            }
        }}
        onMouseLeave={e => { 
            e.currentTarget.style.transform = 'translateX(0)'; 
            e.currentTarget.style.background = urgent ? `${color}10` : 'var(--bg-subtle)';
            e.currentTarget.style.boxShadow = urgent ? `0 4px 12px ${color}10` : 'none';
            e.currentTarget.style.borderColor = urgent ? color + '30' : 'var(--border)';
        }}
    >
        {onDismiss && (
            <button
                onClick={e => { e.stopPropagation(); onDismiss(); }}
                title="Απόρριψη"
                style={{
                    position: 'absolute', top: '6px', right: '6px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: 'none', background: 'rgba(0,0,0,0.06)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: 0,
                    opacity: 0, transition: 'opacity 0.2s',
                }}
                className="action-dismiss-btn"
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
            >
                <X size={10} color="#64748b" />
            </button>
        )}
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
const ActionCenter = ({ pendingCount = 0, recoveryLog = [], recoveryInsights = {}, token, onNavigate, clinic }) => {
    const [sending, setSending] = useState({});
    const [retryingAll, setRetryingAll] = useState(false);
    const [showReply, setShowReply] = useState(false);
    const [dismissed, setDismissed] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem('actionCenterDismissed') || '[]')); } catch { return new Set(); }
    });

    const toggleDismiss = (key) => {
        setDismissed(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            localStorage.setItem('actionCenterDismissed', JSON.stringify([...next]));
            return next;
        });
    };

    const { staleNoReply = [], patientEngaged = [], failedSms: failedInsights = [], callbackRequested = [], summary = {} } = recoveryInsights;
    const logs = Array.isArray(recoveryLog) ? recoveryLog : [];

    // Get average appointment value from clinic config (default to 80€)
    const avgAppointmentValue = (() => {
        try {
            const ai = typeof clinic?.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic?.aiConfig || {});
            return parseFloat(ai.avgAppointmentValue) || 80;
        } catch { return 80; }
    })();

    const failedSmsCount = summary.failedCount ?? logs.filter(l => l?.smsStatus === 'failed').length;
    const patientRepliedCount = summary.engagedCount ?? 0;
    const staleCount = summary.staleCount ?? 0;
    const callbackCount = summary.callbackCount ?? 0;

    // Pipeline stats — reset every Monday 00:00
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const missedThisWeek = logs.filter(l => l && new Date(l.createdAt) >= weekStart).length;
    const activeRecoveries = logs.filter(l => l && l.status === 'RECOVERING').length;
    const awaitingReply = logs.filter(l => l && l.status === 'RECOVERING' && l.smsStatus === 'sent').length;

    const actions = [
        { key: 'stale', count: staleCount },
        { key: 'replied', count: patientRepliedCount },
        { key: 'failedSms', count: failedSmsCount },
        { key: 'callback', count: callbackCount },
        { key: 'pending', count: pendingCount > 0 ? 1 : 0 },
    ];
    const visibleActions = actions.filter(a => !dismissed.has(a.key));
    const urgentCount = visibleActions.reduce((sum, a) => sum + a.count, 0);

    const retryFailedSms = async () => {
        const toRetry = failedInsights.length > 0 ? failedInsights : logs.filter(l => l && l.smsStatus === 'failed');
        if (!toRetry.length) return;
        setRetryingAll(true);
        let retried = 0;
        for (const mc of toRetry.slice(0, 10)) {
            try {
                await api.post('/recovery/' + mc.id + '/retry');
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
                await api.post(`/recovery/${mc.id}/followup`);
                sent++;
            } catch { /* continue */ }
        }
        setSending(s => ({ ...s, followup: false }));
        if (sent > 0) toast.success(`Follow-up SMS εστάλη σε ${sent} ασθενείς`);
        else toast.error('Αποτυχία αποστολής follow-up');
    };

    const handleBatchConfirm = async () => {
        if (!patientEngaged.length) return;
        setSending(s => ({ ...s, batchConfirm: true }));
        try {
            const resp = await api.post('/recovery/batch-confirm');
            if (resp.data.success) {
                if (resp.data.count > 0) {
                    toast.success(`${resp.data.count} ραντεβού κατοχυρώθηκαν και επιβεβαιώθηκαν αυτόματα!`, {
                        duration: 5000
                    });
                    if (onNavigate) onNavigate('appointments');
                } else {
                    // If none were ready, fall back to manual reply
                    setShowReply(true);
                    toast('Κανένα έτοιμο ραντεβού — απαντήστε χειροκίνητα.');
                }
            }
        } catch (err) {
            toast.error('Σφάλμα κατά την αυτόματη κράτηση.');
            setShowReply(true);
        } finally {
            setSending(s => ({ ...s, batchConfirm: false }));
        }
    };

    return (
        <div className="glass-card animate-fade" style={{ 
            padding: '1.2rem 1.4rem', 
            borderRadius: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.8rem',
            border: '1px solid var(--border)',
            background: 'var(--card-bg)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: urgentCount > 0 ? '0.3rem' : '0' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <AlertCircle size={13} color={urgentCount > 0 ? '#f59e0b' : '#10b981'} />
                    Action Center
                </h3>
                <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '900',
                    padding: '5px 12px',
                    borderRadius: '99px',
                    background: urgentCount > 0
                        ? 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(217,119,6,0.12) 100%)'
                        : 'rgba(16,185,129,0.1)',
                    color: urgentCount > 0 ? '#92400e' : '#15803d',
                    border: `1.5px solid ${urgentCount > 0 ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.2)'}`,
                    animation: urgentCount > 0 ? 'pulse-warning 2.5s ease-in-out infinite' : 'none',
                }}>
                    {urgentCount > 0 ? `${urgentCount} χρειάζονται δράση` : 'Όλα καλά'}
                </span>
            </div>

            {/* Urgent banner when there are actions needed */}
            {urgentCount > 0 && (
                <div style={{
                    padding: '9px 14px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.06) 100%)',
                    border: '1.5px solid rgba(245,158,11,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '0.3rem',
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#f59e0b',
                        boxShadow: '0 0 10px rgba(245,158,11,0.6)',
                        animation: 'pulse-dot 2s ease-in-out infinite',
                        flexShrink: 0
                    }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#78350f', flex: 1 }}>
                        {urgentCount} ενέργει{urgentCount === 1 ? 'α' : 'ες'} χρειάζ{urgentCount === 1 ? 'εται' : 'ονται'} την προσοχή σας
                    </span>
                </div>
            )}

            {/* Urgent actions */}
            {urgentCount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <SectionLabel>Χρειάζεται Δράση</SectionLabel>
                    {!dismissed.has('stale') && staleCount > 0 && (
                        <ActionRow
                            icon={Send}
                            color="#7c3aed"
                            label={`${staleCount} ασθενείς δεν απάντησαν ακόμα`}
                            sublabel={`€${(staleCount * avgAppointmentValue).toLocaleString()} εκτιμώμενα έσοδα σε αναμονή`}
                            cta="Υπενθύμιση"
                            loading={sending.followup}
                            onClick={sendFollowUps}
                            urgent
                            onDismiss={() => toggleDismiss('stale')}
                        />
                    )}
                    {!dismissed.has('replied') && patientRepliedCount > 0 && (
                        <ActionRow
                            icon={Reply}
                            color="#3b82f6"
                            label={`${patientRepliedCount} ασθενείς απάντησαν — επιβεβαιώστε τα ραντεβού`}
                            sublabel="Απάντησαν στο SMS, έτοιμοι για κλείσιμο"
                            cta="Κλείσιμο"
                            loading={sending.batchConfirm}
                            onClick={handleBatchConfirm}
                            urgent
                            onDismiss={() => toggleDismiss('replied')}
                        />
                    )}
                    {!dismissed.has('failedSms') && failedSmsCount > 0 && (
                        <ActionRow
                            icon={RefreshCw}
                            color="#dc2626"
                            label={`${failedSmsCount} αποστολές SMS απέτυχαν`}
                            sublabel={`Απώλεια €${(failedSmsCount * avgAppointmentValue).toLocaleString()} — στείλτε ξανά`}
                            cta="Επανάληψη"
                            loading={retryingAll}
                            onClick={retryFailedSms}
                            urgent
                            onDismiss={() => toggleDismiss('failedSms')}
                        />
                    )}
                    {!dismissed.has('callback') && callbackCount > 0 && (
                        <ActionRow
                            icon={PhoneCall}
                            color="#7c3aed"
                            label={`${callbackCount} ασθενείς ζήτησαν επανάκληση`}
                            sublabel="Εκκρεμεί τηλεφωνική επικοινωνία"
                            cta="Καλέστε"
                            onClick={() => onNavigate && onNavigate('patients')}
                            urgent
                            onDismiss={() => toggleDismiss('callback')}
                        />
                    )}
                    {!dismissed.has('pending') && pendingCount > 0 && (
                        <ActionRow
                            icon={Clock}
                            color="#d97706"
                            label={`⏰ ${pendingCount} ραντεβού χρειάζονται επιβεβαίωση`}
                            sublabel="Επιβεβαιώστε για να μη χαθούν"
                            cta="Δείτε"
                            onClick={() => onNavigate && onNavigate('appointments')}
                            urgent
                            onDismiss={() => toggleDismiss('pending')}
                        />
                    )}
                </div>
            )}

            {urgentCount === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.08) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#065f46' }}>Όλα καλά — κανένα χαμένο ραντεβού!</span>
                </div>
            )}

            {/* Weekly overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <SectionLabel>Εβδομαδιαία Απόδοση</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', gridAutoRows: '1fr' }}>
                    {[
                        { icon: PhoneMissed, color: '#ef4444', value: missedThisWeek, label: 'Χαμένες κλήσεις', tooltip: 'Αναπάντητες κλήσεις αυτή την εβδομάδα' },
                        { icon: Zap, color: '#f59e0b', value: activeRecoveries, label: 'Σε εξέλιξη', tooltip: 'Προσπάθειες ανάκτησης σε εξέλιξη' },
                        { icon: MessageCircle, color: '#6366f1', value: awaitingReply, label: 'Αναμονή', tooltip: 'Αναμένουν απάντηση από τον ασθενή' },
                    ].map(({ icon: Icon, color, value, label, tooltip }) => (
                        <Tooltip key={label} text={tooltip} position="top" style={{ height: '100%' }}>
                            <button
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
                                filter: 'blur(10px)',
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
                        </button>
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
                .action-dismiss-btn { opacity: 0 !important; }
                .action-row:hover .action-dismiss-btn { opacity: 1 !important; }
                @keyframes pulse-warning {
                    0%, 100% { 
                        box-shadow: 0 0 12px rgba(245,158,11,0.15);
                    }
                    50% { 
                        box-shadow: 0 0 20px rgba(245,158,11,0.3);
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
