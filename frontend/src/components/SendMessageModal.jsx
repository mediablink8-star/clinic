import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const SendMessageModal = ({ 
    patients = [], 
    preSelectedPatient = null,
    token, 
    onClose, 
    title = 'Send SMS',
    subtitle = 'Select a patient and write a message'
}) => {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(preSelectedPatient);
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
            const resp = await axios.post(`${API_BASE}/messages/send`, { 
                patientId: selected.id, 
                message: message.trim() 
            }, { headers: { Authorization: `Bearer ${token}` } });
            if (resp.data.success) {
                const s = resp.data.deliveryStatus;
                const isError = s === 'FAILED';
                setStatus({ 
                    type: isError ? 'error' : 'success', 
                    text: s === 'SENT' ? 'Message sent successfully!' : s === 'SIMULATED' ? 'Simulated (no webhook configured).' : 'Delivery failed. Check SMS settings.' 
                });
                if (!isError) {
                    setTimeout(() => onClose(), 2000);
                }
            } else {
                setStatus({ type: 'error', text: 'Send failed.' });
            }
        } catch (err) {
            setStatus({ type: 'error', text: err.response?.data?.error || 'Error sending message.' });
            toast.error('SMS failed');
        } finally {
            setSending(false);
        }
    };

    const handleSelectPatient = (patient) => {
        setSelected(patient);
        setSearch('');
    };

    return createPortal(
        <div style={{ 
            position: 'fixed', inset: 0, 
            background: 'rgba(15,23,42,0.5)', 
            backdropFilter: 'blur(6px)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            zIndex: 1000 
        }}>
            <div style={{ 
                background: 'var(--modal-bg)', 
                borderRadius: '24px', 
                padding: '2rem', 
                width: '100%', 
                maxWidth: '480px', 
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)', 
                border: '1px solid var(--modal-border)' 
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px' }}>
                            <Send size={18} color="var(--primary)" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text)' }}>{title}</h2>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>{subtitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                {!selected ? (
                    <div>
                        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input 
                                autoFocus 
                                type="text" 
                                placeholder="Search patient..." 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                                style={{ 
                                    width: '100%', padding: '9px 9px 9px 32px', 
                                    borderRadius: '10px', border: '1px solid var(--input-border)', 
                                    background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', 
                                    boxSizing: 'border-box' 
                                }} 
                            />
                        </div>
                        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {filtered.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '1rem' }}>No patients found</p>
                            ) : filtered.map(p => (
                                <button 
                                    key={p.id} 
                                    onClick={() => handleSelectPatient(p)} 
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '10px', 
                                        padding: '10px 12px', borderRadius: '10px', 
                                        border: '1px solid var(--border)', background: 'var(--modal-bg)', 
                                        cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text)' 
                                    }}
                                >
                                    <div style={{ 
                                        width: '32px', height: '32px', borderRadius: '8px', 
                                        background: 'var(--primary-light)', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                        fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', flexShrink: 0 
                                    }}>
                                        {p.name?.charAt(0)}
                                    </div>
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
                        <div style={{ 
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                            padding: '10px 12px', borderRadius: '10px', 
                            background: 'var(--primary-light)', border: '1px solid var(--border)' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ 
                                    width: '28px', height: '28px', borderRadius: '7px', 
                                    background: 'var(--primary)', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    fontSize: '0.75rem', fontWeight: '800', color: 'white' 
                                }}>
                                    {selected.name?.charAt(0)}
                                </div>
                                <div>
                                    <p style={{ fontWeight: '700', fontSize: '0.875rem', margin: 0 }}>{selected.name}</p>
                                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>{selected.phone}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={14} />
                            </button>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                                Message
                            </label>
                            <textarea 
                                autoFocus 
                                value={message} 
                                onChange={e => setMessage(e.target.value)} 
                                placeholder="Type your message..." 
                                disabled={sending || status?.type === 'success'} 
                                style={{ 
                                    width: '100%', padding: '12px', borderRadius: '10px', 
                                    border: '1px solid var(--input-border)', 
                                    background: 'var(--input-bg)', color: 'var(--text)', 
                                    fontSize: '0.875rem', resize: 'none', minHeight: '110px', 
                                    boxSizing: 'border-box', outline: 'none' 
                                }} 
                            />
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>
                                {message.length} chars
                            </p>
                        </div>
                        {status && (
                            <div style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px', 
                                padding: '10px 12px', borderRadius: '10px', 
                                background: status.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', 
                                color: status.type === 'success' ? '#10b981' : '#ef4444', 
                                fontSize: '0.8rem', fontWeight: '600', 
                                border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` 
                            }}>
                                {status.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                                {status.text}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={onClose} style={{ 
                                flex: 1, padding: '10px', borderRadius: '10px', 
                                border: '1px solid var(--cancel-border)', 
                                background: 'var(--cancel-bg)', cursor: 'pointer', 
                                fontWeight: '600', fontSize: '0.875rem', color: 'var(--cancel-color)' 
                            }}>
                                Cancel
                            </button>
                            <button 
                                onClick={handleSend} 
                                disabled={sending || !message.trim() || status?.type === 'success'} 
                                style={{ 
                                    flex: 1, padding: '10px', borderRadius: '10px', border: 'none', 
                                    background: 'var(--primary)', color: 'white', 
                                    cursor: (sending || !message.trim()) ? 'not-allowed' : 'pointer', 
                                    fontWeight: '700', fontSize: '0.875rem', 
                                    opacity: (sending || !message.trim()) ? 0.6 : 1, 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' 
                                }}
                            >
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

export default SendMessageModal;