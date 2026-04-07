import React from 'react';
import { Users, BarChart3, ArrowUpRight, Target, CalendarCheck } from 'lucide-react';

const RevenueCard = ({ stats, recoveryLog = [] }) => {
    const revenue = stats?.revenue || 0;
    const recovered = stats?.recovered || 0;
    const avgValue = recovered > 0 ? Math.round(revenue / recovered) : 0;
    // ROI: revenue vs estimated SMS cost (assume ~€0.08/SMS, 2 SMS per case)
    const smsCost = recovered * 2 * 0.08;
    const roi = smsCost > 0 ? (revenue / smsCost).toFixed(1) : null;

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

            <div style={{ padding: '0.85rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1, position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ padding: '5px', borderRadius: '7px', background: 'rgba(255,255,255,0.1)' }}>
                            <Target size={12} color="white" />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Έσοδα Ανάκτησης</span>
                    </div>
                    <span style={{ fontSize: '0.6rem', fontWeight: '600', color: 'rgba(255,255,255,0.3)' }}>30 days</span>
                </div>

                {/* Revenue value + ROI */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.9rem', fontWeight: '900', color: 'white', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        €{revenue.toLocaleString()}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800', border: '1px solid rgba(16,185,129,0.1)' }}>
                        <ArrowUpRight size={11} strokeWidth={3} />
                        +14%
                    </div>
                    {roi && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800', border: '1px solid rgba(99,102,241,0.15)' }}>
                            ROI {roi}×
                        </div>
                    )}
                </div>

                {/* Sub-metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.45rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.55rem 0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                            <CalendarCheck size={11} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: '0.58rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Ραντεβού</span>
                        </div>
                        <p style={{ fontSize: '1.1rem', fontWeight: '900', color: 'white', margin: 0 }}>{recovered}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.55rem 0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                            <Users size={11} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: '0.58rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Ασθενείς</span>
                        </div>
                        <p style={{ fontSize: '1.1rem', fontWeight: '900', color: 'white', margin: 0 }}>{recovered}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.55rem 0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                            <BarChart3 size={11} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: '0.58rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Μέση Αξία</span>
                        </div>
                        <p style={{ fontSize: '1.1rem', fontWeight: '900', color: 'white', margin: 0 }}>€{avgValue}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RevenueCard;
