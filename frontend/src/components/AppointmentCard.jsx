import React from 'react';
import Badge from './Badge';
import { CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';

const AppointmentCard = ({ appointment, delay, showActions = false, onConfirm, onCancel, onMessage }) => {
    const startTime = new Date(appointment.startTime);
    const isUrgent = appointment.priority === 'URGENT';

    return (
        <div className={`appointment-card animate-fade${isUrgent ? ' urgent' : ''}`} style={{
            animationDelay: delay,
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '1.5rem 1.75rem',
            borderRadius: '20px',
            border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.6)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
        }}>

            <div className="apt-main" style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1 }}>
                {/* Time block */}
                <div style={{
                    minWidth: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: isUrgent ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)',
                    borderRadius: '14px',
                    padding: '10px 14px',
                }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: '900', color: isUrgent ? '#ef4444' : 'var(--primary)', letterSpacing: '-1px', lineHeight: 1 }}>
                        {startTime.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '4px' }}>
                        {startTime.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })}
                    </div>
                </div>

                {/* Patient info */}
                <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#1e293b', marginBottom: '3px', letterSpacing: '-0.3px' }}>
                        {appointment.patient?.name || 'Άγνωστος'}
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>
                        {appointment.patient?.phone}
                    </p>
                </div>

                {/* Reason + AI tag */}
                {appointment.reason && (
                    <div style={{ flex: 1, paddingLeft: '1rem', borderLeft: '1px solid rgba(0,0,0,0.06)' }}>
                        <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5', fontWeight: '500' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isUrgent && (
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.2)', animation: 'pulse 2s infinite' }} />
                    )}
                    <Badge type={appointment.priority}>
                        {appointment.priority === 'URGENT' ? 'ΕΠΕΙΓΟΝ' : 'ΚΑΝΟΝΙΚΟ'}
                    </Badge>
                </div>

                {showActions && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            title="Αποστολή Μηνύματος"
                            onClick={() => onMessage && onMessage(appointment.patient)}
                            style={{ padding: '8px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <MessageSquare size={16} />
                        </button>
                        <button
                            title="Επιβεβαίωση"
                            onClick={() => onConfirm && onConfirm(appointment.id)}
                            style={{ padding: '8px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.06)', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <CheckCircle size={16} />
                        </button>
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
