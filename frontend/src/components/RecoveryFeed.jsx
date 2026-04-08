import React from 'react';
import toast from 'react-hot-toast';
import { MessageSquare, PhoneMissed, CheckCircle2, AlertCircle, Clock, RefreshCw, Reply } from 'lucide-react';
import { getAccessToken } from '../lib/authSession';

// Outcome-focused event config — label comes first
const EVENT = {
    RECOVERED:  { label: 'Ραντεβού κλείστηκε', icon: CheckCircle2, dot: '#10b981', bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.15)' },
    RECOVERING: { label: 'Ασθενής απάντησε',   icon: Reply,        dot: '#3b82f6', bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.15)' },
    DETECTED:   { label: 'Νέα αναπάντητη',     icon: PhoneMissed,  dot: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.12)'  },
    LOST:       { label: 'Δεν απάντησε',        icon: AlertCircle,  dot: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.12)' },
    SMS_SENT:   { label: 'SMS εστάλη',          icon: MessageSquare,dot: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.15)' },
    SMS_FAILED: { label: 'Αποτυχία SMS',        icon: AlertCircle,  dot: '#ef4444', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.2)'   },
    PENDING:    { label: 'SMS εκκρεμεί',        icon: Clock,        dot: '#d97706', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.12)' },
};

// Derive the most meaningful event type from a log entry
const getEvent = (log) => {
    if (log.smsStatus === 'failed') return EVENT.SMS_FAILED;
    if (log.smsStatus === 'pending' || log.smsStatus === 'scheduled') return EVENT.PENDING;
    // Patient replied = RECOVERING + aiConversation has inbound message
    if (log.status === 'RECOVERING') {
        try {
            const conv = log.aiConversation ? JSON.parse(log.aiConversation) : null;
            const hasReply = Array.isArray(conv) && conv.some(m => m.role === 'user' || m.direction === 'inbound' || m.from === 'patient');
            if (hasReply) return EVENT.RECOVERING; // "Ασθενής απάντησε"
        } catch { /* fall through */ }
        if (log.smsStatus === 'sent' || log.smsStatus === 'simulated') return EVENT.SMS_SENT;
    }
    return EVENT[log.status] || EVENT.DETECTED;
};

// Patient display name: prefer name, fall back to masked phone
const patientLabel = (log) => {
    const name = log.patientName || log.patient?.name;
    if (name) {
        const parts = name.trim().split(' ');
        return parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
    }
    const num = log.fromNumber || '';
    const clean = num.replace(/\D/g, '');
    if (clean.length < 6) return 'Άγνωστος';
    const local = clean.startsWith('30') ? clean.slice(2) : clean;
    return local.length >= 7
        ? `+30 ${local.slice(0, 3)} *** ${local.slice(-4)}`
        : `+30 ${local.slice(0, 3)}***`;
};

const fmtTime = (dateStr) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return '';
        const diff = Math.floor((Date.now() - d) / 1000);
        if (diff < 60) return 'τώρα';
        if (diff < 3600) return `${Math.floor(diff / 60)}λ`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}ω`;
        return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
    } catch { return ''; }
};

const RecoveryFeed = ({ logs = [], token }) => {
    const [retrying, setRetrying] = React.useState({});

    const handleRetry = async (logId) => {
        if (retrying[logId]) return;
        setRetrying(r => ({ ...r, [logId]: 'retrying' }));
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
        const authToken = token || getAccessToken();
        if (!authToken) { toast.error('Session expired.'); return; }
        try {
            const res = await fetch(`${API_BASE}/recovery/${logId}/retry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }
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

    const sorted = Array.isArray(logs)
        ? [...logs].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 5)
        : [];

    if (sorted.length === 0) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '2rem 1rem', textAlign: 'center', gap: '0.5rem',
                borderRadius: '14px',
                background: 'var(--bg-subtle)',
                border: '1px dashed var(--border)'
            }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PhoneMissed size={16} color="#10b981" />
                </div>
                <p style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-light)', margin: 0 }}>Σύστημα έτοιμο</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 4px rgba(16,185,129,0.5)' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: '700', color: '#059669' }}>Παρακολούθηση ενεργή</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {sorted.map((log) => {
                const ev = getEvent(log);
                const Icon = ev.icon;
                const name = patientLabel(log);
                const isFailed = log.smsStatus === 'failed';

                return (
                    <div key={log.id} className="animate-fade" style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '0.38rem 0.7rem', borderRadius: '9px',
                        background: ev.bg, border: `1px solid ${ev.border}`,
                    }}>
                        {/* dot */}
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: ev.dot, flexShrink: 0, boxShadow: `0 0 4px ${ev.dot}70` }} />
                        {/* event label — primary */}
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--secondary)', whiteSpace: 'nowrap' }}>
                            {ev.label}
                        </span>
                        {/* separator */}
                        <span style={{ fontSize: '0.65rem', color: '#cbd5e1', flexShrink: 0 }}>–</span>
                        {/* patient name — secondary */}
                        <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                        </span>
                        {/* time */}
                        <span style={{ fontSize: '0.6rem', color: '#b0bec5', fontWeight: '500', flexShrink: 0 }}>
                            {fmtTime(log.updatedAt || log.createdAt)}
                        </span>
                        {/* retry on failed */}
                        {isFailed && (
                            <button
                                onClick={() => handleRetry(log.id)}
                                disabled={!!retrying[log.id]}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '3px',
                                    padding: '2px 8px', borderRadius: '5px', flexShrink: 0,
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    background: retrying[log.id] === 'sent' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                                    color: retrying[log.id] === 'sent' ? '#059669' : '#dc2626',
                                    fontSize: '0.6rem', fontWeight: '800',
                                    cursor: retrying[log.id] ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <RefreshCw size={8} />
                                {retrying[log.id] === 'retrying' ? '...' : retrying[log.id] === 'sent' ? '✓' : 'Retry'}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default RecoveryFeed;
