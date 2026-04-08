import React from 'react';
import { BarChart2, PhoneMissed, MessageSquare, MessageCircle, CalendarCheck, TrendingUp, Euro, Zap, AlertTriangle, Clock } from 'lucide-react';
import RecoveryFunnel from '../components/RecoveryFunnel';

const MetricRow = ({ icon: Icon, label, value, color = '#6366f1', warn = false }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: '12px',
        background: warn ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.5)',
        border: `1px solid ${warn ? 'rgba(239,68,68,0.15)' : 'rgba(226,232,240,0.6)'}`,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon size={13} color={warn ? '#ef4444' : color} />
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-light)' }}>{label}</span>
        </div>
        <span style={{ fontSize: '0.9rem', fontWeight: '900', color: warn ? '#ef4444' : color }}>{value}</span>
    </div>
);

const SectionCard = ({ title, children }) => (
    <div style={{
        background: 'var(--card-bg)',
        backdropFilter: 'blur(16px)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        padding: '1.5rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>
        <h3 style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            {title}
        </h3>
        {children}
    </div>
);

const Analytics = ({ recoveryLog = [], recoveryStats = {}, spending = {}, systemStats = {} }) => {
    const logs = Array.isArray(recoveryLog) ? recoveryLog : [];

    const totalMissed = logs.length;
    const smsSent = logs.filter(l => l.smsStatus === 'sent' || l.smsStatus === 'simulated').length;
    const smsFailed = logs.filter(l => l.smsStatus === 'failed').length;
    const responded = logs.filter(l => ['RECOVERING', 'RECOVERED'].includes(l.status)).length;
    const booked = recoveryStats.recovered || 0;
    const lost = logs.filter(l => l.status === 'LOST').length;
    const recoveryRate = totalMissed > 0 ? Math.round((booked / totalMissed) * 100) : 0;
    const smsDeliveryRate = smsSent > 0 ? Math.round(((smsSent - smsFailed) / smsSent) * 100) : 0;
    const responseRate = smsSent > 0 ? Math.round((responded / smsSent) * 100) : 0;
    const avgRevenue = booked > 0 ? Math.round((recoveryStats.revenue || 0) / booked) : 0;

    return (
        <section className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <header style={{
                padding: '1.75rem 2rem',
                background: 'linear-gradient(135deg, #0f172a 0%, #062c2b 100%)',
                borderRadius: '24px', color: 'white',
                boxShadow: 'var(--shadow-lg)',
                position: 'relative', overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.06)'
            }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', background: 'var(--primary)', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.25, pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '14px', padding: '10px', display: 'flex' }}>
                        <BarChart2 size={26} color="white" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.04em', margin: 0, color: 'white' }}>Recovery Analytics</h1>
                        <p style={{ fontSize: '0.82rem', fontWeight: '500', opacity: 0.6, margin: '2px 0 0' }}>Ανάλυση απόδοσης ανάκτησης — τελευταίες 30 μέρες</p>
                    </div>
                </div>
            </header>

            {/* Main grid — 2x2 Layout for balance */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
                {/* Top Left: Funnel */}
                <SectionCard title="Recovery Funnel — 30 ημέρες">
                    <RecoveryFunnel logs={logs} stats={recoveryStats} />
                </SectionCard>

                {/* Top Right: Conversion Metrics */}
                <SectionCard title="Ποσοστά Μετατροπής">
                    <MetricRow icon={PhoneMissed}    label="Αναπάντητες κλήσεις"   value={totalMissed}           color="#ef4444" />
                    <MetricRow icon={MessageSquare}  label="SMS εστάλησαν"          value={smsSent}               color="#f59e0b" />
                    <MetricRow icon={MessageCircle}  label="Ασθενείς απάντησαν"     value={responded}             color="#6366f1" />
                    <MetricRow icon={CalendarCheck}  label="Ραντεβού κλείστηκαν"    value={booked}                color="#10b981" />
                    <MetricRow icon={TrendingUp}     label="Ποσοστό ανάκτησης"      value={`${recoveryRate}%`}    color="#10b981" />
                    <MetricRow icon={MessageSquare}  label="Ποσοστό παράδοσης SMS"  value={`${smsDeliveryRate}%`} color="#6366f1" />
                    <MetricRow icon={MessageCircle}  label="Ποσοστό απόκρισης"      value={`${responseRate}%`}    color="#6366f1" />
                    {smsFailed > 0 && <MetricRow icon={AlertTriangle} label="Αποτυχίες SMS" value={smsFailed} warn />}
                </SectionCard>

                {/* Bottom Left: Revenue Metrics */}
                <SectionCard title="Έσοδα Ανάκτησης">
                    <MetricRow icon={Euro}          label="Συνολικά έσοδα"          value={`€${(recoveryStats.revenue || 0).toLocaleString()}`} color="#0ea5e9" />
                    <MetricRow icon={CalendarCheck} label="Κλεισμένα ραντεβού"      value={booked}                                              color="#10b981" />
                    <MetricRow icon={Euro}          label="Μέση αξία ραντεβού"       value={`€${avgRevenue}`}                                    color="#6366f1" />
                </SectionCard>

                {/* Bottom Right: SMS / Technical */}
                <SectionCard title="Τεχνικά — SMS & Χρεώσεις">
                    <MetricRow icon={Zap}   label="Credits χρησιμοποιήθηκαν (μήνας)" value={spending.monthCreditsUsed ?? '—'}  color="#f59e0b" />
                    <MetricRow icon={Zap}   label="Σύνολο SMS απεστάλησαν"            value={spending.totalMessagesSent ?? '—'} color="#f59e0b" />
                    {systemStats.pendingNotifications > 0 && (
                        <MetricRow icon={Clock} label="Εκκρεμείς ειδοποιήσεις" value={systemStats.pendingNotifications} warn />
                    )}
                </SectionCard>
            </div>
        </section>
    );
};

export default Analytics;
