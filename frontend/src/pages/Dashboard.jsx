import React from 'react';
import toast from 'react-hot-toast';
import {
    PhoneMissed,
    CheckCircle2,
    Receipt,
    Euro,
    Calendar,
    ArrowUpRight,
    AlertTriangle,
    Zap,
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

const SkBox = ({ w = '100%', h = 20, r = 10, style = {} }) => (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
);

const DashboardSkeleton = () => (
    <div style={{ paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <SkBox w={280} h={36} r={10} />
                <SkBox w={200} h={16} r={8} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <SkBox w={130} h={42} r={14} />
                <SkBox w={150} h={42} r={14} />
            </div>
        </div>

        {/* Stat cards row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 90, borderRadius: 20 }} />
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
                <div key={i} className="skeleton" style={{ borderRadius: 24 }} />
            ))}
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
    loading,
    onRefresh,
}) => {
    const hasLoaded = React.useRef(false);
    const logsArray = React.useMemo(() => Array.isArray(recoveryLog) ? recoveryLog : [], [recoveryLog]);
    const [configWarnings, setConfigWarnings] = React.useState([]);
    const [testRecoveryStatus, setTestRecoveryStatus] = React.useState(null);
    const [runAutomationStatus, setRunAutomationStatus] = React.useState(null);

    const handleTestRecovery = React.useCallback(async () => {
        if (testRecoveryStatus === 'sending') return;
        setTestRecoveryStatus('sending');
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
        const authToken = token || localStorage.getItem('clinic_token');
        try {
            const res = await fetch(`${API_BASE}/automation/missed-call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    phone: '+3069' + Math.floor(10000000 + Math.random() * 90000000),
                    clinicId: clinic?.id,
                    callSid: `demo_${Date.now()}`
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
            setTestRecoveryStatus('sent');
            toast.success('Missed call simulated!');
            onRefresh?.();
        } catch (err) {
            setTestRecoveryStatus('error');
            toast.error(`Simulation failed: ${err.message}`);
        } finally {
            setTimeout(() => setTestRecoveryStatus(null), 3000);
        }
    }, [token, clinic, testRecoveryStatus, onRefresh]);

    const handleRunAutomation = React.useCallback(async () => {
        if (runAutomationStatus === 'running') return;
        setRunAutomationStatus('running');
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
        const authToken = token || localStorage.getItem('clinic_token');
        try {
            const res = await fetch(`${API_BASE}/automation/process-missed-calls`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({})
            });
            const data = await res.json();
            const processed = data?.data?.processed ?? 0;
            setRunAutomationStatus(processed > 0 ? 'done' : 'empty');
            if (processed > 0) {
                toast.success(`Processed ${processed} missed call${processed > 1 ? 's' : ''}`);
                onRefresh?.();
            } else {
                toast('Nothing pending', { icon: '—' });
            }
        } catch {
            setRunAutomationStatus('error');
            toast.error('Automation failed');
        } finally {
            setTimeout(() => setRunAutomationStatus(null), 3000);
        }
    }, [token, runAutomationStatus, onRefresh]);

    React.useEffect(() => {
        const authToken = token || localStorage.getItem('clinic_token');
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.02em', marginBottom: '6px' }}>
                        {greeting}, {clinic?.name || 'Local Health Clinic'}
                    </h1>
                    <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                        Δείτε τι συμβαίνει στο ιατρείο σας σήμερα.
                    </p>
                    <p style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', display: 'inline-block', boxShadow: '0 0 5px rgba(99,102,241,0.5)' }} />
                        Automation: External (API Mode)
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
                        onClick={handleTestRecovery}
                        disabled={testRecoveryStatus === 'sending'}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '12px',
                            border: '1.5px solid rgba(239,68,68,0.35)',
                            background: testRecoveryStatus === 'sent'
                                ? 'rgba(16,185,129,0.1)'
                                : testRecoveryStatus === 'error'
                                    ? 'rgba(239,68,68,0.1)'
                                    : 'rgba(239,68,68,0.07)',
                            color: testRecoveryStatus === 'sent'
                                ? '#059669'
                                : testRecoveryStatus === 'error'
                                    ? '#dc2626'
                                    : '#ef4444',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: testRecoveryStatus === 'sending' ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s',
                            opacity: testRecoveryStatus === 'sending' ? 0.6 : 1,
                        }}
                    >
                        <PhoneMissed size={14} />
                        {testRecoveryStatus === 'sending'
                            ? 'Αποστολή...'
                            : testRecoveryStatus === 'sent'
                                ? '✓ Εστάλη!'
                                : testRecoveryStatus === 'error'
                                    ? '✗ Σφάλμα'
                                    : 'Simulate Missed Call'}
                    </button>
                    <button
                        onClick={handleRunAutomation}
                        disabled={runAutomationStatus === 'running'}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '12px',
                            border: '1.5px solid rgba(99,102,241,0.35)',
                            background: runAutomationStatus === 'done'
                                ? 'rgba(16,185,129,0.1)'
                                : runAutomationStatus === 'empty'
                                    ? 'rgba(148,163,184,0.1)'
                                    : runAutomationStatus === 'error'
                                        ? 'rgba(239,68,68,0.1)'
                                        : 'rgba(99,102,241,0.07)',
                            color: runAutomationStatus === 'done'
                                ? '#059669'
                                : runAutomationStatus === 'empty'
                                    ? '#64748b'
                                    : runAutomationStatus === 'error'
                                        ? '#dc2626'
                                        : '#6366f1',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: runAutomationStatus === 'running' ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s',
                            opacity: runAutomationStatus === 'running' ? 0.6 : 1,
                        }}
                    >
                        <Zap size={14} />
                        {runAutomationStatus === 'running'
                            ? 'Εκτέλεση...'
                            : runAutomationStatus === 'done'
                                ? '✓ Ολοκληρώθηκε!'
                                : runAutomationStatus === 'empty'
                                    ? '— Τίποτα εκκρεμές'
                                    : runAutomationStatus === 'error'
                                        ? '✗ Σφάλμα'
                                        : 'Run Automation'}
                    </button>
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
                    <RecoveryFeed logs={recoveryLog} muted={true} token={token} />

                    <div className="grid-cell-glass card-hover" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.5)', padding: '1.1rem 1.25rem', boxShadow: '0 8px 32px rgba(0,0,0,0.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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

                    <SystemStatus status={systemStatus} setCurrentTab={setCurrentTab} />

                    <AutomationLog logs={logsArray} onTestRecovery={handleTestRecovery} />
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
