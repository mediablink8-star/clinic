import React, { useState, useEffect } from 'react';
import { DEFAULT_TIMEZONE } from '../lib/constants';
import api from '../lib/api';
import Badge from './Badge';
import { CheckCircle, AlertCircle, MessageSquare, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatInClinicTimezone, getClinicTimePart } from '../lib/dateUtils';

const AppointmentCard = ({ appointment, delay, showActions = false, onConfirm, onCancel, onMessage, onReassignDoctor, clinic }) => {
    const timezone = clinic?.timezone || DEFAULT_TIMEZONE;
    const isUrgent = appointment.priority === 'URGENT';
    const [doctors, setDoctors] = useState([]);
    const [showDoctorSelect, setShowDoctorSelect] = useState(false);
    const [reassigning, setReassigning] = useState(false);

    useEffect(() => {
        if (showActions) {
            api.get('/doctors').then(r => setDoctors(r.data.data || [])).catch(() => {});
        }
    }, [showActions]);

    const handleReassign = async (doctorId) => {
        setReassigning(true);
        try {
            await api.patch(`/appointments/${appointment.id}/doctor`, { doctorId: doctorId || null });
            if (onReassignDoctor) onReassignDoctor();
        } catch (e) {
            console.error('Reassign failed', e);
            toast.error('Αποτυχία ανάθεσης γιατρού');
        } finally {
            setReassigning(false);
            setShowDoctorSelect(false);
        }
    };

    return (
        <div className={`appointment-card shine-on-hover animate-fade${isUrgent ? ' urgent' : ''}`} style={{
            animationDelay: delay,
            background: isUrgent ? 'rgba(239,68,68,0.04)' : 'var(--glass-surface)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '1.5rem 1.75rem',
            borderRadius: '20px',
            border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: 'var(--shadow-sm)',
        }}>

            <div className="apt-main" style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1 }}>
                {/* Time block */}
                    <div className="apt-time" style={{
                        minWidth: '80px',
                        display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: isUrgent ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)',
                    borderRadius: '14px',
                    padding: '10px 14px',
                }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: '900', color: isUrgent ? '#ef4444' : 'var(--primary)', letterSpacing: '-1px', lineHeight: 1 }}>
                        {getClinicTimePart(appointment.startTime, timezone)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '4px' }}>
                        {formatInClinicTimezone(appointment.startTime, timezone, { day: 'numeric', month: 'short' })}
                    </div>
                    {appointment.startTime && appointment.endTime && (
                        <div style={{ fontSize: '0.6rem', color: isUrgent ? '#ef4444' : 'var(--text-muted)', fontWeight: '700', marginTop: '3px', padding: '1px 6px', borderRadius: '4px', background: isUrgent ? 'rgba(239,68,68,0.1)' : 'var(--bg-subtle)' }}>
                            {Math.round((new Date(appointment.endTime) - new Date(appointment.startTime)) / 60000)} λεπτά
                        </div>
                    )}
                </div>

                {/* Patient info */}
                    <div className="apt-patient" style={{ flex: 1.2 }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--secondary)', marginBottom: '4px', letterSpacing: '-0.4px' }}>
                        {appointment.patient?.name || 'Άγνωστος'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.82rem', fontWeight: '650', opacity: 0.85 }}>
                            {appointment.patient?.phone}
                        </p>
                        {appointment.patient?.email && (
                            <>
                                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '500' }}>
                                    {appointment.patient.email}
                                </p>
                            </>
                        )}
                    </div>
                    {appointment.doctor && !showDoctorSelect && (
                        <p
                            onClick={() => showActions && doctors.length > 0 && setShowDoctorSelect(true)}
                            style={{ 
                                background: 'var(--primary-light)',
                                color: 'var(--primary)',
                                fontSize: '0.7rem',
                                fontWeight: '800',
                                marginTop: '8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 10px',
                                borderRadius: '8px',
                                cursor: showActions && doctors.length > 0 ? 'pointer' : 'default',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                border: '1px solid rgba(99, 102, 241, 0.15)'
                            }}
                        >
                            <span style={{ opacity: 0.8 }}>&#x2695;</span> {appointment.doctor.name}
                            {showActions && doctors.length > 0 && <ChevronDown size={10} />}
                        </p>
                    )}
                    {!appointment.doctor && showActions && doctors.length > 0 && !showDoctorSelect && (
                        <p onClick={() => setShowDoctorSelect(true)} style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: '600', marginTop: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            + Ανάθεση γιατρού
                        </p>
                    )}
                    {showDoctorSelect && (
                        <select
                            autoFocus
                            disabled={reassigning}
                            defaultValue={appointment.doctorId || ''}
                            onChange={e => handleReassign(e.target.value)}
                            onBlur={() => setShowDoctorSelect(false)}
                            style={{ fontSize: '0.75rem', marginTop: '4px', borderRadius: '8px', border: '1px solid var(--primary)', padding: '3px 6px', color: 'var(--text)', background: 'var(--input-bg)', maxWidth: '160px' }}
                        >
                            <option value="">Κανένας</option>
                            {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    )}
                </div>

                {/* Reason + AI tag */}
                {appointment.reason && (
                    <div className="apt-reason" style={{ flex: 1, paddingLeft: '1rem', borderLeft: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', lineHeight: '1.5', fontWeight: '500' }}>
                            {appointment.reason}
                        </p>
                        {appointment.aiClassification && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'rgba(99,102,241,0.1)',
                                color: 'var(--primary)',
                                padding: '3px 10px',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: '800',
                                marginTop: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                <CheckCircle size={11} /> {appointment.aiClassification}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Right side */}
            <div className="apt-side" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isUrgent && (
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.2)', animation: 'pulse 2s infinite' }} />
                    )}
                    <Badge type={appointment.priority}>
                        {appointment.priority === 'URGENT' ? 'ΕΠΕΙΓΟΝ' : 'ΚΑΝΟΝΙΚΟ'}
                    </Badge>
                </div>

                {showActions && (
                    <div className="apt-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {/* Status badge when confirmed */}
                        {appointment.status === 'CONFIRMED' && (
                            <span style={{
                                fontSize: '0.72rem', fontWeight: '800', padding: '5px 10px',
                                borderRadius: '8px', background: 'rgba(16,185,129,0.12)',
                                color: '#059669', border: '1px solid rgba(16,185,129,0.25)',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                whiteSpace: 'nowrap'
                            }}>
                                <CheckCircle size={12} /> Επιβεβαιωμένο
                            </span>
                        )}
                        <button
                            title="Αποστολή Μηνύματος"
                            onClick={() => onMessage && onMessage(appointment.patient)}
                            style={{ padding: '8px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <MessageSquare size={16} />
                        </button>
                        {/* Only show confirm button if not already confirmed */}
                        {appointment.status !== 'CONFIRMED' && (
                            <button
                                title="Επιβεβαίωση"
                                onClick={() => onConfirm && onConfirm(appointment.id)}
                                style={{ padding: '8px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.06)', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                                <CheckCircle size={16} />
                            </button>
                        )}
                        <button
                            title="Ακύρωση"
                            onClick={() => onCancel && onCancel(appointment.id)}
                            style={{ padding: '8px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <AlertCircle size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AppointmentCard;
