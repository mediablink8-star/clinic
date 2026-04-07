import React from 'react';
import { Users, BarChart3, Target, CalendarCheck, ChevronDown } from 'lucide-react';

const FunnelRow = ({ label, value, pct, color }) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
            <span style={{ fontSize: '0.65rem', fontWeight: '800', color }}>{value}</span>
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

    // Funnel data
    const missed = logs.length || 0;
    const smsSent = logs.filter(l => l && ['RECOVERING', 'RECOVERED', 'LOST'].includes(l.status)).length;
    const replied = logs.filter(l => l && ['RECOVERING', 'RECOVERED'].includes(l.status)).length;
    const booked = recovered;
    const top = missed || 1;

    // AI impact
    const aiRate = missed > 0 ? Math.round((booked / missed) * 100) : 0;

    return (
        <div style={{
            borderRadius: '24px',
            overflow: 'hidden',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #0f172a 0%, #062c2b 100%)',
            boxShadow: '0 20px 48px -12px rgba(15,23,42,0.3)',
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.08)'
        }}>
            <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '140px', height: '140px', background: 'var(--primary)', borderRadius: '50%', filter: 'blur(70px)', opacity: 0.2, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '120px', height: '120px', background: '#10b981', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.15, pointerEvents: 'none' }} />

            <div style={{ padding: '0.85rem 1.25rem', display: 'flex', gap: '1rem', flex: 1, position: 'relative', zIndex: 1 }}>
                {/* Left: performance metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ padding: '5px', borderRadius: '7px', background: 'rgba(255,255,255,0.1)' }}>
                                <Target size={12} color="white" />
                            </div>
                            <span style={{ fontSize: '0.68rem', fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recovery Performance</span>
                        </div>
                        <span style={{ fontSize: '0.58rem', fontWeight: '600', color: 'rgba(255,255,255,0.3)' }}>30 days</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', flex: 1 }}>
                        {[
                            { icon: Users,         label: 'Ασθενείς',    value: recovered },
                            { icon: CalendarCheck, label: 'Ραντεβού',    value: booked },
                            { icon: BarChart3,     label: 'Μέση αξία',   value: `€${avgValue}` },
                            { icon: Target,        label: 'Έσοδα',       value: `€${revenue.toLocaleString()}` },
                        ].map(({ icon: Icon, label, value }) => (
                            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.45rem 0.6rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                    <Icon size={10} color="rgba(255,255,255,0.4)" />
                                    <span style={{ fontSize: '0.55rem', fontWeight: '800', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{label}</span>
                                </div>
                                <p style={{ fontSize: '1rem', fontWeight: '900', color: 'white', margin: 0 }}>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* AI impact badge */}
                    {aiRate > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.2)' }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: '800', color: '#a5b4fc' }}>
                                AI ανέκτησε {aiRate}% των αναπάντητων κλήσεων
                            </span>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

                {/* Right: mini funnel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '130px', flexShrink: 0, justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.58rem', fontWeight: '800', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Funnel</span>
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
