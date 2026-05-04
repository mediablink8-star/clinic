import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, Send, Calendar, X, Search, Phone, FlaskConical, Loader, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import SendMessageModal from './SendMessageModal';
import CallPatientModal from './CallPatientModal';
import Tooltip from './Tooltip';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

function QuickActionBtn({ icon: Icon, label, onClick, variant = 'outline', badge, tooltip }) {
    const isPrimary = variant === 'primary';
    const isAi = variant === 'ai';
    const isSecondary = variant === 'secondary';

    const bg = isPrimary ? 'linear-gradient(135deg, var(--primary) 0%, #009a93 100%)'
        : isAi ? 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)'
        : isSecondary ? 'linear-gradient(135deg, var(--glass-surface) 0%, var(--bg-subtle) 100%)'
        : 'var(--bg-subtle)';

    const color = (isPrimary || isAi) ? 'white' : 'var(--secondary)';
    const border = (isPrimary || isAi) ? 'none' : '1.5px solid var(--border)';
    const shadow = isPrimary ? '0 8px 24px -6px rgba(59,130,246,0.45)' : isAi ? '0 8px 24px -6px rgba(99,102,241,0.4)' : '0 2px 8px rgba(0,0,0,0.04)';
    const iconBg = isPrimary ? 'rgba(255,255,255,0.18)' : isAi ? 'rgba(99,102,241,0.3)' : 'var(--primary-light)';
    const iconColor = (isPrimary || isAi) ? 'white' : 'var(--primary)';

    const button = (
        <button className={`quick-action-btn ${isPrimary || isAi ? 'quick-action-btn--wide' : ''}`} onClick={onClick} onMouseEnter={e => {
            e.currentTarget.style.transform = isPrimary ? 'scale(1.02)' : 'translateY(-2px)';
            e.currentTarget.style.boxShadow = isPrimary ? '0 12px 32px -8px rgba(59,130,246,0.55)' : isAi ? '0 12px 32px -8px rgba(99,102,241,0.5)' : '0 8px 20px rgba(0,0,0,0.12)';
            if (isSecondary) {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.querySelector('.icon-container').style.transform = 'scale(1.1)';
            }
        }} onMouseLeave={e => {
            e.currentTarget.style.transform = isPrimary ? 'scale(1)' : 'translateY(0)';
            e.currentTarget.style.boxShadow = shadow;
            if (isSecondary) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.querySelector('.icon-container').style.transform = 'scale(1)';
            }
        }} style={{ width: '100%', flex: (isPrimary || isAi) ? undefined : 1, padding: (isPrimary || isAi) ? '1rem' : '0.8rem', borderRadius: '14px', border, background: bg, backdropFilter: 'blur(8px)', color, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: (isPrimary || isAi) ? '800' : '700', fontSize: (isPrimary || isAi) ? '0.9rem' : '0.82rem', cursor: 'pointer', boxShadow: shadow, transition: 'all 0.2s ease', position: 'relative', opacity: 1 }}>
            <div className="icon-container" style={{ background: iconBg, padding: (isPrimary || isAi) ? '8px' : '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.2s ease' }}>
                <Icon size={(isPrimary || isAi) ? 18 : 17} color={iconColor} strokeWidth={2.5} />
            </div>
            {label}
            {badge && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: '800', padding: '2px 7px', borderRadius: '99px', background: 'rgba(255,255,255,0.25)', color: 'white', letterSpacing: '0.03em' }}>{badge}</span>}
        </button>
    );

    return tooltip ? <Tooltip text={tooltip} position="top">{button}</Tooltip> : button;
}

function TestSetupModal({ token, clinic, onClose }) {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleTest = async () => {
        if (!phone.trim()) { toast.error('Εισάγετε αριθμό τηλεφώνου.'); return; }
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch(`${API_BASE}/recovery/test-trigger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ phone: phone.trim(), bypassCooldown: true, callSid: `test_${Date.now()}` })
            });
            const data = await res.json();
            setResult({ success: data.success, channel: data.channel || 'sms', callId: data.callId, smsStatus: data.smsStatus, reason: data.reason });
        } catch (err) {
            setResult({ success: false, reason: err.message });
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border)', padding: '1.75rem', width: '100%', maxWidth: '420px', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FlaskConical size={16} color="var(--primary)" />
                        </div>
                        <div>
                            <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text)' }}>Δοκιμή Ρύθμισης</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Προσομοίωση αναπάντητης κλήσης</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', display: 'flex' }}><X size={18} /></button>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                    Εισάγετε έναν αριθμό τηλεφώνου για να δοκιμάσετε την ανάκτηση. Αν το Voice AI είναι ενεργό, θα λάβετε κλήση. Αλλιώς θα σταλεί SMS.
                </p>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-light)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Αριθμός Τηλεφώνου</label>
                    <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+306912345678"
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>

                {result && (
                    <div style={{ padding: '12px 14px', borderRadius: '12px', marginBottom: '1rem', background: result.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        {result.success
                            ? <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '1px' }} />
                            : <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                        }
                        <div style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5 }}>
                            {result.success
                                ? result.channel === 'voice'
                                    ? `✅ Κλήση ξεκίνησε! Call ID: ${result.callId}`
                                    : `✅ SMS εστάλη! (${result.smsStatus})`
                                : `❌ Αποτυχία: ${result.reason || 'Άγνωστο σφάλμα'}`
                            }
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}>Κλείσιμο</button>
                    <button onClick={handleTest} disabled={loading} style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.7 : 1 }}>
                        {loading ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Δοκιμή...</> : <><FlaskConical size={13} /> Εκτέλεση Δοκιμής</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}


function QuickActions({ onViewSchedule, onAddPatient, onNewAppointment, patients = [], token, clinic, onRefresh }) {
    const [showSMS, setShowSMS] = useState(false);
    const [showCall, setShowCall] = useState(false);
    const [showTest, setShowTest] = useState(false);

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <QuickActionBtn icon={Calendar} label="+ Νέο Ραντεβού" onClick={onNewAppointment || onViewSchedule} variant="primary" tooltip="Δημιουργία νέου ραντεβού" />
                <div className="quick-actions-row" style={{ display: 'flex', gap: '0.5rem' }}>
                    <QuickActionBtn icon={UserPlus} label="Ασθενείς" onClick={onAddPatient || onViewSchedule} variant="secondary" tooltip="Διαχείριση ασθενών" />
                    <QuickActionBtn icon={Send} label="SMS" onClick={() => setShowSMS(true)} variant="secondary" tooltip="Αποστολή SMS σε ασθενείς" />
                    <QuickActionBtn icon={Phone} label="Κλήση" onClick={() => setShowCall(true)} variant="secondary" tooltip="Κλήση ασθενούς" />
                </div>
                <QuickActionBtn icon={FlaskConical} label="Δοκιμή Ρύθμισης" onClick={() => setShowTest(true)} variant="secondary" tooltip="Δοκιμή συστήματος ανάκτησης" />
            </div>
            {showSMS && <SendMessageModal patients={patients} token={token} onClose={() => setShowSMS(false)} />}
            {showCall && <CallPatientModal patients={patients} token={token} onClose={() => setShowCall(false)} />}
            {showTest && <TestSetupModal token={token} clinic={clinic} onClose={() => setShowTest(false)} />}
        </>
    );
}

export default QuickActions;
