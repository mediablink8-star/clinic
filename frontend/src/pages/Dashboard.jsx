import React from 'react';
import {
    PhoneMissed,
    CheckCircle2,
    Receipt,
    Euro,
    Calendar,
    ArrowUpRight,
    AlertTriangle,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import RecoveryFeed from '../components/RecoveryFeed';
import RevenueCard from '../components/RevenueCard';
import QuickActions from '../components/QuickActions';
import TodayStatus from '../components/TodayStatus';
import SystemStatus from '../components/SystemStatus';
import AutomationLog from '../components/AutomationLog';
import RecoveryFunnel from '../components/RecoveryFunnel';
import OnboardingChecklist from '../components/OnboardingChecklist';
import Skeleton from '../components/Skeleton';

const DashboardSkeleton = () => (
    <div style={{ paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton width="280px" height="36px" borderRadius="10px" />
                <Skeleton width="200px" height="16px" borderRadius="8px" />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Skeleton width="130px" height="42px" borderRadius="14px" />
                <Skeleton width="150px" height="42px" borderRadius="14px" />
            </div>
        </div>

        {/* Stat cards row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {[...Array(4)].map((_, i) => (
                <Skeleton key={i} height="90px" borderRadius="20px" />
            ))}
        </div>

        {/* 3×2 grid */}
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, minmax(280px, 1fr))',
            gap: '1rem',
            minHeight: '560px',
        }}>
            {[...Array(6)].map((_, i) => (
                <Skeleton key={i} height="100%" borderRadius="24px" />
            ))}
        </div>
    </div>
);

const SectionHeader = ({ children, icon: Icon, style = {} }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '0.9rem', paddingLeft: '2px' }}>
        {Icon && <Icon size={13} color="#94a3b8" />}
        <h3 style={{
            fontSize: '10px',
            fontWeight: '800',
            color: '#94a3b8',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            ...style
        }}>
            {children}
        </h3>
        <div style={{ flex: 1, height: '1px', background: 'rgba(148,163,184,0.15)', marginLeft: '4px' }} />
    </div>
);

