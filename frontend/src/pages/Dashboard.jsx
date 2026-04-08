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
import NeedsAttention from '../components/NeedsAttention';
import Opportunities from '../components/Opportunities';
import RevenueCard from '../components/RevenueCard';
import OnboardingChecklist from '../components/OnboardingChecklist';
import Skeleton from '../components/Skeleton';
import NotificationBell from '../components/NotificationBell';

const DashboardSkeleton = () => (
    <div className="dashboard-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="dashboard-skeleton__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton width="320px" height="40px" borderRadius="12px" />
                <Skeleton width="240px" height="18px" borderRadius="8px" />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
                <Skeleton width="140px" height="48px" borderRadius="16px" />
                <Skeleton width="48px" height="48px" borderRadius="16px" />
            </div>
        </div>
        <div className="dashboard-skeleton__stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} height="120px" borderRadius="24px" />)}
        </div>
        <div className="dashboard-skeleton__grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
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
        <div ref={ref} className="dashboard-right-column" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, overflowY: 'auto', paddingRight: '2px', position: 'relative' }}>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem' }}>
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
    recoveryInsights = {},
    systemStatus = {},
    systemStats = {},
    apiUsage = {},
    spending = { totalCreditsUsed: 0, monthCreditsUsed: 0, totalMessagesSent: 0 },
    loading,
    warnings = [],
    notifications = [],
    upcomingAppointments = [],
    onUpdate,
    onRefresh,
    onNotificationAction
}) => {
    const [hasLoaded, setHasLoaded] = React.useState(false);
    const logsArray = React.useMemo(() => Array.isArray(recoveryLog) ? recoveryLog : [], [recoveryLog]);

    React.useEffect(() => {
        if (!loading) {
            setHasLoaded(true);
        }
    }, [loading]);

    if (!hasLoaded && loading) return <DashboardSkeleton />;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Καλημέρα' : hour < 18 ? 'Καλό απόγευμα' : 'Καλό βράδυ';

    const missedCallsToday = systemStats.missedCallsToday ?? logsArray.filter(l => {
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
        <div className="animate-fade dashboard-shell" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {/* MINI HEADER */}
            <div className="dashboard-header" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0 4px',
                flexShrink: 0,
                position: 'relative',
                zIndex: 50
            }}>
                <div className="dashboard-header__intro hidden-mobile" style={{ flexDirection: 'column', gap: '1px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.04em', margin: 0 }}>
                            {greeting}, {clinic?.name?.match(/^(Δρ\.|Dr\.)/i) ? clinic.name : `Δρ. ${clinic?.name || 'Συνάδελφε'}`}
                        </h1>
                        <button 
                            onClick={handleToggleActive}
                            style={{ 
                                background: clinic?.isActive
                                    ? 'linear-gradient(135deg, rgba(255,255,255,0.46) 0%, rgba(16,185,129,0.14) 100%)'
                                    : 'linear-gradient(135deg, rgba(254,242,242,0.9) 0%, rgba(239,68,68,0.12) 100%)', 
                                color: clinic?.isActive ? '#10b981' : '#dc2626', 
                                border: `1px solid ${clinic?.isActive ? 'rgba(255,255,255,0.32)' : 'rgba(239,68,68,0.35)'}`,
                                padding: clinic?.isActive ? '3px 10px' : '4px 12px', 
                                borderRadius: '99px', 
                                fontSize: clinic?.isActive ? '0.65rem' : '0.68rem', 
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                outline: 'none',
                                backdropFilter: 'blur(18px) saturate(180%)',
                                boxShadow: clinic?.isActive
                                    ? 'inset 0 1px 0 rgba(255,255,255,0.24)'
                                    : '0 0 0 3px rgba(239,68,68,0.15), inset 0 1px 0 rgba(255,255,255,0.24)'
                            }}>
                            <div className={clinic?.isActive ? "status-pulse" : ""} style={{ 
                                margin: 0, 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%',
                                background: clinic?.isActive ? '#10b981' : '#dc2626',
                                animation: clinic?.isActive ? undefined : 'none'
                            }} />
                            {clinic?.isActive ? 'ΣΥΣΤΗΜΑ ΕΝΕΡΓΟ' : '⚠️ Αυτοματισμός σε παύση — αναπάντητες κλήσεις δεν ανακτώνται'}
                        </button>
                    </div>
                </div>

                <div className="dashboard-header__actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="dashboard-action-bar" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '4px', 
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.14) 100%)', 
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.28)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        boxShadow: 'var(--shadow-sm)',
                        position: 'relative',
                        zIndex: 51
                    }}>
                        <button onClick={() => setCurrentTab('reports')} className="btn btn-outline" style={{ border: 'none', background: 'transparent', padding: '5px 10px', fontSize: '0.78rem' }}>
                            <LineChart size={15} />
                            Αναφορές
                        </button>
                        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '0.78rem' }}>
                            <Plus size={15} strokeWidth={3} />
                            Νέο Ραντεβού
                        </button>
                        <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
                        <NotificationBell warnings={warnings} notifications={notifications} onAction={onNotificationAction} />
                    </div>
                </div>
            </div>

            {/* COMPACT STATS STRIP */}
            {(() => {
                const recovered = recoveryStats.recovered || 0;
                const recoveryRate = systemStats.recoveryRate ?? (missedCallsToday > 0 ? Math.round((recovered / missedCallsToday) * 100) : 0);
                const avgApptValue = recovered > 0 ? Math.round((recoveryStats.revenue || 0) / recovered) : 118;
                const potentialRevenue = activeConversations * avgApptValue;
                return (
                    <div className="dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
                        <StatCard title="Αναπάντητες σήμερα" value={missedCallsToday} icon={PhoneMissed} color="#ef4444" size="compact" />
                        <StatCard title="Ενεργές ανακτήσεις" value={activeConversations} icon={Zap} color="#f59e0b" size="compact" />
                        <StatCard title="Κλεισμένα ραντεβού" value={recovered} icon={CheckCircle2} color="#10b981" size="compact" />
                        <StatCard title="Ποσοστό ανάκτησης" value={`${recoveryRate}%`} icon={Activity} color="#6366f1" size="compact" />
                        <StatCard
                            title="Έσοδα ανάκτησης"
                            value={`€${(recoveryStats.revenue || 0).toLocaleString()}`}
                            subtitle={potentialRevenue > 0 ? `Potential: €${potentialRevenue.toLocaleString()}` : null}
                            icon={Euro}
                            color="#0ea5e9"
                            size="compact"
                        />
                    </div>
                );
            })()}

            {/* MAIN GRID */}
            <div className="dashboard-main-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.4fr 1fr', 
                gap: '0.5rem'
            }}>
                {/* Left Column */}
                <div className="dashboard-left-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div className="card-glass" style={{ 
                        borderRadius: '20px', 
                        display: 'flex', 
                        flexDirection: 'column',
                        flex: isMobile ? 'none' : 1,
                        minHeight: isMobile ? 'auto' : '520px'
                    }}>
                        <div style={{ padding: '0.6rem 1rem 0.3rem', flexShrink: 0 }}>
                            <SectionHeader icon={Activity}>Live Δραστηριότητα</SectionHeader>
                        </div>
                        <div className="dashboard-feed-container" style={{ padding: '0 0.5rem 0.5rem' }}>
                            <RecoveryFeed logs={recoveryLog} muted={true} token={token} />
                        </div>
                    </div>

                    <div className="dashboard-revenue-card" style={{ height: '210px', flexShrink: 0 }}>
                        <RevenueCard stats={recoveryStats} recoveryLog={recoveryLog} />
                    </div>
                </div>

                {/* Right Column */}
                <div className="dashboard-right-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ flexShrink: 0 }}>
                        <NeedsAttention
                            pendingCount={Array.isArray(todayAppointments) ? todayAppointments.filter(a => a.status === 'PENDING').length : 0}
                            recoveryLog={logsArray}
                            recoveryInsights={recoveryInsights}
                            token={token}
                            onNavigate={setCurrentTab}
                        />
                    </div>

                    <div style={{ flexShrink: 0 }}>
                        <Opportunities
                            recoveryLog={logsArray}
                            onNavigate={setCurrentTab}
                        />
                    </div>

                    <div className="card-glass" style={{ borderRadius: '20px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <SectionHeader icon={Zap}>Γρήγορες Ενέργειες</SectionHeader>
                        <div className="dashboard-actions-container">
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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
