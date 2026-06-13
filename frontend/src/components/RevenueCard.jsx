import React from 'react';
import { Users, BarChart3, Target, CalendarCheck } from 'lucide-react';

const FunnelRow = ({ label, value, pct, color }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <span style={{ fontSize: '0.72rem', fontWeight: '700', color }}>{value}</span>
    </div>
    <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.8s ease' }} />
    </div>
  </div>
);

const MetricTile = ({ icon: Icon, label, value }) => (
  <div style={{
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '0.65rem 0.75rem',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
      <Icon size={10} color="rgba(255,255,255,0.35)" strokeWidth={2} />
      <span style={{ fontSize: '0.62rem', fontWeight: '600', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
    <p style={{ fontSize: '1.2rem', fontWeight: '700', color: 'white', margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
  </div>
);

const RevenueCard = ({ stats, recoveryLog = [], systemStats = {} }) => {
    const logs = Array.isArray(recoveryLog) ? recoveryLog : [];
    const revenue = stats?.revenue || 0;
    const recovered = stats?.recovered || 0;
    const avgValue = recovered > 0 ? Math.round(revenue / recovered) : 0;

    const totalMissedCalls = systemStats?.totalMissedCalls ?? logs.length;
    const smsSentTotal = systemStats?.smsSentToday ?? logs.filter(l => l && l.smsStatus === 'sent').length;
    const recoveredTotal = systemStats?.recoveredThisMonth ?? recovered;
    const top = totalMissedCalls || 1;

    const aiRate = totalMissedCalls > 0 ? Math.round((recoveredTotal / totalMissedCalls) * 100) : 0;

    return (
        <div style={{
            borderRadius: '16px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #0c1222 0%, #162032 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            position: 'relative',
        }}>
            <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1.25rem', flex: 1, position: 'relative', zIndex: 1 }}>
                {/* Left: performance metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: 'rgba(255,255,255,0.25)' }} />
                            <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Απόδοση Ανάκτησης</span>
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: '500', color: 'rgba(255,255,255,0.3)' }}>30 ημέρες</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', flex: 1 }}>
                        <MetricTile icon={Users} label="Ανακτήθηκαν" value={recovered} />
                        <MetricTile icon={CalendarCheck} label="Ραντεβού" value={recoveredTotal} />
                        <MetricTile icon={BarChart3} label="Μέση αξία" value={`€${avgValue}`} />
                        <MetricTile icon={Target} label="Έσοδα" value={`€${revenue.toLocaleString()}`} />
                    </div>

                    {aiRate > 0 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '7px 12px', borderRadius: '8px',
                            background: 'rgba(99,102,241,0.08)',
                            border: '1px solid rgba(99,102,241,0.15)',
                        }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#818cf8', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: '500', color: '#a5b4fc' }}>
                                AI ανέκτησε {aiRate}% των αναπάντητων κλήσεων
                            </span>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div style={{ width: '1px', background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)', flexShrink: 0 }} />

                {/* Right: funnel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '130px', flexShrink: 0, justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: '600', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Διαδρομή</span>
                    <FunnelRow label="Αναπάντητες" value={totalMissedCalls}  pct={100} color="#64748b" />
                    <div style={{ paddingLeft: '6px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)', lineHeight: '0.4rem' }}>↓</div>
                    <FunnelRow label="SMS εστάλη"  value={smsSentTotal} pct={Math.round(smsSentTotal/top*100)} color="#a16207" />
                    <div style={{ paddingLeft: '6px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)', lineHeight: '0.4rem' }}>↓</div>
                    <FunnelRow label="Κλείστηκαν"  value={recoveredTotal} pct={Math.round(recoveredTotal/top*100)} color="#059669" />
                </div>
            </div>
        </div>
    );
};

export default RevenueCard;
