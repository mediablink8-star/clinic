import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Search, User, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const CallPatientModal = ({ patients = [], token, onClose }) => {
    const [search, setSearch] = useState('');
    const [calling, setCalling] = useState(false);

    const filtered = patients.filter(p => {
        const q = search.toLowerCase();
        return p.name?.toLowerCase().includes(q) || p.phone?.includes(q);
    });

    const handleCall = async (patient) => {
        setCalling(true);
        try {
            const res = await fetch(`${API_BASE}/ai/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ 
                    command: `Κάλεσε τον/την ${patient.name}`
                })
            });
            
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    toast.success(`Κλήση προς ${patient.name} ξεκίνησε!`);
                    onClose();
                } else {
                    toast.error(data.error || 'Αποτυχία κλήσης — ελέγξτε τις ρυθμίσεις Voice AI');
                }
            } else {
                const data = await res.json();
                toast.error(data.error || 'Αποτυχία κλήσης');
            }
        } catch (err) {
            toast.error('Σφάλμα σύνδεσης');
        } finally {
            setCalling(false);
        }
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
            <div style={{ width: '90%', maxWidth: '480px', maxHeight: '80vh', background: 'var(--modal-bg)', borderRadius: '20px', boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Phone size={18} color="white" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>Κλήση Ασθενή</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: '2px 0 0' }}>Επιλέξτε ασθενή για AI κλήση</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Αναζήτηση ασθενή..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                {/* Patient List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)' }}>
                            <User size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                            <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>Δεν βρέθηκαν ασθενείς</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {filtered.map(patient => (
                                <div
                                    key={patient.id}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', cursor: 'pointer', transition: 'all 0.15s' }}
                                    onClick={() => !calling && handleCall(patient)}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                                >
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: '800', color: 'white', flexShrink: 0 }}>
                                        {patient.name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>{patient.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{patient.phone}</div>
                                    </div>
                                    <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                                        {calling ? (
                                            <Loader size={14} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} />
                                        ) : (
                                            <Phone size={14} color="#7c3aed" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}>
                        Κλείσιμο
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CallPatientModal;
