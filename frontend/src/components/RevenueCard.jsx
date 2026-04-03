import React from 'react';
import { Users, BarChart3, ArrowUpRight, Target } from 'lucide-react';

const RevenueCard = ({ stats, recoveryLog = [] }) => {
    const revenue = stats?.revenue || 0;
    const recovered = stats?.recovered || 0;
    const avgValue = recovered > 0 ? Math.round(revenue / recovered) : 0;

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

            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ padding: '5px', borderRadius: '7px', background: 'rgba(255,255,255,0.1)' }}>
                        <Target size={12} color="white" />
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Έσοδα Ανάκτησης</span>
                </div>

                {/* Revenue value */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '2rem', fontWeight: '900', color: 'white', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        €{revenue.toLocaleString()}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800', border: '1px solid rgba(16,185,129,0.1)' }}>
                        <ArrowUpRight size={11} strokeWidth={3} />
                        +14%
                    </div>
                </div>

                {/* Sub-metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <Users size={12} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Ασθενείς</span>
                        </div>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>{recovered}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <BarChart3 size={12} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Μέση Αξία</span>
                        </div>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>€{avgValue}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RevenueCard;
