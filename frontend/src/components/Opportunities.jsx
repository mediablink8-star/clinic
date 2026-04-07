import React from 'react';
import { TrendingUp, PhoneMissed, Zap, MessageCircle, ChevronRight } from 'lucide-react';

const Opportunities = ({ recoveryLog = [], onNavigate }) => {
    const logs = Array.isArray(recoveryLog) ? recoveryLog : [];

    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const missedThisWeek = logs.filter(l => l && new Date(l.createdAt) >= week).length;
    const activeRecoveries = logs.filter(l => l && l.status === 'RECOVERING').length;
    const awaitingReply = logs.filter(l => l && l.status === 'RECOVERING' && l.smsStatus === 'sent').length;

    const items = [
        { icon: PhoneMissed, color: '#ef4444', bg: '#fef2f2', label: `${missedThisWeek} αναπάντητες αυτή την εβδομάδα` },
        { icon: Zap,         color: '#f59e0b', bg: '#fffbeb', label: `${activeRecoveries} ενεργές ανακτήσεις` },
        { icon: MessageCircle, color: '#6366f1', bg: '#eef2ff', label: `${awaitingReply} αναμένουν απάντηση` },
    ];

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '7px', margin: 0 }}>
                    <TrendingUp size={15} /> ΕΥΚΑΙΡΙΕΣ
                </h3>
                <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>7 ημέρες</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {items.map(({ icon: Icon, color, bg, label }) => (
                    <div
                        key={label}
                        onClick={() => onNavigate && onNavigate('analytics')}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '7px 10px', borderRadius: '10px',
                            background: bg, border: `1px solid ${color}18`,
                            cursor: 'pointer', transition: 'all 0.15s ease'
                        }}
                        className="hover-lift"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                            <Icon size={13} color={color} />
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--secondary)' }}>{label}</span>
                        </div>
                        <ChevronRight size={12} color="#cbd5e1" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Opportunities;
