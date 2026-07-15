import React from 'react';
import { API_BASE } from '../lib/constants';
import toast from 'react-hot-toast';
import { PhoneMissed, RefreshCw, Phone, PhoneCall, MessageSquare, AlertCircle, CheckCircle, Reply, Clock, Link, Calendar, Bot, UserCheck, MoreHorizontal, Check, MessageSquare as MessageSquareIcon, Phone as PhoneIcon, Eye } from 'lucide-react';
import ActionPanel from './ActionPanel';
import { getEvent, getPatientLabel, formatTime, getReplyPreview, getRevenue, getInitials, EVENT_TYPES } from '../lib/recoveryUtils';

const STATUS_ICONS = {
    RECOVERED: CheckCircle,
    RECOVERING: Reply,
    DETECTED: PhoneMissed,
    LOST: AlertCircle,
    SMS_SENT: MessageSquare,
    SMS_FAILED: AlertCircle,
    PENDING: Clock,
    VOICE_CALL: Phone,
    VOICE_ANSWERED: PhoneCall,
};

const NEW_EVENT_CONFIG = {
    APPOINTMENT_BOOKED_VIA_LINK: { icon: Link, label: 'Ραντεβού από δημόσιο σύνδεσμο', dot: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    APPOINTMENT_BOOKED_VIA_SMS: { icon: MessageSquare, label: 'Ραντεβού από SMS', dot: '#4f46e5', bg: 'rgba(79,70,229,0.08)', border: 'rgba(79,70,229,0.2)' },
    APPOINTMENT_BOOKED_VIA_CALL: { icon: Phone, label: 'Ραντεβού από κλήση', dot: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)' },
    AI_CALL_ANSWERED: { icon: Bot, label: 'AI κλήση απαντήθηκε', dot: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    MISSED_CALL_DETECTED: { icon: PhoneMissed, label: 'Αναπάντητη κλήση', dot: '#dc2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.15)' },
    PATIENT_REPLIED: { icon: Reply, label: 'Ασθενής απάντησε', dot: '#4f46e5', bg: 'rgba(79,70,229,0.08)', border: 'rgba(79,70,229,0.2)' },
    INBOUND_SMS_RECEIVED: { icon: MessageSquare, label: 'Μήνυμα ασθενούς', dot: '#4f46e5', bg: 'rgba(79,70,229,0.08)', border: 'rgba(79,70,229,0.2)' },
    CASE_RECOVERED: { icon: CheckCircle, label: 'Ανάκτηση κλήσης', dot: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    CASE_CLOSED: { icon: AlertCircle, label: 'Υπόθεση έκλεισε', dot: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' },
};

function normalizeItem(log) {
    if (log.type) {
        const cfg = NEW_EVENT_CONFIG[log.type];
        return {
            id: log.id,
            type: log.type,
            cfg,
            IconComponent: cfg?.icon || Clock,
            name: log.patientName || (log.phone ? formatPhone(log.phone) : 'Άγνωστος'),
            sub: log.title || cfg?.label || '',
            time: formatTime(log.createdAt),
            rawDate: log.createdAt,
            isNewFormat: true,
            appointmentId: log.appointmentId || null,
            missedCallId: log.missedCallId || null,
            patientId: log.patientId || null,
            phone: log.phone || null,
            estimatedRevenue: log.estimatedRevenue || null,
        };
    }
    const event = getEvent(log);
    const eventKey = Object.entries(EVENT_TYPES).find(([, v]) => v === event)?.[0] || log.status;
    const IconComponent = STATUS_ICONS[eventKey] || PhoneMissed;
    const name = getPatientLabel(log);
    const replyPreview = getReplyPreview(log);
    return {
        id: log.id,
        type: log.status,
        cfg: event,
        IconComponent,
        name,
        sub: replyPreview || event.label,
        time: formatTime(log.updatedAt || log.createdAt),
        rawDate: log.updatedAt || log.createdAt,
        isNewFormat: false,
        raw: log,
        eventKey,
    };
}

function formatPhone(num) {
    if (!num) return 'Άγνωστος';
    const clean = num.replace(/\D/g, '');
    if (clean.length < 6) return 'Άγνωστος';
    const local = clean.startsWith('30') ? clean.slice(2) : clean;
    return local.length >= 7 ? `+30 ${local.slice(0, 3)} *** ${local.slice(-4)}` : `+30 ${local.slice(0, 3)}***`;
}

const RecoveryFeed = ({ logs = [], token, onNavigate, avgAppointmentValue = 80, recoveryLog = [] }) => {
    const [retrying, setRetrying] = React.useState({});
    const [selected, setSelected] = React.useState(null);
    const [selectedMissedCall, setSelectedMissedCall] = React.useState(null);
    const [fetchingLog, setFetchingLog] = React.useState(false);
    const [dismissed, setDismissed] = React.useState(() => {
        try {
            const saved = localStorage.getItem('feed_dismissed:v1');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch { return new Set(); }
    });

    // Swipe actions state
    const [swipeOffset, setSwipeOffset] = React.useState({});
    const [swipingId, setSwipingId] = React.useState(null);

    const SWIPE_THRESHOLD = 80;
    const SWIPE_MAX = 180;

    const handleItemClick = React.useCallback(async (item) => {
        if (!item.isNewFormat && item.raw) {
            setSelected(item.raw);
            return;
        }
        if (item.appointmentId) {
            if (onNavigate) onNavigate('appointments');
            return;
        }
        if (item.missedCallId) {
            const found = (Array.isArray(recoveryLog) ? recoveryLog : []).find(l => l.id === item.missedCallId);
            if (found) {
                setSelectedMissedCall(found);
                return;
            }
            setFetchingLog(true);
            try {
                const res = await fetch(`${API_BASE}/recovery/${item.missedCallId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSelectedMissedCall(data);
                } else {
                    toast.error('Δεν βρέθηκε η κλήση');
                }
            } catch {
                toast.error('Σφάλμα σύνδεσης');
            } finally {
                setFetchingLog(false);
            }
            return;
        }
        if (item.phone && onNavigate) {
            onNavigate('patients');
        }
    }, [recoveryLog, token, onNavigate]);

    const dismissAll = (ids) => {
        const next = new Set(ids);
        setDismissed(next);
        try { localStorage.setItem('feed_dismissed:v1', JSON.stringify([...next])); } catch {}
    };

const handleRetry = async (logId, e) => {
        e.stopPropagation();
        if (retrying[logId]) return;
        setRetrying(r => ({ ...r, [logId]: 'retrying' }));
        if (!token) { toast.error('Η σύνδεση έληξε. Παρακαλώ συνδεθείτε ξανά.'); return; }
        try {
            const res = await fetch(`${API_BASE}/recovery/${logId}/retry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            const status = data.data?.smsStatus === 'sent' ? 'sent' : 'failed';
            setRetrying(r => ({ ...r, [logId]: status }));
            if (status === 'sent') toast.success('Το SMS στάλθηκε!');
            else toast.error('Αποτυχία — ελέγξτε ρυθμίσεις');
        } catch {
            setRetrying(r => ({ ...r, [logId]: 'failed' }));
            toast.error('Σφάλμα σύνδεσης');
        } finally {
            setTimeout(() => setRetrying(r => { const n = { ...r }; delete n[logId]; return n; }), 3000);
        }
    };

    const handleTouchStart = (e, itemId) => {
        setSwipingId(itemId);
        setSwipeOffset(prev => ({ ...prev, [itemId]: { startX: e.touches?.[0].clientX ?? e.clientX, currentX: 0 } }));
    };

    const handleTouchMove = (e, itemId) => {
        if (swipingId !== itemId) return;
        const clientX = e.touches?.[0].clientX ?? e.clientX;
        const startX = swipeOffset[itemId]?.startX ?? clientX;
        const deltaX = clientX - startX;
        const clamped = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, deltaX));
        setSwipeOffset(prev => ({ ...prev, [itemId]: { startX, currentX: clamped } }));
    };

    const handleTouchEnd = (itemId, item) => {
        if (swipingId !== itemId) return;
        const offset = swipeOffset[itemId]?.currentX ?? 0;
        
        if (offset > SWIPE_THRESHOLD) {
            // Swipe right - Call / View
            handleSwipeAction('right', item);
        } else if (offset < -SWIPE_THRESHOLD) {
            // Swipe left - Mark Recovered / Follow-up
            handleSwipeAction('left', item);
        }
        
        // Animate back to 0
        setSwipeOffset(prev => ({ ...prev, [itemId]: { ...prev[itemId], currentX: 0 } }));
        setTimeout(() => {
            setSwipeOffset(prev => { const n = { ...prev }; delete n[itemId]; return n; });
            setSwipingId(null);
        }, 300);
    };

    const handleSwipeAction = (direction, item) => {
        if (!item.isNewFormat && item.raw) {
            const log = item.raw;
            if (direction === 'right') {
                // Call patient
                if (log.phone && token) {
                    fetch(`${API_BASE}/recovery/call`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ missedCallId: log.id, phone: log.phone })
                    }).then(r => r.json()).then(d => {
                        if (d.success) toast.success('Κλήση ξεκίνησε!');
                        else toast.error('Αποτυχία κλήσης');
                    }).catch(() => toast.error('Σφάλμα κλήσης'));
                }
            } else if (direction === 'left') {
                // Mark recovered + follow-up
                if (log.id && token) {
                    fetch(`${API_BASE}/recovery/${log.id}/mark-recovered`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
                    }).then(r => r.json()).then(d => {
                        if (d.success) {
                            toast.success('Σημαντεύτηκε ως ανακτημένη!');
                            // Trigger follow-up SMS
                            fetch(`${API_BASE}/recovery/${log.id}/followup`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
                            });
                        } else toast.error('Αποτυχία');
                    }).catch(() => toast.error('Σφάλμα'));
                }
            }
        }
    };

    const normalized = (Array.isArray(logs) ? [...logs] : [])
        .map(normalizeItem)
        .sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate))
        .slice(0, 15);
    const filtered = normalized.filter(l => !dismissed.has(l.id));

    const rawLogs = Array.isArray(logs) ? logs : [];
    const publicLinkBookings = rawLogs.filter(l => l.type === 'APPOINTMENT_BOOKED_VIA_LINK').length;
    const revenue = rawLogs
        .filter(l => l.type === 'APPOINTMENT_BOOKED_VIA_LINK')
        .reduce((sum, l) => sum + (l.estimatedRevenue || avgAppointmentValue), 0);
    const missedCalls = rawLogs.filter(l => l.type === 'MISSED_CALL_DETECTED').length;
    const smsEvents = rawLogs.filter(l => ['APPOINTMENT_BOOKED_VIA_SMS', 'INBOUND_SMS_RECEIVED', 'PATIENT_REPLIED'].includes(l.type)).length;
    const aiCalls = rawLogs.filter(l => l.type === 'AI_CALL_ANSWERED').length;

    if (normalized.length === 0) {
        return (
            <div className="feed-empty">
                <div className="empty-icon">
                    <PhoneMissed size={20} />
                </div>
                <p className="empty-title">Δεν υπάρχει δραστηριότητα</p>
                <div className="empty-status">
                    <span className="status-dot" />
                    <span>Σε αναμονή</span>
                </div>
            </div>
        );
    }

    const getActionBackground = (item) => {
        if (item.isNewFormat) return item.cfg?.bg || 'transparent';
        const key = item.eventKey;
        if (key === 'RECOVERED') return 'rgba(147,51,234,0.09)';
        if (key === 'RECOVERING') return 'var(--success-light)';
        if (key === 'LOST') return 'var(--error-light)';
        if (key === 'SMS_FAILED') return 'var(--error-light)';
        if (key === 'SMS_SENT') return 'var(--warning-light)';
        if (key === 'VOICE_CALL') return 'rgba(139,92,246,0.08)';
        if (key === 'VOICE_ANSWERED') return 'var(--success-light)';
        if (key === 'PENDING') return 'var(--warning-light)';
        if (item.raw?.status === 'DETECTED') return 'var(--error-light)';
        return filtered.indexOf(item) % 2 === 0 ? 'var(--glass-surface)' : 'transparent';
    };

    const getOutcomeBadge = (item) => {
        if (item.isNewFormat) {
            const typeBadges = {
                APPOINTMENT_BOOKED_VIA_LINK: { text: 'Δημόσιος σύνδεσμος', bg: 'rgba(16,185,129,0.12)', color: '#059669', border: 'rgba(16,185,129,0.25)' },
                APPOINTMENT_BOOKED_VIA_SMS: { text: 'Από SMS', bg: 'rgba(79,70,229,0.12)', color: '#4f46e5', border: 'rgba(79,70,229,0.2)' },
                APPOINTMENT_BOOKED_VIA_CALL: { text: 'Από κλήση', bg: 'rgba(99,102,241,0.12)', color: '#6366f1', border: 'rgba(99,102,241,0.2)' },
                AI_CALL_ANSWERED: { text: 'AI κλήση', bg: 'rgba(16,185,129,0.12)', color: '#059669', border: 'rgba(16,185,129,0.25)' },
                MISSED_CALL_DETECTED: { text: 'Αναπάντητη', bg: 'rgba(220,38,38,0.1)', color: '#dc2626', border: 'rgba(220,38,38,0.2)' },
                PATIENT_REPLIED: { text: 'Απάντησε', bg: 'rgba(79,70,229,0.12)', color: '#4f46e5', border: 'rgba(79,70,229,0.2)' },
            };
            const badge = typeBadges[item.type];
            if (!badge) return null;
            return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>{badge.text}</span>;
        }
        const key = item.eventKey;
        if (key === 'RECOVERED') return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'var(--success-light)', color: 'var(--accent)', border: '1px solid rgba(16,185,129,0.25)' }}>Κλείστηκε</span>;
        if (key === 'RECOVERING') return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid rgba(99,91,255,0.2)' }}>Ενεργό</span>;
        if (key === 'LOST') return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'var(--error-light)', color: 'var(--urgent)', border: '1px solid rgba(239,68,68,0.2)' }}>Χάθηκε</span>;
        if (key === 'SMS_FAILED') return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'var(--error-light)', color: 'var(--urgent)', border: '1px solid rgba(239,68,68,0.2)' }}>Απέτυχε</span>;
        if (key === 'VOICE_CALL') return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'rgba(139,92,246,0.12)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.2)' }}>Κλήση</span>;
        if (key === 'SMS_SENT') return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'var(--warning-light)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)' }}>Εστάλη</span>;
        if (key === 'PENDING') return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'var(--warning-light)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)' }}>Εκκρεμεί</span>;
        return null;
    };

    return (
        <div className="feed-container">
            <div className="feed-stats-row">
                <div className="feed-stat" style={{ '--stat-color': '#4f46e5' }}>
                    <span className="feed-stat-value">€{revenue}</span>
                    <span className="feed-stat-label">Έσοδα ανάκτησης</span>
                </div>
                <div className="feed-stat" style={{ '--stat-color': '#dc2626' }}>
                    <span className="feed-stat-value">{missedCalls}</span>
                    <span className="feed-stat-label">Αναπάντητες</span>
                </div>
                <div className="feed-stat" style={{ '--stat-color': '#10b981' }}>
                    <span className="feed-stat-value">{smsEvents}</span>
                    <span className="feed-stat-label">Μηνύματα SMS</span>
                </div>
                <div className="feed-stat" style={{ '--stat-color': '#6366f1' }}>
                    <span className="feed-stat-value">{aiCalls}</span>
                    <span className="feed-stat-label">Κλήσεις AI</span>
                </div>
            </div>
            <div className="feed-list">
                {filtered.map((item) => {
        const offset = swipeOffset[item.id]?.currentX ?? 0;
        const isSwiping = swipingId === item.id;
        const showLeftActions = offset < -SWIPE_THRESHOLD;
        const showRightActions = offset > SWIPE_THRESHOLD;

        return (
            <div
                key={item.id}
                className="feed-item"
                style={{
                    borderLeftColor: item.cfg?.dot || (item.raw?.status === 'DETECTED' ? '#ef4444' : 'var(--primary)'),
                    backgroundColor: getActionBackground(item),
                    transform: isSwiping ? `translateX(${offset}px)` : undefined,
                    transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: isSwiping ? 10 : 1,
                }}
                onTouchStart={(e) => handleTouchStart(e, item.id)}
                onTouchMove={(e) => handleTouchMove(e, item.id)}
                onTouchEnd={() => handleTouchEnd(item.id, item)}
                onMouseDown={(e) => handleTouchStart(e, item.id)}
                onMouseMove={(e) => {
                    if (swipingId === item.id) handleTouchMove(e, item.id);
                }}
                onMouseUp={() => handleTouchEnd(item.id, item)}
                onMouseLeave={() => handleTouchEnd(item.id, item)}
                onClick={() => !isSwiping && handleItemClick(item)}
            >
                {/* Swipe Left Actions (Mark Recovered / Follow-up) */}
                <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: SWIPE_MAX,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    paddingLeft: '16px',
                    background: 'linear-gradient(90deg, var(--success) 0%, var(--success) 100%)',
                    borderRadius: '12px 0 0 12px',
                    opacity: offset < 0 ? Math.min(1, Math.abs(offset) / SWIPE_THRESHOLD) : 0,
                    pointerEvents: 'none',
                    zIndex: -1,
                }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleSwipeAction('left', item); }}
                            style={{
                                padding: '8px 12px', borderRadius: '8px', border: 'none',
                                background: 'rgba(255,255,255,0.2)', color: 'white',
                                fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                backdropFilter: 'blur(4px)',
                            }}
                        >
                            <Check size={12} /> <span style={{fontSize:'0.65rem'}}>Ανακτήθηκε</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleSwipeAction('left', item); }}
                            style={{
                                padding: '8px 12px', borderRadius: '8px', border: 'none',
                                background: 'rgba(255,255,255,0.2)', color: 'white',
                                fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                backdropFilter: 'blur(4px)',
                            }}
                        >
                            <MessageSquareIcon size={12} /> <span style={{fontSize:'0.65rem'}}>Follow-up</span>
                        </button>
                    </div>
                </div>

                {/* Swipe Right Actions (Call / View) */}
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: SWIPE_MAX,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: '16px',
                    background: 'linear-gradient(270deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                    borderRadius: '0 12px 12px 0',
                    opacity: offset > 0 ? Math.min(1, offset / SWIPE_THRESHOLD) : 0,
                    pointerEvents: 'none',
                    zIndex: -1,
                }}>
                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'row-reverse' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleSwipeAction('right', item); }}
                            style={{
                                padding: '8px 12px', borderRadius: '8px', border: 'none',
                                background: 'rgba(255,255,255,0.2)', color: 'white',
                                fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                backdropFilter: 'blur(4px)',
                            }}
                        >
                            <PhoneIcon size={12} /> <span style={{fontSize:'0.65rem'}}>Καλέστε</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleSwipeAction('right', item); }}
                            style={{
                                padding: '8px 12px', borderRadius: '8px', border: 'none',
                                background: 'rgba(255,255,255,0.2)', color: 'white',
                                fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                backdropFilter: 'blur(4px)',
                            }}
                        >
                            <Eye size={12} /> <span style={{fontSize:'0.65rem'}}>Δείτε</span>
                        </button>
                    </div>
                </div>

                <div
                    key={item.id}
                    className="feed-item"
                    style={{
                        borderLeftColor: item.cfg?.dot || (item.raw?.status === 'DETECTED' ? '#ef4444' : 'var(--primary)'),
                        backgroundColor: getActionBackground(item),
                        transform: isSwiping ? `translateX(${offset}px)` : undefined,
                        transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: isSwiping ? 10 : 1,
                    }}
                    onTouchStart={(e) => handleTouchStart(e, item.id)}
                    onTouchMove={(e) => handleTouchMove(e, item.id)}
                    onTouchEnd={() => handleTouchEnd(item.id, item)}
                    onMouseDown={(e) => handleTouchStart(e, item.id)}
                    onMouseMove={(e) => {
                        if (swipingId === item.id) handleTouchMove(e, item.id);
                    }}
                    onMouseUp={() => handleTouchEnd(item.id, item)}
                    onMouseLeave={() => handleTouchEnd(item.id, item)}
                    onClick={() => !isSwiping && handleItemClick(item)}
                >
                        <div className="feed-content">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <div className="feed-name">{item.name}</div>
                                {getOutcomeBadge(item)}
                            </div>
                            <div className="feed-sub">{item.sub}</div>
                        </div>
                        <div className="feed-right">
                            <span className="feed-time">{item.time}</span>
                            {!item.isNewFormat && item.raw?.status === 'RECOVERED' && (
                                <span className="badge-success">+€{item.raw.estimatedRevenue || 80}</span>
                            )}
                            {!item.isNewFormat && item.raw?.smsStatus === 'failed' && (
                                <button className={`btn-retry ${retrying[item.id]}`} onClick={(e) => handleRetry(item.id, e)} disabled={!!retrying[item.id]}>
                                    {retrying[item.id] === 'retrying' ? '...' : retrying[item.id] === 'sent' ? '✓' : '↻'}
                                </button>
                            )}
                        </div>
                    </div>
                )) }
            </div>

            {selected && (
                <ActionPanel
                    log={selected}
                    token={token}
                    onClose={() => setSelected(null)}
                    onNavigate={onNavigate}
                />
            )}

            {selectedMissedCall && (
                <ActionPanel
                    log={selectedMissedCall}
                    token={token}
                    onClose={() => setSelectedMissedCall(null)}
                    onNavigate={onNavigate}
                />
            )}

            <style>{`
                .feed-container { display: flex; flex-direction: column; height: 100%; min-height: 0; }
                .feed-stats-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; margin-bottom: 10px; }
                .feed-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 6px; border-radius: 12px; background: linear-gradient(135deg, color-mix(in srgb, var(--stat-color) 10%, transparent) 0%, color-mix(in srgb, var(--stat-color) 5%, transparent) 100%); border: 1px solid color-mix(in srgb, var(--stat-color) 20%, transparent); }
                .feed-stat-value { font-size: 1.1rem; font-weight: 950; color: var(--stat-color); letter-spacing: -0.03em; line-height: 1.2; }
                .feed-stat-label { font-size: 0.6rem; font-weight: 700; color: color-mix(in srgb, var(--stat-color) 70%, var(--text)); text-transform: uppercase; letter-spacing: 0.04em; }
                .feed-list { display: flex; flex-direction: column; gap: 5px; flex: 1; min-height: 0; overflow-y: auto; padding-right: 2px; }
                
                .feed-empty { 
                    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; text-align: center; gap: 0.75rem; border-radius: 12px; background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
                }
                .empty-icon { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-light) 0%, rgba(99,91,255,0.1) 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(99,91,255,0.18), inset 0 1px 0 rgba(255,255,255,0.2); }
                .empty-icon svg { color: var(--primary); }
                .empty-title { font-size: 0.8rem; font-weight: 700; color: var(--text); margin: 0; }
                .empty-status { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 10px; background: linear-gradient(135deg, var(--primary-light) 0%, rgba(99,91,255,0.1) 100%); border: 1px solid rgba(99,91,255,0.18); box-shadow: inset 0 1px 0 rgba(255,255,255,0.15); }
                .empty-status .status-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--primary); animation: pulse 2s infinite; }
                .empty-status span { font-size: 0.6rem; font-weight: 700; color: var(--primary); }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(0.9); }
                }
                
                .feed-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); border-left: 3px solid; cursor: pointer; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); position: relative; backdrop-filter: blur(12px); box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
                .feed-item:hover { transform: translateX(4px) translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.09), 0 0 0 1px rgba(255,255,255,0.14) inset; background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.07) 100%) !important; border-color: rgba(255,255,255,0.18); }
                
                .feed-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid; box-shadow: 0 3px 10px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.15); transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
                .feed-item:hover .feed-icon { transform: scale(1.05); box-shadow: 0 5px 14px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2); }
                .feed-content { flex: 1; min-width: 0; }
                .feed-name { font-size: 0.88rem; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
                .feed-sub { font-size: 0.76rem; color: var(--text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; margin-top: 2px; }
                
                .feed-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
                .feed-time { font-size: 0.7rem; color: var(--text-light); font-weight: 600; opacity: 0.7; }
                .badge-success { font-size: 0.7rem; font-weight: 900; padding: 4px 9px; border-radius: 10px; background: linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.1) 100%); color: #059669; border: 1px solid rgba(16,185,129,0.22); box-shadow: 0 2px 8px rgba(16,185,129,0.12), inset 0 1px 0 rgba(255,255,255,0.15); }
                .btn-retry { width: 26px; height: 26px; border-radius: 8px; border: 1px solid rgba(239,68,68,0.22); background: linear-gradient(135deg, rgba(239,68,68,0.14) 0%, rgba(239,68,68,0.07) 100%); color: #dc2626; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 4px rgba(239,68,68,0.1); }
                .btn-retry:hover { transform: scale(1.1); box-shadow: 0 5px 14px rgba(239,68,68,0.22); border-color: rgba(239,68,68,0.3); }
                .btn-retry.sent { background: linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.1) 100%); color: #059669; border-color: rgba(16,185,129,0.22); box-shadow: 0 1px 4px rgba(16,185,129,0.12); }
                .status-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
                
                .feed-list::-webkit-scrollbar { width: 4px; }
                .feed-list::-webkit-scrollbar-track { background: transparent; }
                .feed-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
                .feed-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
            `}</style>
        </div>
    );
};

export default RecoveryFeed;
