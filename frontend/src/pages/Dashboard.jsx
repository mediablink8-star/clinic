import React from 'react';
import {
    PhoneMissed,
    CheckCircle2,
    Receipt,
    Euro,
    Calendar,
    ArrowUpRight,
    AlertTriangle,
    Zap,
    Clock,
    Plus,
    Activity,
    LineChart,
    Power,
    Check
} from 'lucide-react';
import axios from 'axios';
import StatCard from '../components/StatCard';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
import RecoveryFeed from '../components/RecoveryFeed';
import QuickActions from '../components/QuickActions';
import TodayStatus from '../components/TodayStatus';
import RevenueCard from '../components/RevenueCard';
import OnboardingChecklist from '../components/OnboardingChecklist';
import Skeleton from '../components/Skeleton';
import NotificationBell from '../components/NotificationBell';

const DashboardSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton width="320px" height="40px" borderRadius="12px" />
                <Skeleton width="240px" height="18px" borderRadius="8px" />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
                <Skeleton width="140px" height="48px" borderRadius="16px" />
                <Skeleton width="48px" height="48px" borderRadius="16px" />
            </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} height="120px" borderRadius="24px" />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            <Skeleton height="400px" borderRadius="32px" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <Skeleton height="190px" borderRadius="32px" />
                <Skeleton height="190px" borderRadius="32px" />
            </div>
        </div>
    </div>
);

const RightColumn = ({ children }) => {
    const ref = React.useRef(null);
    const [showHint, setShowHint] = React.useState(false);

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const check = () => setShowHint(el.scrollTop < 20 && el.scrollHeight > el.clientHeight + 10);
        // slight delay so layout is settled
        const t = setTimeout(check, 300);
        el.addEventListener('scroll', check);
        window.addEventListener('resize', check);
        return () => { clearTimeout(t); el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
    }, []);

    return (
        <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, overflowY: 'auto', paddingRight: '2px', position: 'relative' }}>
            {children}
            {showHint && (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                    padding: '6px 0 2px', pointerEvents: 'none',
                    animation: 'scrollBounce 1.6s ease-in-out infinite'
                }}>
                    <span style={{ fontSize: '0.58rem', fontWeight: '700', color: 'var(--text-light)', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.5 }}>scroll για περισσότερα</span>
                    <svg width="14" height="9" viewBox="0 0 14 9" fill="none" style={{ opacity: 0.4 }}>
                        <path d="M1 1l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            )}
        </div>
    );
};

