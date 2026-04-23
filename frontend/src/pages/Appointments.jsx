import { useState } from 'react';
import { Search, Filter, ChevronDown, Plus, Calendar } from 'lucide-react';
import AppointmentCard from '../components/AppointmentCard';
import MessageModal from '../components/MessageModal';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const STATUS_OPTIONS = ['Όλα', 'CONFIRMED', 'PENDING', 'CANCELLED'];

const AppointmentsSkeleton = () => (
    <div className="animate-fade">
        <div style={{
            marginBottom: 'var(--section-gap)',
            padding: '2rem',
            background: 'linear-gradient(135deg, var(--secondary) 0%, #1a253a 100%)',
            borderRadius: '24px',
            position: 'relative',
            overflow: 'hidden',
        }}>
            <Skeleton height="48px" width="300px" borderRadius="12px" style={{ marginBottom: '12px' }} />
            <Skeleton height="20px" width="400px" borderRadius="8px" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '0.75rem' }}>
            <Skeleton height="20px" width="150px" borderRadius="8px" />
            <div style={{ display: 'flex', gap: '10px' }}>
                <Skeleton height="42px" width="220px" borderRadius="12px" />
                <Skeleton height="42px" width="100px" borderRadius="12px" />
                <Skeleton height="42px" width="140px" borderRadius="12px" />
            </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[...Array(4)].map((_, i) => (
                <div key={i} className="appointment-card" style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem' }}>
                    <Skeleton height="80px" width="100px" borderRadius="14px" />
                    <div style={{ flex: 1 }}>
                        <Skeleton height="24px" width="200px" borderRadius="8px" style={{ marginBottom: '8px' }} />
                        <Skeleton height="16px" width="150px" borderRadius="6px" />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Skeleton height="32px" width="32px" borderRadius="10px" />
                        <Skeleton height="32px" width="32px" borderRadius="10px" />
                        <Skeleton height="32px" width="32px" borderRadius="10px" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const Appointments = ({ appointments, token, onConfirm, onCancel, onNewAppointment, isLoading }) => {
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('Όλα');
    const [showFilter, setShowFilter] = useState(false);

    if (isLoading) {
        return <AppointmentsSkeleton />;
    }

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
            <header style={{
                marginBottom: 'var(--section-gap)',
                padding: '2rem',
                background: 'linear-gradient(135deg, var(--secondary) 0%, #1a253a 100%)',
                borderRadius: '24px',
                color: 'white',
                boxShadow: 'var(--shadow-lg)',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-1.5px', marginBottom: '8px', color: 'white' }}>Πρόγραμμα Ραντεβού</h1>
                    <p style={{ fontSize: '1.1rem', fontWeight: '600', opacity: 0.8 }}>Διαχείριση και ανασκόπηση όλων των προγραμματισμένων επισκέψεων.</p>
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
                    <EmptyState
                        icon={Calendar}
                        title={search ? 'Δεν βρέθηκαν αποτελέσματα' : 'Δεν υπάρχουν ραντεβού'}
                        subtitle={search ? 'Δοκιμάστε διαφορετική αναζήτηση.' : 'Κλείστε το πρώτο σας ραντεβού για να ξεκινήσετε.'}
                        action={onNewAppointment && (
                            <button onClick={onNewAppointment} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                                <Plus size={16} /> Νέο Ραντεβού
                            </button>
                        )}
                    />
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
