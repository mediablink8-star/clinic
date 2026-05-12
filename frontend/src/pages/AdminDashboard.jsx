import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Building2, Users, Calendar, MessageSquare, Plus, X, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newClinic, setNewClinic] = useState({
        name: '',
        ownerEmail: '',
        ownerPassword: '',
        ownerName: ''
    });
    const [isCreating, setIsCreating] = useState(false);

    const { data: clinics = [], isLoading, error } = useQuery({
        queryKey: ['admin-clinics'],
        queryFn: () => api.get('/admin/usage').then(res => res.data),
        refetchInterval: 30000
    });

    const { data: logs = [] } = useQuery({
        queryKey: ['admin-logs'],
        queryFn: () => api.get('/admin/logs').then(res => res.data),
        refetchInterval: 15000
    });

    const handleCreateClinic = async (e) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            await api.post('/admin/clinics', newClinic);
            toast.success('Το ιατρείο δημιουργήθηκε επιτυχώς!');
            setShowCreateModal(false);
            setNewClinic({ name: '', ownerEmail: '', ownerPassword: '', ownerName: '' });
            queryClient.invalidateQueries(['admin-clinics']);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Αποτυχία δημιουργίας ιατρείου');
        } finally {
            setIsCreating(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="splash-spinner" style={{ margin: '0 auto 1rem', border: '3px solid rgba(99,91,255,0.15)', borderTop: '3px solid var(--primary)', borderRadius: '50%', width: '36px', height: '36px', animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Φόρτωση πίνακα ελέγχου...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--urgent)', fontSize: '0.9rem' }}>Σφάλμα φόρτωσης δεδομένων</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldAlert size={22} style={{ color: 'var(--primary)' }} />
                        Admin Control Plane
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px' }}>Διαχείριση ιατρείων και χρήσης πλατφόρμας</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 18px', borderRadius: '12px', border: 'none',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                        color: 'white', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
                        boxShadow: '0 8px 20px -4px rgba(99,91,255,0.4)',
                        transition: 'all 0.2s'
                    }}
                >
                    <Plus size={16} />
                    Νέο Ιατρείο
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{
                    background: 'var(--card-bg)', backdropFilter: 'var(--glass-strong)',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '16px',
                    padding: '1.25rem', boxShadow: 'var(--shadow-md)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Building2 size={18} color="white" />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Συνολικά Ιατρεία</span>
                    </div>
                    <p style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--secondary)', margin: 0, lineHeight: 1.2 }}>
                        {clinics.length}
                    </p>
                </div>

                <div style={{
                    background: 'var(--card-bg)', backdropFilter: 'var(--glass-strong)',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '16px',
                    padding: '1.25rem', boxShadow: 'var(--shadow-md)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <CheckCircle2 size={18} color="white" />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ενεργά</span>
                    </div>
                    <p style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--secondary)', margin: 0, lineHeight: 1.2 }}>
                        {clinics.filter(c => c.isActive).length}
                    </p>
                </div>

                <div style={{
                    background: 'var(--card-bg)', backdropFilter: 'var(--glass-strong)',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '16px',
                    padding: '1.25rem', boxShadow: 'var(--shadow-md)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <MessageSquare size={18} color="white" />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Συνολικά Μηνύματα</span>
                    </div>
                    <p style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--secondary)', margin: 0, lineHeight: 1.2 }}>
                        {logs.length}
                    </p>
                </div>

                <div style={{
                    background: 'var(--card-bg)', backdropFilter: 'var(--glass-strong)',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '16px',
                    padding: '1.25rem', boxShadow: 'var(--shadow-md)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <XCircle size={18} color="white" />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ανενεργά</span>
                    </div>
                    <p style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--secondary)', margin: 0, lineHeight: 1.2 }}>
                        {clinics.filter(c => !c.isActive).length}
                    </p>
                </div>
            </div>

            {/* Clinics Table */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
                    <Building2 size={16} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--primary)' }} />
                    Λίστα Ιατρείων
                </h2>
                <div className="card-glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{
                                    background: 'linear-gradient(135deg, rgba(99,91,255,0.06) 0%, rgba(16,185,129,0.04) 100%)',
                                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <th style={tableHeaderStyle}>Ιατρείο</th>
                                    <th style={tableHeaderStyle}>Credits</th>
                                    <th style={tableHeaderStyle}>Ημέσια / Όρια</th>
                                    <th style={tableHeaderStyle}>Χρήστες</th>
                                    <th style={tableHeaderStyle}>Κατάσταση</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clinics.map(clinic => (
                                    <tr key={clinic.id} style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                                        transition: 'background 0.15s',
                                        background: 'rgba(255,255,255,0.01)'
                                    }}>
                                        <td style={tableCellStyle}>
                                            <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text)' }}>{clinic.name}</div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{clinic.id}</div>
                                        </td>
                                        <td style={tableCellStyle}>
                                            <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                                                {clinic.messageCredits} / {clinic.monthlyCreditLimit}
                                            </div>
                                        </td>
                                        <td style={tableCellStyle}>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text)' }}>
                                                {clinic.dailyUsedCount} / {clinic.dailyMessageCap}
                                            </div>
                                        </td>
                                        <td style={tableCellStyle}>
                                            <div style={{ fontSize: '0.78rem' }}>
                                                👥 {clinic._count?.users || 0} &nbsp;📅 {clinic._count?.appointments || 0}
                                            </div>
                                        </td>
                                        <td style={tableCellStyle}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '99px',
                                                fontSize: '0.7rem',
                                                fontWeight: '700',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                background: clinic.isActive
                                                    ? 'rgba(16,185,129,0.12)'
                                                    : 'rgba(239,68,68,0.12)',
                                                color: clinic.isActive
                                                    ? '#10b981'
                                                    : '#ef4444',
                                                border: `1px solid ${clinic.isActive
                                                    ? 'rgba(16,185,129,0.25)'
                                                    : 'rgba(239,68,68,0.25)'}`
                                            }}>
                                                {clinic.isActive
                                                    ? <CheckCircle2 size={10} />
                                                    : <XCircle size={10} />}
                                                {clinic.isActive ? 'Ενεργό' : 'Ανενεργό'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Recent Logs */}
            <div>
                <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
                    <MessageSquare size={16} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--primary)' }} />
                    Πρόσφατα Logs
                </h2>
                <div className="card-glass" style={{ borderRadius: '16px', padding: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
                    {logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Δεν υπάρχουν ακόμη λειτουργίες
                        </div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 14px',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                fontSize: '0.8rem',
                                transition: 'background 0.15s'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                    <span style={{
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.68rem',
                                        fontWeight: '700',
                                        background: log.status === 'SENT'
                                            ? 'rgba(16,185,129,0.12)'
                                            : 'rgba(239,68,68,0.12)',
                                        color: log.status === 'SENT' ? '#10b981' : '#ef4444'
                                    }}>
                                        {log.status}
                                    </span>
                                    <span style={{ color: 'var(--text)', fontWeight: '500' }}>
                                        {log.clinic?.name || 'Unknown'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                    <span>{log.type}</span>
                                    <span>Κόστος: {log.cost}</span>
                                    <span>{new Date(log.timestamp).toLocaleString('el-GR')}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Create Clinic Modal */}
            {showCreateModal && (
                <div
                    onClick={() => setShowCreateModal(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 100,
                        background: 'rgba(5,11,27,0.6)',
                        backdropFilter: 'blur(16px) saturate(160%)',
                        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '1rem'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%', maxWidth: '520px',
                            background: 'var(--glass-surface-strong)',
                            backdropFilter: 'blur(32px) saturate(200%)',
                            WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                            borderRadius: '24px',
                            border: '1px solid rgba(255,255,255,0.3)',
                            boxShadow: '0 32px 64px -12px rgba(5,11,27,0.3)',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        <div
                            aria-hidden="true"
                            style={{
                                position: 'absolute', inset: 0,
                                background: 'var(--glass-sheen)',
                                pointerEvents: 'none',
                                opacity: 0.5
                            }}
                        />

                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--glass-control-soft)',
                            position: 'relative'
                        }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>
                                Δημιουργία Νέου Ιατρείου
                            </h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                style={{
                                    width: '32px', height: '32px', borderRadius: '8px',
                                    background: 'var(--glass-control)', border: '1px solid rgba(255,255,255,0.2)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--cancel-color)', transition: 'all 0.15s',
                                    backdropFilter: 'blur(16px) saturate(160%)'
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleCreateClinic} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={formLabelStyle}>Όνομα Ιατρείου</label>
                                <input
                                    required
                                    style={inputStyle}
                                    value={newClinic.name}
                                    onChange={e => setNewClinic({ ...newClinic, name: e.target.value })}
                                    placeholder="π.χ. Οδοντιατρείο Παπαδόπουλου"
                                />
                            </div>

                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
                                <p style={sectionLabelStyle}>Στοιχεία Ιδιοκτήτη</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={formLabelStyle}>Όνομα Ιδιοκτήτη</label>
                                <input
                                    required
                                    style={inputStyle}
                                    value={newClinic.ownerName}
                                    onChange={e => setNewClinic({ ...newClinic, ownerName: e.target.value })}
                                    placeholder="Πλήρες όνομα"
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={formLabelStyle}>Email Ιδιοκτήτη</label>
                                <input
                                    required
                                    type="email"
                                    style={inputStyle}
                                    value={newClinic.ownerEmail}
                                    onChange={e => setNewClinic({ ...newClinic, ownerEmail: e.target.value })}
                                    placeholder="owner@clinic.gr"
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={formLabelStyle}>Αρχικός Κωδικός</label>
                                <input
                                    required
                                    type="password"
                                    style={inputStyle}
                                    value={newClinic.ownerPassword}
                                    onChange={e => setNewClinic({ ...newClinic, ownerPassword: e.target.value })}
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating}
                                style={{
                                    marginTop: '0.5rem',
                                    padding: '12px 20px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: isCreating
                                        ? 'var(--glass-control)'
                                        : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                                    color: isCreating ? 'var(--text-light)' : 'white',
                                    fontWeight: '800',
                                    fontSize: '0.9rem',
                                    cursor: isCreating ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: '0 8px 20px -4px rgba(99,91,255,0.4)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isCreating ? 'Δημιουργία...' : 'Δημιουργία Ιατρείου & Λογαριασμού'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const tableHeaderStyle = {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '0.7rem',
    fontWeight: '800',
    color: 'var(--text-light)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
};

const tableCellStyle = {
    padding: '12px 16px',
    fontSize: '0.82rem',
    color: 'var(--text)',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
};

const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontSize: '0.88rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit'
};

const formLabelStyle = {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-light)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '4px'
};

const sectionLabelStyle = {
    fontSize: '0.7rem',
    fontWeight: '800',
    color: 'var(--primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '4px'
};

export default AdminDashboard;