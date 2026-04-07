import React from 'react';
import { MessageSquare, AlertCircle, ChevronRight, Clock, Reply, PhoneOff } from 'lucide-react';

const AttentionItem = ({ icon: Icon, color, bg, label, action, onClick }) => (
    <div 
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            borderRadius: '12px',
            background: '#f8fafc',
            border: '1px solid #f1f5f9',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
        }}
        className="hover-lift"
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: bg,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Icon size={13} />
            </div>
            <div>
                <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '1px' }}>{label}</p>
                <p style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    {action}
                </p>
            </div>
        </div>
        <ChevronRight size={14} color="#cbd5e1" />
    </div>
);

const NeedsAttention = ({ pendingCount = 0, recoveryLog = [], onNavigate }) => {
    const recovering = Array.isArray(recoveryLog) ? recoveryLog.filter(l => l.status === 'RECOVERING').length : 0;
    const failedSms = Array.isArray(recoveryLog) ? recoveryLog.filter(l => l.smsStatus === 'failed').length : 0;
    const patientReplied = Array.isArray(recoveryLog) ? recoveryLog.filter(l => l.patientReplied || l.status === 'PATIENT_REPLIED').length : 0;
    const total = recovering + failedSms + patientReplied + (pendingCount > 0 ? 1 : 0);

    return (
        <div className="card-glass" style={{
            background: 'white',
            padding: '1rem 1.25rem',
            borderRadius: '20px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} /> ΧΡΕΙΑΖΕΤΑΙ ΠΡΟΣΟΧΗ
                </h3>
                <span style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: '700', 
                    padding: '4px 8px', 
                    background: total > 0 ? '#fef3c7' : '#f0fdf4', 
                    color: total > 0 ? '#b45309' : '#15803d', 
                    borderRadius: '6px' 
                }}>
                    {total > 0 ? `${total} ΕΚΚΡΕΜΟΤΗΤΕΣ` : 'ΟΛΑ ΟΚ'}
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {patientReplied > 0 && (
                    <AttentionItem 
                        icon={Reply} 
                        color="#3b82f6" 
                        bg="#eff6ff" 
                        label={`${patientReplied} ασθενής απάντησε`}
                        action="ΑΠΑΝΤΗΣΤΕ ΤΩΡΑ"
                        onClick={() => onNavigate && onNavigate('dashboard')}
                    />
                )}
                {failedSms > 0 && (
                    <AttentionItem 
                        icon={PhoneOff} 
                        color="#dc2626" 
                        bg="#fef2f2" 
                        label={`${failedSms} αποτυχία αποστολής SMS`}
                        action="ΕΠΑΝΑΛΗΨΗ"
                        onClick={() => onNavigate && onNavigate('dashboard')}
                    />
                )}
                {recovering > 0 && (
                    <AttentionItem 
                        icon={MessageSquare} 
                        color="#d97706" 
                        bg="#fffbeb" 
                        label={`${recovering} ασθενής σε ανάκτηση`}
                        action="ΔΕΙΤΕ ΤΗ ΡΟΗ"
                        onClick={() => onNavigate && onNavigate('dashboard')}
                    />
                )}
                {pendingCount > 0 && (
                    <AttentionItem 
                        icon={Clock} 
                        color="#d97706" 
                        bg="#fffbeb" 
                        label={`${pendingCount} εκκρεμή ραντεβού`}
                        action="ΔΕΙΤΕ ΤΑ ΡΑΝΤΕΒΟΥ"
                        onClick={() => onNavigate && onNavigate('appointments')}
                    />
                )}
                {total === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                        Δεν υπάρχουν εκκρεμότητες 🎉
                    </div>
                )}
            </div>
        </div>
    );
};

export default NeedsAttention;
