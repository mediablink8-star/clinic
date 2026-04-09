import React, { useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { UserPlus, Send, Calendar, X, Search, CheckCircle2, AlertCircle, Phone, FlaskConical, Zap } from 'lucide-react';
import api from '../lib/api';

const QuickActionBtn = ({ icon: Icon, label, onClick, variant = 'outline', badge }) => {
    const isPrimary = variant === 'primary';
    const isSecondary = variant === 'secondary';
    const isAi = variant === 'ai';
    const isTest = variant === 'test';

    const bg = isPrimary ? 'linear-gradient(135deg, var(--primary) 0%, #009a93 100%)'
        : isAi ? 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)'
        : isTest ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
        : 'var(--bg-subtle)';

    const color = (isPrimary || isAi || isTest) ? 'white' : 'var(--secondary)';
    const border = (isPrimary || isAi || isTest) ? 'none' : '1px solid var(--border)';
    const shadow = isPrimary ? '0 8px 24px -6px rgba(59,130,246,0.45)' : isAi ? '0 8px 24px -6px rgba(99,102,241,0.4)' : isTest ? '0 6px 18px -4px rgba(16,185,129,0.35)' : 'var(--shadow-sm)';
    const iconBg = isPrimary ? 'rgba(255,255,255,0.18)' : isAi ? 'rgba(99,102,241,0.3)' : isTest ? 'rgba(52,211,153,0.25)' : 'var(--primary-light)';
    const iconColor = (isPrimary || isAi || isTest) ? 'white' : 'var(--primary)';

    return (
        <button className={`quick-action-btn ${isPrimary || isAi ? 'quick-action-btn--wide' : ''}`} onClick={onClick} style={{ width: '100%', flex: (isPrimary || isAi) ? undefined : 1, padding: (isPrimary || isAi) ? '1rem' : '0.75rem', borderRadius: '14px', border, background: bg, backdropFilter: 'blur(8px)', color, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: (isPrimary || isAi) ? '800' : '600', fontSize: (isPrimary || isAi) ? '0.9rem' : '0.82rem', cursor: 'pointer', boxShadow: shadow, transition: 'all 0.2s ease', position: 'relative', opacity: isPrimary ? 1 : 0.9 }}>
            <div style={{ background: iconBg, padding: (isPrimary || isAi) ? '8px' : '7px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={(isPrimary || isAi) ? 18 : 16} color={iconColor} />
            </div>
            {label}
            {badge && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: '800', padding: '2px 7px', borderRadius: '99px', background: 'rgba(255,255,255,0.25)', color: 'white', letterSpacing: '0.03em' }}>{badge}</span>}
        </button>
    );
};

