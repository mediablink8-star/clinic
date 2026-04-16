import React from 'react';
import { PhoneMissed, Euro, Zap, Plus, Activity, LineChart } from 'lucide-react';
import axios from 'axios';
import StatCard from '../components/StatCard';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
import RecoveryFeed from '../components/RecoveryFeed';
import QuickActions from '../components/QuickActions';
import ActionCenter from '../components/ActionCenter';
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

const SectionHeader = ({ children, icon: Icon }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem' }}>
        {Icon && (
            <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Icon size={14} strokeWidth={2.5} />
            </div>
        )}
        <h3 style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--secondary)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {children}
        </h3>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)', marginLeft: '6px' }} />
    </div>
);

const Dashboard = ({
    clinic, todayAppointments = [], patients = [], token, setCurrentTab, setShowModal,
    recoveryStats = { recovered: 0, pending: 0, revenue: 0, potentialRevenue: 0 },
    recoveryLog = [], recoveryInsights = {}, systemStatus = {}, systemStats = {},
    apiUsage = {}, spending = {}, loading, warnings = [], notifications = [],
    upcomingAppointments = [], onUpdate, onRefresh, onNotificationAction
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
    const recoveryRate = systemStats.recoveryRate ?? (missedCallsToday > 0 ? Math.round((recovered / missedCallsToday) * 100) : 0);
    const revenueSubtitle = recovered > 0
        ? `${recovered} ανακτήθηκαν${potentialRevenue > 0 ? ` · ~€${potentialRevenue.toLocaleString()} σε εξέλιξη` : ''}`
        : potentialRevenue > 0 ? `~€${potentialRevenue.toLocaleString()} σε εξέλιξη` : 'Δεν υπάρχουν ακόμα';

    return (
        <div className="animate-fade dashboard-shell" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', flexShrink: 0, position: 'relative', zIndex: 50 }}>
                <div className="dashboard-header__intro hidden-mobile" style={{ flexDirection: 'column', gap: '1px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.04em', margin: 0 }}>
                            {greeting}, {clinic?.name?.match(/^(Δρ.|Dr.)/i) ? clinic.name : `Δρ. ${clinic?.name || 'Συνάδελφε'}`}
                        </h1>
                        <button onClick={handleToggleActive} style={{ background: clinic?.isActive ? 'linear-gradient(135deg,rgba(255,255,255,0.46) 0%,rgba(16,185,129,0.14) 100%)' : 'linear-gradient(135deg,rgba(254,242,242,0.9) 0%,rgba(239,68,68,0.12) 100%)', color: clinic?.isActive ? '#10b981' : '#dc2626', border: `1px solid ${clinic?.isActive ? 'rgba(255,255,255,0.32)' : 'rgba(239,68,68,0.35)'}`, padding: '4px 12px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', outline: 'none', backdropFilter: 'blur(18px) saturate(180%)' }}>
                            <div className={clinic?.isActive ? 'status-pulse' : ''} style={{ margin: 0, width: '6px', height: '6px', borderRadius: '50%', background: clinic?.isActive ? '#10b981' : '#dc2626' }} />
                            {clinic?.isActive ? 'ΣΥΣΤΗΜΑ ΕΝΕΡΓΟ' : '⚠️ Αυτοματισμός σε παύση — αναπάντητες κλήσεις δεν ανακτώνται'}
                        </button>
                    </div>
                </div>
                <div className="dashboard-header__actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="dashboard-action-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', background: 'linear-gradient(180deg,rgba(255,255,255,0.34) 0%,rgba(255,255,255,0.14) 100%)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.28)', backdropFilter: 'blur(20px) saturate(180%)', boxShadow: 'var(--shadow-sm)', position: 'relative', zIndex: 51 }}>
                        <button onClick={() => setCurrentTab('reports')} className="btn btn-outline" style={{ border: 'none', background: 'transparent', padding: '5px 10px', fontSize: '0.78rem' }}><LineChart size={15} /> Αναφορές</button>
                        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '0.78rem' }}><Plus size={15} strokeWidth={3} /> Νέο Ραντεβού</button>
                        <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
                        <NotificationBell warnings={warnings} notifications={notifications} onAction={onNotificationAction} />
                    </div>
                </div>
            </div>

            <div style={{ flexShrink: 0 }}><OnboardingChecklist clinic={clinic} systemStatus={systemStatus} recoveryLog={recoveryLog} /></div>

            <div className="dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: '0.4rem' }}>
                <StatCard title="Έσοδα Ανάκτησης" value={`€${revenue.toLocaleString()}`} subtitle={revenueSubtitle} icon={Euro} color="#10b981" size="compact" />
                <StatCard title="Αναπάντητες σήμερα" value={missedCallsToday} icon={PhoneMissed} color="#ef4444" size="compact" />
                <StatCard title="Ποσοστό ανάκτησης" value={`${recoveryRate}%`} icon={Activity} color="#6366f1" size="compact" />
            </div>

            <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.5rem' }}>
                <div className="dashboard-left-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div className="card-glass" style={{ borderRadius: '20px', display: 'flex', flexDirection: 'column', height: '560px', flexShrink: 0 }}>
                        <div style={{ padding: '0.6rem 1rem 0.3rem', flexShrink: 0 }}>
                            <SectionHeader icon={Activity}>Live Δραστηριότητα</SectionHeader>
                        </div>
                        <div className="dashboard-feed-container" style={{ padding: '0 0.5rem 0.5rem', flex: 1, overflowY: 'auto' }}>
                            <RecoveryFeed logs={recoveryLog} muted={true} token={token} onNavigate={setCurrentTab} />
                        </div>
                    </div>
                    <div className="dashboard-revenue-card" style={{ height: '210px', flexShrink: 0 }}>
                        <RevenueCard stats={recoveryStats} recoveryLog={recoveryLog} />
                    </div>
                </div>
                <div className="dashboard-right-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <ActionCenter pendingCount={Array.isArray(todayAppointments) ? todayAppointments.filter(a => a.status === 'PENDING').length : 0} recoveryLog={logsArray} recoveryInsights={recoveryInsights} token={token} onNavigate={setCurrentTab} />
                    <div className="card-glass" style={{ borderRadius: '20px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <SectionHeader icon={Zap}>Γρήγορες Ενέργειες</SectionHeader>
                        <div className="dashboard-actions-container">
                            <QuickActions onViewSchedule={() => setCurrentTab('appointments')} onAddPatient={() => setCurrentTab('patients')} onNewAppointment={() => setShowModal(true)} patients={patients} token={token} clinic={clinic} onRefresh={onRefresh} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
