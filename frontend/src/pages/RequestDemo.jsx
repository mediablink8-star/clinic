import React, { useState } from 'react';
import { API_BASE } from '../lib/constants';
import axios from 'axios';
import { Building2, Mail, Phone, User, CheckCircle2, ArrowRight, Calendar } from 'lucide-react';

/**
 * Public "Request a demo" page. Replaces the old self-serve registration
 * form. Clinic provisioning is a manual, high-touch process done by the
 * platform owner — interested clinics fill in this form and we email the
 * owner to schedule a call.
 */
const RequestDemo = () => {
    const [formData, setFormData] = useState({
        clinicName: '',
        name: '',
        email: '',
        phone: '',
        notes: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const navigateTo = (path) => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new Event('popstate'));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/leads/demo`, {
                ...formData,
                phone: formData.phone.replace(/[\s()-]/g, ''),
            });
            setSuccess(true);
        } catch (err) {
            const apiError = err.response?.data?.error || err.response?.data?.message;
            if (err.response?.status === 429) {
                setError('Έχετε ήδη στείλει αρκετά αιτήματα. Δοκιμάστε ξανά σε μία ώρα.');
            } else {
                setError(apiError || 'Κάτι πήγε στραβά. Δοκιμάστε ξανά ή στείλτε μας email.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="register-layout register-success-layout">
                <div style={{
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(10px)',
                    padding: '3rem',
                    borderRadius: '28px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    maxWidth: '440px',
                }}>
                    <div style={{ width: '64px', height: '64px', background: 'rgba(16,185,129,0.2)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <CheckCircle2 size={32} color="#10b981" />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '900', marginBottom: '1rem' }}>Λάβαμε το αίτημά σας!</h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                        Θα επικοινωνήσουμε μαζί σας εντός 1 εργάσιμης ημέρας για να κανονίσουμε μια επίδειξη
                        και να σχεδιάσουμε μαζί την ενσωμάτωση με τα συστήματά σας.
                    </p>
                    <button
                        onClick={() => navigateTo('/')}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.2)',
                            padding: '12px 24px',
                            borderRadius: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                        }}
                    >
                        Επιστροφή στην αρχική
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="register-layout">
            <div className="register-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                    <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #0d9488, #14b8a6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 size={22} color="white" />
                    </div>
                    <span style={{ fontWeight: '900', fontSize: '1.15rem' }}>ClinicFlow</span>
                </div>
                <h1 style={{ fontSize: '2.25rem', fontWeight: '900', lineHeight: 1.15, marginBottom: '1rem' }}>
                    Κλείστε μια<br />επίδειξη.
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: '2rem', fontSize: '1.05rem' }}>
                    Η εγκατάσταση του ClinicFlow γίνεται προσωπικά από εμάς, ώστε να το
                    ρυθμίσουμε ακριβώς στα μέτρα του ιατρείου σας — από το ωράριο μέχρι
                    τα SMS υπενθυμίσεων μέσω του δικού σας αριθμού.
                </p>
                <div className="register-features">
                    <div className="register-feature">
                        <div className="register-feature-icon">✓</div>
                        <div>
                            <div style={{ fontWeight: '700', marginBottom: '2px' }}>Προσωπική εγκατάσταση</div>
                            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Σας το στήνουμε εμείς, εσείς δεν πειράζετε τίποτα</div>
                        </div>
                    </div>
                    <div className="register-feature">
                        <div className="register-feature-icon">✓</div>
                        <div>
                            <div style={{ fontWeight: '700', marginBottom: '2px' }}>Δικά σας SMS</div>
                            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Με το δικό σας Twilio account — κανένα κρυφό κόστος ανά μήνυμα</div>
                        </div>
                    </div>
                    <div className="register-feature">
                        <div className="register-feature-icon">✓</div>
                        <div>
                            <div style={{ fontWeight: '700', marginBottom: '2px' }}>14 μέρες δωρεάν δοκιμή</div>
                            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Ξεκινάει μόνο όταν είστε έτοιμοι</div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="register-right">
                <h2 style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '0.5rem' }}>Αίτημα επίδειξης</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                    Συμπληρώστε τα στοιχεία σας — θα σας πάρουμε τηλέφωνο εντός 1 εργάσιμης.
                </p>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '14px' }}>
                        <label htmlFor="demo-clinic-name" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Όνομα Ιατρείου *</label>
                        <div style={{ position: 'relative' }}>
                            <Building2 size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                            <input
                                id="demo-clinic-name"
                                type="text"
                                required
                                placeholder="π.χ. Οδοντιατρείο Σμυρνάκη"
                                value={formData.clinicName}
                                onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                                style={{ width: '100%', padding: '12px 14px 12px 42px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '0.95rem' }}
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                        <label htmlFor="demo-name" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Το όνομά σας</label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                            <input
                                id="demo-name"
                                type="text"
                                placeholder="Γιώργος Παπαδόπουλος"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                style={{ width: '100%', padding: '12px 14px 12px 42px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '0.95rem' }}
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                        <label htmlFor="demo-email" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Email *</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                            <input
                                id="demo-email"
                                type="email"
                                required
                                placeholder="info@iatreio.gr"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                style={{ width: '100%', padding: '12px 14px 12px 42px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '0.95rem' }}
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                        <label htmlFor="demo-phone" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Τηλέφωνο</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                            <input
                                id="demo-phone"
                                type="tel"
                                placeholder="2101234567"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                style={{ width: '100%', padding: '12px 14px 12px 42px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '0.95rem' }}
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label htmlFor="demo-notes" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Τι θα θέλατε να δούμε;</label>
                        <textarea
                            id="demo-notes"
                            rows={3}
                            placeholder="π.χ. SMS υπενθυμίσεις, online κρατήσεις, σύνδεση με το Viber μας..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                    </div>
                    {error && (
                        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '14px' }}>
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: loading ? 'rgba(13,148,136,0.5)' : 'linear-gradient(135deg, #0d9488, #14b8a6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: '800',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                        }}
                    >
                        {loading ? 'Στέλνουμε...' : (<><Calendar size={18} /> Ζητήστε επίδειξη</>)}
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                        Ήδη πελάτης; <button type="button" onClick={() => navigateTo('/login')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}>Σύνδεση</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RequestDemo;
