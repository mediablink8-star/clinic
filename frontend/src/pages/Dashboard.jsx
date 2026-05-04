import React from 'react';
import { PhoneMissed, Euro, Zap, Plus, Activity, LineChart, TrendingUp, Bot } from 'lucide-react';
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

            {/* ── HERO SECTION: Desktop = row, Mobile = stacked ── */}
            <div style={{ flexShrink: 0 }}>
                {/* Desktop: Main revenue card - smaller but still dominant, next to other cards */}
                <div className="desktop-hero-row" style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column' }}>
                    {/* Main Revenue - smaller but biggest */}
                    {revenue > 0 && (
                        <div className="hero-main-card" style={{
                            background: 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)',
                            borderRadius: '18px',
                            padding: '1rem 1.5rem',
                            boxShadow: '0 6px 24px rgba(99, 91, 255, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            position: 'relative',
                            overflow: 'hidden',
                            flex: '2 1 200px'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: '-30px',
                                right: '-30px',
                                width: '120px',
                                height: '120px',
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: '50%',
                                filter: 'blur(40px)'
                            }} />
                            <Euro size={24} color="white" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontSize: '1.8rem', fontWeight: '900', color: 'white', letterSpacing: '-0.02em' }}>€{revenue.toLocaleString()}</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>ανακτήθηκαν</span>
                            </div>
                        </div>
                    )}

                    {/* Side cards for desktop - smaller and compact */}
                    <div className="hero-side-cards" style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column' }}>
                        {/* THE KILLER SENTENCE - desktop only */}
                        {totalMissed > 0 && totalRecovered > 0 && (
                            <div className="killer-sentence-desktop" style={{
                                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                borderRadius: '12px',
                                padding: '0.55rem 0.9rem',
                                textAlign: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                display: 'none'
                            }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'white' }}>
                                    <span style={{ color: '#ef4444' }}>Χάσατε {totalMissed - totalRecovered}</span>
                                    <span style={{ color: 'rgba(255,255,255,0.5)' }}> — </span>
                                    <span style={{ color: '#10b981' }}>AI €{weeklyRevenue}</span>
                                </span>
                            </div>
                        )}

                        {/* 3 small cards row */}
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {/* Lost */}
                            <div style={{
                                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                borderRadius: '14px',
                                padding: '0.55rem 0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                flex: '1 1 100px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#ef4444' }}>❌</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'white' }}>{totalMissed - totalRecovered} χάθηκαν</span>
                            </div>

                            {/* AI */}
                            <div style={{
                                background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
                                borderRadius: '14px',
                                padding: '0.55rem 0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                flex: '1 1 130px',
                                boxShadow: '0 2px 8px rgba(8, 145, 178, 0.15)'
                            }}>
                                <Bot size={12} color="white" />
                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'white' }}>🤖 {totalRecovered} → €{weeklyRevenue}</span>
                            </div>

                            {/* Recovery rate */}
                            <div style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                                borderRadius: '14px',
                                padding: '0.55rem 0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                flex: '0 0 auto',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'
                            }}>
                                <Activity size={11} color="white" />
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'white' }}>{recoveryRate}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile-only: Killer sentence (shown below main card on mobile) */}
                {totalMissed > 0 && totalRecovered > 0 && (
                    <div className="mobile-killer-sentence" style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        borderRadius: '12px',
                        padding: '0.65rem 1rem',
                        textAlign: 'center',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                        marginTop: '0.4rem'
                    }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white' }}>
                            <span style={{ color: '#ef4444' }}>Χάσατε {totalMissed - totalRecovered} ασθενείς</span>
                            <span style={{ color: 'rgba(255,255,255,0.5)' }}> — </span>
                            <span style={{ color: '#10b981' }}>η AI ανέκτησε €{weeklyRevenue}</span>
                        </span>
                    </div>
                )}

                {/* Mobile-only: No missed calls message */}
                {totalMissed === 0 && (
                    <div style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                        borderRadius: '14px',
                        padding: '0.6rem 0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '0.4rem',
                        boxShadow: '0 2px 10px rgba(16, 185, 129, 0.2)'
                    }}>
                        <span style={{ fontSize: '0.9rem' }}>🎉</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'white' }}>
                            Καμία αναπάντητη κλήση σήμερα!
                        </span>
                    </div>
                )}
            </div>

            {/* CSS for responsive layout */}
            <style>{`
                @media (min-width: 1024px) {
                    .desktop-hero-row {
                        flex-direction: row !important;
                        align-items: stretch !important;
                    }
                    .hero-main-card {
                        min-width: 200px;
                    }
                    .hero-side-cards {
                        flex: '1 1 auto' !important;
                        display: flex !important;
                        flexDirection: 'column' !important;
                    }
                    .killer-sentence-desktop {
                        display: block !important;
                    }
                    .mobile-killer-sentence {
                        display: none !important;
                    }
                }
            `}</style>

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
