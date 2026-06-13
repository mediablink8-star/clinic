import React, { useState, useEffect } from 'react';
import { API_BASE } from '../lib/constants';
import axios from 'axios';
import { Calendar, Clock, User, Phone, CheckCircle, AlertCircle, MapPin, ChevronRight, ChevronLeft, Mail, FileText } from 'lucide-react';

const PatientBooking = () => {
    const clinicId = new URLSearchParams(window.location.search).get('clinicId');
    const missedCallId = new URLSearchParams(window.location.search).get('missedCallId'); 
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

    
    useEffect(() => {
        const fetchSlots = async () => {
            if (!formData.date || !clinicId) return;
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
    }, [formData.date, formData.doctorId, clinicId]);

    useEffect(() => {
        const fetchClinic = async () => {
            try {
                const resp = await axios.get(`${API_BASE}/public/clinic/${clinicId}`);
                setClinic(resp.data.data);
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
        
        if (!formData.date || !formData.time) {
            setError("Παρακαλώ επιλέξτε ημερομηνία και ώρα.");
            setLoading(false);
            return;
        }
        
        try {
            await axios.post(`${API_BASE}/public/book`, {
                clinicId,
                name: formData.name,
                phone: formData.phone,
                email: formData.email || undefined,
                reason: formData.reason || undefined,
                date: formData.date,
                time: formData.time,
                doctorId: formData.doctorId || undefined,
                missedCallId: missedCallId || undefined,
            });
            setStep(3);
        } catch (err) {
            if (err.response?.status === 409) {
                setError("Η συγκεκριμένη ώρα μόλις κλείστηκε από άλλον ασθενή. Παρακαλώ επιλέξτε μια άλλη ώρα.");
                try {
                    const url = `${API_BASE}/public/clinic/${clinicId}/slots?date=${formData.date}${formData.doctorId ? `&doctorId=${formData.doctorId}` : ''}`;
                    const resp = await axios.get(url);
                    setAvailableSlots(resp.data.data);
                    setFormData(prev => ({ ...prev, time: '' }));
                } catch (refreshErr) {}
            } else if (err.response?.status === 400) {
                setError(err.response.data?.error || "Παρακαλώ ελέγξτε τα στοιχεία σας και δοκιμάστε ξανά.");
            } else {
                setError("Η κράτηση απέτυχε. Παρακαλώ δοκιμάστε ξανά.");
            }
        } finally {
            setLoading(false);
        }
    };

    const StepIndicator = ({ currentStep }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2.5rem' }}>
            {[1, 2, 3].map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.875rem', fontWeight: '800',
                        background: currentStep === s ? 'var(--primary)' : currentStep > s ? 'var(--accent)' : 'var(--bg-subtle)',
                        color: currentStep >= s ? 'white' : 'var(--text-muted)',
                        transition: 'all 0.3s ease',
                        boxShadow: currentStep === s ? '0 8px 16px -4px var(--primary-glow)' : 'none'
                    }}>
                        {currentStep > s ? <CheckCircle size={16} /> : s}
                    </div>
                    {s < 3 && <div style={{ width: '40px', height: '2px', background: currentStep > s ? 'var(--accent)' : 'var(--border)', opacity: 0.5 }} />}
                </div>
            ))}
        </div>
    );

    if (error && step !== 2) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '2rem' }}>
            <div className="booking-glass" style={{ textAlign: 'center', maxWidth: '400px', background: '#fff5f5', borderColor: '#feb2b2' }}>
                <AlertCircle size={48} color="#f56565" style={{ marginBottom: '1rem', margin: '0 auto' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#c53030', marginBottom: '0.75rem' }}>Σφάλμα</h2>
                <p style={{ marginBottom: '2rem', color: '#9b2c2c', fontWeight: '500' }}>{error}</p>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setError(null); setStep(1); }}>Δοκιμάστε ξανά</button>
            </div>
        </div>
    );

    if (!clinic && !error) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '12px' }}>
            <Clock className="animate-spin" size={32} color="var(--primary)" />
            <span style={{ fontWeight: '700', color: 'var(--text-light)' }}>Φόρτωση ιατρείου...</span>
        </div>
    );

    return (
        <div className="booking-page" style={{ minHeight: '100vh', background: 'transparent', padding: '4rem 1rem' }}>
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                {/* Header */}
                <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{ 
                        width: '80px', height: '80px', borderRadius: '24px', 
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem auto', boxShadow: 'var(--shadow-primary)',
                        fontSize: '1.5rem', fontWeight: '900', color: 'white'
                    }}>
                        {clinic.name.substring(0, 1).toUpperCase()}{clinic.name.split(' ').length > 1 ? clinic.name.split(' ')[1].substring(0, 1).toUpperCase() : 'C'}
                    </div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: '950', color: 'var(--secondary)', marginBottom: '0.75rem', letterSpacing: '-0.04em' }}>{clinic.name}</h1>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', color: 'var(--text-light)', fontSize: '0.9rem', fontWeight: '600' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={16} color="var(--primary)" /> {clinic.location}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={16} color="var(--primary)" /> {clinic.phone}</span>
                    </div>
                </header>

                <div className="booking-glass animate-slide">
                    <StepIndicator currentStep={step} />

                    {step === 1 && (
                        <div className="animate-fade">
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '2rem' }}>Στοιχεία Ασθενή</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <label className="booking-label"><User size={14} /> Ονοματεπώνυμο *</label>
                                    <input type="text" placeholder="Π.χ. Ιωάννης Παπαδόπουλος" className="booking-input" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} />
                                    {formData.name && formData.name.length < 2 && (
                                        <small style={{ color: '#ef4444', fontWeight: 600, marginTop: 4, display: 'block' }}>Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες</small>
                                    )}
                                </div>
                                <div className="booking-name-grid">
                                    <div>
                                        <label className="booking-label"><Phone size={14} /> Τηλέφωνο *</label>
                                        <input type="tel" placeholder="69XXXXXXXX" className="booking-input" value={formData.phone} onChange={e => {
                                            const digits = e.target.value.replace(/\D/g, '');
                                            setFormData(prev => ({ ...prev, phone: digits }));
                                        }} />
                                        {formData.phone && formData.phone.length > 0 && formData.phone.length < 10 && (
                                            <small style={{ color: '#ef4444', fontWeight: 600, marginTop: 4, display: 'block' }}>Το τηλέφωνο πρέπει να έχει τουλάχιστον 10 ψηφία</small>
                                        )}
                                    </div>
                                    <div>
                                        <label className="booking-label"><Mail size={14} /> Email (Προαιρετικά)</label>
                                        <input type="email" placeholder="email@example.gr" className="booking-input" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} />
                                        {formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && (
                                            <small style={{ color: '#ef4444', fontWeight: 600, marginTop: 4, display: 'block' }}>Μη έγκυρη διεύθυνση email</small>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="booking-label"><FileText size={14} /> Λόγος Επίσκεψης</label>
                                    <textarea className="booking-input" placeholder="Περιγράψτε σύντομα τι σας απασχολεί..." style={{ minHeight: '100px', resize: 'none' }} value={formData.reason} onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))} />
                                </div>
                                <button className="btn btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '16px', marginTop: '1rem', fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => {
                                    const errors = [];
                                    if (!formData.name || formData.name.length < 2) errors.push('Ονοματεπώνυμο (τουλάχιστον 2 χαρακτήρες)');
                                    if (!formData.phone || formData.phone.length < 10) errors.push('Τηλέφωνο (τουλάχιστον 10 ψηφία)');
                                    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.push('Email');
                                    if (errors.length > 0) {
                                        setError('Παρακαλώ συμπληρώστε σωστά: ' + errors.join(', '));
                                        return;
                                    }
                                    setError(null);
                                    setStep(2);
                                }} disabled={!formData.name || !formData.phone || formData.phone.length < 10 || (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))}>
                                    Συνέχεια <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-fade">
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '2rem' }}>Επιλογή Ραντεβού</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {doctors.length > 0 && (
                                    <div>
                                        <label className="booking-label"><User size={14} /> Επιλογή Γιατρού</label>
                                        <div className="booking-doctors-grid">
                                            <button 
                                                onClick={() => setFormData(prev => ({ ...prev, doctorId: '', date: '', time: '' }))}
                                                style={{
                                                    padding: '12px', borderRadius: '12px', border: '1.5px solid', 
                                                    borderColor: !formData.doctorId ? 'var(--primary)' : 'var(--border)',
                                                    background: !formData.doctorId ? 'var(--primary-light)' : 'white',
                                                    color: !formData.doctorId ? 'var(--primary)' : 'var(--text)',
                                                    fontSize: '0.85rem', fontWeight: '700', transition: 'all 0.2s', cursor: 'pointer'
                                                }}
                                            >
                                                Οποιοσδήποτε
                                            </button>
                                            {doctors.map(d => (
                                                <button 
                                                    key={d.id}
                                                    onClick={() => setFormData(prev => ({ ...prev, doctorId: d.id, date: '', time: '' }))}
                                                    style={{
                                                        padding: '12px', borderRadius: '12px', border: '1.5px solid', 
                                                        borderColor: formData.doctorId === d.id ? 'var(--primary)' : 'var(--border)',
                                                        background: formData.doctorId === d.id ? 'var(--primary-light)' : 'white',
                                                        color: formData.doctorId === d.id ? 'var(--primary)' : 'var(--text)',
                                                        fontSize: '0.85rem', fontWeight: '700', transition: 'all 0.2s', cursor: 'pointer',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    {d.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                                    <div>
                                        <label className="booking-label"><Calendar size={14} /> Ημερομηνία</label>
                                        <input type="date" className="booking-input" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value, time: '' }))} min={minDate} />
                                    </div>

                                    <div>
                                        <label className="booking-label"><Clock size={14} /> Διαθέσιμες Ώρες</label>
                                        {!formData.date ? (
                                            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '600' }}>
                                                Παρακαλώ επιλέξτε ημερομηνία πρώτα
                                            </div>
                                        ) : slotsLoading ? (
                                            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '16px', color: 'var(--primary)', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <Clock className="animate-spin" size={18} /> Αναζήτηση slots...
                                            </div>
                                        ) : availableSlots.length === 0 ? (
                                            <div style={{ padding: '1.5rem', textAlign: 'center', background: '#fff8e6', borderRadius: '16px', color: '#92400e', fontSize: '0.88rem', fontWeight: '600', border: '1px solid #fde68a' }}>
                                                <Clock size={18} style={{ marginBottom: '4px' }} />
                                                <div>Δεν υπάρχουν διαθέσιμες ώρες για αυτή την ημέρα.</div>
                                                <div style={{ fontSize: '0.78rem', marginTop: '6px', opacity: 0.85, fontWeight: '500' }}>
                                                    Δοκιμάστε άλλη ημερομηνία ή καλέστε μας στο {clinic.phone} για ραντεβού εκτός ωραρίου.
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="booking-slots-grid">
                                                {availableSlots.map(slot => (
                                                    <button 
                                                        key={slot}
                                                        onClick={() => setFormData(prev => ({ ...prev, time: slot }))}
                                                        style={{
                                                            padding: '12px 8px', borderRadius: '12px', border: '1.5px solid',
                                                            borderColor: formData.time === slot ? 'var(--primary)' : 'var(--border)',
                                                            background: formData.time === slot ? 'var(--primary)' : 'white',
                                                            color: formData.time === slot ? 'white' : 'var(--text)',
                                                            fontSize: '0.9rem', fontWeight: '800', transition: 'all 0.2s', cursor: 'pointer',
                                                            boxShadow: formData.time === slot ? '0 8px 16px -4px var(--primary-glow)' : 'none'
                                                        }}
                                                    >
                                                        {slot}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="booking-nav">
                                    <button className="btn btn-outline" style={{ flex: 1, padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => setStep(1)}>
                                        <ChevronLeft size={18} /> Πίσω
                                    </button>
                                    <button className="btn btn-primary" style={{ flex: 2, padding: '16px', borderRadius: '16px', fontWeight: '800' }} onClick={handleSubmit} disabled={!formData.date || !formData.time || loading}>
                                        {loading ? 'Γίνεται κράτηση...' : 'Επιβεβαίωση Ραντεβού'}
                                    </button>
                                </div>
                                {error && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: '#fff5f5', color: '#c53030', fontSize: '0.85rem', fontWeight: '700', border: '1px solid #feb2b2' }}>
                                        <AlertCircle size={16} /> {error}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-fade" style={{ textAlign: 'center', padding: '1rem' }}>
                            <div style={{ width: '96px', height: '96px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto', border: '2px solid var(--accent)' }}>
                                <CheckCircle size={56} color="var(--accent)" />
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--secondary)', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Επιτυχής Καταχώρηση!</h2>
                            <p style={{ color: 'var(--text-light)', marginBottom: '2.5rem', lineHeight: '1.7', fontSize: '1.05rem', fontWeight: '500' }}>
                                Σας ευχαριστούμε, {formData.name.split(' ')[0]}.<br/>
                                Το ραντεβού σας για τις <strong>{(() => {
                                    const [y, m, d] = formData.date.split('-');
                                    return new Date(y, m - 1, d).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' });
                                })()}</strong> στις <strong>{formData.time}</strong> καταχωρήθηκε.
                                <br/><span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Θα λάβετε σύντομα μήνυμα επιβεβαίωσης.</span>
                            </p>
                            <button className="btn btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '16px', fontWeight: '800' }} onClick={() => { setStep(1); setFormData({ name: '', phone: '', email: '', reason: '', date: '', time: '', doctorId: '' }); setAvailableSlots([]); setError(null); }}>
                                Νέα Κράτηση
                            </button>
                        </div>
                    )}
                </div>

                <footer style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ 
                            width: '28px', height: '28px', borderRadius: '8px', 
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.65rem', fontWeight: '900', color: 'white'
                        }}>CF</div>
                        <span style={{ fontWeight: '800', color: 'var(--secondary)', fontSize: '1rem', letterSpacing: '-0.02em' }}>ClinicFlow</span>
                    </div>
                    <p>Powered by AI-first Clinic Management • Secure & Encrypted</p>
                </footer>
            </div>

            <style>{`
                .booking-glass {
                    background: var(--glass-surface-strong);
                    backdrop-filter: blur(20px) saturate(180%);
                    border: 1px solid rgba(255,255,255,0.4);
                    box-shadow: 0 40px 80px -16px rgba(15,23,42,0.12), 0 0 0 1px rgba(255,255,255,0.5);
                    border-radius: 24px;
                    padding: 2.5rem;
                    position: relative;
                    overflow: hidden;
                }
                .booking-input {
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1.5px solid var(--border);
                    background: rgba(255,255,255,0.8);
                    font-size: 0.95rem;
                    font-weight: 500;
                    color: var(--text);
                    transition: all 0.2s ease;
                    outline: none;
                    box-sizing: border-box;
                    font-family: inherit;
                }
                .booking-input:focus {
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px var(--primary-light);
                }
                .booking-label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: var(--text-light);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 8px;
                }
                .booking-slots-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                }
                .booking-doctors-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    gap: 8px;
                }
                .booking-name-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                .booking-nav {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1rem;
                }
                @media (max-width: 640px) {
                    .booking-glass {
                        padding: 1.5rem;
                        border-radius: 16px;
                    }
                    .booking-slots-grid {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 8px;
                    }
                    .booking-doctors-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    .booking-name-grid {
                        grid-template-columns: 1fr;
                    }
                    .booking-nav {
                        flex-direction: column;
                    }
                    .booking-page {
                        padding: 2rem 0.75rem !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default PatientBooking;
