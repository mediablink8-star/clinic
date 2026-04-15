import React from 'react';
import { CalendarCheck, PhoneMissed, UserCheck, MessageCircle } from 'lucide-react';

const TodayRow = ({ icon: Icon, color, label, value }) => (
    <div className="card-hover" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        borderRadius: '16px',
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        transition: 'all 0.2s ease',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color
            }}>
                <Icon size={16} strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-light)' }}>{label}</span>
        </div>
        <span style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.02em' }}>{value}</span>
    </div>
);

const TodayStatus = ({ missedCalls = 0, recovered = 0, appointmentsToday = 0, activeChats = 0 }) => {
    const today = new Date();
    const dayName = today.toLocaleDateString('el-GR', { weekday: 'long' });
    const dateStr = today.toLocaleDateString('el-GR', { month: 'short', day: 'numeric' });

    return (
        <div className="card-glass grid-cell-glass" style={{
            padding: '1.5rem',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Δραστηριότητα
                </h3>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'capitalize' }}>{dayName}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-light)' }}>{dateStr}</div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                <TodayRow icon={PhoneMissed} color="#ef4444" label="Αναπάντητες σήμερα" value={missedCalls} />
                <TodayRow icon={UserCheck} color="#10b981" label="Ανακτήθηκαν" value={recovered} />
                <TodayRow icon={CalendarCheck} color="#6366f1" label="Ραντεβού σήμερα" value={appointmentsToday} />
                <TodayRow icon={MessageCircle} color="#f59e0b" label="Ενεργές συνομιλίες" value={activeChats} />
            </div>
        </div>
    );
};

export default TodayStatus;
