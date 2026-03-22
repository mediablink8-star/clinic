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

const DashboardSkeleton = () => (
    <div className="animate-fade space-y-8">
        <div className="flex justify-between items-end mb-8">
            <div className="space-y-3">
                <div className="shimmer w-64 h-10" />
                <div className="shimmer w-48 h-4" />
            </div>
            <div className="flex gap-3">
                <div className="shimmer w-32 h-10 rounded-xl" />
                <div className="shimmer w-40 h-10 rounded-xl" />
            </div>
        </div>
        <div className="grid grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="shimmer h-32 rounded-3xl" />
            ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 320px', gap: '2rem' }}>
            <div className="space-y-8">
                <div className="shimmer h-[350px] rounded-3xl" />
                <div className="shimmer h-[350px] rounded-3xl" />
            </div>
            <div className="space-y-8">
                <div className="shimmer h-[420px] rounded-3xl" />
                <div className="shimmer h-[300px] rounded-3xl" />
            </div>
            <div className="space-y-8">
                <div className="shimmer h-[350px] rounded-3xl" />
                <div className="shimmer h-[250px] rounded-3xl" />
            </div>
        </div>
    </div>
);

const SectionHeader = ({ children, icon: Icon, style = {} }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', paddingLeft: '2px' }}>
        {Icon && <Icon size={14} className="text-text-light opacity-60" />}
        <h3 style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#94a3b8',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            ...style
        }}>
            {children}
        </h3>
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
    apiUsage = {},
    loading
}) => {
    const hasLoaded = React.useRef(false);
    const logsArray = React.useMemo(() => Array.isArray(recoveryLog) ? recoveryLog : [], [recoveryLog]);
    const [configWarnings, setConfigWarnings] = React.useState([]);

    React.useEffect(() => {
        if (!token) return;
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
        fetch(`${API_BASE}/system/config-status`, { headers: { Authorization: `Bearer ${token}` } })
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.02em', marginBottom: '6px' }}>
                        {greeting}, {clinic?.name || 'Local Health Clinic'}
                    </h1>
                    <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                        Δείτε τι συμβαίνει στο ιατρείο σας σήμερα.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {systemStatus && (
                        <span style={{
                            padding: '6px 12px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: systemStatus.aiConfigured ? '#f0fdf4' : '#fef2f2',
                            color: systemStatus.aiConfigured ? '#15803d' : '#b91c1c'
                        }}>
                            {systemStatus.aiConfigured ? '● Ενεργό' : '● Πρόβλημα'}
                        </span>
                    )}
                    <button
                        onClick={() => setCurrentTab('reports')}
                        className="btn btn-outline"
                    >
                        Προβολή Αναφορών
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn btn-primary"
                    >
                        Νέο Ραντεβού
                    </button>
                </div>
            </div>

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
                <SectionHeader icon={ArrowUpRight}>PERFORMANCE</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
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
                <SectionHeader icon={Calendar}>DASHBOARD OVERVIEW</SectionHeader>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gridTemplateRows: 'repeat(2, minmax(280px, 1fr))',
                    gap: '1rem',
                    minHeight: '560px',
                }}>
                    {/* Row 1 */}
                    <RecoveryFeed logs={recoveryLog} muted={true} />

                    <div className="grid-cell-glass" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.5)', padding: '1.1rem 1.25rem', boxShadow: '0 8px 32px rgba(0,0,0,0.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                    <TodayStatus
                        missedCalls={missedCallsToday}
                        recovered={recoveryStats?.recovered || 0}
                        appointmentsToday={todayAppointments?.length || 0}
                        activeChats={activeConversations}
                    />

                    <SystemStatus status={systemStatus} />

                    <AutomationLog logs={logsArray} />
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