const SectionHeader = ({ children, icon: Icon }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
        {Icon && (
            <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Icon size={14} strokeWidth={2.5} />
            </div>
        )}
        <h3 style={{
            fontSize: '0.8rem',
            fontWeight: '800',
            color: 'var(--secondary)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase'
        }}>
            {children}
        </h3>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)', marginLeft: '6px' }} />
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
    spending = { totalCreditsUsed: 0, monthCreditsUsed: 0, totalMessagesSent: 0 },
    loading,
    warnings = [],
    notifications = [],
    upcomingAppointments = [],
    onUpdate,
    onRefresh
}) => {
    const hasLoaded = React.useRef(false);
    const logsArray = React.useMemo(() => Array.isArray(recoveryLog) ? recoveryLog : [], [recoveryLog]);

    if (!hasLoaded.current && loading) return <DashboardSkeleton />;
    if (!hasLoaded.current && !loading) hasLoaded.current = true;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Καλημέρα' : hour < 18 ? 'Καλό απόγευμα' : 'Καλό βράδυ';

    const missedCallsToday = logsArray.filter(l => {
        if (!l || !l.createdAt) return false;
        const d = new Date(l.createdAt);
        return d.toDateString() === new Date().toDateString();
    }).length;

    const handleToggleActive = async () => {
        const nextState = !clinic?.isActive;
        if (onUpdate) onUpdate({ isActive: nextState });
        try {
            await axios.post(`${API_BASE}/clinic/toggle-status`, 
                { isActive: nextState }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (err) {
            if (onUpdate) onUpdate({ isActive: !nextState });
            console.error("Status toggle failed:", err);
        }
    };

    const activeConversations = logsArray.filter(l => l && l.status === 'RECOVERING').length;

    return (
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 4rem)', overflow: 'hidden' }}>
            {/* MINI HEADER */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0 4px'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.04em', margin: 0 }}>
                            {greeting}, {clinic?.name?.match(/^(Δρ\.|Dr\.)/i) ? clinic.name : `Δρ. ${clinic?.name || 'Συνάδελφε'}`}
                        </h1>
                        <button 
                            onClick={handleToggleActive}
                            style={{ 
                                background: clinic?.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)', 
                                color: clinic?.isActive ? '#10b981' : '#64748b', 
                                border: `1px solid ${clinic?.isActive ? '#10b981' : '#64748b'}44`,
                                padding: '4px 12px', 
                                borderRadius: '99px', 
                                fontSize: '0.68rem', 
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                outline: 'none'
                            }}>
                            <div className={clinic?.isActive ? "status-pulse" : ""} style={{ 
                                margin: 0, 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%',
                                background: clinic?.isActive ? '#10b981' : '#64748b' 
                            }} />
                            {clinic?.isActive ? 'ΣΥΣΤΗΜΑ ΕΝΕΡΓΟ' : 'WORKFLOWS PAUSED'}
                        </button>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontWeight: '700', margin: 0, opacity: 0.8 }}>
                        Δείτε τι συμβαίνει στο ιατρείο σας σήμερα.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '4px', 
                        background: 'var(--bg-subtle)', 
                        borderRadius: '12px',
                        border: '1px solid var(--border)'
                    }}>
                        <button onClick={() => setCurrentTab('reports')} className="btn btn-outline" style={{ border: 'none', background: 'transparent', padding: '6px 12px', fontSize: '0.8rem' }}>
                            <LineChart size={16} />
                            Αναφορές
                        </button>
                        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '0.8rem' }}>
                            <Plus size={16} strokeWidth={3} />
                            Νέο Ραντεβού
                        </button>
                        <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
                        <NotificationBell warnings={warnings} notifications={notifications} />
                    </div>
                </div>
            </div>

            {/* COMPACT STATS STRIP */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                <StatCard
                    title="Αναπάντητες (24h)"
                    value={missedCallsToday}
                    icon={PhoneMissed}
                    color="#ef4444"
                    trendValue="+2"
                    trendType="up"
                    size="compact"
                />
                <StatCard
                    title="Ανακτήθηκαν"
                    value={recoveryStats.recovered || 0}
                    icon={CheckCircle2}
                    color="#10b981"
                    trendValue="+14%"
                    trendType="up"
                    size="compact"
                />
                <StatCard
                    title="Έσοδα"
                    value={`€${(recoveryStats.revenue || 0).toLocaleString()}`}
                    icon={Euro}
                    color="#6366f1"
                    trendValue="+€450"
                    trendType="up"
                    size="compact"
                />
                <StatCard
                    title="Χρεώσεις"
                    value={`${spending.monthCreditsUsed}`}
                    icon={Zap}
                    color="#f59e0b"
                    trendValue={`${spending.totalMessagesSent} SMS`}
                    trendType="neutral"
                    size="compact"
                />
            </div>

            {/* ULTRA COMPACT GRID */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.4fr 1fr', 
                gap: '1rem',
                flex: 1,
                minHeight: 0 // Crucial for nested scroll
            }}>
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
                    <div className="card-glass" style={{ borderRadius: '24px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '0.75rem 1.25rem 0.4rem', flexShrink: 0 }}>
                            <SectionHeader icon={Activity}>Live Δραστηριότητα</SectionHeader>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem 0.5rem', minHeight: 0 }}>
                            <RecoveryFeed logs={recoveryLog} muted={true} token={token} />
                        </div>
                    </div>

                    <div style={{ height: '200px', flexShrink: 0 }}>
                        <RevenueCard stats={recoveryStats} recoveryLog={recoveryLog} />
                    </div>
                </div>

                {/* Right Column */}
                <RightColumn>
                    <div style={{ flexShrink: 0 }}>
                        <TodayStatus
                            missedCalls={missedCallsToday}
                            recovered={recoveryStats.recovered}
                            appointmentsToday={todayAppointments.length}
                            activeChats={activeConversations}
                        />
                    </div>

                    <div className="card-glass" style={{ borderRadius: '24px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <SectionHeader icon={Zap}>Γρήγορες Ενέργειες</SectionHeader>
                        <QuickActions
                            onViewSchedule={() => setCurrentTab('appointments')}
                            onAddPatient={() => setCurrentTab('patients')}
                            onNewAppointment={() => setShowModal(true)}
                            patients={patients}
                            token={token}
                            clinic={clinic}
                            onRefresh={onRefresh}
                        />
                    </div>
                </RightColumn>
            </div>
        </div>
    );
};

export default Dashboard;
