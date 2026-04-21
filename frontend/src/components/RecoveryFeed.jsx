import React from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { MessageSquare, PhoneMissed, CheckCircle2, AlertCircle, Clock, RefreshCw, Reply, X, Send, Calendar, User, UserPlus, ChevronRight, Phone, PhoneCall } from 'lucide-react';
import { getAccessToken } from '../lib/authSession';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const EVENT = {
    RECOVERED:  { label: 'Ραντεβού κλείστηκε', icon: CheckCircle2, dot: '#10b981', bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.15)' },
    RECOVERING: { label: 'Ασθενής απάντησε',   icon: Reply,        dot: '#3b82f6', bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.15)' },
    DETECTED:   { label: 'Νέα αναπάντητη',     icon: PhoneMissed,  dot: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.12)'  },
    LOST:       { label: 'Δεν απάντησε',        icon: AlertCircle,  dot: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.12)' },
    SMS_SENT:   { label: 'SMS εστάλη',          icon: MessageSquare,dot: 'var(--primary)', bg: 'var(--primary-light)',  border: 'rgba(0,181,173,0.15)' },
    SMS_FAILED: { label: 'Αποτυχία SMS',        icon: AlertCircle,  dot: '#ef4444', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.2)'   },
    PENDING:    { label: 'SMS εκκρεμεί',        icon: Clock,        dot: 'rgba(0,181,173,0.8)', bg: 'var(--primary-light)',  border: 'rgba(0,181,173,0.12)' },
    VOICE_CALL: { label: 'AI Κλήση εστάλη',     icon: Phone,        dot: '#7c3aed', bg: 'rgba(124,58,237,0.07)', border: 'rgba(124,58,237,0.15)' },
    VOICE_ANSWERED: { label: 'Κλήση απαντήθηκε', icon: PhoneCall,   dot: '#10b981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.15)' },
};

const getEvent = (log) => {
    if (log.smsStatus === 'failed') return EVENT.SMS_FAILED;
    // Voice call detection — check aiConversation for bland_call_id marker
    if (log.smsStatus === 'pending') {
        try {
            const conv = log.aiConversation ? JSON.parse(log.aiConversation) : null;
            const hasVoice = Array.isArray(conv) && conv.some(m => m.role === 'system' && String(m.content || '').startsWith('bland_call_id:'));
            if (hasVoice) return log.status === 'RECOVERED' ? EVENT.VOICE_ANSWERED : EVENT.VOICE_CALL;
        } catch {}
        return EVENT.VOICE_CALL; // pending + voice enabled = voice call
    }
    if (log.smsStatus === 'scheduled') return EVENT.PENDING;
    if (log.status === 'RECOVERING') {
        try {
            const conv = log.aiConversation ? JSON.parse(log.aiConversation) : null;
            const hasReply = Array.isArray(conv) && conv.some(m => m.role === 'user' || m.direction === 'inbound' || m.from === 'patient');
            if (hasReply) return EVENT.RECOVERING;
        } catch { /* fall through */ }
        if (log.smsStatus === 'sent' || log.smsStatus === 'simulated') return EVENT.SMS_SENT;
    }
    return EVENT[log.status] || EVENT.DETECTED;
};

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
    return local.length >= 7 ? `+30 ${local.slice(0, 3)} *** ${local.slice(-4)}` : `+30 ${local.slice(0, 3)}***`;
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

