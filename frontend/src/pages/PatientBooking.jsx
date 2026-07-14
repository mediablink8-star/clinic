import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../lib/constants';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, User, Phone, CheckCircle, AlertCircle, MapPin, ChevronRight, ChevronLeft, Mail, FileText, Loader2, Shield, Download, Globe } from 'lucide-react';

const PatientBooking = () => {
    const { t, i18n } = useTranslation();
    const searchParams = new URLSearchParams(window.location.search);
    const clinicId = searchParams.get('clinicId');
    const missedCallId = searchParams.get('missedCallId');
    const lang = searchParams.get('lang') || 'el';

    useEffect(() => {
        i18n.changeLanguage(lang);
    }, [lang]);

    const [clinic, setClinic] = useState(null);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        reason: '',
        date: '',
        time: '',
        doctorId: '',
    });
    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [minDate, setMinDate] = useState('');
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const [recaptchaLoading, setRecaptchaLoading] = useState(false);
    const [pollingInterval, setPollingInterval] = useState(null);
    const [mounted, setMounted] = useState(false);

    const executeRecaptcha = useCallback(async () => {
        if (!window.grecaptcha || recaptchaToken) return;
        setRecaptchaLoading(true);
        try {
            const token = await window.grecaptcha.execute('6Lc...', { action: 'booking' });
            setRecaptchaToken(token);
        } catch (err) {
            console.error('reCAPTCHA error:', err);
        } finally {
            setRecaptchaLoading(false);
        }
    }, [recaptchaToken]);

    useEffect(() => {
        if (window.grecaptcha && !recaptchaToken) {
            executeRecaptcha();
        }
    }, [executeRecaptcha, recaptchaToken]);

    useEffect(() => {
        setMounted(true);
        setMinDate(new Date().toISOString().split('T')[0]);
    }, []);

    const fetchSlots = useCallback(async () => {
        if (!formData.date || !clinicId) return;
        setSlotsLoading(true);
        try {
            const url = `${API_BASE}/public/clinic/${clinicId}/slots?date=${formData.date}${formData.doctorId ? `&doctorId=${formData.doctorId}` : ''}`;
            const resp = await axios.get(url);
            setAvailableSlots(resp.data.data || []);
        } catch (err) {
            console.error('Failed to fetch slots:', err);
            setAvailableSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    }, [formData.date, formData.doctorId, clinicId]);

    useEffect(() => {
        fetchSlots();
    }, [fetchSlots]);

    useEffect(() => {
        if (formData.date && formData.time && clinicId) {
            const interval = setInterval(() => {
                fetchSlots();
            }, 30000);
            setPollingInterval(interval);
            return () => clearInterval(interval);
        }
    }, [formData.date, formData.time, clinicId, fetchSlots]);

    useEffect(() => {
        if (!clinicId) {
            setError(t('noClinicId'));
            return;
        }
        const fetchClinic = async () => {
            try {
                const resp = await axios.get(`${API_BASE}/public/clinic/${clinicId}`);
                setClinic(resp.data.data);
            } catch (err) {
                setError(t('clinicNotFound'));
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
        fetchClinic();
        fetchDoctors();
    }, [clinicId]);

    const executeRecaptcha = useCallback(async () => {
        if (!window.grecaptcha || recaptchaToken) return;
        setRecaptchaLoading(true);
        try {
            const token = await window.grecaptcha.execute('6Lc...', { action: 'booking' });
            setRecaptchaToken(token);
        } catch (err) {
            console.error('reCAPTCHA error:', err);
        } finally {
            setRecaptchaLoading(false);
        }
    }, [recaptchaToken]);

    useEffect(() => {
        if (window.grecaptcha && !recaptchaToken) {
            executeRecaptcha();
        }
    }, [executeRecaptcha, recaptchaToken]);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        if (!formData.date || !formData.time) {
            setError(t('selectDateTime'));
            setLoading(false);
            return;
        }
        if (!recaptchaToken) {
            try {
                const token = await window.grecaptcha.execute('6Lc...', { action: 'booking_submit' });
                setRecaptchaToken(token);
            } catch (err) {
                setError('Security verification failed. Please refresh and try again.');
                setLoading(false);
                return;
            }
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
                recaptchaToken,
            });
            setStep(3);
        } catch (err) {
            if (err.response?.status === 409) {
                setError(t('slotTaken'));
                try {
                    const resp = await axios.get(`${API_BASE}/public/clinic/${clinicId}/slots?date=${formData.date}${formData.doctorId ? `&doctorId=${formData.doctorId}` : ''}`);
                    setAvailableSlots(resp.data.data || []);
                    setFormData(prev => ({ ...prev, time: '' }));
                } catch (refreshErr) {}
            } else if (err.response?.status === 400) {
                setError(err.response.data?.error || t('validationError'));
            } else {
                setError(t('bookingFailed'));
            }
        } finally {
            setLoading(false);
        }
    };

    const downloadICS = useCallback(() => {
        if (!formData.date || !formData.time || !clinic) return;
        const start = new Date(`${formData.date}T${formData.time}:00`);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@clinicflow`;
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ClinicFlow//Appointment//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:Ραντεβού στο ${clinic.name}
DESCRIPTION:Λόγος: ${formData.reason || 'Γενικός έλεγχος'}\\nΤοποθεσία: ${clinic.location}\\nΤηλέφωνο: ${clinic.phone}
LOCATION:${clinic.location}
ORGANIZER;CN=${clinic.name}:mailto:${clinic.email}
ATTENDEE;CN=${formData.name}:mailto:${formData.email || ''}
STATUS:CONFIRMED
SEQUENCE:0
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`;
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `appointment-${formData.date}-${formData.time}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [formData, clinic]);

    const formatDateGR = (dateStr) => {
        const [y, m, d] = dateStr.split('-');
        return new Date(y, m - 1, d).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' });
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

    if (!mounted) return null;

    if (error && step !== 2) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '2rem' }}>
            <div style={{ textAlign: 'center', maxWidth: '400px', background: '#fff5f5', borderColor: '#feb2b2', borderRadius: '20px', padding: '2.5rem', boxShadow: '0 20px 40px -12px rgba(245, 101, 101, 0.3)' }}>
                <AlertCircle size={48} color="#f56565" style={{ marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#c53030', marginBottom: '0.75rem' }}>{t('securityCheck')}</h2>
                <p style={{ marginBottom: '2rem', color: '#9b2c2c', fontWeight: '500' }}>{error}</p>
                <button className="btn btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: '800' }} onClick={() => { setError(null); setStep(1); setRecaptchaToken(null); executeRecaptcha(); }}>{t('recaptchaVerify')}</button>
            </div>
        </div>
    );

    if (!clinic && !error) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', gap: '12px' }}>
            <Loader2 className="animate-spin" size={32} color="var(--primary)" />
            <span style={{ fontWeight: '700', color: 'var(--text-light)' }}>{t('loading')}</span>
        </div>
    );

    return (
        <div className="booking-page" style={{ minHeight: '100vh', background: 'transparent', padding: '4rem 1rem' }}>
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
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
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', color: 'var(--text-light)', fontSize: '0.9rem', fontWeight: '600', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={16} color="var(--primary)" /> {clinic.location}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={16} color="var(--primary)" /> {clinic.phone}</span>
                    </div>
                </header>

                <div style={{
                    background: 'var(--glass-surface-strong)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 40px 80px -16px rgba(15,23,42,0.12), 0 0 0 1px rgba(255,255,255,0.5)',
                    borderRadius: '24px',
                    padding: '2.5rem',
                    position: 'relative',
                    overflow: 'hidden',
                    animation: 'slideUp 0.4s ease'
                }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--primary), var(--accent))' }} />

                    <StepIndicator currentStep={step} />

                    {/* Language Switcher */}
                    <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
                        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle)', borderRadius: '8px', padding: '4px' }}>
                            <button
                                onClick={() => i18n.changeLanguage('el')}
                                style={{
                                    padding: '6px 12px', borderRadius: '6px', border: 'none',
                                    background: i18n.language === 'el' ? 'var(--primary)' : 'transparent',
                                    color: i18n.language === 'el' ? 'white' : 'var(--text)',
                                    fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                ΕΛ
                            </button>
                            <button
                                onClick={() => i18n.changeLanguage('en')}
                                style={{
                                    padding: '6px 12px', borderRadius: '6px', border: 'none',
                                    background: i18n.language === 'en' ? 'var(--primary)' : 'transparent',
                                    color: i18n.language === 'en' ? 'white' : 'var(--text)',
                                    fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                EN
                            </button>
                        </div>
                    </div>

                    <StepIndicator currentStep={step} />

                    {step === 1 && (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                <Shield size={20} color="var(--primary)" />
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--secondary)', margin: 0 }}>{t('patientDetails')}</h2>
                            </div>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontWeight: '500', fontSize: '0.9rem' }}>{t('securityCheck')}</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                        <User size={14} /> {t('fullName')} <span style={{ color: 'var(--urgent)' }}>*</span>
                                    </label>
                                    <input type="text" placeholder="Π.χ. Ιωάννης Παπαδόπουλος" style={{
                                        width: '100%', padding: '12px 16px', borderRadius: '12px',
                                        border: '1.5px solid var(--border)', background: 'rgba(255,255,255,0.8)',
                                        fontSize: '0.95rem', fontWeight: '500', color: 'var(--text)',
                                        transition: 'all 0.2s ease', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                                    }} value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} />
                                    {formData.name && formData.name.length < 2 && (
                                        <small style={{ color: '#ef4444', fontWeight: '600', marginTop: '4px', display: 'block' }}>{t('minNameLength')}</small>
                                    )}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                            <Phone size={14} /> {t('phone')} <span style={{ color: 'var(--urgent)' }}>*</span>
                                        </label>
                                        <input type="tel" placeholder="69XXXXXXXX" style={{
                                            width: '100%', padding: '12px 16px', borderRadius: '12px',
                                            border: '1.5px solid var(--border)', background: 'rgba(255,255,255,0.8)',
                                            fontSize: '0.95rem', fontWeight: '500', color: 'var(--text)',
                                            transition: 'all 0.2s ease', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                                        }} value={formData.phone} onChange={e => {
                                            const digits = e.target.value.replace(/\D/g, '');
                                            setFormData(prev => ({ ...prev, phone: digits }));
                                        }} />
                                        {formData.phone && formData.phone.length > 0 && formData.phone.length < 10 && (
                                            <small style={{ color: '#ef4444', fontWeight: '600', marginTop: '4px', display: 'block' }}>{t('minPhoneLength')}</small>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                            <Mail size={14} /> {t('email')}
                                        </label>
                                        <input type="email" placeholder="email@example.gr" style={{
                                            width: '100%', padding: '12px 16px', borderRadius: '12px',
                                            border: '1.5px solid var(--border)', background: 'rgba(255,255,255,0.8)',
                                            fontSize: '0.95rem', fontWeight: '500', color: 'var(--text)',
                                            transition: 'all 0.2s ease', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                                        }} value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} />
                                        {formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && (
                                            <small style={{ color: '#ef4444', fontWeight: '600', marginTop: '4px', display: 'block' }}>{t('invalidEmail')}</small>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                        <FileText size={14} /> {t('reason')}
                                    </label>
                                    <textarea placeholder="Περιγράψτε σύντομα τι σας απασχολεί..." style={{
                                        width: '100%', padding: '12px 16px', borderRadius: '12px',
                                        border: '1.5px solid var(--border)', background: 'rgba(255,255,255,0.8)',
                                        fontSize: '0.95rem', fontWeight: '500', color: 'var(--text)',
                                        transition: 'all 0.2s ease', outline: 'none', boxSizing: 'border-box',
                                        fontFamily: 'inherit', minHeight: '100px', resize: 'none'
                                    }} value={formData.reason} onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))} />
                                </div>
                                <button style={{
                                    width: '100%', padding: '16px', borderRadius: '16px',
                                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                                    color: 'white', fontWeight: '800', fontSize: '1rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    transition: 'all 0.15s', boxShadow: 'var(--shadow-primary)',
                                    border: 'none', cursor: 'pointer'
                                }} onClick={() => {
                                    const errors = [];
                                    if (!formData.name || formData.name.length < 2) errors.push(t('fullName'));
                                    if (!formData.phone || formData.phone.length < 10) errors.push(t('phone'));
                                    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.push(t('email'));
                                    if (errors.length > 0) { setError(`${t('requiredFields')} ${errors.join(', ')}`); return; }
                                    setError(null);
                                    executeRecaptcha();
                                    setTimeout(() => setStep(2), 500);
                                }} disabled={!formData.name || formData.name.length < 2 || !formData.phone || formData.phone.length < 10 || (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) || recaptchaLoading}>
                                    {recaptchaLoading ? `${t('recaptchaVerify')} <Loader2 className="animate-spin" size={16} />` : `${t('continue')} <ChevronRight size={18} />`}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                <Calendar size={20} color="var(--primary)" />
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--secondary)', margin: 0 }}>{t('selectAppointment')}</h2>
                            </div>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontWeight: '500', fontSize: '0.9rem' }}>
                                {t('selectDoctor')}: {doctors.length > 0 ? t('anyDoctor') : '—'}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {doctors.length > 0 && (
                                    <div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                            <User size={14} /> {t('selectDoctor')}
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
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
                                                {t('anyDoctor')}
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
                                                        textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
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
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                            <Calendar size={14} /> {t('date')}
                                        </label>
                                        <input type="date" style={{
                                            width: '100%', padding: '12px 16px', borderRadius: '12px',
                                            border: '1.5px solid var(--border)', background: 'rgba(255,255,255,0.8)',
                                            fontSize: '0.95rem', fontWeight: '500', color: 'var(--text)',
                                            transition: 'all 0.2s ease', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                                        }} value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value, time: '' }))} min={minDate} />
                                    </div>

                                    <div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                            <Clock size={14} /> {t('availableTimes')}
                                        </label>
                                        {!formData.date ? (
                                            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '600' }}>
                                                {t('selectDateFirst')}
                                            </div>
                                        ) : slotsLoading ? (
                                            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '16px', color: 'var(--primary)', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <Loader2 className="animate-spin" size={18} /> {t('slotsLoading')}
                                            </div>
                                        ) : availableSlots.length === 0 ? (
                                            <div style={{ padding: '1.5rem', textAlign: 'center', background: '#fff8e6', borderRadius: '16px', color: '#92400e', fontSize: '0.88rem', fontWeight: '600', border: '1px solid #fde68a' }}>
                                                <Clock size={18} style={{ marginBottom: '4px' }} />
                                                <div>{t('noSlots')}</div>
                                                <div style={{ fontSize: '0.78rem', marginTop: '6px', opacity: 0.85, fontWeight: '500' }}>
                                                    {t('tryAnotherDate')} {clinic.phone}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
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

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button style={{ flex: 1, padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--bg-subtle)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: '800' }} onClick={() => setStep(1)}>
                                        <ChevronLeft size={18} /> {t('back')}
                                    </button>
                                    <button style={{ flex: 2, padding: '16px', borderRadius: '16px', fontWeight: '800', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.15s', boxShadow: 'var(--shadow-primary)', cursor: 'pointer' }} onClick={handleSubmit} disabled={!formData.date || !formData.time || loading}>
                                        {loading ? `${t('loading')} <Loader2 className="animate-spin" size={16} />` : t('bookAppointment')}
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
                        <div style={{ animation: 'fadeIn 0.3s ease', textAlign: 'center', padding: '1rem' }}>
                            <div style={{ width: '96px', height: '96px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto', border: '2px solid var(--accent)' }}>
                                <CheckCircle size={56} color="var(--accent)" />
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--secondary)', marginBottom: '1rem', letterSpacing: '-0.02em' }}>{t('success')}</h2>
                            <p style={{ color: 'var(--text-light)', marginBottom: '2.5rem', lineHeight: '1.7', fontSize: '1.05rem', fontWeight: '500' }}>
                                {t('confirmationSent', { name: formData.name.split(' ')[0] })}
                                <br/><span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('confirmationSent')}</span>
                            </p>
                            <button style={{ width: '100%', padding: '16px', borderRadius: '16px', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }} onClick={downloadICS}>
                                <Download size={18} /> {t('downloadCalendar')}
                            </button>
                            <button style={{ width: '100%', padding: '16px', borderRadius: '16px', fontWeight: '800', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)', color: 'white', border: 'none', cursor: 'pointer' }} onClick={() => { setStep(1); setFormData({ name: '', phone: '', email: '', reason: '', date: '', time: '', doctorId: '' }); setAvailableSlots([]); setError(null); }}>
                                {t('newBooking')}
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
                    <p>{t('poweredBy')}</p>
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
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default PatientBooking;