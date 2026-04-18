import React from 'react';
import { BarChart2, PhoneMissed, MessageSquare, MessageCircle, CalendarCheck, TrendingUp, TrendingDown, Minus, Euro, Zap, AlertTriangle, Clock } from 'lucide-react';
import RecoveryFunnel from '../components/RecoveryFunnel';

const MetricRow = ({ icon: Icon, label, value, color = '#6366f1', warn = false }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: '12px', background: warn ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.5)', border: `1px solid ${warn ? 'rgba(239,68,68,0.15)' : 'rgba(226,232,240,0.6)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon size={14} color={warn ? '#ef4444' : color} />
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-light)' }}>{label}</span>
        </div>
        <span style={{ fontSize: '0.95rem', fontWeight: '900', color: warn ? '#ef4444' : color }}>{value}</span>
    </div>
);

const SectionCard = ({ title, children }) => (
    <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{title}</h3>
        {children}
    </div>
);

const Sparkline = ({ logs }) => {
    const days = 14;
    const buckets = Array.from({ length: days }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
        return { date: d.toDateString(), missed: 0, recovered: 0 };
    });
    logs.forEach(l => {
        const ds = new Date(l.createdAt).toDateString();
        const b = buckets.find(bk => bk.date === ds);
        if (b) { b.missed++; if (l.status === 'RECOVERED') b.recovered++; }
    });
    const maxVal = Math.max(...buckets.map(b => b.missed), 1);
    const W = 280, H = 56, barW = Math.floor(W / days) - 2;
    return (
        <div style={{ paddingTop: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Τάση 14 ημερών</div>
            <svg width="100%" viewBox={`0 0 ${W} ${H + 18}`} style={{ overflow: 'visible' }}>
                {buckets.map((b, i) => {
                    const x = i * (W / days);
                    const missedH = Math.max(2, Math.round((b.missed / maxVal) * H));
                    const recovH = b.recovered > 0 ? Math.max(2, Math.round((b.recovered / maxVal) * H)) : 0;
                    return (
                        <g key={i}>
                            <rect x={x + 1} y={H - missedH} width={barW} height={missedH} rx="3" fill="rgba(239,68,68,0.25)" />
                            {recovH > 0 && <rect x={x + 1} y={H - recovH} width={barW} height={recovH} rx="3" fill="rgba(16,185,129,0.7)" />}
                        </g>
                    );
                })}
                {[0, 6, 13].map(i => (
                    <text key={i} x={i * (W / days) + barW / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">
                        {new Date(buckets[i].date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })}
                    </text>
                ))}
            </svg>
            <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(239,68,68,0.4)' }} /><span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: '600' }}>Αναπάντητες</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(16,185,129,0.7)' }} /><span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: '600' }}>Ανακτήθηκαν</span></div>
            </div>
        </div>
    );
};