// ─── Action Panel (slide-in from right) ───────────────────────────────────────
const ActionPanel = ({ log, token, onClose, onNavigate }) => {
    const ev = getEvent(log);
    const name = log.patientName || log.patient?.name || log.fromNumber;
    const phone = log.fromNumber;

    const [smsText, setSmsText] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [patientData, setPatientData] = React.useState(log.patient || null);
    const [loadingPatient, setLoadingPatient] = React.useState(false);
    const [savingPatient, setSavingPatient] = React.useState(false);
    const [patientName, setPatientName] = React.useState('');
    const [showNameInput, setShowNameInput] = React.useState(false);
    const authToken = token || getAccessToken();
    const isKnownPatient = !!(log.patient?.id || patientData?.id);

    React.useEffect(() => {
        if (log.patient?.id) {
            setLoadingPatient(true);
            fetch(`${API_BASE}/patients/${log.patient.id}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }).then(r => r.json()).then(d => setPatientData(d)).catch(() => {}).finally(() => setLoadingPatient(false));
        } else if (log.fromNumber) {
            fetch(`${API_BASE}/patients`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }).then(r => r.json()).then(data => {
                const match = Array.isArray(data) ? data.find(p => p.phone === log.fromNumber) : null;
                if (match) setPatientData(match);
            }).catch(() => {});
        }
    }, [log.id]);

    const handleSendSms = async () => {
        if (!smsText.trim() || sending) return;
        setSending(true);
        try {
            if (isKnownPatient) {
                await fetch(`${API_BASE}/messages/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ patientId: log.patient.id, message: smsText.trim() })
                });
            } else {
                // Direct SMS via recovery retry with custom message not supported yet — show info
                toast('Αποθηκεύστε πρώτα τον ασθενή για να στείλετε SMS.');
                setSending(false);
                return;
            }
            toast.success('SMS εστάλη!');
            setSmsText('');
        } catch {
            toast.error('Αποτυχία αποστολής SMS.');
        } finally {
            setSending(false);
        }
    };

    const handleSavePatient = async () => {
        if (!patientName.trim()) { setShowNameInput(true); return; }
        setSavingPatient(true);
        try {
            const res = await fetch(`${API_BASE}/patients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({ name: patientName.trim(), phone })
            });
            const data = await res.json();
            if (data.id) {
                toast.success('Ασθενής αποθηκεύτηκε!');
                setPatientData(data);
                setShowNameInput(false);
            } else {
                toast.error(data.error || 'Σφάλμα αποθήκευσης.');
            }
        } catch {
            toast.error('Σφάλμα σύνδεσης.');
        } finally {
            setSavingPatient(false);
        }
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex' }}>
            {/* Backdrop */}
            <div style={{ flex: 1, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
            {/* Panel */}
            <div style={{
                width: '360px', background: 'var(--modal-bg)', borderLeft: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', overflowY: 'auto',
                boxShadow: '-20px 0 60px rgba(0,0,0,0.15)',
                animation: 'slideInRight 0.2s ease'
            }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ev.dot }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: ev.dot, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ev.label}</span>
                        </div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>{name}</h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', margin: '2px 0 0' }}>{phone}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Patient status */}
                    <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: isKnownPatient ? 'rgba(16,185,129,0.07)' : 'var(--primary-light)', border: `1px solid ${isKnownPatient ? 'rgba(16,185,129,0.2)' : 'rgba(0,181,173,0.2)'}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <User size={16} color={isKnownPatient ? '#10b981' : 'var(--primary)'} />
                        <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: '700', color: isKnownPatient ? '#065f46' : 'var(--primary)' }}>
                                {isKnownPatient ? 'Υπάρχων ασθενής' : 'Νέος / Άγνωστος ασθενής'}
                            </div>
                            {isKnownPatient && patientData?.appointments && (
                                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                                    {patientData.appointments.length} ραντεβού στο ιστορικό
                                </div>
                            )}
                        </div>
                        {!isKnownPatient && !patientData?.id && (
                            <div style={{ marginLeft: 'auto' }}>
                                {showNameInput ? (
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <input
                                            autoFocus
                                            value={patientName}
                                            onChange={e => setPatientName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSavePatient()}
                                            placeholder="Όνομα ασθενή"
                                            style={{ padding: '4px 8px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.75rem', width: '130px', outline: 'none' }}
                                        />
                                        <button onClick={handleSavePatient} disabled={savingPatient} style={{ padding: '4px 10px', borderRadius: '7px', border: 'none', background: '#10b981', color: 'white', fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer' }}>
                                            {savingPatient ? '...' : 'OK'}
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowNameInput(true)} style={{ padding: '4px 10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, rgba(0,181,173,0.78) 0%, rgba(38,198,189,0.6) 100%)', color: 'white', fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <UserPlus size={11} /> Αποθήκευση
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Send SMS */}
                    <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Αποστολή SMS</label>
                        <textarea
                            value={smsText}
                            onChange={e => setSmsText(e.target.value)}
                            placeholder="Γράψτε μήνυμα..."
                            rows={3}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.85rem', resize: 'none', boxSizing: 'border-box', outline: 'none' }}
                        />
                        <button onClick={handleSendSms} disabled={!smsText.trim() || sending} style={{ marginTop: '6px', width: '100%', padding: '9px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '0.82rem', cursor: (!smsText.trim() || sending) ? 'not-allowed' : 'pointer', opacity: (!smsText.trim() || sending) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <Send size={13} /> {sending ? 'Αποστολή...' : 'Αποστολή SMS'}
                        </button>
                    </div>

                    {/* Quick actions */}
                    <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Γρήγορες Ενέργειες</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button onClick={() => { onNavigate && onNavigate('appointments'); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', cursor: 'pointer', color: 'var(--text)', textAlign: 'left' }}>
                                <Calendar size={15} color="var(--primary)" />
                                <span style={{ fontSize: '0.82rem', fontWeight: '600', flex: 1 }}>Νέο Ραντεβού</span>
                                <ChevronRight size={13} color="#94a3b8" />
                            </button>
                            {isKnownPatient && (
                                <button onClick={() => { onNavigate && onNavigate('patients'); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', cursor: 'pointer', color: 'var(--text)', textAlign: 'left' }}>
                                    <User size={15} color="#6366f1" />
                                    <span style={{ fontSize: '0.82rem', fontWeight: '600', flex: 1 }}>Προφίλ Ασθενή</span>
                                    <ChevronRight size={13} color="#94a3b8" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Recovery status */}
                    <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Κατάσταση Ανάκτησης</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {[
                                { label: 'Κλήση', value: fmtTime(log.createdAt) },
                                { label: log.smsStatus === 'pending' ? 'Κλήση' : 'SMS', value: log.smsStatus === 'sent' ? '✓ Εστάλη' : log.smsStatus === 'failed' ? '✗ Απέτυχε' : log.smsStatus === 'pending' ? '📞 AI Κλήση' : log.smsStatus },
                                { label: 'Κατάσταση', value: log.status },
                                log.recoveredAt && { label: 'Ανακτήθηκε', value: fmtTime(log.recoveredAt) },
                            ].filter(Boolean).map(({ label, value }) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                    <span style={{ color: 'var(--text-light)', fontWeight: '600' }}>{label}</span>
                                    <span style={{ color: 'var(--text)', fontWeight: '700' }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ─── Main Feed ────────────────────────────────────────────────────────────────
const RecoveryFeed = ({ logs = [], token, onNavigate }) => {
    const [retrying, setRetrying] = React.useState({});
    const [selected, setSelected] = React.useState(null);
    const [dismissed, setDismissed] = React.useState(new Set());

    const handleRetry = async (logId, e) => {
        e.stopPropagation();
        if (retrying[logId]) return;
        setRetrying(r => ({ ...r, [logId]: 'retrying' }));
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

    const allSorted = Array.isArray(logs)
        ? [...logs].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 20)
        : [];
    const sorted = allSorted.filter(l => !dismissed.has(l.id));

    if (allSorted.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center', gap: '0.5rem', borderRadius: '14px', background: 'var(--bg-subtle)', border: '1px dashed var(--border)' }}>
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
        <>
            {sorted.length < allSorted.length || allSorted.length > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                    <button onClick={() => setDismissed(new Set(allSorted.map(l => l.id)))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '0.72rem', fontWeight: '700', padding: '2px 6px' }}>Καθαρισμός</button>
                </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {sorted.map((log) => {
                    const ev = getEvent(log);
                    const Icon = ev.icon;
                    const name = patientLabel(log);
                    const isFailed = log.smsStatus === 'failed';

                    // Get reply preview from aiConversation
                    let replyPreview = null;
                    try {
                        const conv = typeof log.aiConversation === 'string' ? JSON.parse(log.aiConversation) : (log.aiConversation || []);
                        const inbound = Array.isArray(conv) && [...conv].reverse().find(m => m.role === 'user' || m.direction === 'inbound' || m.from === 'patient');
                        if (inbound && (inbound.content || inbound.body || inbound.text)) {
                            replyPreview = String(inbound.content || inbound.body || inbound.text).slice(0, 55);
                            if (String(inbound.content || inbound.body || inbound.text).length > 55) replyPreview += '...';
                        }
                    } catch { /* ignore */ }
                    
                    const revenue = log.estimatedRevenue || (log.status === 'RECOVERED' || log.status === 'RECOVERING' ? 150 : null);

                    return (
                        <div
                            key={log.id}
                            className="animate-fade"
                            onClick={() => setSelected(log)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '0.7rem 0.85rem', borderRadius: '12px',
                                background: ev.bg, border: `1px solid ${ev.border}`,
                                cursor: 'pointer', transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                            {/* Avatar */}
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                                background: ev.dot + '22', border: `1px solid ${ev.dot}44`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.85rem', fontWeight: '800', color: ev.dot,
                            }}>
                                {(log.patientName || log.patient?.name || '?')[0].toUpperCase()}
                            </div>
                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', whiteSpace: 'nowrap' }}>{name}</span>
                                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: ev.dot, flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: ev.dot, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</span>
                                </div>
                                {replyPreview ? (
                                    <div style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: '600', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        "{replyPreview}"
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: '500' }}>
                                        {log.fromNumber || '—'}
                                    </div>
                                )}
                            </div>
                            {/* Right side */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.68rem', color: '#b0bec5', fontWeight: '500' }}>{fmtTime(log.updatedAt || log.createdAt)}</span>
                                {revenue && log.status === 'RECOVERED' ? (
                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 7px', borderRadius: '6px' }}>
                                        +€{revenue}
                                    </span>
                                ) : revenue && log.status === 'RECOVERING' ? (
                                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 7px', borderRadius: '6px' }}>
                                        ~€{revenue}
                                    </span>
                                ) : revenue ? (
                                    <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#94a3b8', background: 'var(--bg-subtle)', padding: '2px 7px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                        ~€{revenue}
                                    </span>
                                ) : isFailed ? (
                                    <button
                                        onClick={(e) => handleRetry(log.id, e)}
                                        disabled={!!retrying[log.id]}
                                        style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '5px', border: '1px solid rgba(239,68,68,0.3)', background: retrying[log.id] === 'sent' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)', color: retrying[log.id] === 'sent' ? '#059669' : '#dc2626', fontSize: '0.62rem', fontWeight: '800', cursor: retrying[log.id] ? 'not-allowed' : 'pointer' }}
                                    >
                                        <RefreshCw size={8} />
                                        {retrying[log.id] === 'retrying' ? '...' : retrying[log.id] === 'sent' ? '✓' : 'Retry'}
                                    </button>
                                ) : (
                                    <ChevronRight size={13} color="#cbd5e1" />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {selected && (
                <ActionPanel
                    log={selected}
                    token={token}
                    onClose={() => setSelected(null)}
                    onNavigate={onNavigate}
                />
            )}

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </>
    );
};

export default RecoveryFeed;