const Dashboard = ({
    clinic,
    todayAppointments = [],
    patients = [],
    token,
    setCurrentTab,
    setShowModal,
    recoveryStats = { recovered: 0, pending: 0, revenue: 0 },
    recoveryLog = [],
    systemStatus = {},
    systemStats = {},
    apiUsage = {},
    loading,
    onRefresh,
}) => {
    const hasLoaded = React.useRef(false);
    const logsArray = React.useMemo(() => Array.isArray(recoveryLog) ? recoveryLog : [], [recoveryLog]);
    const [configWarnings, setConfigWarnings] = React.useState([]);

    React.useEffect(() => {
        const authToken = token;
        if (!authToken) return;
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
        fetch(`${API_BASE}/system/config-status`, { headers: { Authorization: `Bearer ${authToken}` } })
            .then(r => r.json())
            .then(d => setConfigWarnings(d.warnings || []))
            .catch(() => {});
    }, [token]);

    if (!hasLoaded.current && loading) return <DashboardSkeleton />;
    if (!hasLoaded.current && !loading) hasLoaded.current = true;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Καλημέρα' : hour < 18 ? 'Καλό απόγευμα' : 'Καλό βράδυ';

    // Metrics calculation
    const missedCallsToday = logsArray.filter(l => {
        if (!l || !l.createdAt) return false;
        const d = new Date(l.createdAt);
        if (isNaN(d.getTime())) return false;
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
    }).length;

    const activeConversations = logsArray.filter(l => l && l.status === 'RECOVERING').length;

    return (
        <div className="animate-fade" style={{ paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '0.25rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.03em', marginBottom: '4px', lineHeight: 1.1 }}>
                        {greeting}, {clinic?.name || 'Local Health Clinic'}
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                        Δείτε τι συμβαίνει στο ιατρείο σας σήμερα.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.02em' }}>
                            Σύστημα Αυτοματισμού: Σε λειτουργία
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {systemStatus && (
                        <span style={{
                            padding: '5px 11px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: systemStatus.aiConfigured ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                            color: systemStatus.aiConfigured ? '#059669' : '#dc2626',
                            border: `1px solid ${systemStatus.aiConfigured ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)'}`,
                        }}>
                            {systemStatus.aiConfigured ? '● Ενεργό' : '● Πρόβλημα'}
                        </span>
                    )}
                    <button
                        onClick={() => setCurrentTab('reports')}
                        className="btn btn-outline"
                    >
                        Αναφορές
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn btn-primary"
                    >
                        + Νέο Ραντεβού
                    </button>
                </div>
            </div>

            {/* Onboarding Checklist */}
            <OnboardingChecklist
                clinic={clinic}
                systemStatus={systemStatus}
                recoveryLog={logsArray}
            />

            {/* Config Warnings */}
            {configWarnings.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {configWarnings.map(w => (
                        <div key={w.key} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 16px', borderRadius: '12px',
                            background: '#fffbeb', border: '1px solid #fde68a',
                            fontSize: '0.82rem', fontWeight: '600', color: '#92400e'
                        }}>
                            <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                            {w.message}
                        </div>
                    ))}
                </div>
            )}

            {/* PERFORMANCE strip */}
            <section>
                <SectionHeader icon={ArrowUpRight}>ΑΠΟΔΟΣΗ ΙΑΤΡΕΙΟΥ</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem' }}>
                    <StatCard
                        title="Αναπάντητες (μήνας)"
                        value={missedCallsToday}
                        icon={PhoneMissed}
                        color="#ef4444"
                        bg="#fef2f2"
                        subtitle="Αναπάντητες αυτόν τον μήνα"
                        trendValue="+3"
                        trendType="up"
                        size="compact"
                    />
                    <StatCard
                        title="Ανακτήθηκαν (μήνας)"
                        value={recoveryStats.recovered || 0}
                        icon={CheckCircle2}
                        color="#10b981"
                        bg="#f0fdf4"
                        subtitle="Ασθενείς που επέστρεψαν"
                        trendValue="+42%"
                        trendType="up"
                        size="compact"
                    />
                    <StatCard
                        title="Έσοδα"
                        value={`€${recoveryStats.revenue || 0}`}
                        icon={Euro}
                        color="#3b82f6"
                        bg="#eff6ff"
                        subtitle="Εκτιμώμενα έσοδα μήνα"
                        trendValue="+12%"
                        trendType="up"
                        size="compact"
                    />
                    <StatCard
                        title="Έξοδα API"
                        value={`€${((apiUsage.dailyUsed ?? 0) * 0.04).toFixed(2)}`}
                        icon={Receipt}
                        color="#8b5cf6"
                        bg="#f5f3ff"
                        subtitle={`${apiUsage.dailyUsed ?? 0} SMS × €0.04 σήμερα`}
                        trendValue={apiUsage.creditsRemaining ? `${apiUsage.creditsRemaining} credits` : '—'}
                        trendType="neutral"
                        size="compact"
                    />
                </div>
            </section>

            {/* DASHBOARD OVERVIEW — 3×2 equal grid */}
            <section>
                <SectionHeader icon={Calendar}>ΕΠΙΣΚΟΠΗΣΗ ΔΡΑΣΤΗΡΙΟΤΗΤΑΣ</SectionHeader>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gridTemplateRows: 'repeat(2, 280px)',
                    gap: '0.875rem',
                    height: '560px',
                }}>
                    {/* Row 1 */}
                    <RecoveryFeed logs={recoveryLog} muted={true} token={token} />

                    <div className="grid-cell-glass card-hover" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.5)', padding: '1.1rem 1.25rem', boxShadow: '0 8px 32px rgba(0,0,0,0.07)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Γρήγορες Ενέργειες</h3>
                        <QuickActions
                            onViewSchedule={() => setCurrentTab('appointments')}
                            onAddPatient={() => setCurrentTab('patients')}
                            onNewAppointment={() => setShowModal(true)}
                            patients={patients}
                            token={token}
                            clinic={clinic}
                        />
                    </div>

                    <RevenueCard stats={recoveryStats} recoveryLog={recoveryLog} />

                    {/* Row 2 */}
                    <RecoveryFunnel logs={logsArray} stats={recoveryStats} />

                    <SystemStatus status={systemStatus} stats={systemStats} setCurrentTab={setCurrentTab} />

                    <AutomationLog logs={logsArray} />
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
