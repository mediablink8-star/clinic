import { useState } from 'react';
import { Search, Filter, ChevronDown, Plus } from 'lucide-react';
import AppointmentCard from '../components/AppointmentCard';
import MessageModal from '../components/MessageModal';

const STATUS_OPTIONS = ['Όλα', 'CONFIRMED', 'PENDING', 'CANCELLED'];

const Appointments = ({ appointments, token, onConfirm, onCancel, onNewAppointment }) => {
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('Όλα');
    const [showFilter, setShowFilter] = useState(false);

    const filtered = appointments.filter(a => {
        const matchSearch = !search.trim() || (
            a.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
            a.patient?.phone?.includes(search) ||
            a.reason?.toLowerCase().includes(search.toLowerCase())
        );
        const matchStatus = statusFilter === 'Όλα' || a.status === statusFilter;
        return matchSearch && matchStatus;
    });

    return (
        <section className="animate-fade">
            <header className="page-header">
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1>Πρόγραμμα Ραντεβού</h1>
                    <p style={{ fontWeight: '600', opacity: 0.8 }}>Διαχείριση και ανασκόπηση όλων των προγραμματισμένων επισκέψεων.</p>
                </div>
                {/* Subtle background element */}
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '200px',
                    height: '200px',
                    background: 'var(--primary)',
                    filter: 'blur(100px)',
                    opacity: 0.3,
                    borderRadius: '50%'
                }}></div>
            </header>

            <div className="appointments-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Όλα τα Ραντεβού</h2>
                <div className="appointments-toolbar__controls" style={{ display: 'flex', gap: '10px', flex: 1, justifyContent: 'flex-end' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Αναζήτηση..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                padding: '10px 12px 10px 38px',
                                borderRadius: '12px',
                                border: '1px solid var(--input-border, rgba(0,0,0,0.08))',
                                fontSize: '0.85rem',
                                width: '220px',
                                background: 'var(--input-bg, rgba(255,255,255,0.7))',
                                color: 'var(--text)',
                                backdropFilter: 'blur(8px)',
                            }}
                        />
                    </div>
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowFilter(f => !f)}
                                style={{
                                    padding: '10px 14px', borderRadius: '12px',
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    background: statusFilter !== 'Όλα' ? 'var(--primary)' : 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                    color: statusFilter !== 'Όλα' ? 'white' : '#64748b',
                                    fontSize: '0.82rem', fontWeight: '600'
                                }}>
                                <Filter size={15} />
                                {statusFilter !== 'Όλα' ? statusFilter : 'Φίλτρο'}
                                <ChevronDown size={13} />
                            </button>
                            {showFilter && (
                                <div style={{
                                    position: 'absolute', top: '110%', right: 0, zIndex: 50,
                                    background: 'var(--modal-bg)',
                                    borderRadius: '12px', boxShadow: 'var(--shadow-lg)',
                                    border: '1px solid var(--modal-border)', overflow: 'hidden', minWidth: '140px'
                                }}>
                                    {STATUS_OPTIONS.map(opt => (
                                        <button key={opt} onClick={() => { setStatusFilter(opt); setShowFilter(false); }}
                                            style={{
                                                display: 'block', width: '100%', padding: '9px 16px',
                                                textAlign: 'left', border: 'none', cursor: 'pointer',
                                                fontSize: '0.82rem', fontWeight: '600',
                                                background: statusFilter === opt ? 'var(--primary-light)' : 'transparent',
                                                color: statusFilter === opt ? 'var(--primary)' : 'var(--text)',
                                            }}>
                                            {opt === 'CONFIRMED' ? 'Επιβεβαιωμένα' : opt === 'PENDING' ? 'Εκκρεμή' : opt === 'CANCELLED' ? 'Ακυρωμένα' : opt}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {onNewAppointment && (
                            <button
                                onClick={onNewAppointment}
                                className="btn btn-primary"
                                style={{ padding: '10px 14px', borderRadius: '12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                            >
                                <Plus size={14} strokeWidth={3} />
                                Νέο Ραντεβού
                            </button>
                        )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', background: 'rgba(248,250,252,0.8)', borderRadius: '20px', border: '2px dashed var(--border)' }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{search ? 'Δεν βρέθηκαν αποτελέσματα.' : 'Δεν υπάρχουν προγραμματισμένα ραντεβού.'}</p>
                    </div>
                ) : (
                    filtered.map((apt, idx) => (
                        <AppointmentCard
                            key={apt.id}
                            appointment={apt}
                            delay={`${idx * 0.05}s`}
                            showActions={true}
                            onConfirm={onConfirm}
                            onCancel={onCancel}
                            onMessage={(p) => setSelectedPatient(p)}
                        />
                    ))
                )}
            </div>

            <MessageModal 
                isOpen={!!selectedPatient} 
                onClose={() => setSelectedPatient(null)} 
                patient={selectedPatient || {}} 
                token={token}
            />
        </section>
    );
};

export default Appointments;
