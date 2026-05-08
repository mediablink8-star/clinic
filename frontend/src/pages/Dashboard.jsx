import React from 'react';
import { Zap, Plus, Activity, LineChart, TrendingUp } from 'lucide-react';
import api from '../lib/api';
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

    // Safety checks for all props
    if (!clinic) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Φόρτωση δεδομένων κλινικής...</p>
        </div>;
    }

    if (!token) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Σφάλμα ελέγχου ταυτότητας. Παρακαλώ συνδεθείτε ξανά.</p>
        </div>;
    }

    if (!setCurrentTab || !setShowModal) {
        console.error('[Dashboard] Missing required callbacks:', { setCurrentTab, setShowModal });
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
            <p>Σφάλμα διαμόρφωσης εφαρμογής. Παρακαλώ ανανεώστε τη σελίδα.</p>
        </div>;
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Καλημέρα' : hour < 18 ? 'Καλησπέρα' : 'Καλησπέρα';
    const missedCallsToday = systemStats.missedCallsToday ?? logsArray.filter(l => {
        if (!l || !l.createdAt) return false;
        return new Date(l.createdAt).toDateString() === new Date().toDateString();
    }).length;

    const handleToggleActive = async () => {
        const nextState = !clinic?.isActive;
        
        // Confirmation dialog ONLY when deactivating (going from true to false)
        if (clinic?.isActive && !nextState) {
            const confirmed = window.confirm(
                '⚠️ ΠΡΟΣΟΧΗ: Θα σταματήσουν όλες οι αυτοματοποιήσεις!\n\n' +
                '• Δεν θα στέλνονται SMS ανάκτησης\n' +
                '• Δεν θα γίνονται φωνητικές κλήσεις\n' +
                '• Τα δεδομένα σας θα παραμείνουν ασφαλή\n\n' +
                'Είστε σίγουροι ότι θέλετε να θέσετε την κλινική ΣΕ ΠΑΥΣΗ;'
            );
            if (!confirmed) return;
        }
        
        if (onUpdate) onUpdate({ isActive: nextState });
        try {
            await api.post('/clinic/toggle-status', { isActive: nextState });
        } catch (err) { 
            if (onUpdate) onUpdate({ isActive: !nextState }); 
            alert('Σφάλμα κατά την ενημέρωση κατάστασης. Δοκιμάστε ξανά.');
        }
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

    // Get average appointment value from clinic config (default to 80€)
    const avgAppointmentValue = (() => {
        try {
            const ai = typeof clinic?.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic?.aiConfig || {});
            return parseFloat(ai.avgAppointmentValue) || 80;
        } catch { return 80; }
    })();

    // Weekly revenue calculation
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weeklyRevenue = recoveryStats.trend?.thisWeek?.recovered
        ? recoveryStats.trend.thisWeek.recovered * avgAppointmentValue
        : logsArray.filter(l => l?.status === 'RECOVERED' && l?.recoveredAt && new Date(l.recoveredAt) >= weekStart).length * avgAppointmentValue;

    // Emotional stats
    const totalMissed = totalMissedForRate || 0;
    const totalRecovered = recoveredForRate || 0;
    const missedNotRecovered = totalMissed - totalRecovered;

    return (
        <div className="animate-fade dashboard-shell" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', height: '100%', overflow: 'hidden' }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, padding: '0 2px', gap: '8px' }}>
                <h1 className="hidden-mobile" style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.04em', margin: 0 }}>
                    {greeting}, {clinic?.name?.match(/^(Δρ\.|Dr\.)/i) ? clinic.name : `Δρ. ${clinic?.name || 'Συνάδελφε'}`}
                </h1>
                <div className="dashboard-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    <button onClick={handleToggleActive} style={{ background: clinic?.isActive ? 'linear-gradient(135deg,rgba(255,255,255,0.46) 0%,rgba(16,185,129,0.14) 100%)' : 'linear-gradient(135deg,rgba(254,242,242,0.9) 0%,rgba(239,68,68,0.12) 100%)', color: clinic?.isActive ? '#10b981' : '#dc2626', border: `1px solid ${clinic?.isActive ? 'rgba(255,255,255,0.32)' : 'rgba(239,68,68,0.35)'}`, padding: '6px 14px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', outline: 'none', backdropFilter: 'blur(18px) saturate(180%)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)' }}>
                        <div className={clinic?.isActive ? 'status-pulse' : ''} style={{ margin: 0, width: '6px', height: '6px', borderRadius: '50%', background: clinic?.isActive ? '#10b981' : '#dc2626' }} />
                        {clinic?.isActive ? 'ΕΝΕΡΓΟ' : '⚠️ ΣΕ ΠΑΥΣΗ'}
                    </button>
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

            {/* ── SAFE MODE BANNER ── */}
            {clinic?.safeMode && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.9) 0%, rgba(217,119,6,0.8) 100%)',
                    border: '2px solid rgba(245,158,11,0.6)',
                    borderRadius: '16px',
                    padding: '0.85rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 8px 24px rgba(245,158,11,0.3)',
                    flexShrink: 0
                }}>
                    <div style={{ fontSize: '1.5rem' }}>🛡️</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: 'white', fontWeight: '800', fontSize: '0.9rem', marginBottom: '2px' }}>
                            Safe Mode Ενεργό
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem' }}>
                            Κανένα SMS ή κλήση δεν στέλνεται. Όλες οι ενέργειες προσομοιώνονται.
                        </div>
                    </div>
                    <button
                        onClick={handleToggleSafeMode}
                        style={{
                            background: 'white',
                            color: '#d97706',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Απενεργοποίηση
                    </button>
                </div>
            )}

            {/* ── INACTIVE WARNING ── */}
            {!clinic?.isActive && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.85) 100%)',
                    border: '2px solid rgba(239, 68, 68, 0.6)',
                    borderRadius: '16px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)',
                    flexShrink: 0
                }}>
                    <div style={{ fontSize: '2rem' }}>⚠️</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: 'white', fontWeight: '800', fontSize: '0.95rem', marginBottom: '4px' }}>
                            Η Κλινική είναι ΣΕ ΠΑΥΣΗ
                        </div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.95)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                            Όλες οι αυτοματοποιήσεις είναι απενεργοποιημένες. Δεν θα στέλνονται SMS ή φωνητικές κλήσεις ανάκτησης.
                        </div>
                    </div>
                    <button 
                        onClick={handleToggleActive}
                        style={{
                            background: 'white',
                            color: '#dc2626',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}
                    >
                        Ενεργοποίηση Τώρα
                    </button>
                </div>
            )}

            {/* ── HERO SECTION: Big Revenue + 2 smaller cards ── */}
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'stretch' }}>
                {/* BIG Revenue Card - screams "YOU MADE €X" */}
                {revenue > 0 && (
                    <div style={{
                        flex: '2 1 200px',
                        background: 'linear-gradient(135deg, #635BFF 0%, #4338CA 100%)',
                        borderRadius: '20px',
                        padding: '1.25rem 1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-elevation-high)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            position: 'absolute', top: '-30px', right: '-30px',
                            width: '120px', height: '120px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                            pointerEvents: 'none'
                        }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                            Ανάκτηση από AI
                        </span>
                        <span style={{ fontSize: '2.4rem', fontWeight: '950', color: 'white', letterSpacing: '-0.04em', lineHeight: 1 }}>
                            €{revenue.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TrendingUp size={14} />
                            +€{weeklyRevenue || 0} αυτή την εβδομάδα
                        </span>
                        {weeklyRevenue > 0 && (
                            <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: '6px', fontStyle: 'italic' }}>
                                Η AI ανέκτησε €{weeklyRevenue} αυτή την εβδομάδα από χαμένες κλήσεις
                            </span>
                        )}
                    </div>
                )}

                {/* Stats display */}
                <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 180px' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                        borderRadius: '14px',
                        padding: '1rem',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        boxShadow: '0 4px 20px rgba(49, 46, 129, 0.4)',
                        border: '1px solid rgba(139, 92, 246, 0.3)'
                    }}>
                        <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.95rem', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                            Ανακτήθηκαν {recovered} ασθενείς από χαμένες κλήσεις
                        </div>
                        <div style={{ color: '#c4b5fd', fontSize: '0.9rem', fontWeight: 600 }}>
                            🤖 AI διαχειρίστηκε {logsArray.length} κλήσεις — +€{revenue > 0 ? revenue.toLocaleString() : (recovered * avgAppointmentValue).toLocaleString()}
                        </div>
                        <div style={{ color: '#a5b4fc', fontSize: '0.9rem', fontWeight: 500 }}>
                            📅 {todayAppointments?.length ?? 0} ραντεβού
                        </div>
                    </div>
                </div>
            </div>

            

            {/* ── MAIN GRID ── */}
            <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.5rem', flex: 1, minHeight: 0 }}>

                {/* Left column: live feed (flex) + recovery performance (fixed) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
                    {/* Live feed — takes all remaining height */}
                    <div className="card-glass" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div style={{ padding: '0.4rem 0.7rem 0.15rem', flexShrink: 0 }}>
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
                        clinic={clinic}
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

