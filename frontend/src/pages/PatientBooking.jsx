import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, User, Phone, CheckCircle, AlertCircle, MapPin } from 'lucide-react';

const PatientBooking = () => {
    const clinicId = new URLSearchParams(window.location.search).get('clinicId');
    const missedCallId = new URLSearchParams(window.location.search).get('missedCallId'); // Track recovery source
    const [clinic, setClinic] = useState(null);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', reason: '', date: '', time: '', doctorId: '' });
    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [minDate, setMinDate] = useState('');

    useEffect(() => {
        setMinDate(new Date().toISOString().split('T')[0]);
    }, []);

    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

    useEffect(() => {
        const fetchSlots = async () => {
            if (!formData.date || !clinicId) return;
            // No longer waiting for doctorId to be set, empty means "Anyone"
            setSlotsLoading(true);
            try {
                const url = `${API_BASE}/public/clinic/${clinicId}/slots?date=${formData.date}${formData.doctorId ? `&doctorId=${formData.doctorId}` : ''}`;
                const resp = await axios.get(url);
                setAvailableSlots(resp.data.data);
            } catch (err) {
                console.error("Failed to fetch slots:", err);
            } finally {
                setSlotsLoading(false);
            }
        };
        fetchSlots();
    }, [formData.date, formData.doctorId, clinicId]); // Re-fetch when doctor selection changes

    useEffect(() => {
        const fetchClinic = async () => {
            try {
                const resp = await axios.get(`${API_BASE}/public/clinic/${clinicId}`);
                setClinic(resp.data);
            } catch (err) {
                setError("Το ιατρείο δεν βρέθηκε.");
            }
        };
        const fetchDoctors = async () => {
            try {
                const resp = await axios.get(`${API_BASE}/public/clinic/${clinicId}/doctors`);
                setDoctors(resp.data.data || []);
                if (resp.data.data?.length === 1) {
                    setFormData(prev => ({ ...prev, doctorId: resp.data.data[0].id }));
                }
            } catch (err) { }
        };
        
        if (clinicId) {
            fetchClinic();
            fetchDoctors();
        }
        else setError("Δεν βρέθηκε αναγνωριστικό ιατρείου. Παρακαλώ χρησιμοποιήστε τον σύνδεσμο που σας δόθηκε.");
    }, [clinicId]);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        
        // Validate date and time are selected
        if (!formData.date || !formData.time) {
            setError("Παρακαλώ επιλέξτε ημερομηνία και ώρα.");
            setLoading(false);
            return;
        }
        
        try {
            // Send date and time separately - backend will handle timezone conversion
            await axios.post(`${API_BASE}/public/book`, {
                clinicId,
                name: formData.name,
                phone: formData.phone,
                email: formData.email || undefined,
                reason: formData.reason || undefined,
                date: formData.date,
                time: formData.time,
                doctorId: formData.doctorId || undefined,
                missedCallId: missedCallId || undefined, // Link to missed call if this is a recovery booking
            });
            setStep(3);
        } catch (err) {
            if (err.response?.status === 409) {
                setError("Η συγκεκριμένη ώρα μόλις κλείστηκε από άλλον ασθενή. Παρακαλώ επιλέξτε μια άλλη ώρα.");
                // Refresh available slots to show updated availability
                try {
                    const url = `${API_BASE}/public/clinic/${clinicId}/slots?date=${formData.date}${formData.doctorId ? `&doctorId=${formData.doctorId}` : ''}`;
                    const resp = await axios.get(url);
                    setAvailableSlots(resp.data.data);
                    setFormData({ ...formData, time: '' }); // Clear selected time
                } catch (refreshErr) {
                    console.error("Failed to refresh slots:", refreshErr);
                }
            } else if (err.response?.status === 400) {
                setError(err.response.data?.error || "Παρακαλώ ελέγξτε τα στοιχεία σας και δοκιμάστε ξανά.");
            } else if (err.response?.status === 403) {
                setError("Το ιατρείο δεν δέχεται κρατήσεις αυτή τη στιγμή.");
            } else {
                setError("Η κράτηση απέτυχε. Παρακαλώ δοκιμάστε ξανά.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (error && step !== 2) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '2rem' }}>
            <div style={{ textAlign: 'center', padding: '2rem', background: '#fee2e2', borderRadius: '16px', color: '#b91c1c' }}>
                <AlertCircle size={48} style={{ marginBottom: '1rem' }} />
                <p style={{ marginBottom: '1.5rem', fontWeight: '600' }}>{error}</p>
                <button className="btn btn-primary" onClick={() => { setError(null); setStep(1); }}>Δοκιμάστε ξανά</button>
            </div>
        </div>
    );

    if (!clinic) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Clock className="animate-spin" size={48} color="var(--primary)" />
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-mesh)', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <header style={{ textAlign: 'center', marginBottom: 'var(--section-gap)' }}>
                    <div style={{ 
                        width: '100px', 
                        height: '100px', 
                        borderRadius: '32px', 
                        marginBottom: '1.5rem', 
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto',
                        boxShadow: 'var(--shadow-md)',
                        fontSize: '1.5rem',
                        fontWeight: '900',
                        color: 'white',
                        letterSpacing: '-0.5px'
                    }}>
                        CF
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--secondary)', marginBottom: '0.75rem', letterSpacing: '-1.5px' }}>{clinic.name}</h1>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', color: '#64748b', fontSize: '0.95rem', fontWeight: '700', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={18} color="var(--primary)" /> {clinic.location}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={18} color="var(--primary)" /> {clinic.phone}</span>
                    </div>
                </header>

                <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '2.5rem', border: '1px solid var(--border)' }}>
                    {step === 1 && (
                        <div className="animate-fade">
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <User size={20} color="var(--primary)" /> Στοιχεία Ασθενή
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label htmlFor="name" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Ονοματεπώνυμο</label>
                                    <input id="name" type="text" placeholder="Π.χ. Ιωάννης Παπαδόπουλος" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label htmlFor="phone" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Τηλέφωνο</label>
                                        <input id="phone" type="tel" placeholder="69..." style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Email (Προαιρετικά)</label>
                                        <input id="email" type="email" placeholder="email@example.com" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="reason" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Λόγος Επίσκεψης</label>
                                    <textarea id="reason" placeholder="Περιγράψτε σύντομα τι σας απασχολεί..." style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '100px', resize: 'none' }} value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                                </div>
                                <button className="btn btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px', marginTop: '1rem' }} onClick={() => setStep(2)} disabled={!formData.name || !formData.phone}>
                                    Συνέχεια
                                </button>
                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', marginTop: '1rem', lineHeight: 1.5 }}>
                                    Κάνοντας κλικ στο "Συνέχεια", αποδέχεστε την επεξεργασία των δεδομένων σας για τον σκοπό της κράτησης ραντεβού, σύμφωνα με την <span style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => window.open('/privacy', '_blank')}>Πολιτική Απορρήτου</span> του ιατρείου.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-fade">
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={20} color="var(--primary)" /> {doctors.length > 0 ? 'Επιλογή Γιατρού & Ραντεβού' : 'Επιλογή Ημερομηνίας & Ώρας'}
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {doctors.length > 0 && (
                                    <div className="form-group">
                                        <label htmlFor="doctor" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Γιατρός</label>
                                        <select id="doctor" 
                                            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white' }} 
                                            value={formData.doctorId} 
                                            onChange={e => setFormData({ ...formData, doctorId: e.target.value, date: '', time: '' })}
                                        >
                                            {doctors.length > 0 && <option value="">Οποιοσδήποτε διαθέσιμος</option>}
                                            {doctors.map(d => (
                                                <option key={d.id} value={d.id}>{d.name} {d.specialty ? `(${d.specialty})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label htmlFor="date" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Ημερομηνία</label>
                                        <input id="date" 
                                            type="date" 
                                            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} 
                                            value={formData.date} 
                                            onChange={e => setFormData({ ...formData, date: e.target.value })} 
                                            min={minDate} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="time" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Ώρα</label>
                                        <select id="time" 
                                            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: slotsLoading ? '#f1f5f9' : 'white' }} 
                                            value={formData.time} 
                                            onChange={e => setFormData({ ...formData, time: e.target.value })}
                                            disabled={!formData.date || slotsLoading || availableSlots.length === 0}
                                        >
                                            {!formData.date ? (
                                                <option value="">Επιλέξτε ημερομηνία πρώτα...</option>
                                            ) : slotsLoading ? (
                                                <option value="">Φόρτωση διαθεσιμότητας...</option>
                                            ) : availableSlots.length === 0 ? (
                                                <option value="">Κανένα διαθέσιμο ραντεβού</option>
                                            ) : (
                                                <>
                                                    <option value="">Επιλέξτε ώρα...</option>
                                                    {availableSlots.map(slot => (
                                                        <option key={slot} value={slot}>{slot}</option>
                                                    ))}
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button className="btn btn-outline" style={{ flex: 1, padding: '14px', borderRadius: '12px' }} onClick={() => { setStep(1); setError(null); }}>Πίσω</button>
                                    <button className="btn btn-primary" style={{ flex: 2, padding: '14px', borderRadius: '12px' }} onClick={handleSubmit} disabled={!formData.date || !formData.time || loading}>
                                        {loading ? 'Γίνεται κράτηση...' : 'Επιβεβαίωση Ραντεβού'}
                                    </button>
                                </div>
                                {error && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '10px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.875rem', fontWeight: '600' }}>
                                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-fade" style={{ textAlign: 'center', padding: '1rem' }}>
                            <div style={{ width: '80px', height: '80px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                                <CheckCircle size={48} color="#22c55e" />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', marginBottom: '1rem' }}>Το αίτημά σας καταχωρήθηκε!</h2>
                            <p style={{ color: 'var(--text-light)', marginBottom: '2rem', lineHeight: '1.6' }}>
                                Σας ευχαριστούμε, {formData.name.split(' ')[0]}. Το ιατρείο θα επεξεργαστεί το αίτημα σας για τις <strong>{new Date(formData.date + 'T00:00:00').toLocaleDateString('el-GR', { day: 'numeric', month: 'long' })}</strong> στις <strong>{formData.time}</strong> και θα επικοινωνήσει μαζί σας για επιβεβαίωση.
                            </p>
            <button className="btn btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px' }} onClick={() => { setStep(1); setFormData({ name: '', phone: '', email: '', reason: '', date: '', time: '', doctorId: '' }); setAvailableSlots([]); setError(null); }}>
                Νέα Κράτηση
                            </button>
                        </div>
                    )}
                </div>

                <footer style={{ textAlign: 'center', marginTop: '3rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '8px', 
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '900',
                            color: 'white',
                            letterSpacing: '-0.5px'
                        }}>
                            CF
                        </div>
                        <span style={{ fontWeight: '700', color: 'var(--secondary)', fontSize: '1rem' }}>ClinicFlow</span>
                    </div>
                    <p style={{ fontSize: '0.75rem' }}>Ασφαλής Σύνδεση • Προστασία Δεδομένων</p>
                </footer>
            </div>
        </div>
    );
};

export default PatientBooking;
