import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, PhoneMissed, CheckCircle2, Send, Reply, Zap, Clock, AlertCircle, Loader } from 'lucide-react';

const EVENT_META = {
    SMS_SENT:            { icon: Send,         color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  label: 'SMS εστάλη' },
    MISSED_CALL:         { icon: PhoneMissed,  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Αναπάντητη κλήση' },
    RECOVERY_SENT:       { icon: MessageSquare,color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Στάλθηκε SMS αυτόματης απάντησης' },
    APPOINTMENT_CONFIRMED:{ icon: CheckCircle2,color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Κλείστηκε ραντεβού (Ανάκτηση)' },
    PATIENT_REPLIED:     { icon: Reply,        color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Ασθενής απάντησε' },
    RECOVERING:          { icon: Zap,          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Σε εξέλιξη' },
};

const SMS_STATUS_BADGE = {
    sent:       { label: 'Εστάλη',      color: '#059669', bg: 'rgba(16,185,129,0.12)', icon: CheckCircle2 },
    simulated:  { label: 'Προσομοίωση', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  icon: Zap },
    pending:    { label: 'Εκκρεμεί',    color: '#d97706', bg: 'rgba(245,158,11,0.1)',  icon: Clock },
    processing: { label: 'Επεξεργασία', color: '#2563eb', bg: 'rgba(59,130,246,0.1)',  icon: Loader },
    failed:     { label: 'Απέτυχε',     color: '#dc2626', bg: 'rgba(239,68,68,0.1)',   icon: AlertCircle },
};

const fmtTime = (dateStr) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return '--';
        const diff = Math.floor((Date.now() - d) / 1000);
        if (diff < 60) return `${diff}δ`;
        if (diff < 3600) return `${Math.floor(diff / 60)}λ`;
        return d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    } catch { return '--'; }
};

const maskPhone = (phone) => {
    if (!phone) return '—';
    const s = phone.replace(/\s/g, '');
    if (s.length < 6) return s;
    return s.slice(0, 4) + 'XXXX' + s.slice(-2);
};

// Build entries from real recovery log only — no fake demo data
const buildEntries = (logs) => {
    if (!Array.isArray(logs) || logs.length === 0) return [];
    return logs.slice(0, 6).flatMap((l) => {
        const entries = [];
        if (l.status === 'RECOVERING' || l.status === 'RECOVERED') {
            entries.push({ id: `${l.id}-miss`, type: 'MISSED_CALL', phone: l.fromNumber, time: l.createdAt });
            entries.push({ id: `${l.id}-sms`, type: 'RECOVERY_SENT', phone: l.fromNumber, time: l.updatedAt || l.createdAt, smsStatus: l.smsStatus, smsError: l.smsError });
        }
        if (l.status === 'RECOVERED') {
            entries.push({ id: `${l.id}-conf`, type: 'APPOINTMENT_CONFIRMED', phone: l.fromNumber, time: l.updatedAt || l.createdAt });
        }
        if (l.status === 'DETECTED') {
            entries.push({ id: `${l.id}-miss`, type: 'MISSED_CALL', phone: l.fromNumber, time: l.createdAt });
        }
        return entries;
    }).slice(0, 7);
};


const fmtAgo = (dateStr) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return null;
        const diff = Math.floor((Date.now() - d) / 1000);
        if (diff < 60) return 'μόλις τώρα';
        if (diff < 3600) return `${Math.floor(diff / 60)} λεπτά πριν`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ώρες πριν`;
        return `${Math.floor(diff / 86400)} μέρες πριν`;
    } catch { return null; }
};

const AutomationLog = ({ logs = [], onTestRecovery }) => {
    const entries = buildEntries(logs);

    // Flash when a new entry arrives
    const prevCount = useRef(entries.length);
    const [flashing, setFlashing] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (entries.length > prevCount.current) {
            setFlashing(false);
            requestAnimationFrame(() => requestAnimationFrame(() => setFlashing(true)));
            setToast('+1 ανάκτηση εντοπίστηκε');
            const t = setTimeout(() => { setFlashing(false); setToast(null); }, 2200);
            return () => clearTimeout(t);
        }
        prevCount.current = entries.length;
    }, [entries.length]);

    // Most recent activity across all logs
    const lastActivityDate = Array.isArray(logs) && logs.length > 0
        ? logs.reduce((latest, l) => {
            const t = new Date(l.updatedAt || l.createdAt);
            return t > latest ? t : latest;
        }, new Date(0))
        : null;
    const lastActivityLabel = lastActivityDate && lastActivityDate > new Date(0)
        ? fmtAgo(lastActivityDate)
        : null;

    return (
        <div className={`grid-cell-glass${flashing ? ' recovery-flash' : ''}`} style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.5)',
            padding: '1.1rem 1.25rem',
            boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Toast */}
            {toast && (
                <div className="recovery-toast" style={{
                    position: 'absolute', top: '10px', right: '10px',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '4px 10px', borderRadius: '99px',
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.35)',
                    color: '#059669', fontSize: '0.68rem', fontWeight: 800,
                    zIndex: 10, backdropFilter: 'blur(8px)',
                }}>
                    <CheckCircle2 size={11} />
                    {toast}
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Automation Activity
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                    LIVE
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, overflowY: 'auto' }}>
                {entries.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        flex: 1, padding: '1.5rem 1rem', textAlign: 'center', gap: '0.6rem'
                    }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: 'rgba(99,102,241,0.08)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', marginBottom: '2px'
                        }}>
                            <Zap size={18} color="#6366f1" />
                        </div>
                        <p style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', margin: 0 }}>
                            Καμία δραστηριότητα ακόμα
                        </p>
                        <p style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '500', margin: 0, lineHeight: 1.5 }}>
                            Δοκιμάστε την ανάκτηση για να δείτε<br />το σύστημα σε δράση.
                        </p>
                        {onTestRecovery && (
                            <button
                                onClick={onTestRecovery}
                                style={{
                                    marginTop: '4px',
                                    padding: '6px 14px',
                                    borderRadius: '9px',
                                    border: '1px solid rgba(99,102,241,0.3)',
                                    background: 'rgba(99,102,241,0.08)',
                                    color: '#6366f1',
                                    fontSize: '0.7rem',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.16)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                            >
                                Δοκιμή Recovery SMS →
                            </button>
                        )}
                    </div>
                ) : entries.map((entry) => {
                    const meta = EVENT_META[entry.type] || EVENT_META['SMS_SENT'];
                    const Icon = meta.icon;

                    // For RECOVERY_SENT, override color based on smsStatus
                    let rowColor = meta.color;
                    let rowBg = meta.bg;
                    if (entry.type === 'RECOVERY_SENT' && entry.smsStatus) {
                        if (entry.smsStatus === 'sent') { rowColor = '#059669'; rowBg = 'rgba(16,185,129,0.1)'; }
                        else if (entry.smsStatus === 'failed') { rowColor = '#dc2626'; rowBg = 'rgba(239,68,68,0.1)'; }
                        else if (entry.smsStatus === 'pending' || entry.smsStatus === 'scheduled') { rowColor = '#d97706'; rowBg = 'rgba(245,158,11,0.1)'; }
                    }
                    return (
                        <div key={entry.id} className="animate-fade" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '7px 10px',
                            borderRadius: '10px',
                            background: rowBg,
                            border: `1px solid ${rowBg.replace('0.1', '0.2')}`,
                        }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                                <Icon size={12} color={rowColor} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {meta.label}
                                </p>
                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0, fontWeight: '600' }}>
                                    {maskPhone(entry.phone)}
                                </p>
                                {entry.smsStatus === 'failed' && entry.smsError && (
                                    <p style={{ fontSize: '0.6rem', color: '#dc2626', margin: '2px 0 0', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {entry.smsError}
                                    </p>
                                )}
                            </div>
                            {entry.smsStatus && SMS_STATUS_BADGE[entry.smsStatus] && (() => {
                                const badge = SMS_STATUS_BADGE[entry.smsStatus];
                                const BadgeIcon = badge.icon;
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '6px', background: badge.bg, flexShrink: 0 }}>
                                        <BadgeIcon size={9} color={badge.color} />
                                        <span style={{ fontSize: '0.6rem', fontWeight: '800', color: badge.color }}>{badge.label}</span>
                                    </div>
                                );
                            })()}
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '700', flexShrink: 0 }}>
                                {fmtTime(entry.time)}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Footer — last activity */}
            <div style={{
                marginTop: '0.6rem', paddingTop: '0.5rem',
                borderTop: '1px solid rgba(0,0,0,0.05)',
                display: 'flex', alignItems: 'center', gap: '5px'
            }}>
                <div style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: lastActivityLabel ? '#10b981' : '#94a3b8',
                    boxShadow: lastActivityLabel ? '0 0 5px rgba(16,185,129,0.5)' : 'none',
                }} />
                <span style={{ fontSize: '0.63rem', color: '#94a3b8', fontWeight: '600' }}>
                    {lastActivityLabel
                        ? `Τελευταία ανάκτηση: ${lastActivityLabel}`
                        : 'Παρακολούθηση κλήσεων...'}
                </span>
            </div>
        </div>
    );
};

export default AutomationLog;
