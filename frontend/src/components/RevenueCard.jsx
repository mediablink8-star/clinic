import React from 'react';
import { Users, BarChart3, Target, CalendarCheck, ChevronDown } from 'lucide-react';

const FunnelRow = ({ label, value, pct, color }) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color }}>{value}</span>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
    </div>
);

const RevenueCard = ({ stats, recoveryLog = [] }) => {
    const logs = Array.isArray(recoveryLog) ? recoveryLog : [];
    const revenue = stats?.revenue || 0;
    const recovered = stats?.recovered || 0;
    const avgValue = recovered > 0 ? Math.round(revenue / recovered) : 0;

    // Funnel data — based on actual MissedCall fields
    const missed = logs.length || 0;
    const smsSent = logs.filter(l => l && (l.smsStatus === 'sent' || l.smsStatus === 'simulated')).length;
    const replied = logs.filter(l => l && l.status === 'RECOVERING' && l.aiConversation && (() => {
        try { const c = JSON.parse(l.aiConversation); return Array.isArray(c) && c.some(m => m.role === 'user' || m.direction === 'inbound'); } catch { return false; }
    })()).length;
    const booked = recovered;
    const top = missed || 1;

    // AI impact
    const aiRate = missed > 0 ? Math.round((booked / missed) * 100) : 0;

    return (
        <div style={{
            borderRadius: '20px',
            overflow: 'hidden',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            boxShadow: '0 8px 32px -8px rgba(15,23,42,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.1)',
            transition: 'all 0.3s ease'
        }}
        onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 40px -8px rgba(15,23,42,0.5), 0 0 0 1px rgba(255,255,255,0.08)';
        }}
        onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px -8px rgba(15,23,42,0.4), 0 0 0 1px rgba(255,255,255,0.05)';
        }}
        >
            <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '140px', height: '140px', background: 'var(--primary)', borderRadius: '50%', filter: 'blur(10px)', opacity: 0.18, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '120px', height: '120px', background: '#10b981', borderRadius: '50%', filter: 'blur(10px)', opacity: 0.12, pointerEvents: 'none' }} />

            <div style={{ padding: '0.85rem 1.25rem', display: 'flex', gap: '1rem', flex: 1, position: 'relative', zIndex: 1 }}>
                {/* Left: performance metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ padding: '5px', borderRadius: '7px', background: 'rgba(255,255,255,0.1)' }}>
                                <Target size={12} color="white" />
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Απόδοση Ανάκτησης</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>30 μέρες</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', flex: 1 }}>
                        {[
                            { icon: Users,         label: 'Ασθενείς',    value: recovered },
                            { icon: CalendarCheck, label: 'Ραντεβού',    value: booked },
                            { icon: BarChart3,     label: 'Μέση αξία',   value: `€${avgValue}` },
                            { icon: Target,        label: 'Έσοδα',       value: `€${revenue.toLocaleString()}` },
                        ].map(({ icon: Icon, label, value }) => (
                            <div key={label} style={{ 
                                background: 'rgba(255,255,255,0.05)', 
                                border: '1px solid rgba(255,255,255,0.08)', 
                                borderRadius: '12px', 
                                padding: '0.5rem 0.65rem',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                                    <Icon size={11} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
                                </div>
                                <p style={{ fontSize: '1.15rem', fontWeight: '900', color: 'white', margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* AI impact badge */}
                    {aiRate > 0 && (
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            padding: '6px 11px', 
                            borderRadius: '10px', 
                            background: 'rgba(99,102,241,0.15)', 
                            border: '1px solid rgba(99,102,241,0.25)',
                            boxShadow: '0 0 20px rgba(99,102,241,0.15)'
                        }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: '800', color: '#c7d2fe', letterSpacing: '0.01em' }}>
                                ✨ AI ανέκτησε {aiRate}% των αναπάντητων κλήσεων
                            </span>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

                {/* Right: mini funnel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '130px', flexShrink: 0, justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Χωνί</span>
                    <FunnelRow label="Αναπάντητες" value={missed}  pct={100}                              color="#94a3b8" />
                    <div style={{ paddingLeft: '6px' }}><ChevronDown size={10} color="rgba(255,255,255,0.2)" /></div>
                    <FunnelRow label="SMS εστάλη"  value={smsSent} pct={Math.round(smsSent/top*100)}     color="#f59e0b" />
                    <div style={{ paddingLeft: '6px' }}><ChevronDown size={10} color="rgba(255,255,255,0.2)" /></div>
                    <FunnelRow label="Απάντησαν"   value={replied} pct={Math.round(replied/top*100)}     color="#6366f1" />
                    <div style={{ paddingLeft: '6px' }}><ChevronDown size={10} color="rgba(255,255,255,0.2)" /></div>
                    <FunnelRow label="Κλείστηκαν"  value={booked}  pct={Math.round(booked/top*100)}      color="#10b981" />
                </div>
            </div>
        </div>
    );
};

export default RevenueCard;
