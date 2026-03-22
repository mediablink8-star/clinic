import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, User, Phone, CheckCircle, AlertCircle, MapPin } from 'lucide-react';

const PatientBooking = () => {
    const clinicId = new URLSearchParams(window.location.search).get('clinicId');
    const [clinic, setClinic] = useState(null);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', reason: '', date: '', time: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

    useEffect(() => {
        const fetchClinic = async () => {
            try {
                const resp = await axios.get(`${API_BASE}/public/clinic/${clinicId}`);
                setClinic(resp.data);
            } catch (err) {
                setError("Το ιατρείο δεν βρέθηκε.");
            }
        };
        if (clinicId) fetchClinic();
        else setError("Δεν βρέθηκε αναγνωριστικό ιατρείου. Παρακαλώ χρησιμοποιήστε τον σύνδεσμο που σας δόθηκε.");
    }, [clinicId]);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            const startTime = new Date(`${formData.date}T${formData.time}`);
            await axios.post(`${API_BASE}/public/book`, { ...formData, clinicId, startTime });
            setStep(3);
        } catch (err) {
            setError("Η κράτηση απέτυχε. Παρακαλώ δοκιμάστε ξανά.");
        } finally {
            setLoading(false);
        }
    };

    if (error) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '2rem' }}>
            <div style={{ textAlign: 'center', padding: '2rem', background: '#fee2e2', borderRadius: '16px', color: '#b91c1c' }}>
                <AlertCircle size={48} style={{ marginBottom: '1rem' }} />
                <p>{error}</p>
            </div>
        </div>
    );

    if (!clinic) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Clock className="animate-spin" size={48} color="var(--primary)" />
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <header style={{ textAlign: 'center', marginBottom: 'var(--section-gap)' }}>
                    {clinic.avatarUrl && <img src={clinic.avatarUrl} alt={clinic.name} style={{ width: '100px', height: '100px', borderRadius: '32px', marginBottom: '1.5rem', objectFit: 'cover', boxShadow: 'var(--shadow-md)' }} />}
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--secondary)', marginBottom: '0.75rem', letterSpacing: '-1.5px' }}>{clinic.name}</h1>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', color: '#64748b', fontSize: '0.95rem', fontWeight: '700' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={18} color="var(--primary)" /> {clinic.location}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={18} color="var(--primary)" /> {clinic.phone}</span>
                    </div>
                </header>

                <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '3.5rem', border: '1px solid var(--border)' }}>
                    {step === 1 && (
                        <div className="animate-fade">
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <User size={20} color="var(--primary)" /> Στοιχεία Ασθενή
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Ονοματεπώνυμο</label>
                                    <input type="text" placeholder="Π.χ. Ιωάννης Παπαδόπουλος" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Τηλέφωνο</label>
                                        <input type="tel" placeholder="69..." style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Email (Προαιρετικά)</label>
                                        <input type="email" placeholder="email@example.com" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Λόγος Επίσκεψης</label>
                                    <textarea placeholder="Περιγράψτε σύντομα τι σας απασχολεί..." style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '100px', resize: 'none' }} value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                                </div>
                                <button className="btn btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px', marginTop: '1rem' }} onClick={() => setStep(2)} disabled={!formData.name || !formData.phone || !formData.reason}>
                                    Συνέχεια
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-fade">
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={20} color="var(--primary)" /> Επιλογή Ημερομηνίας & Ώρας
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Ημερομηνία</label>
                                        <input type="date" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} min={new Date().toISOString().split('T')[0]} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>Ώρα</label>
                                        <select style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }} value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })}>
                                            <option value="">Επιλέξτε ώρα...</option>
                                            <option value="09:00">09:00</option>
                                            <option value="10:00">10:00</option>
                                            <option value="11:00">11:00</option>
                                            <option value="12:00">12:00</option>
                                            <option value="13:00">13:00</option>
                                            <option value="17:00">17:00</option>
                                            <option value="18:00">18:00</option>
                                            <option value="19:00">19:00</option>
                                            <option value="20:00">20:00</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button className="btn btn-outline" style={{ flex: 1, padding: '14px', borderRadius: '12px' }} onClick={() => setStep(1)}>Πίσω</button>
                                    <button className="btn btn-primary" style={{ flex: 2, padding: '14px', borderRadius: '12px' }} onClick={handleSubmit} disabled={!formData.date || !formData.time || loading}>
                                        {loading ? 'Γίνεται κράτηση...' : 'Επιβεβαίωση Ραντεβού'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-fade" style={{ textAlign: 'center', padding: '1rem' }}>
                            <div style={{ width: '80px', height: '80px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                                <CheckCircle size={48} color="#22c55e" />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', marginBottom: '1rem' }}>Το αίτημά σας καταχωρήθηκε!</h2>
                            <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: '1.6' }}>
                                Σας ευχαριστούμε, {formData.name.split(' ')[0]}. Το ιατρείο θα επεξεργαστεί το αίτημα σας για τις <strong>{new Date(formData.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' })}</strong> στις <strong>{formData.time}</strong> και θα επικοινωνήσει μαζί σας για επιβεβαίωση.
                            </p>
                            <button className="btn btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px' }} onClick={() => window.location.reload()}>
                                Νέα Κράτηση
                            </button>
                        </div>
                    )}
                </div>

                <footer style={{ textAlign: 'center', marginTop: '3rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                    <p>Powered by ClinicFlow SaaS • Ασφαλής Σύνδεση</p>
                </footer>
            </div>
        </div>
    );
};

export default PatientBooking;
