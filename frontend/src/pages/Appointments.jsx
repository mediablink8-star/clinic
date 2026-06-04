import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Search, Filter, ChevronDown, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import AppointmentCard from '../components/AppointmentCard';
import MessageModal from '../components/MessageModal';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { label: 'Όλα', value: '' },
  { label: 'Επιβεβαιωμένα', value: 'CONFIRMED' },
  { label: 'Εκκρεμή', value: 'PENDING' },
  { label: 'Ακυρωμένα', value: 'CANCELLED' },
];

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
                <div key={`apt-sk-${i}`} className="appointment-card" style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem' }}>
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

const Appointments = ({ appointments, token, onConfirm, onCancel, onNewAppointment, isLoading, error, onRetry, clinic }) => {
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [doctorFilter, setDoctorFilter] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [showDeleted, setShowDeleted] = useState(false);
    const [deletedAppointments, setDeletedAppointments] = useState([]);
    const [loadingDeleted, setLoadingDeleted] = useState(false);
    const [restoringId, setRestoringId] = useState(null);

    useEffect(() => {
        if (!showDeleted || !token) { setDeletedAppointments([]); return; }
        setLoadingDeleted(true);
        api.get(`/appointments?_t=${Date.now()}&deleted=true`)
            .then(res => setDeletedAppointments(res.data.data || []))
            .catch(() => {})
            .finally(() => setLoadingDeleted(false));
    }, [showDeleted, token]);

    const handleRestore = async (id) => {
        setRestoringId(id);
        try {
            await api.post(`/appointments/${id}/restore`);
            toast.success('Το ραντεβού επαναφέρθηκε');
            setDeletedAppointments(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            toast.error('Αποτυχία επαναφοράς');
        } finally {
            setRestoringId(null);
        }
    };

    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                const res = await api.get('/doctors');
                setDoctors(res.data.data || []);
            } catch (err) {
                console.error("Failed to fetch doctors:", err);
            }
        };
        if (token) fetchDoctors();
    }, [token]);

    if (error) {
        return <ErrorState onRetry={onRetry} />;
    }

    if (isLoading) {
        return <AppointmentsSkeleton />;
    }

    const filtered = appointments.filter(a => {
        const matchSearch = !search.trim() || (
            a.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
            a.patient?.phone?.includes(search) ||
            a.reason?.toLowerCase().includes(search.toLowerCase())
        );
        const matchStatus = !statusFilter || a.status === statusFilter;
        const matchDoctor = !doctorFilter || a.doctorId === doctorFilter;
        return matchSearch && matchStatus && matchDoctor;
    }).sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        
        if (dateA !== dateB) return dateB - dateA;
        return (b.id || "").localeCompare(a.id || "");
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
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '200px',
                    height: '200px',
                    background: 'var(--primary)',
                    filter: 'blur(10px)',
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
                    {doctors.length > 0 && (
                        <div style={{ position: 'relative' }}>
                            <select
                                value={doctorFilter}
                                onChange={e => setDoctorFilter(e.target.value)}
                                style={{
                                    padding: '10px 30px 10px 14px', borderRadius: '12px',
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    background: doctorFilter ? 'var(--primary)' : 'rgba(255,255,255,0.7)',
                                    color: doctorFilter ? 'white' : '#64748b',
                                    fontSize: '0.82rem', fontWeight: '600',
                                    appearance: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="">Όλοι οι Γιατροί</option>
                                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <ChevronDown size={13} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: doctorFilter ? 'white' : '#64748b' }} />
                        </div>
                    )}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowFilter(f => !f)}
                                style={{
                                    padding: '10px 14px', borderRadius: '12px',
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    background: statusFilter ? 'var(--primary)' : 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                    color: statusFilter ? 'white' : '#64748b',
                                    fontSize: '0.82rem', fontWeight: '600'
                                }}>
                                <Filter size={15} />
                                {statusFilter ? STATUS_OPTIONS.find(o => o.value === statusFilter)?.label || statusFilter : 'Όλα'}
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
                                <button key={opt.value} onClick={() => { setStatusFilter(opt.value); setShowFilter(false); }}
                                    style={{
                                        display: 'block', width: '100%', padding: '9px 16px',
                                        textAlign: 'left', border: 'none', cursor: 'pointer',
                                        fontSize: '0.82rem', fontWeight: '600',
                                        background: statusFilter === opt.value ? 'var(--primary-light)' : 'transparent',
                                        color: statusFilter === opt.value ? 'var(--primary)' : 'var(--text)',
                                    }}>
                                    {opt.label}
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
                        <button
                            onClick={() => setShowDeleted(s => !s)}
                            title="Διαγραμμένα ραντεβού"
                            style={{
                                padding: '10px 14px', borderRadius: '12px',
                                border: `1px solid ${showDeleted ? 'var(--urgent)' : 'var(--border)'}`,
                                background: showDeleted ? 'var(--error-light)' : 'var(--bg-subtle)',
                                color: showDeleted ? 'var(--urgent)' : 'var(--text-light)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '0.82rem', fontWeight: '700', whiteSpace: 'nowrap'
                            }}
                        >
                            <RotateCcw size={14} />
                            {showDeleted ? 'Απόκρυψη Διαγραμμένων' : 'Διαγραμμένα'}
                        </button>
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                title="Ανανέωση"
                                style={{ padding: '10px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-light)' }}
                            >
                                <RefreshCw size={15} />
                            </button>
                        )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.length === 0 ? (
                    <EmptyState
                        type={search ? 'search' : 'calendar'}
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
                            onReassignDoctor={onRetry}
                            clinic={clinic}
                        />
                    ))
                )}
            </div>

            {showDeleted && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--urgent)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.5rem 0' }}>
                        Διαγραμμένα Ραντεβού ({deletedAppointments.length})
                    </h3>
                    {loadingDeleted ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Φόρτωση...</div>
                    ) : deletedAppointments.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Δεν υπάρχουν διαγραμμένα ραντεβού</div>
                    ) : deletedAppointments.map((apt, idx) => (
                        <div key={apt.id} className="animate-fade" style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '1rem 1.25rem',
                            background: 'rgba(239,68,68,0.04)',
                            borderRadius: '16px', border: '1px solid rgba(239,68,68,0.15)',
                            opacity: 0.85,
                            animationDelay: `${idx * 0.04}s`
                        }}>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--secondary)' }}>
                                    {apt.patient?.name || 'Άγνωστος'}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {apt.date ? new Date(apt.date).toLocaleDateString('el-GR') : apt.startTime ? new Date(apt.startTime).toLocaleDateString('el-GR') : ''}
                                    {apt.doctor ? ` · ${apt.doctor.name}` : ''}
                                </div>
                            </div>
                            <button
                                onClick={() => handleRestore(apt.id)}
                                disabled={restoringId === apt.id}
                                style={{
                                    padding: '8px 14px', borderRadius: '10px', border: 'none',
                                    background: restoringId === apt.id ? 'var(--border)' : 'var(--accent)',
                                    color: 'white', fontWeight: '800', fontSize: '0.78rem',
                                    cursor: restoringId === apt.id ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    opacity: restoringId === apt.id ? 0.6 : 1
                                }}
                            >
                                <RotateCcw size={13} />
                                {restoringId === apt.id ? '...' : 'Επαναφορά'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

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
