import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertCircle, Reply, Send, PhoneOff, Clock,
    PhoneMissed, Zap, MessageCircle, ChevronRight, X
} from 'lucide-react';
import axios from 'axios';
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
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', margin: 0 }}>{patients.length} ασθενής απάντησε</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                </div>
                {patients.length > 1 && !selected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                        <p style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-light)', margin: '0 0 6px' }}>Επιλέξτε ασθενή:</p>
                        {patients.map(p => (
                            <button key={p.id} onClick={() => setSelected(p)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: '800', color: '#3b82f6' }}>
                                    {(p.patientName || p.phone || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{p.patientName || 'Άγνωστος'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{p.phone}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                {selected && (
                    <>
                        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text)' }}>{selected.patientName || 'Άγνωστος'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{selected.phone}</div>
                            </div>
                            {patients.length > 1 && <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.75rem' }}>Αλλαγή</button>}
                        </div>
                        <textarea
                            autoFocus value={message} onChange={e => setMessage(e.target.value)}
                            placeholder="Γράψτε την απάντησή σας..." rows={4}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.9rem', resize: 'none', boxSizing: 'border-box', outline: 'none', marginBottom: '0.75rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--cancel-border)', background: 'var(--cancel-bg)', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', color: 'var(--cancel-color)' }}>Ακύρωση</button>
                            <button onClick={handleSend} disabled={!message.trim() || sending} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', cursor: (!message.trim() || sending) ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.9rem', opacity: (!message.trim() || sending) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
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
    const [showReply, setShowReply] = useState(false);

    const { staleNoReply = [], patientEngaged = [], failedSms: failedInsights = [], summary = {} } = recoveryInsights;
    const logs = Array.isArray(recoveryLog) ? recoveryLog : [];

    const failedSmsCount = summary.failedCount ?? logs.filter(l => l?.smsStatus === 'failed').length;
    const patientRepliedCount = summary.engagedCount ?? 0;
    const staleCount = summary.staleCount ?? 0;

    // Pipeline stats
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const missedThisWeek = logs.filter(l => l && new Date(l.createdAt) >= week).length;
    const activeRecoveries = logs.filter(l => l && l.status === 'RECOVERING').length;
    const awaitingReply = logs.filter(l => l && l.status === 'RECOVERING' && l.smsStatus === 'sent').length;

    const urgentCount = staleCount + patientRepliedCount + failedSmsCount + (pendingCount > 0 ? 1 : 0);

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
                        <ActionRow icon={PhoneOff} color="#dc2626" label={`${failedSmsCount} αποτυχία SMS`} sublabel="Επανάληψη" cta="Retry" onClick={() => onNavigate && onNavigate('dashboard')} urgent />
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
                <ReplyModal patients={patientEngaged} token={token} onClose={() => setShowReply(false)} />
            )}
        </div>
    );
};

export default ActionCenter;
