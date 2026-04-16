import { AlertCircle, ChevronRight, Clock, Reply, PhoneOff, Send, X } from 'lucide-react';
import axios from 'axios';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// ─── Reply Modal ──────────────────────────────────────────────────────────────
const ReplyModal = ({ patients, token, onClose }) => {
    const [selected, setSelected] = useState(patients.length === 1 ? patients[0] : null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!selected || !message.trim() || sending) return;
        setSending(true);
        try {
            await axios.post(`${API_BASE}/messages/send`,
                { patientId: selected.patientId || selected.id, message: message.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Απάντηση εστάλη!');
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Αποτυχία αποστολής.');
        } finally {
            setSending(false);
        }
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ background: 'var(--modal-bg)', borderRadius: '20px', padding: '1.75rem', width: '100%', maxWidth: '460px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', border: '1px solid var(--modal-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)' }}><Reply size={18} color="#3b82f6" /></div>
                        <div>
                            <h2 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, color: 'var(--text)' }}>Απάντηση σε Ασθενή</h2>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', margin: 0 }}>{patients.length} ασθενής απάντησε</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                </div>

                {/* Patient selector if multiple */}
                {patients.length > 1 && !selected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-light)', margin: '0 0 6px' }}>Επιλέξτε ασθενή:</p>
                        {patients.map(p => (
                            <button key={p.id} onClick={() => setSelected(p)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '800', color: '#3b82f6' }}>
                                    {(p.patientName || p.phone || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: '700' }}>{p.patientName || 'Άγνωστος'}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{p.phone}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {selected && (
                    <>
                        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text)' }}>{selected.patientName || 'Άγνωστος'}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{selected.phone}</div>
                            </div>
                            {patients.length > 1 && <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.7rem' }}>Αλλαγή</button>}
                        </div>
                        <textarea
                            autoFocus
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Γράψτε την απάντησή σας..."
                            rows={4}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.875rem', resize: 'none', boxSizing: 'border-box', outline: 'none', marginBottom: '0.75rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--cancel-border)', background: 'var(--cancel-bg)', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', color: 'var(--cancel-color)' }}>Ακύρωση</button>
                            <button onClick={handleSend} disabled={!message.trim() || sending} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', cursor: (!message.trim() || sending) ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.875rem', opacity: (!message.trim() || sending) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <Send size={14} /> {sending ? 'Αποστολή...' : 'Αποστολή'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

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
    const [showReply, setShowReply] = useState(false);

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
                        action="Απάντηση"
                        onClick={() => setShowReply(true)}
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

            {showReply && patientEngaged.length > 0 && (
                <ReplyModal patients={patientEngaged} token={token} onClose={() => setShowReply(false)} />
            )}
        </div>
    );
};

export default NeedsAttention;
