import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, Send, Calendar, X, Search, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import SendMessageModal from './SendMessageModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const QuickActionBtn = ({ icon: Icon, label, onClick, variant = 'outline', badge }) => {
    const isPrimary = variant === 'primary';
    const isAi = variant === 'ai';

    const bg = isPrimary ? 'linear-gradient(135deg, var(--primary) 0%, #009a93 100%)'
        : isAi ? 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)'
        : 'var(--bg-subtle)';

    const color = (isPrimary || isAi) ? 'white' : 'var(--secondary)';
    const border = (isPrimary || isAi) ? 'none' : '1px solid var(--border)';
    const shadow = isPrimary ? '0 8px 24px -6px rgba(59,130,246,0.45)' : isAi ? '0 8px 24px -6px rgba(99,102,241,0.4)' : 'var(--shadow-sm)';
    const iconBg = isPrimary ? 'rgba(255,255,255,0.18)' : isAi ? 'rgba(99,102,241,0.3)' : 'var(--primary-light)';
    const iconColor = (isPrimary || isAi) ? 'white' : 'var(--primary)';

    return (
        <button className={`quick-action-btn ${isPrimary || isAi ? 'quick-action-btn--wide' : ''}`} onClick={onClick} style={{ width: '100%', flex: (isPrimary || isAi) ? undefined : 1, padding: (isPrimary || isAi) ? '1rem' : '0.75rem', borderRadius: '14px', border, background: bg, backdropFilter: 'blur(8px)', color, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: (isPrimary || isAi) ? '800' : '600', fontSize: (isPrimary || isAi) ? '0.9rem' : '0.82rem', cursor: 'pointer', boxShadow: shadow, transition: 'all 0.2s ease', position: 'relative', opacity: isPrimary ? 1 : 0.9 }}>
            <div style={{ background: iconBg, padding: (isPrimary || isAi) ? '8px' : '7px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={(isPrimary || isAi) ? 18 : 16} color={iconColor} />
            </div>
            {label}
            {badge && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: '800', padding: '2px 7px', borderRadius: '99px', background: 'rgba(255,255,255,0.25)', color: 'white', letterSpacing: '0.03em' }}>{badge}</span>}
        </button>
    );
};

const QuickActions = ({ onViewSchedule, onAddPatient, onNewAppointment, patients = [], token, clinic, onRefresh }) => {
    const [showSMS, setShowSMS] = useState(false);
    const [showCall, setShowCall] = useState(false);

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <QuickActionBtn icon={Calendar} label="+ Νέο Ραντεβού" onClick={onNewAppointment || onViewSchedule} variant="primary" />
                <div className="quick-actions-row" style={{ display: 'flex', gap: '0.5rem' }}>
                    <QuickActionBtn icon={UserPlus} label="Ασθενείς" onClick={onAddPatient || onViewSchedule} variant="secondary" />
                    <QuickActionBtn icon={Send} label="SMS" onClick={() => setShowSMS(true)} variant="secondary" />
                    <QuickActionBtn icon={Phone} label="Κλήση" onClick={() => setShowCall(true)} variant="secondary" />
                </div>
            </div>
            {showSMS && <SendMessageModal patients={patients} token={token} onClose={() => setShowSMS(false)} />}
            {showCall && <CallPatientModal patients={patients} onClose={() => setShowCall(false)} />}
        </>
    );
};

export default QuickActions;
