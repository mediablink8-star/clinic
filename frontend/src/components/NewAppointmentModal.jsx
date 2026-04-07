import React from 'react';
import { X, AlertCircle, Calendar, Clock, User, FileText, Sparkles } from 'lucide-react';

const NewAppointmentModal = ({
    onClose,
    patients,
    newAppt,
    setNewAppt,
    onAnalyze,
    analyzing,
    analysis,
    onBook
}) => {
    const isValid = newAppt.patientId && newAppt.reason && newAppt.date && newAppt.time;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(5,11,27,0.55)',
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, padding: '1rem'
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: '520px',
                    background: 'var(--glass-surface-strong)',
                    backdropFilter: 'blur(32px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(32px) saturate(200%)',
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
                            backdropFilter: 'blur(16px) saturate(160%)'
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                    {/* Patient */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            <User size={12} /> Ασθενής
                        </label>
                        <select
                            style={{
                                width: '100%', padding: '11px 14px',
                                borderRadius: '12px', border: '1px solid var(--input-border)',
                                background: 'var(--input-bg)', fontSize: '0.9rem',
                                color: 'var(--text)', outline: 'none', fontWeight: '500'
                            }}
                            value={newAppt.patientId}
                            onChange={e => setNewAppt({ ...newAppt, patientId: e.target.value })}
                        >
                            <option value="">Επιλέξτε ασθενή...</option>
                            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    {/* Reason */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            <FileText size={12} /> Αιτία Επίσκεψης
                        </label>
                        <textarea
                            placeholder="Περιγράψτε το πρόβλημα..."
                            style={{
                                width: '100%', padding: '11px 14px',
                                borderRadius: '12px', border: '1px solid var(--input-border)',
                                background: 'var(--input-bg)', fontSize: '0.9rem',
                                minHeight: '90px', resize: 'none', outline: 'none',
                                color: 'var(--text)', fontFamily: 'inherit'
                            }}
                            value={newAppt.reason}
                            onChange={e => {
                                setNewAppt({ ...newAppt, reason: e.target.value });
                                if (e.target.value.length > 5) onAnalyze(e.target.value);
                            }}
                        />
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
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                <Calendar size={12} /> Ημερομηνία
                            </label>
                            <input
                                type="date"
                                style={{
                                    width: '100%', padding: '11px 14px',
                                    borderRadius: '12px', border: '1px solid var(--input-border)',
                                    background: 'var(--input-bg)', fontSize: '0.9rem', outline: 'none',
                                    color: 'var(--text)'
                                }}
                                value={newAppt.date}
                                onChange={e => setNewAppt({ ...newAppt, date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                <Clock size={12} /> Ώρα
                            </label>
                            <input
                                type="time"
                                style={{
                                    width: '100%', padding: '11px 14px',
                                    borderRadius: '12px', border: '1px solid var(--input-border)',
                                    background: 'var(--input-bg)', fontSize: '0.9rem', outline: 'none',
                                    color: 'var(--text)'
                                }}
                                value={newAppt.time}
                                onChange={e => setNewAppt({ ...newAppt, time: e.target.value })}
                            />
                        </div>
                    </div>
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
                            backdropFilter: 'blur(18px) saturate(160%)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)'
                        }}
                    >
                        Ακύρωση
                    </button>
                    <button
                        onClick={onBook}
                        disabled={!isValid}
                        style={{
                            flex: 2, padding: '12px',
                            borderRadius: '14px', border: '1px solid rgba(255,255,255,0.22)',
                            background: isValid 
                                ? 'linear-gradient(135deg, rgba(0,181,173,0.82) 0%, rgba(37,99,235,0.62) 100%)' 
                                : 'var(--glass-control-soft)',
                            color: isValid ? 'white' : 'var(--text-light)',
                            fontSize: '0.9rem', fontWeight: '800',
                            cursor: isValid ? 'pointer' : 'not-allowed',
                            boxShadow: isValid ? '0 12px 26px -12px rgba(0,102,255,0.42), inset 0 1px 0 rgba(255,255,255,0.26)' : 'none',
                            transition: 'all 0.2s',
                            backdropFilter: 'blur(18px) saturate(180%)'
                        }}
                    >
                        Καταχώρηση Ραντεβού
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewAppointmentModal;
