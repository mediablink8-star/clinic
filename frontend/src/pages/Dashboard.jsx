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
    loading,
    warnings = [],
    notifications = [],
    upcomingAppointments = [],
    onUpdate
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
                    title="AI Activity"
                    value={`${apiUsage.dailyUsed ?? 0}`}
                    icon={Zap}
                    color="#f59e0b"
                    trendValue={apiUsage.creditsRemaining ? `${apiUsage.creditsRemaining} left` : '—'}
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
                    <div className="card-glass" style={{ borderRadius: '24px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                         <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
                            <SectionHeader icon={Activity}>Live Δραστηριότητα</SectionHeader>
                         </div>
                         <div style={{ flex: 1, padding: '0 0.5rem 0.5rem', overflowY: 'auto' }}>
                            <RecoveryFeed logs={recoveryLog} muted={true} token={token} />
                         </div>
                    </div>
                    
                    <div style={{ height: '240px', flexShrink: 0 }}>
                        <RevenueCard stats={recoveryStats} recoveryLog={recoveryLog} />
                    </div>
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
                    <div style={{ flexShrink: 0 }}>
                        <TodayStatus 
                            missedCalls={missedCallsToday} 
                            recovered={recoveryStats.recovered} 
                            appointmentsToday={todayAppointments.length} 
                            activeChats={activeConversations} 
                        />
                    </div>

                    <div className="card-glass" style={{ borderRadius: '24px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}>
                        <SectionHeader icon={Zap}>Γρήγορες Ενέργειες</SectionHeader>
                        <QuickActions
                            onViewSchedule={() => setCurrentTab('appointments')}
                            onAddPatient={() => setCurrentTab('patients')}
                            onNewAppointment={() => setShowModal(true)}
                            patients={patients}
                            token={token}
                            clinic={clinic}
                        />
                    </div>

                    <div className="card-glass" style={{ borderRadius: '24px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minHeight: 0 }}>
                        <SectionHeader icon={Calendar}>Επόμενα Ραντεβού</SectionHeader>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
                            {upcomingAppointments.length > 0 ? upcomingAppointments.slice(0, 5).map((apt, i) => (
                                <div key={i} className="card-hover" style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '10px', 
                                    padding: '8px 12px', 
                                    background: 'var(--bg-subtle)', 
                                    borderRadius: '16px', 
                                    border: '1px solid var(--border)',
                                    flexShrink: 0
                                }}>
                                    <div style={{ 
                                        width: '40px', 
                                        height: '40px', 
                                        borderRadius: '12px', 
                                        background: 'var(--primary-light)', 
                                        color: 'var(--primary)', 
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        fontSize: '0.65rem', 
                                        fontWeight: '800' 
                                    }}>
                                        <Clock size={11} style={{ marginBottom: '1px' }} />
                                        {new Date(apt.startTime).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', margin: 0 }}>{apt.patient?.name}</p>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', margin: 0, fontWeight: 600 }}>{apt.reason}</p>
                                    </div>
                                    <ArrowUpRight size={14} color="var(--text-light)" />
                                </div>
                            )) : (
                                <div style={{ textAlign: 'center', padding: '1rem' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600 }}>Κανένα ραντεβού</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="card-glass" style={{ 
                borderRadius: '24px', 
                padding: '1rem', 
                background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: '900', marginBottom: '4px' }}>Χρειάζεστε Βοήθεια;</h4>
                    <p style={{ fontSize: '0.7rem', opacity: 0.9, lineHeight: '1.4', marginBottom: '8px' }}>
                        Η AI γραμματεία σας είναι έτοιμη.
                    </p>
                    <button 
                        onClick={() => setCurrentTab('reports')} 
                        style={{ 
                            background: 'white', 
                            color: 'var(--primary)', 
                            border: 'none', 
                            padding: '6px 12px', 
                            borderRadius: '8px', 
                            fontSize: '0.75rem', 
                            fontWeight: '800', 
                            cursor: 'pointer'
                        }}
                    >
                        Στατιστικά
                    </button>
                </div>
                <Zap size={40} style={{ position: 'absolute', right: '-5px', bottom: '-5px', opacity: 0.15, transform: 'rotate(15deg)' }} />
            </div>
        </div>
    );
};

export default Dashboard;