const Analytics = ({ recoveryLog = [], recoveryStats = {}, spending = {}, systemStats = {} }) => {
    const logs = Array.isArray(recoveryLog) ? recoveryLog : [];
    const totalMissed = logs.length;
    const smsSent = logs.filter(l => l.smsStatus === 'sent' || l.smsStatus === 'simulated').length;
    const smsFailed = logs.filter(l => l.smsStatus === 'failed').length;
    const responded = logs.filter(l => ['RECOVERING', 'RECOVERED'].includes(l.status)).length;
    const booked = recoveryStats.recovered || 0;
    const recoveryRate = totalMissed > 0 ? Math.round((booked / totalMissed) * 100) : 0;
    const smsDeliveryRate = smsSent > 0 ? Math.round(((smsSent - smsFailed) / smsSent) * 100) : 0;
    const responseRate = smsSent > 0 ? Math.round((responded / smsSent) * 100) : 0;
    const avgRevenue = booked > 0 ? Math.round((recoveryStats.revenue || 0) / booked) : 0;

    return (
        <section className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header style={{ padding: '1.75rem 2rem', background: 'linear-gradient(135deg, #0f172a 0%, #062c2b 100%)', borderRadius: '24px', color: 'white', boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', background: 'var(--primary)', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.25, pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '14px', padding: '10px', display: 'flex' }}><BarChart2 size={26} color="white" /></div>
                    <div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.04em', margin: 0, color: 'white' }}>Recovery Analytics</h1>
                        <p style={{ fontSize: '0.82rem', fontWeight: '500', opacity: 0.6, margin: '2px 0 0' }}>Ανάλυση απόδοσης ανάκτησης — τελευταίες 30 μέρες</p>
                    </div>
                </div>
            </header>

            {/* Trend strip — this week vs last week */}
            {recoveryStats.trend && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    {[
                        { label: 'Αναπάντητες αυτή την εβδομάδα', value: recoveryStats.trend.thisWeek.missed, prev: recoveryStats.trend.lastWeek.missed, color: '#ef4444', isRate: false },
                        { label: 'Ανακτήθηκαν αυτή την εβδομάδα', value: recoveryStats.trend.thisWeek.recovered, prev: recoveryStats.trend.lastWeek.recovered, color: '#10b981', isRate: false },
                        { label: 'Ποσοστό ανάκτησης', value: `${recoveryStats.trend.thisWeek.rate}%`, prev: recoveryStats.trend.lastWeek.rate, delta: recoveryStats.trend.rateDelta, color: '#6366f1', isRate: true },
                    ].map(({ label, value, prev, delta, isRate, color }) => {
                        const d = isRate ? (delta || 0) : (typeof value === 'number' ? value - prev : 0);
                        const up = d > 0; const neutral = d === 0;
                        return (
                            <div key={label} style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', borderRadius: '16px', border: '1px solid var(--border)', padding: '1.1rem 1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                                <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</p>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                                    <span style={{ fontSize: '1.8rem', fontWeight: '900', color, letterSpacing: '-0.04em' }}>{value}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '99px', background: neutral ? 'var(--bg-subtle)' : up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: neutral ? 'var(--text-light)' : up ? '#10b981' : '#ef4444', fontSize: '0.72rem', fontWeight: '800' }}>
                                        {neutral ? '—' : (up ? '+' : '') + d + (isRate ? '%' : '') + ' vs πέρσι'}
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '4px' }}>Προηγ. εβδομάδα: {isRate ? `${prev}%` : prev}</p>
                            </div>
                        );
                    })}
                </div>
            )}


            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <SectionCard title="Recovery Funnel — 30 ημέρες">
                        <RecoveryFunnel logs={logs} stats={recoveryStats} />
                        <Sparkline logs={logs} />
                    </SectionCard>
                    <SectionCard title="Τεχνικά — SMS & Χρεώσεις">
                        <MetricRow icon={Zap} label="Credits χρησιμοποιήθηκαν (μήνας)" value={spending.monthCreditsUsed ?? '—'} color="#f59e0b" />
                        <MetricRow icon={Zap} label="Σύνολο SMS απεστάλησαν" value={spending.totalMessagesSent ?? '—'} color="#f59e0b" />
                        {systemStats.pendingNotifications > 0 && <MetricRow icon={Clock} label="Εκκρεμείς ειδοποιήσεις" value={systemStats.pendingNotifications} warn />}
                    </SectionCard>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <SectionCard title="Ποσοστά Μετατροπής">
                        <MetricRow icon={PhoneMissed} label="Αναπάντητες κλήσεις" value={totalMissed} color="#ef4444" />
                        <MetricRow icon={MessageSquare} label="SMS εστάλησαν" value={smsSent} color="#f59e0b" />
                        <MetricRow icon={MessageCircle} label="Ασθενείς απάντησαν" value={responded} color="#6366f1" />
                        <MetricRow icon={CalendarCheck} label="Ραντεβού κλείστηκαν" value={booked} color="#10b981" />
                        <MetricRow icon={TrendingUp} label="Ποσοστό ανάκτησης" value={`${recoveryRate}%`} color="#10b981" />
                        <MetricRow icon={MessageSquare} label="Ποσοστό παράδοσης SMS" value={`${smsDeliveryRate}%`} color="#6366f1" />
                        <MetricRow icon={MessageCircle} label="Ποσοστό απόκρισης" value={`${responseRate}%`} color="#6366f1" />
                        {smsFailed > 0 && <MetricRow icon={AlertTriangle} label="Αποτυχίες SMS" value={smsFailed} warn />}
                    </SectionCard>
                    <SectionCard title="Έσοδα Ανάκτησης">
                        <MetricRow icon={Euro} label="Συνολικά έσοδα" value={`€${(recoveryStats.revenue || 0).toLocaleString()}`} color="#0ea5e9" />
                        <MetricRow icon={CalendarCheck} label="Κλεισμένα ραντεβού" value={booked} color="#10b981" />
                        <MetricRow icon={Euro} label="Μέση αξία ραντεβού" value={`€${avgRevenue}`} color="#6366f1" />
                    </SectionCard>
                </div>
            </div>
        </section>
    );
};

export default Analytics;
