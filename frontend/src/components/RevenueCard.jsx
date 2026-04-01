import React from 'react';
import { TrendingUp, Users, BarChart3, ArrowUpRight, Target } from 'lucide-react';

const daysShort = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'];

const RevenueCard = ({ stats, recoveryLog = [] }) => {
    const weeklyData = React.useMemo(() => {
        const counts = [0, 0, 0, 0, 0, 0, 0];
        const now = new Date();
        if (Array.isArray(recoveryLog)) {
            recoveryLog.forEach(l => {
                if (l.status !== 'RECOVERED') return;
                const d = new Date(l.updatedAt || l.createdAt);
                const diffDays = Math.floor((now - d) / 86400000);
                if (diffDays >= 0 && diffDays < 7) {
                    const idx = 6 - diffDays;
                    if (idx >= 0 && idx < 7) counts[idx]++;
                }
            });
        }
        return counts;
    }, [recoveryLog]);

    const maxVal = Math.max(...weeklyData, 1);
    const revenue = stats?.revenue || 0;
    const recovered = stats?.recovered || 0;
    const avgValue = recovered > 0 ? Math.round(revenue / recovered) : 0;

    return (
        <div style={{
            borderRadius: '32px',
            overflow: 'hidden',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #0f172a 0%, #062c2b 100%)',
            boxShadow: '0 20px 48px -12px rgba(15,23,42,0.3)',
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.08)'
        }}>
            {/* Ambient Background Glows */}
            <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '180px', height: '180px', background: 'var(--primary)', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.2, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '150px', height: '150px', background: '#10b981', borderRadius: '50%', filter: 'blur(70px)', opacity: 0.15, pointerEvents: 'none' }} />

            <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)' }}>
                                <Target size={14} color="white" />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Έσοδα Ανάκτησης</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                            <span style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white', letterSpacing: '-0.04em', lineHeight: 1 }}>
                                €{revenue.toLocaleString()}
                            </span>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                background: 'rgba(16,185,129,0.15)', 
                                color: '#34d399', 
                                padding: '4px 10px', 
                                borderRadius: '10px', 
                                fontSize: '0.8rem', 
                                fontWeight: '800',
                                border: '1px solid rgba(16,185,129,0.1)'
                            }}>
                                <ArrowUpRight size={12} strokeWidth={3} />
                                +14%
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub-metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ 
                        background: 'rgba(255,255,255,0.04)', 
                        border: '1px solid rgba(255,255,255,0.06)', 
                        borderRadius: '20px', 
                        padding: '1.25rem',
                        transition: 'transform 0.2s ease',
                        cursor: 'default'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <Users size={14} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Ασθενείς</span>
                        </div>
                        <p style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: 0 }}>{recovered}</p>
                    </div>
                    <div style={{ 
                        background: 'rgba(255,255,255,0.04)', 
                        border: '1px solid rgba(255,255,255,0.06)', 
                        borderRadius: '20px', 
                        padding: '1.25rem' 
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <BarChart3 size={14} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Μέση Αξία</span>
                        </div>
                        <p style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: 0 }}>€{avgValue}</p>
                    </div>
                </div>

                {/* Weekly Flow */}
                <div style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Τάση Εβδομάδας</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.8rem', fontWeight: '800' }}>
                            <TrendingUp size={14} strokeWidth={3} />
                            <span>UPWARD</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '64px' }}>
                        {weeklyData.map((val, idx) => (
                            <div key={idx} style={{ 
                                flex: 1, 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                gap: '8px', 
                                height: '100%', 
                                justifyContent: 'flex-end' 
                            }}>
                                <div style={{
                                    width: '100%',
                                    height: `${Math.max((val / maxVal) * 100, 10)}%`,
                                    background: idx === 6
                                        ? 'linear-gradient(180deg, #34d399 0%, #10b981 100%)'
                                        : 'rgba(255,255,255,0.08)',
                                    borderRadius: '6px',
                                    transition: 'height 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    boxShadow: idx === 6 ? '0 0 15px rgba(52,211,153,0.3)' : 'none'
                                }} />
                                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: '800' }}>{daysShort[idx]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RevenueCard;
