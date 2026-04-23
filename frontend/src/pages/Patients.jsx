import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Clock, Search, MessageSquare, UserPlus, X, Download, Send, Calendar, ChevronRight, Phone, Mail, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// ─── New Patient Modal ────────────────────────────────────────────────────────
const NewPatientModal = ({ onClose, onCreated, token }) => {
    const [form, setForm] = useState({ name: '', phone: '', email: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.phone) { setError('Το όνομα και το τηλέφωνο είναι υποχρεωτικά.'); return; }
        setLoading(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/patients`, form, { headers: { Authorization: `Bearer ${token}` } });
            onCreated();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Σφάλμα κατά τη δημιουργία ασθενή.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--modal-bg)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid var(--modal-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text)' }}>Νέος Ασθενής</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>Ονοματεπώνυμο *</label>
                        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="π.χ. Γιώργος Παπαδόπουλος" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>Τηλέφωνο *</label>
                        <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="π.χ. 6912345678" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>Email (προαιρετικό)</label>
                        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="π.χ. user@example.com" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                    </div>
                    {error && <p style={{ color: '#ef4444', fontSize: '0.8125rem', margin: 0 }}>{error}</p>}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--cancel-border)', background: 'var(--cancel-bg)', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', color: 'var(--cancel-color)' }}>Ακύρωση</button>
                        <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.875rem', opacity: loading ? 0.7 : 1 }}>
                            {loading ? 'Αποθήκευση...' : 'Δημιουργία'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Patient Profile Panel ────────────────────────────────────────────────────
const PatientProfilePanel = ({ patient, token, onClose }) => {
    const [smsText, setSmsText] = useState('');
    const [sending, setSending] = useState(false);
    const [tab, setTab] = useState('history'); // 'history' | 'message'

    const appointments = patient.appointments || [];
    const sortedApts = [...appointments].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    const statusColor = { CONFIRMED: '#10b981', PENDING: '#f59e0b', CANCELLED: '#ef4444', COMPLETED: '#6366f1', NO_SHOW: '#94a3b8' };
    const statusLabel = { CONFIRMED: 'Επιβεβαιωμένο', PENDING: 'Εκκρεμεί', CANCELLED: 'Ακυρώθηκε', COMPLETED: 'Ολοκληρώθηκε', NO_SHOW: 'Δεν εμφανίστηκε' };

    const handleSend = async () => {
        if (!smsText.trim() || sending) return;
        setSending(true);
        try {
            await axios.post(`${API_BASE}/messages/send`, { patientId: patient.id, message: smsText.trim() }, { headers: { Authorization: `Bearer ${token}` } });
            setSmsText('');
            toast.success('SMS εστάλη!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Αποτυχία αποστολής.');
        } finally {
            setSending(false);
        }
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex' }}>
            <div style={{ flex: 1, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
            <div style={{ width: '400px', background: 'var(--modal-bg)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.15)', animation: 'slideInRight 0.2s ease' }}>
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary)' }}>
                                {patient.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>{patient.name}</h3>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                    {patient.phone && <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '3px' }}><Phone size={11} />{patient.phone}</span>}
                                    {patient.email && <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '3px' }}><Mail size={11} />{patient.email}</span>}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                    </div>
                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { label: 'Ραντεβού', value: appointments.length },
                            { label: 'Ολοκληρωμένα', value: appointments.filter(a => a.status === 'COMPLETED').length },
                            { label: 'Εγγραφή', value: patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('el-GR', { month: 'short', year: 'numeric' }) : '—' },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ flex: 1, padding: '8px 10px', borderRadius: '10px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--text)' }}>{value}</div>
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-light)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                    {[['history', 'Ιστορικό'], ['message', 'Αποστολή SMS']].map(([key, label]) => (
                        <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: '10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', color: tab === key ? 'var(--primary)' : 'var(--text-light)', borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.15s' }}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                    {tab === 'history' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {sortedApts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)', fontSize: '0.85rem' }}>Δεν υπάρχουν ραντεβού ακόμα.</div>
                            ) : sortedApts.map(apt => (
                                <div key={apt.id} style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>
                                                {apt.reason || 'Χωρίς αιτιολογία'}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                                                {new Date(apt.startTime).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(apt.startTime).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: `${statusColor[apt.status]}18`, color: statusColor[apt.status] }}>
                                            {statusLabel[apt.status] || apt.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'message' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', margin: 0 }}>Αποστολή SMS στον {patient.name} ({patient.phone})</p>
                            <textarea
                                value={smsText}
                                onChange={e => setSmsText(e.target.value)}
                                placeholder="Γράψτε το μήνυμά σας..."
                                rows={5}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.85rem', resize: 'none', boxSizing: 'border-box', outline: 'none' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>{smsText.length} χαρακτήρες</span>
                                <button onClick={handleSend} disabled={!smsText.trim() || sending} style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '0.82rem', cursor: (!smsText.trim() || sending) ? 'not-allowed' : 'pointer', opacity: (!smsText.trim() || sending) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Send size={13} /> {sending ? 'Αποστολή...' : 'Αποστολή SMS'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
        </div>,
        document.body
    );
};

// ─── Main Patients Page ───────────────────────────────────────────────────────
const PatientsSkeleton = () => (
    <div className="animate-fade">
        <div style={{
            marginBottom: 'var(--section-gap)',
            padding: '2rem',
            background: 'linear-gradient(135deg, var(--secondary) 0%, #1a253a 100%)',
            borderRadius: '24px',
            position: 'relative',
            overflow: 'hidden',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Skeleton height="48px" width="300px" borderRadius="12px" style={{ marginBottom: '12px' }} />
                    <Skeleton height="20px" width="200px" borderRadius="8px" />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Skeleton height="44px" width="140px" borderRadius="12px" />
                    <Skeleton height="44px" width="140px" borderRadius="12px" />
                </div>
            </div>
        </div>
        <Skeleton height="48px" width="100%" borderRadius="12px" style={{ marginBottom: '1.5rem' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[...Array(5)].map((_, i) => (
                <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    background: 'var(--glass-surface)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '16px',
                    border: '1px solid var(--border)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Skeleton height="42px" width="42px" borderRadius="12px" />
                        <div>
                            <Skeleton height="20px" width="180px" borderRadius="8px" style={{ marginBottom: '6px' }} />
                            <Skeleton height="14px" width="120px" borderRadius="6px" />
                        </div>
                    </div>
                    <Skeleton height="24px" width="80px" borderRadius="8px" />
                </div>
            ))}
        </div>
    </div>
);

const Patients = ({ patients, setCurrentTab, token, onPatientCreated, isLoading }) => {
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showNewPatient, setShowNewPatient] = useState(false);
    const [search, setSearch] = useState('');

    if (isLoading) {
        return <PatientsSkeleton />;
    }

    const filtered = patients.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.includes(search) ||
        p.email?.toLowerCase().includes(search.toLowerCase())
    );

    const handleExportCSV = () => {
        const rows = [
            ['Ονοματεπώνυμο', 'Τηλέφωνο', 'Email', 'Ραντεβού', 'Εγγραφή'],
            ...patients.map(p => [p.name || '', p.phone || '', p.email || '', p.appointments?.length || 0, p.createdAt ? new Date(p.createdAt).toLocaleDateString('el-GR') : ''])
        ];
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `ασθενείς_${new Date().toISOString().split('T')[0]}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <section className="animate-fade">
            <header style={{ marginBottom: 'var(--section-gap)', padding: '2rem', background: 'linear-gradient(135deg, var(--secondary) 0%, #1a253a 100%)', borderRadius: '24px', color: 'white', boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-1.5px', marginBottom: '8px', color: 'white' }}>Αρχείο Ασθενών</h1>
                        <p style={{ fontSize: '1.1rem', fontWeight: '600', opacity: 0.8 }}>{patients.length} ασθενείς καταχωρημένοι</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                            <Download size={16} /> Εξαγωγή CSV
                        </button>
                        <button onClick={() => setShowNewPatient(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}>
                            <UserPlus size={18} /> Νέος Ασθενής
                        </button>
                    </div>
                </div>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'var(--primary)', filter: 'blur(100px)', opacity: 0.3, borderRadius: '50%' }} />
            </header>

            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" placeholder="Αναζήτηση ασθενή..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem' }} />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        title={search ? 'Δεν βρέθηκαν αποτελέσματα' : 'Δεν υπάρχουν ασθενείς'}
                        subtitle={search ? 'Δοκιμάστε διαφορετική αναζήτηση.' : 'Προσθέστε τον πρώτο σας ασθενή για να ξεκινήσετε.'}
                        action={
                            <button onClick={() => setShowNewPatient(true)} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                                <UserPlus size={16} /> Νέος Ασθενής
                            </button>
                        }
                    />
                ) : filtered.map((p, idx) => (
                    <div
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className="animate-fade card-hover"
                        style={{ animationDelay: `${idx * 0.04}s`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'var(--glass-surface)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '900', color: 'var(--primary)', flexShrink: 0 }}>
                                {p.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                                <h3 style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--secondary)', marginBottom: '2px' }}>{p.name}</h3>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: '500', margin: 0 }}>
                                    {p.phone}{p.email ? ` · ${p.email}` : ''}
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '700', padding: '3px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px' }}>
                                {p.appointments?.length || 0} ραντεβού
                            </span>
                            <ChevronRight size={16} color="var(--text-light)" />
                        </div>
                    </div>
                ))}
            </div>

            {selectedPatient && <PatientProfilePanel patient={selectedPatient} token={token} onClose={() => setSelectedPatient(null)} />}
            {showNewPatient && <NewPatientModal token={token} onClose={() => setShowNewPatient(false)} onCreated={onPatientCreated} />}
        </section>
    );
};

export default Patients;
