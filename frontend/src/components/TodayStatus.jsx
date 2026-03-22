import React from 'react';
import { CalendarCheck, PhoneMissed, UserCheck, MessageCircle } from 'lucide-react';

const TodayRow = ({ icon: Icon, color, label, value }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderRadius: '12px',
        background: 'rgba(248,250,252,0.7)',
        border: '1px solid rgba(226,232,240,0.5)',
        flex: 1,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)',
                color
            }}>
                <Icon size={14} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>{label}</span>
        </div>
        <span style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--secondary)' }}>{value}</span>
    </div>
);

const TodayStatus = ({ missedCalls = 0, recovered = 0, appointmentsToday = 0, activeChats = 0 }) => {
    const today = new Date();
    const dayName = today.toLocaleDateString('el-GR', { weekday: 'long' });
    const dateStr = today.toLocaleDateString('el-GR', { month: 'short', day: 'numeric' });

    return (
        <div className="grid-cell-glass" style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            padding: '1.25rem',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.5)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.07)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--secondary)' }}>
                    📅 Σήμερα
                </h3>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>
                    {dayName}, {dateStr}
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <TodayRow icon={PhoneMissed} color="#ef4444" label="Αναπάντητες κλήσεις" value={missedCalls} />
                <TodayRow icon={UserCheck} color="#10b981" label="Ανακτήθηκαν" value={recovered} />
                <TodayRow icon={CalendarCheck} color="#3b82f6" label="Ραντεβού σήμερα" value={appointmentsToday} />
                <TodayRow icon={MessageCircle} color="var(--primary)" label="Ενεργές συνομιλίες AI" value={activeChats} />
            </div>
        </div>
    );
};

export default TodayStatus;