const SendSMSModal = ({ patients = [], token, onClose }) => {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState(null);

    const filtered = patients.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search)
    );

    const handleSend = async () => {
        if (!selected || !message.trim()) return;
        setSending(true);
        setStatus(null);
        try {
            const resp = await api.post('/messages/send', { patientId: selected.id, message: message.trim() });
            if (resp.data.success) {
                const s = resp.data.deliveryStatus;
                const isError = s === 'FAILED';
                setStatus({ type: isError ? 'error' : 'success', text: s === 'SENT' ? 'Message sent successfully!' : s === 'SIMULATED' ? 'Simulated (no webhook configured).' : 'Delivery failed. Check SMS settings.' });
                if (!isError) setTimeout(() => onClose(), 2000);
            } else {
                setStatus({ type: 'error', text: 'Send failed.' });
            }
        } catch (err) {
            setStatus({ type: 'error', text: err.response?.data?.error || 'Error sending message.' });
        } finally {
            setSending(false);
        }
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--modal-bg)', borderRadius: '24px', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)', border: '1px solid var(--modal-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px' }}><Send size={18} color="var(--primary)" /></div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text)' }}>Send SMS</h2>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Select a patient and write a message</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}><X size={20} /></button>
                </div>

                {!selected ? (
                    <div>
                        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input autoFocus type="text" placeholder="Search patient..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '9px 9px 9px 32px', borderRadius: '10px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {filtered.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '1rem' }}>No patients found</p>
                            ) : filtered.map(p => (
                                <button key={p.id} onClick={() => setSelected(p)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--modal-bg)', cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text)' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', flexShrink: 0 }}>{p.name?.charAt(0)}</div>
                                    <div>
                                        <p style={{ fontWeight: '700', fontSize: '0.875rem', margin: 0 }}>{p.name}</p>
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>{p.phone}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: 'var(--primary-light)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '800', color: 'white' }}>{selected.name?.charAt(0)}</div>
                                <div>
                                    <p style={{ fontWeight: '700', fontSize: '0.875rem', margin: 0 }}>{selected.name}</p>
                                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>{selected.phone}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={14} /></button>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Message</label>
                            <textarea autoFocus value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message..." disabled={sending || status?.type === 'success'} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', resize: 'none', minHeight: '110px', boxSizing: 'border-box', outline: 'none' }} />
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>{message.length} chars</p>
                        </div>
                        {status && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: status.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: status.type === 'success' ? '#10b981' : '#ef4444', fontSize: '0.8rem', fontWeight: '600', border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                                {status.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                                {status.text}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--cancel-border)', background: 'var(--cancel-bg)', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', color: 'var(--cancel-color)' }}>Cancel</button>
                            <button onClick={handleSend} disabled={sending || !message.trim() || status?.type === 'success'} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'white', cursor: (sending || !message.trim()) ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.875rem', opacity: (sending || !message.trim()) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <Send size={15} />
                                {sending ? 'Sending...' : 'Send SMS'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

const CallPatientModal = ({ patients = [], onClose }) => {
    const [search, setSearch] = useState('');
    const filtered = patients.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search)
    );

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--modal-bg)', borderRadius: '24px', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)', border: '1px solid var(--modal-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(16,185,129,0.1)', padding: '8px', borderRadius: '10px' }}><Phone size={18} color="#10b981" /></div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text)' }}>Call Patient</h2>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0 }}>Select a patient to call</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                </div>
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input autoFocus type="text" placeholder="Search patient..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '9px 9px 9px 32px', borderRadius: '10px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>
                <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {filtered.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '1rem' }}>No patients found</p>
                    ) : filtered.map(p => (
                        <a key={p.id} href={`tel:${p.phone}`} onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--modal-bg)', textDecoration: 'none', color: 'var(--text)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '800', color: '#10b981', flexShrink: 0 }}>{p.name?.charAt(0)}</div>
                                <div>
                                    <p style={{ fontWeight: '700', fontSize: '0.875rem', margin: 0 }}>{p.name}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{p.phone}</p>
                                </div>
                            </div>
                            <div style={{ background: 'rgba(16,185,129,0.1)', padding: '7px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone size={15} color="#10b981" /></div>
                        </a>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
};

const SimulateCallModal = ({ onClose, clinic }) => {
    const [url, setUrl] = useState(() => localStorage.getItem('n8n_webhook_url') || '');
    const [phone, setPhone] = useState('+30690000000');
    const [status, setStatus] = useState(null);
    const [errMsg, setErrMsg] = useState('');

    const handleSave = () => localStorage.setItem('n8n_webhook_url', url);

    const handleSimulate = async () => {
        if (!url.trim()) return;
        handleSave();
        setStatus('sending');
        setErrMsg('');
        const payload = { event: 'missed_call', phone, clinicId: clinic?.id || 'test-clinic', callSid: `sim_${Date.now()}`, timestamp: new Date().toISOString(), source: 'simulate_button' };
        try {
            await axios.post(url.trim(), payload);
            setStatus('sent');
            setTimeout(() => { setStatus(null); onClose(); }, 2000);
        } catch (err) {
            setStatus('error');
            setErrMsg(err?.response?.data?.message || err.message || 'Request failed');
        }
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--modal-bg)', borderRadius: '24px', padding: '2rem', width: '100%', maxWidth: '460px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid var(--modal-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', padding: '8px', borderRadius: '10px' }}><Zap size={18} color="white" /></div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text)' }}>Simulate Incoming Call</h2>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Fires a missed-call payload to your n8n webhook</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>n8n Webhook URL</label>
                        <input type="url" placeholder="https://your-n8n.com/webhook/clinic-events" value={url} onChange={e => setUrl(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Caller Phone (simulated)</label>
                        <input type="text" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ background: '#0f172a', borderRadius: '10px', padding: '12px', fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace', lineHeight: 1.6 }}>
                        <span style={{ color: '#64748b' }}>// payload sent to n8n</span>{'\n'}
                        {JSON.stringify({ event: 'missed_call', phone, clinicId: clinic?.id || 'test-clinic', callSid: 'sim_...', timestamp: '...', source: 'simulate_button' }, null, 2)}
                    </div>
                    {status === 'error' && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.8rem', fontWeight: '600', border: '1px solid rgba(239,68,68,0.2)' }}><AlertCircle size={15} /> {errMsg || 'Failed to reach webhook'}</div>}
                    {status === 'sent' && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.8rem', fontWeight: '600', border: '1px solid rgba(16,185,129,0.2)' }}><CheckCircle2 size={15} /> Webhook triggered successfully!</div>}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--cancel-border)', background: 'var(--cancel-bg)', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', color: 'var(--cancel-color)' }}>Cancel</button>
                        <button onClick={handleSimulate} disabled={!url.trim() || status === 'sending' || status === 'sent'} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: 'white', cursor: (!url.trim() || status === 'sending') ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.875rem', opacity: (!url.trim() || status === 'sending') ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <Zap size={15} />
                            {status === 'sending' ? 'Firing...' : 'Fire Webhook'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const QuickActions = ({ onViewSchedule, onAddPatient, onNewAppointment, patients = [], token, clinic, onRefresh }) => {
    const [showSMS, setShowSMS] = useState(false);
    const [showCall, setShowCall] = useState(false);
    const [showSimulate, setShowSimulate] = useState(false);
    const [testStatus, setTestStatus] = useState(null);

    const handleTestRecovery = async () => {
        setTestStatus('sending');
        try {
            await api.post('/recovery/test-trigger', {
                phone: '+30690000000',
                callSid: `demo_${Date.now()}`
            });
            setTestStatus('sent');
            if (onRefresh) onRefresh();
            setTimeout(() => setTestStatus(null), 3000);
        } catch (err) {
            console.error('Test recovery failed:', err.response?.data || err.message);
            setTestStatus('error');
            setTimeout(() => setTestStatus(null), 3000);
        }
    };

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <QuickActionBtn icon={Calendar} label="+ Νέο Ραντεβού" onClick={onNewAppointment || onViewSchedule} variant="primary" />
                <div className="quick-actions-row" style={{ display: 'flex', gap: '0.5rem' }}>
                    <QuickActionBtn icon={UserPlus} label="Ασθενείς" onClick={onAddPatient} variant="secondary" />
                    <QuickActionBtn icon={Send} label="SMS" onClick={() => setShowSMS(true)} variant="secondary" />
                    <QuickActionBtn icon={Phone} label="Κλήση" onClick={() => setShowCall(true)} variant="secondary" />
                </div>
                <div style={{ marginTop: '0.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Εργαλεία Προγραμματιστή</div>
                    <QuickActionBtn
                        icon={FlaskConical}
                        label={testStatus === 'sending' ? 'Αποστολή...' : testStatus === 'sent' ? '✓ Εστάλη!' : testStatus === 'error' ? '✗ Σφάλμα' : 'Δοκιμή SMS Ανάκτησης'}
                        onClick={handleTestRecovery}
                        variant="test"
                    />
                    <QuickActionBtn
                        icon={Zap}
                        label="Προσομοίωση Webhook..."
                        onClick={() => setShowSimulate(true)}
                        variant="test"
                    />
                </div>
            </div>
            {showSMS && <SendSMSModal patients={patients} token={token} onClose={() => setShowSMS(false)} />}
            {showSimulate && <SimulateCallModal onClose={() => setShowSimulate(false)} clinic={clinic} />}
            {showCall && <CallPatientModal patients={patients} onClose={() => setShowCall(false)} />}
        </>
    );
};

export default QuickActions;
