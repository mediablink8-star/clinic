import { useState } from 'react';
import { User, Clock, Search, MessageSquare, UserPlus, X, Download } from 'lucide-react';
import api from '../lib/api';
import MessageModal from '../components/MessageModal';

const NewPatientModal = ({ onClose, onCreated, token }) => {
    const [form, setForm] = useState({ name: '', phone: '', email: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.phone) {
            setError('Το όνομα και το τηλέφωνο είναι υποχρεωτικά.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await api.post('/patients', form);
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
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={20} />
                    </button>
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

const Patients = ({ patients, setCurrentTab, token, onPatientCreated }) => {
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showNewPatient, setShowNewPatient] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = patients.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.includes(search) ||
        p.email?.toLowerCase().includes(search.toLowerCase())
    );

    const handleExportCSV = () => {
        const rows = [
            ['Ονοματεπώνυμο', 'Τηλέφωνο', 'Email', 'Ραντεβού', 'Εγγραφή'],
            ...patients.map(p => [
                p.name || '',
                p.phone || '',
                p.email || '',
                p.appointments?.length || 0,
                p.createdAt ? new Date(p.createdAt).toLocaleDateString('el-GR') : ''
            ])
        ];
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ασθενείς_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <section className="animate-fade">
            <header className="page-header">
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>Αρχείο Ασθενών</h1>
                        <p style={{ fontWeight: '600', opacity: 0.8 }}>Λεπτομερές ιστορικό ασθενών και στοιχεία επικοινωνίας.</p>
                    </div>
                    <div className="hidden-mobile" style={{ gap: '8px' }}>
                        <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(8px)' }}>
                            <Download size={16} />
                            Εξαγωγή CSV
                        </button>
                        <button onClick={() => setShowNewPatient(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <UserPlus size={18} />
                            Νέος Ασθενής
                        </button>
                    </div>
                </div>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'var(--primary)', filter: 'blur(100px)', opacity: 0.3, borderRadius: '50%' }}></div>
            </header>

            <div style={{ marginBottom: '2rem' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" placeholder="Αναζήτηση ασθενή..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem' }} />
                </div>
            </div>

            <div className="appointment-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-subtle)', borderRadius: '20px', border: '2px dashed var(--border)' }}>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>{search ? 'Δεν βρέθηκαν αποτελέσματα.' : 'Δεν βρέθηκαν ασθενείς.'}</p>
                    </div>
                ) : (
                    filtered.map((p, idx) => (
                        <div key={p.id} className="animate-fade card-hover patient-card-responsive" style={{
                            animationDelay: `${idx * 0.05}s`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem 1.25rem',
                            background: 'var(--glass-surface)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderRadius: '18px',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all 0.25s ease'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                                <div style={{ background: 'rgba(99,102,241,0.1)', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <User color="var(--primary)" size={18} />
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <h3 style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--secondary)', marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h3>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.phone}</p>
                                </div>
                                <div className="hidden-mobile" style={{ marginLeft: '1rem', padding: '4px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px' }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                        {p.appointments?.length || 0} ραντεβού
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => setSelectedPatient(p)} title="Αποστολή Μηνύματος" style={{ padding: '8px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <MessageSquare size={16} />
                                </button>
                                <button onClick={() => setCurrentTab('appointments')} title="Προβολή Ραντεβού" style={{ padding: '8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-light)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <Clock size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <MessageModal isOpen={!!selectedPatient} onClose={() => setSelectedPatient(null)} patient={selectedPatient || {}} token={token} />

            {showNewPatient && (
                <NewPatientModal token={token} onClose={() => setShowNewPatient(false)} onCreated={onPatientCreated} />
            )}
        </section>
    );
};

export default Patients;
