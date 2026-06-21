import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { X, AlertCircle, Calendar, Clock, User, FileText, Sparkles, Stethoscope, Ban, Phone, Mail } from 'lucide-react';
import { getHoliday } from '../lib/greekHolidays';

const NewAppointmentModal = ({
    onClose,
    patients,
    appointments = [],
    newAppt,
    setNewAppt,
    onAnalyze,
    analyzing,
    analysis,
    onBook,
    booking = false,
}) => {
    const [doctors, setDoctors] = useState([]);
    const [isNewPatient, setIsNewPatient] = useState(false);
    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientPhone, setNewPatientPhone] = useState('');
    const [newPatientEmail, setNewPatientEmail] = useState('');
    const [creatingPatient, setCreatingPatient] = useState(false);
    const [patientError, setPatientError] = useState('');

    useEffect(() => {
        api.get('/doctors').then(r => setDoctors(r.data.data || [])).catch(() => {});
    }, []);

    const handleLocalBook = async () => {
        if (isNewPatient) {
            if (!newPatientName.trim() || !newPatientPhone.trim()) {
                setPatientError('Το όνομα και το τηλέφωνο είναι υποχρεωτικά.');
                return;
            }
            setCreatingPatient(true);
            setPatientError('');
            try {
                const res = await api.post('/patients', {
                    name: newPatientName.trim(),
                    phone: newPatientPhone.trim(),
                    email: newPatientEmail.trim() || null
                });
                const newPatient = res.data;
                setCreatingPatient(false);
                onBook(newPatient.id);
            } catch (err) {
                setCreatingPatient(false);
                setPatientError(err.response?.data?.error || 'Σφάλμα κατά τη δημιουργία ασθενούς.');
            }
        } else {
            onBook();
        }
    };

    const conflict = React.useMemo(() => {
        if (!newAppt.date || !newAppt.time || !appointments.length) return null;
        try {
            const requestedStart = new Date(`${newAppt.date}T${newAppt.time}`);
            if (isNaN(requestedStart.getTime())) return null;
            
            const requestedEnd = new Date(requestedStart.getTime() + 30 * 60 * 1000);
            
            return appointments.find(apt => {
                if (apt.status === 'CANCELLED') return false;
                if (newAppt.doctorId && apt.doctorId && newAppt.doctorId !== apt.doctorId) return false;
                
                const start = new Date(apt.startTime);
                if (isNaN(start.getTime())) return false;
                const end = apt.endTime ? new Date(apt.endTime) : new Date(start.getTime() + 30 * 60 * 1000);
                
                return requestedStart < end && requestedEnd > start;
            });
        } catch {
            return null;
        }
    }, [newAppt.date, newAppt.time, newAppt.doctorId, appointments]);

    const holiday = newAppt.date ? getHoliday(newAppt.date) : null;

    const isPatientValid = isNewPatient
        ? (newPatientName.trim() && newPatientPhone.trim())
        : newAppt.patientId;

    const isValid = isPatientValid && newAppt.reason && newAppt.date && newAppt.time && !holiday;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(5,11,27,0.55)',
                backdropFilter: 'blur(10px) saturate(180%)',
                WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 51, padding: '1rem'
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: '520px',
                    background: 'var(--glass-surface-strong)',
                    backdropFilter: 'blur(10px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(10px) saturate(200%)',
                    borderRadius: '28px',
                    border: '1px solid rgba(255,255,255,0.56)',
                    boxShadow: '0 32px 64px -12px rgba(5,11,27,0.25), 0 0 0 1px rgba(255,255,255,0.5)',
                    overflow: 'hidden',
                    position: 'relative'
                }}
            >
                <div
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'var(--glass-sheen)',
                        pointerEvents: 'none'
                    }}
                />
                {/* Header */}
                <div style={{
                    padding: '1.5rem 1.75rem 1.25rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--glass-control-soft)',
                    position: 'relative'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, var(--primary), #2563eb)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,102,255,0.3)'
                        }}>
                            <Calendar size={16} color="white" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>Νέο Ραντεβού</h2>
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0, fontWeight: '500' }}>Καταχώρηση νέας επίσκεψης</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: 'var(--glass-control)', border: '1px solid rgba(255,255,255,0.36)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--cancel-color)', transition: 'all 0.15s',
                            backdropFilter: 'blur(10px) saturate(160%)'
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                    {/* Patient */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label htmlFor={isNewPatient ? "new-patient-name" : "appt-patient"} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                <User size={12} /> {isNewPatient ? 'Νέος Ασθενής' : 'Ασθενής'}
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsNewPatient(!isNewPatient);
                                    setPatientError('');
                                }}
                                style={{
                                    background: 'none', border: 'none',
                                    color: 'var(--primary)', fontSize: '0.75rem',
                                    fontWeight: '700', cursor: 'pointer', padding: '2px 6px',
                                    borderRadius: '6px', transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                                {isNewPatient ? '← Επιλογή υπάρχοντος' : '+ Νέος Ασθενής'}
                            </button>
                        </div>

                        {!isNewPatient ? (
                            <select
                                id="appt-patient"
                                style={{
                                    width: '100%', padding: '11px 14px',
                                    borderRadius: '12px', border: '1px solid var(--input-border)',
                                    background: 'var(--input-bg)', fontSize: '0.9rem',
                                    color: 'var(--text)', outline: '2px solid transparent', fontWeight: '500'
                                }}
                                value={newAppt.patientId}
                                onChange={e => setNewAppt({ ...newAppt, patientId: e.target.value })}
                            >
                                <option value="">Επιλέξτε ασθενή...</option>
                                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <input
                                    id="new-patient-name"
                                    type="text"
                                    placeholder="Ονοματεπώνυμο"
                                    style={{
                                        width: '100%', padding: '10px 14px',
                                        borderRadius: '12px', border: '1px solid var(--input-border)',
                                        background: 'var(--input-bg)', fontSize: '0.9rem',
                                        color: 'var(--text)', outline: '2px solid transparent'
                                    }}
                                    value={newPatientName}
                                    onChange={e => setNewPatientName(e.target.value)}
                                />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="tel"
                                            placeholder="Κινητό Τηλέφωνο"
                                            style={{
                                                width: '100%', padding: '10px 14px 10px 32px',
                                                borderRadius: '12px', border: '1px solid var(--input-border)',
                                                background: 'var(--input-bg)', fontSize: '0.85rem',
                                                color: 'var(--text)', outline: '2px solid transparent'
                                            }}
                                            value={newPatientPhone}
                                            onChange={e => setNewPatientPhone(e.target.value)}
                                        />
                                        <Phone size={12} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="email"
                                            placeholder="Email (Προαιρετικό)"
                                            style={{
                                                width: '100%', padding: '10px 14px 10px 32px',
                                                borderRadius: '12px', border: '1px solid var(--input-border)',
                                                background: 'var(--input-bg)', fontSize: '0.85rem',
                                                color: 'var(--text)', outline: '2px solid transparent'
                                            }}
                                            value={newPatientEmail}
                                            onChange={e => setNewPatientEmail(e.target.value)}
                                        />
                                        <Mail size={12} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                    </div>
                                </div>
                                {patientError && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--urgent)', fontWeight: '600' }}>
                                        {patientError}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Reason */}
                    <div>
                        <label htmlFor="appt-reason" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            <FileText size={12} /> Αιτία Επίσκεψης
                        </label>
                        <textarea
                            id="appt-reason"
                            placeholder="Περιγράψτε το πρόβλημα..."
                            style={{
                                width: '100%', padding: '11px 14px',
                                borderRadius: '12px', border: '1px solid var(--input-border)',
                                background: 'var(--input-bg)', fontSize: '0.9rem',
                                minHeight: '90px', resize: 'none', outline: '2px solid transparent',
                                color: 'var(--text)', fontFamily: 'inherit'
                            }}
                            value={newAppt.reason}
                            onChange={e => {
                                setNewAppt({ ...newAppt, reason: e.target.value });
                                if (e.target.value.length > 5) onAnalyze(e.target.value);
                            }}
                        />
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                            {[
                                { label: 'Γενική εξέταση', text: 'Γενική εξέταση και προληπτικός έλεγχος' },
                                { label: 'Επανεξέταση', text: 'Επανεξέταση μετά από θεραπεία' },
                                { label: 'Επείγον', text: 'Επείγον περιστατικό με έντονο πόνο' },
                                { label: 'Καθαρισμός', text: 'Καθαρισμός και προληπτική φροντίδα' }
                            ].map(tpl => (
                                <button
                                    key={tpl.label}
                                    type="button"
                                    onClick={() => {
                                        setNewAppt({ ...newAppt, reason: tpl.text });
                                        onAnalyze(tpl.text);
                                    }}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-subtle)',
                                        color: 'var(--text-light)',
                                        fontSize: '0.7rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'var(--primary-light)';
                                        e.currentTarget.style.color = 'var(--primary)';
                                        e.currentTarget.style.borderColor = 'rgba(99,91,255,0.2)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'var(--bg-subtle)';
                                        e.currentTarget.style.color = 'var(--text-light)';
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                    }}
                                >
                                    + {tpl.label}
                                </button>
                            ))}
                        </div>
                        {analyzing && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '600' }}>
                                <Sparkles size={11} />
                                Ανάλυση AI σε εξέλιξη...
                            </div>
                        )}
                        {analysis && (
                            <div style={{
                                marginTop: '8px', padding: '10px 14px',
                                background: analysis.priority === 'URGENT' ? 'rgba(239,68,68,0.06)' : 'rgba(0,102,255,0.06)',
                                borderRadius: '10px',
                                border: `1px solid ${analysis.priority === 'URGENT' ? 'rgba(239,68,68,0.2)' : 'rgba(0,102,255,0.15)'}`,
                                display: 'flex', gap: '8px', alignItems: 'flex-start'
                            }}>
                                <AlertCircle size={14} color={analysis.priority === 'URGENT' ? '#ef4444' : 'var(--primary)'} style={{ flexShrink: 0, marginTop: '1px' }} />
                                <span style={{ fontSize: '0.8rem', color: analysis.priority === 'URGENT' ? '#b91c1c' : 'var(--primary)', fontWeight: '600', lineHeight: 1.4 }}>
                                    {analysis.priority === 'URGENT' ? '⚠ ΕΠΕΙΓΟΝ: ' : '✓ ΚΑΝΟΝΙΚΟ: '}{analysis.greekSummary}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Date + Time */}
                    <div className="modal-two-column" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                            <label htmlFor="appt-date" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                <Calendar size={12} /> Ημερομηνία
                            </label>
                            <input
                                id="appt-date"
                                type="date"
                                style={{
                                    width: '100%', padding: '11px 14px',
                                    borderRadius: '12px', border: '1px solid var(--input-border)',
                                    background: 'var(--input-bg)', fontSize: '0.9rem', outline: '2px solid transparent',
                                    color: 'var(--text)'
                                }}
                                value={newAppt.date}
                                onChange={e => setNewAppt({ ...newAppt, date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label htmlFor="appt-time" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                <Clock size={12} /> Ώρα
                            </label>
                            <input
                                id="appt-time"
                                type="time"
                                style={{
                                    width: '100%', padding: '11px 14px',
                                    borderRadius: '12px', border: '1px solid var(--input-border)',
                                    background: 'var(--input-bg)', fontSize: '0.9rem', outline: '2px solid transparent',
                                    color: 'var(--text)'
                                }}
                                value={newAppt.time}
                                onChange={e => setNewAppt({ ...newAppt, time: e.target.value })}
                            />
                        </div>
                    </div>

                    {holiday && (
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Ban size={14} />
                            <span>Το ιατρείο είναι <u>κλειστό</u> — {holiday.name}. Δεν μπορείτε να προγραμματίσετε ραντεβού.</span>
                        </div>
                    )}

                    {!holiday && newAppt.date && newAppt.time && (
                        <div style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            background: conflict ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                            border: `1px solid ${conflict ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            color: conflict ? '#ef4444' : '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '-4px'
                        }}>
                            <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: conflict ? '#ef4444' : '#10b981',
                                display: 'inline-block'
                            }} />
                            {conflict ? `⚠️ Σύγκρουση: Υπάρχει ήδη ραντεβού (${conflict.patient?.name || 'Ασθενής'}) αυτή την ώρα!` : '🟢 Διαθέσιμο Slot'}
                        </div>
                    )}

                    {/* Doctor */}
                    {doctors.length > 0 && (
                        <div>
                            <label htmlFor="appt-doctor" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                <Stethoscope size={12} /> Γιατρός
                            </label>
                            <select
                                id="appt-doctor"
                                style={{
                                    width: '100%', padding: '11px 14px',
                                    borderRadius: '12px', border: '1px solid var(--input-border)',
                                    background: 'var(--input-bg)', fontSize: '0.9rem',
                                    color: 'var(--text)', outline: '2px solid transparent', fontWeight: '500'
                                }}
                                value={newAppt.doctorId || ''}
                                onChange={e => setNewAppt({ ...newAppt, doctorId: e.target.value || null })}
                            >
                                <option value="">Οποιοσδήποτε διαθέσιμος</option>
                                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` — ${d.specialty}` : ''}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer-actions" style={{ padding: '1rem 1.75rem 1.5rem', display: 'flex', gap: '0.75rem', position: 'relative' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '12px',
                            borderRadius: '14px', border: '1px solid rgba(255,255,255,0.34)',
                            background: 'var(--glass-control)', fontSize: '0.9rem',
                            fontWeight: '700', color: 'var(--cancel-color)', cursor: 'pointer',
                            backdropFilter: 'blur(10px) saturate(160%)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)'
                        }}
                    >
                        Ακύρωση
                    </button>
                    <button
                        onClick={handleLocalBook}
                        disabled={!isValid || booking || creatingPatient}
                        style={{
                            flex: 2, padding: '12px',
                            borderRadius: '14px', border: '1px solid rgba(255,255,255,0.22)',
                            background: isValid && !booking && !creatingPatient
                                ? 'linear-gradient(135deg, rgba(99,91,255,0.9) 0%, rgba(139,92,246,0.72) 100%)'
                                : 'var(--glass-control-soft)',
                            color: isValid && !booking && !creatingPatient ? 'white' : 'var(--text-light)',
                            fontSize: '0.9rem', fontWeight: '800',
                            cursor: isValid && !booking && !creatingPatient ? 'pointer' : 'not-allowed',
                            boxShadow: isValid && !booking && !creatingPatient ? '0 12px 26px -12px rgba(0,102,255,0.42), inset 0 1px 0 rgba(255,255,255,0.26)' : 'none',
                            transition: 'all 0.2s',
                            backdropFilter: 'blur(10px) saturate(180%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}
                    >
                        {(booking || creatingPatient) ? (
                            <>
                                <svg style={{ animation: 'spin 1s linear infinite', width: 15, height: 15 }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round"/></svg>
                                {creatingPatient ? 'Δημιουργία Ασθενούς...' : 'Καταχώρηση...'}
                            </>
                        ) : 'Καταχώρηση Ραντεβού'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewAppointmentModal;
