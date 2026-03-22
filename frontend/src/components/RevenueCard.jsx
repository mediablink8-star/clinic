import React from 'react';
import { TrendingUp, Users, BarChart3, ArrowUpRight } from 'lucide-react';

const days = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'];

const RevenueCard = ({ stats, recoveryLog = [] }) => {
    // Build real weekly data from recovery log
    const weeklyData = React.useMemo(() => {
        const counts = [0, 0, 0, 0, 0, 0, 0];
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun
        if (Array.isArray(recoveryLog)) {
            recoveryLog.forEach(l => {
                if (l.status !== 'RECOVERED') return;
                const d = new Date(l.updatedAt || l.createdAt);
                const diffDays = Math.floor((now - d) / 86400000);
                if (diffDays < 0 || diffDays > 6) return;
                // map to Mon-Sun index (0=Mon)
                const idx = 6 - diffDays;
                if (idx >= 0 && idx < 7) counts[idx]++;
            });
        }
        return counts;
    }, [recoveryLog]);
    const maxVal = Math.max(...weeklyData, 1);
    const hasPatients = stats?.recovered > 0;
    const hasRevenue = stats?.revenue > 0;
    const revenue = stats?.revenue || 0;
    const recovered = stats?.recovered || 0;
    const avgValue = hasRevenue && hasPatients ? Math.round(revenue / recovered) : 0;

    return (
        <div style={{
            borderRadius: '24px',
            overflow: 'hidden',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(145deg, #0f172a 0%, #1e3a5f 100%)',
            boxShadow: '0 20px 40px -12px rgba(15,23,42,0.4)',
            position: 'relative'
        }}>
            {/* Glow blobs */}
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', background: 'var(--primary)', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.25, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '120px', height: '120px', background: '#10b981', borderRadius: '50%', filter: 'blur(50px)', opacity: 0.15, pointerEvents: 'none' }} />

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>Ανάκτηση Εσόδων</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '2rem', fontWeight: '900', color: 'white', letterSpacing: '-1px', lineHeight: 1 }}>
                                €{revenue.toLocaleString()}
                            </span>
                            {hasRevenue && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '2px 7px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800' }}>
                                    <ArrowUpRight size={10} />
                                    +12%
                                </div>
                            )}
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>εκτιμώμενα έσοδα μήνα</p>
                        <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', marginTop: '1px', fontStyle: 'italic' }}>
                            ανακτηθέντες ασθενείς × μέση αξία επίσκεψης
                        </p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 10px', fontSize: '0.6rem', fontWeight: '800', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Αυτόν τον μήνα
                    </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <div style={{ background: 'rgba(16,185,129,0.2)', padding: '5px', borderRadius: '7px' }}>
                                <Users size={12} color="#34d399" />
                            </div>
                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ασθενείς</span>
                        </div>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', lineHeight: 1 }}>{recovered}</p>
                        <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>ανακτήθηκαν</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <div style={{ background: 'rgba(99,102,241,0.25)', padding: '5px', borderRadius: '7px' }}>
                                <BarChart3 size={12} color="#a5b4fc" />
                            </div>
                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Μέση Αξία</span>
                        </div>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', lineHeight: 1 }}>€{avgValue}</p>
                        <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>ανά ασθενή</p>
                    </div>
                </div>

                {/* Chart */}
                <div style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <p style={{ fontSize: '0.6rem', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Εβδομαδιαία Τάση</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399', fontSize: '0.6rem', fontWeight: '700' }}>
                            <TrendingUp size={10} />
                            <span>Αυξητική</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '44px' }}>
                        {weeklyData.map((val, idx) => (
                            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                                <div style={{
                                    width: '100%',
                                    height: `${Math.max((val / maxVal) * 100, 8)}%`,
                                    background: idx === 6
                                        ? 'linear-gradient(180deg, #34d399, #10b981)'
                                        : 'rgba(255,255,255,0.12)',
                                    borderRadius: '4px',
                                    transition: 'height 0.5s ease',
                                    boxShadow: idx === 6 ? '0 0 8px rgba(52,211,153,0.4)' : 'none'
                                }} />
                                <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>{days[idx]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RevenueCard;
