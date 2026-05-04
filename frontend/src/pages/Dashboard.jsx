import React from 'react';
import { PhoneMissed, Euro, Zap, Plus, Activity, LineChart, TrendingUp } from 'lucide-react';
import axios from 'axios';
import StatCard from '../components/StatCard';
import RecoveryFeed from '../components/RecoveryFeed';
import QuickActions from '../components/QuickActions';
import ActionCenter from '../components/ActionCenter';
import RevenueCard from '../components/RevenueCard';
import OnboardingChecklist from '../components/OnboardingChecklist';
import Skeleton from '../components/Skeleton';
import NotificationBell from '../components/NotificationBell';
import AiAssistant from '../components/AiAssistant';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const DashboardSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        <Skeleton height="44px" borderRadius="12px" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {[...Array(3)].map((_, i) => <Skeleton key={i} height="76px" borderRadius="16px" />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.5rem', flex: 1 }}>
            <Skeleton borderRadius="20px" />
            <Skeleton borderRadius="20px" />
        </div>
    </div>
);

const SectionHeader = ({ children, icon: Icon }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.3rem' }}>
        {Icon && (
            <div style={{ padding: '5px', borderRadius: '7px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Icon size={13} strokeWidth={2.5} />
            </div>
        )}
        <h3 style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
            {children}
        </h3>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)', marginLeft: '4px' }} />
    </div>
);

const toFiniteNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const Dashboard = ({
    clinic, todayAppointments = [], patients = [], token, setCurrentTab, setShowModal,
    recoveryStats = { recovered: 0, pending: 0, revenue: 0, potentialRevenue: 0 },
    recoveryLog = [], recoveryInsights = {}, systemStatus = {}, systemStats = {},
    apiUsage = {}, spending = {}, loading, warnings = [], notifications = [],
    upcomingAppointments = [], onUpdate, onRefresh, onNotificationAction, isMobile = false
}) => {
    const [hasLoaded, setHasLoaded] = React.useState(false);
    const logsArray = React.useMemo(() => Array.isArray(recoveryLog) ? recoveryLog : [], [recoveryLog]);
    React.useEffect(() => { if (!loading) setHasLoaded(true); }, [loading]);
    if (!hasLoaded && loading) return <DashboardSkeleton />;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Καλημέρα' : hour < 18 ? 'Καλό απόγευμα' : 'Καλό βράδυ';
    const missedCallsToday = systemStats.missedCallsToday ?? logsArray.filter(l => {
        if (!l || !l.createdAt) return false;
        return new Date(l.createdAt).toDateString() === new Date().toDateString();
    }).length;

    const handleToggleActive = async () => {
        const nextState = !clinic?.isActive;
        if (onUpdate) onUpdate({ isActive: nextState });
        try {
            await axios.post(`${API_BASE}/clinic/toggle-status`, { isActive: nextState }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (err) { if (onUpdate) onUpdate({ isActive: !nextState }); }
    };

    const recovered = recoveryStats.recovered || 0;
    const revenue = recoveryStats.revenue || 0;
    const potentialRevenue = recoveryStats.potentialRevenue || 0;
    const recoveredFromLogs = logsArray.filter(l => l?.status === 'RECOVERED').length;
    const systemTotalMissed = toFiniteNumber(systemStats.totalMissedCalls);
    const totalMissedForRate = systemTotalMissed ?? logsArray.length;
    const recoveredForRate = systemTotalMissed !== null
        ? (toFiniteNumber(systemStats.recoveredThisMonth) ?? 0)
        : (recovered || recoveredFromLogs);
    const systemRate = toFiniteNumber(systemStats.recoveryRate);
    const weeklyRate = toFiniteNumber(recoveryStats.trend?.thisWeek?.rate);
    const logRate = totalMissedForRate > 0 ? Math.min(100, Math.round((recoveredForRate / totalMissedForRate) * 100)) : 0;
    const recoveryRate = systemRate && systemRate > 0
        ? systemRate
        : weeklyRate && weeklyRate > 0
            ? weeklyRate
            : logRate;

    // Weekly revenue calculation
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weeklyRevenue = recoveryStats.trend?.thisWeek?.recovered
        ? recoveryStats.trend.thisWeek.recovered * 150
        : logsArray.filter(l => l?.status === 'RECOVERED' && l?.recoveredAt && new Date(l.recoveredAt) >= weekStart).length * 150;

    // Emotional stats
    const totalMissed = totalMissedForRate || 0;
    const totalRecovered = recoveredForRate || 0;
    const missedNotRecovered = totalMissed - totalRecovered;

    return (
        <div className="animate-fade dashboard-shell" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', height: '100%', overflow: 'hidden' }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, padding: '0 2px' }}>
                <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.04em', margin: 0 }}>
                        {greeting}, {clinic?.name?.match(/^(Δρ\.|Dr\.)/i) ? clinic.name : `Δρ. ${clinic?.name || 'Συνάδελφε'}`}
                    </h1>
                    <button onClick={handleToggleActive} style={{ background: clinic?.isActive ? 'linear-gradient(135deg,rgba(255,255,255,0.46) 0%,rgba(16,185,129,0.14) 100%)' : 'linear-gradient(135deg,rgba(254,242,242,0.9) 0%,rgba(239,68,68,0.12) 100%)', color: clinic?.isActive ? '#10b981' : '#dc2626', border: `1px solid ${clinic?.isActive ? 'rgba(255,255,255,0.32)' : 'rgba(239,68,68,0.35)'}`, padding: '3px 10px', borderRadius: '99px', fontSize: '0.65rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', outline: 'none', backdropFilter: 'blur(18px) saturate(180%)' }}>
                        <div className={clinic?.isActive ? 'status-pulse' : ''} style={{ margin: 0, width: '5px', height: '5px', borderRadius: '50%', background: clinic?.isActive ? '#10b981' : '#dc2626' }} />
                        {clinic?.isActive ? 'ΕΝΕΡΓΟ' : '⚠️ ΣΕ ΠΑΥΣΗ'}
                    </button>
                </div>
                <div className="dashboard-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px', background: 'linear-gradient(180deg,rgba(255,255,255,0.34) 0%,rgba(255,255,255,0.14) 100%)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.28)', backdropFilter: 'blur(20px) saturate(180%)', boxShadow: 'var(--shadow-sm)' }}>
                        <button onClick={() => setCurrentTab('reports')} className="btn btn-outline" style={{ border: 'none', background: 'transparent', padding: '4px 9px', fontSize: '0.75rem' }}><LineChart size={14} /> Αναφορές</button>
                        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '5px 11px', borderRadius: '8px', fontSize: '0.75rem' }}><Plus size={14} strokeWidth={3} /> Νέο Ραντεβού</button>
                        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
                        <NotificationBell warnings={warnings} notifications={notifications} onAction={onNotificationAction} />
                    </div>
                </div>
            </div>

            {/* ── ONBOARDING ── */}
            <div style={{ flexShrink: 0 }}>
                <OnboardingChecklist clinic={clinic} systemStatus={systemStatus} recoveryLog={recoveryLog} />
            </div>

            {/* ── PROMINENT REVENUE BANNER ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: revenue > 0 ? '2fr 1fr' : '1fr',
                gap: '0.5rem',
                flexShrink: 0
            }}>
                {/* Main Revenue Banner - TOP CENTER IMPOSSIBLE TO IGNORE */}
                {revenue > 0 && (
                    <div style={{
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
                        borderRadius: '20px',
                        padding: '1.5rem 2rem',
                        boxShadow: '0 8px 32px rgba(16, 185, 129, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '-30px',
                            right: '-30px',
                            width: '120px',
                            height: '120px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '50%',
                            filter: 'blur(40px)'
                        }} />
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <Euro size={28} color="white" strokeWidth={2.5} />
                                <span style={{ fontSize: '3rem', fontWeight: '900', color: 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                    {revenue.toLocaleString()}
                                </span>
                            </div>
                            <p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'rgba(255,255,255,0.9)', margin: 0 }}>
                                ανακτήθηκαν αυτόν τον μήνα
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                                <div style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    padding: '4px 10px',
                                    borderRadius: '99px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <TrendingUp size={12} color="white" />
                                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'white' }}>
                                        +€{weeklyRevenue.toLocaleString()} αυτή την εβδομάδα
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Emotional Sentence - RIGHT NEXT TO REVENUE */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    borderRadius: '20px',
                    padding: revenue > 0 ? '1.25rem 1.5rem' : '1.5rem 2rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: revenue > 0 ? 'flex-start' : 'center',
                    textAlign: revenue > 0 ? 'left' : 'center'
                }}>
                    {totalMissed > 0 ? (
                        <>
                            <p style={{
                                fontSize: revenue > 0 ? '1.15rem' : '1.4rem',
                                fontWeight: '900',
                                color: 'white',
                                margin: 0,
                                lineHeight: 1.4
                            }}>
                                <span style={{ color: '#ef4444' }}>{totalMissed}</span> ασθενείς χάθηκαν —{' '}
                                <span style={{ color: '#10b981' }}>{totalRecovered}</span> ανακτήθηκαν
                            </p>
                            <p style={{
                                fontSize: '0.85rem',
                                color: 'rgba(255,255,255,0.6)',
                                margin: '8px 0 0',
                                fontWeight: '600'
                            }}>
                                {missedNotRecovered > 0 ? `Χάθηκαν €${(missedNotRecovered * 150).toLocaleString()} από ${missedNotRecovered} ασθενείς` : 'Όλοι οι ασθενείς ανακτήθηκαν!'}
                            </p>
                        </>
                    ) : (
                        <p style={{
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            color: 'rgba(255,255,255,0.8)',
                            margin: 0,
                            textAlign: 'center'
                        }}>
                            Δεν υπάρχουν αναπάντητες κλήσεις ακόμα
                        </p>
                    )}
                </div>
            </div>

            {/* ── STATS STRIP ── */}
            <div className="dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', flexShrink: 0 }}>
                <StatCard title="Αναπάντητες σήμερα" value={missedCallsToday} icon={PhoneMissed} color="#ef4444" size="compact" />
                <StatCard title="Ποσοστό ανάκτησης" value={`${recoveryRate}%`} icon={Activity} color="#6366f1" size="compact" />
            </div>

            {/* ── MAIN GRID ── */}
            <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.5rem', flex: 1, minHeight: 0 }}>

                {/* Left column: live feed (flex) + recovery performance (fixed) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
                    {/* Live feed — takes all remaining height */}
                    <div className="card-glass" style={{ borderRadius: '20px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div style={{ padding: '0.55rem 0.9rem 0.25rem', flexShrink: 0 }}>
                            <SectionHeader icon={Activity}>Live Δραστηριότητα</SectionHeader>
                        </div>
                        <div style={{ padding: '0 0.5rem 0.5rem', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <RecoveryFeed logs={recoveryLog} muted={true} token={token} onNavigate={setCurrentTab} />
                        </div>
                    </div>
                    {/* Recovery Performance — fixed height */}
                    <div style={{ height: '190px', flexShrink: 0 }}>
                        <RevenueCard stats={recoveryStats} recoveryLog={recoveryLog} />
                    </div>
                </div>

                {/* Right column: action center FIRST (moved up) + quick actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0, overflowY: 'auto' }}>
                    <ActionCenter
                        pendingCount={Array.isArray(todayAppointments) ? todayAppointments.filter(a => a.status === 'PENDING').length : 0}
                        recoveryLog={logsArray}
                        recoveryInsights={recoveryInsights}
                        token={token}
                        onNavigate={setCurrentTab}
                    />
                    <div className="card-glass" style={{ borderRadius: '20px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                </div>
            </div>

            {/* AI Assistant Bubble */}
            <AiAssistant token={token} isMobile={isMobile} />
        </div>
    );
};

export default Dashboard;
