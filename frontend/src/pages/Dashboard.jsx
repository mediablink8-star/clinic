import React from 'react';
import toast from 'react-hot-toast';
import { DEFAULT_TIMEZONE } from '../lib/constants';
import { API_BASE } from '../lib/constants';
import { Zap, Plus, Activity, LineChart, TrendingUp, Menu, X, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import RecoveryFeed from '../components/RecoveryFeed';
import QuickActions from '../components/QuickActions';
import ActionCenter from '../components/ActionCenter';
import RevenueCard from '../components/RevenueCard';
import OnboardingChecklist from '../components/OnboardingChecklist';
import Skeleton from '../components/Skeleton';
import NotificationBell from '../components/NotificationBell';
import AiAssistant from '../components/AiAssistant';
import { useConfirm } from '../hooks/useConfirm';


const DashboardSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        <Skeleton height="44px" borderRadius="12px" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {[...Array(3)].map((_, i) => <Skeleton key={`sk-top-${i}`} height="76px" borderRadius="16px" />)}
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
    recoveryLog = [], activityFeed = [], recoveryInsights = {}, systemStatus = {}, systemStats = {},
    apiUsage = {}, spending = {}, loading, warnings = [], notifications = [],
    upcomingAppointments = [], onUpdate, onRefresh, onNotificationAction, isMobile = false
}) => {
    const [hasLoaded, setHasLoaded] = React.useState(false);
    const logsArray = React.useMemo(() => Array.isArray(recoveryLog) ? recoveryLog : [], [recoveryLog]);
    React.useEffect(() => { if (!loading) setHasLoaded(true); }, [loading]);
    const { confirm, dialog } = useConfirm();
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
    const greeting = hour < 12 ? 'Καλημέρα' : hour < 18 ? 'Καλησπέρα' : 'Καλό βράδυ';
    const clinicName = clinic?.name || 'Συνάδελφε';
    const isDoctor = /^(Δρ\.?|Dr\.?|Γιατρός|Ιατρός)/i.test(clinicName);
    const displayName = isDoctor ? clinicName : clinicName;

    const missedCallsToday = systemStats.missedCallsToday ?? logsArray.filter(l => {
        if (!l || !l.createdAt) return false;
        return new Date(l.createdAt).toDateString() === new Date().toDateString();
    }).length;

    const handleToggleActive = async () => {
        const nextState = !clinic?.isActive;
        
        // Confirmation dialog ONLY when deactivating (going from true to false)
        if (clinic?.isActive && !nextState) {
            const confirmed = await confirm(
                '⚠️ ΠΡΟΣΟΧΗ: Θα σταματήσουν όλες οι αυτοματοποιήσεις!\n\n' +
                '• Δεν θα στέλνονται SMS ανάκτησης\n' +
                '• Δεν θα γίνονται φωνητικές κλήσεις\n' +
                '• Τα δεδομένα σας θα παραμείνουν ασφαλή\n\n' +
                'Είστε σίγουροι ότι θέλετε να θέσετε την κλινική ΣΕ ΠΑΥΣΗ;',
                { title: 'Προσοχή', variant: 'warning', confirmLabel: 'Ναι, Θέτω σε Παύση' }
            );
            if (!confirmed) return;
        }
        
        if (onUpdate) onUpdate({ isActive: nextState });
        try {
            await api.post('/clinic/toggle-status', { isActive: nextState });
            toast.success(`Η κλινική τέθηκε ${nextState ? 'σε λειτουργία' : 'σε παύση'}`);
        } catch (err) { 
            if (onUpdate) onUpdate({ isActive: !nextState }); 
            toast.error('Σφάλμα κατά την ενημέρωση κατάστασης. Δοκιμάστε ξανά.');
        }
    };
    const recovered = recoveryStats.recovered || 0;
    const revenue = recoveryStats.revenue || 0;
    const potentialRevenue = recoveryStats.potentialRevenue || 0;
    const systemTotalMissed = toFiniteNumber(systemStats.totalMissedCalls);
    const recoveredThisMonth = toFiniteNumber(systemStats.recoveredThisMonth) ?? 0;
    const totalMissedForRate = systemTotalMissed ?? logsArray.length;
    const recoveryRate = toFiniteNumber(systemStats.recoveryRate) ??
        (totalMissedForRate > 0 ? Math.min(100, Math.round((recoveredThisMonth / totalMissedForRate) * 100)) : 0);

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
    const weeklyRevenue = recoveryStats.trend?.thisWeek?.recovered !== undefined
        ? recoveryStats.trend.thisWeek.recovered * avgAppointmentValue
        : logsArray.filter(l => l?.status === 'RECOVERED' && l?.recoveredAt && new Date(l.recoveredAt) >= weekStart).length * avgAppointmentValue;

    // Hero stats — all scoped to this month via systemStats.
    // If systemStats hasn't loaded yet (null), fall back to all-time recovered count.
    const totalMissed = totalMissedForRate || 0;
    const totalRecovered = systemTotalMissed !== null ? recoveredThisMonth : recovered;

    const isDndActive = (() => {
        try {
            const ai = typeof clinic?.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic?.aiConfig || {});
            if (!ai.dndEnabled) return false;
            
            const hoursStr = ai.dndHours || "20:00-08:00";
            const parts = hoursStr.split('-');
            if (parts.length !== 2) return true;
            
            const [start, end] = parts;
            const [startH, startM] = start.split(':').map(Number);
            const [endH, endM] = end.split(':').map(Number);
            
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: clinic?.timezone || DEFAULT_TIMEZONE,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const [currH, currM] = formatter.format(now).split(':').map(Number);
            
            const currentMinutes = currH * 60 + currM;
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;
            
            if (startMinutes > endMinutes) {
                return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
            } else {
                return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
            }
        } catch {
            return false;
        }
    })();

    const [isHeaderExpanded, setIsHeaderExpanded] = React.useState(true);
    const headerRef = React.useRef(null);

    // Sticky header observer
    React.useEffect(() => {
        const header = headerRef.current;
        if (!header) return;
        
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsHeaderExpanded(entry.isIntersecting);
            },
            { root: null, rootMargin: '0px', threshold: 0 }
        );
        
        const sentinel = document.createElement('div');
        sentinel.style.height = '1px';
        sentinel.style.width = '100%';
        header.parentNode.insertBefore(sentinel, header);
        observer.observe(sentinel);
        
        return () => observer.disconnect();
    }, []);

    // FAB for New Appointment (mobile)
    const FabNewAppointment = () => (
        <button 
            onClick={() => setShowModal(true)}
            style={{
                position: 'fixed',
                bottom: isMobile ? '16px' : '24px',
                right: isMobile ? '16px' : '24px',
                width: isMobile ? '56px' : '60px',
                height: isMobile ? '56px' : '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                border: 'none',
                boxShadow: 'var(--shadow-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
                transition: 'all 0.3s ease',
                animation: 'fab-pulse 2s infinite'
            }}
            onMouseEnter={e => {
                if (!isMobile) {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 16px 40px -8px var(--primary-glow)';
                }
            }}
            onMouseLeave={e => {
                if (!isMobile) {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-primary)';
                }
            }}
            aria-label="Νέο Ραντεβού"
        >
            <Plus size={isMobile ? 22 : 24} color="white" strokeWidth={3} />
        </button>
    );

    return (
        <div className="animate-fade dashboard-shell" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', height: '100%', overflow: 'hidden' }}>

            {/* ── STICKY HEADER ── */}
            <div ref={headerRef} style={{ 
                position: 'sticky', 
                top: 0, 
                zIndex: 50, 
                background: 'var(--bg)', 
                backdropFilter: 'blur(20px) saturate(180%)',
                borderBottom: '1px solid var(--border)',
                padding: '0.5rem 0.5rem 0.25rem',
                margin: '0 -0.5rem -0.45rem -0.5rem',
                transition: 'box-shadow 0.2s ease, background 0.2s ease',
                boxShadow: isHeaderExpanded ? 'none' : '0 4px 16px -4px rgba(15,23,42,0.12)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h1 className="hidden-mobile" style={{ fontSize: '1.4rem', fontWeight: '950', color: 'var(--secondary)', letterSpacing: '-0.05em', margin: 0 }}>
                            {greeting}, {isDoctor ? displayName : clinicName}
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                            <button onClick={handleToggleActive} style={{ background: clinic?.isActive ? 'linear-gradient(135deg,rgba(255,255,255,0.46) 0%,rgba(16,185,129,0.14) 100%)' : 'linear-gradient(135deg,rgba(254,242,242,0.9) 0%,rgba(239,68,68,0.12) 100%)', color: clinic?.isActive ? '#10b981' : '#dc2626', border: `1px solid ${clinic?.isActive ? 'rgba(255,255,255,0.32)' : 'rgba(239,68,68,0.35)'}`, padding: '6px 12px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', outline: '2px solid transparent', backdropFilter: 'blur(10px) saturate(180%)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)' }}>
                                <div className={clinic?.isActive ? 'status-pulse' : ''} style={{ margin: 0, width: '6px', height: '6px', borderRadius: '50%', background: clinic?.isActive ? '#10b981' : '#dc2626' }} />
                                {clinic?.isActive ? 'ΕΝΕΡΓΟ' : '⚠️ ΣΕ ΠΑΥΣΗ'}
                            </button>
                            {clinic?.isActive && isDndActive && (
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(124,58,237,0.15) 100%)',
                                    color: '#6366f1',
                                    border: '1px solid rgba(99,102,241,0.3)',
                                    padding: '4px 10px',
                                    borderRadius: '99px',
                                    fontSize: '0.65rem',
                                    fontWeight: '800',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    backdropFilter: 'blur(10px) saturate(180%)',
                                    boxShadow: 'var(--shadow-sm)',
                                    whiteSpace: 'nowrap'
                                }} title="Λειτουργία 'Μην Ενοχλείτε' (DND) Ενεργή">
                                    <span style={{ fontSize: '0.75rem' }}>🌙</span>
                                    DND ΕΝΕΡΓΟ
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px', background: 'linear-gradient(180deg,rgba(255,255,255,0.34) 0%,rgba(255,255,255,0.14) 100%)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.28)', backdropFilter: 'blur(10px) saturate(180%)', boxShadow: 'var(--shadow-sm)' }}>
                                <button onClick={() => setCurrentTab('reports')} className="btn btn-outline" style={{ border: 'none', background: 'transparent', padding: '4px 9px', fontSize: '0.7rem' }}><LineChart size={12} /> Αναφορές</button>
                                <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem' }}><Plus size={12} strokeWidth={3} /> Νέο Ραντεβού</button>
                                <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
                                <NotificationBell warnings={warnings} notifications={notifications} onAction={onNotificationAction} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── STICKY STATS BAR ── */}
            <div style={{ 
                position: 'sticky', 
                top: '68px', 
                zIndex: 45, 
                background: 'var(--bg)', 
                backdropFilter: 'blur(20px) saturate(180%)',
                borderBottom: '1px solid var(--border)',
                padding: '0.5rem 0.5rem 0.25rem',
                margin: '0 -0.5rem 0 -0.5rem',
                transition: 'box-shadow 0.2s ease',
                boxShadow: '0 4px 16px -4px rgba(15,23,42,0.08)'
            }}>
                <div className="dashboard-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    {/* HERO: Recovered Revenue */}
                    {(() => {
                        const days = 14, now = new Date();
                        const sparkData = [];
                        for (let i = days - 1; i >= 0; i--) {
                            const d = new Date(now); d.setDate(d.getDate() - i);
                            const ds = d.toDateString();
                            sparkData.push(logsArray.filter(l =>
                                l?.status === 'RECOVERED' && l?.recoveredAt && new Date(l.recoveredAt).toDateString() === ds
                            ).length);
                        }
                        const max = Math.max(...sparkData, 1);
                        const w = 90, h = 32, p = 2;
                        const pts = sparkData.map((v, i) => `${((i / (days - 1)) * (w - p * 2)) + p},${h - p - (v / max) * (h - p * 2)}`).join(' ');
                        return (
                            <div className="revenue-card-hero" style={{
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                borderRadius: '20px',
                                padding: '1.1rem 1.3rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                boxShadow: '0 16px 40px -12px rgba(99, 91, 255, 0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                position: 'relative',
                                overflow: 'hidden',
                            }}>
                                <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '130px', height: '130px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        Revenue Monitor
                                    </span>
                                    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ opacity: 0.7 }}>
                                        <defs>
                                            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="white" stopOpacity="0.25" />
                                                <stop offset="100%" stopColor="white" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        <polygon points={`${pts} ${w},${h} 0,${h}`} fill="url(#sg)" />
                                        <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <div style={{ lineHeight: 1 }}>
                                    <span className="num-animate" style={{ fontSize: revenue > 0 ? '2.6rem' : '2rem', fontWeight: '950', color: 'white', letterSpacing: '-0.05em' }}>
                                        {revenue > 0 ? `€${revenue.toLocaleString()}` : '€0'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'rgba(255,255,255,0.95)', background: 'rgba(255,255,255,0.18)', padding: '2px 8px', borderRadius: '6px' }}>
                                        {recovered} ραντεβού σώθηκαν
                                    </span>
                                    {weeklyRevenue > 0 && (
                                        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                                            +€{weeklyRevenue} αυτή την εβδομάδα
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                    
                    {/* Missed calls recovered */}
                    <div className="hero-stat-card" style={{
                        background: 'var(--glass-surface-strong)',
                        borderRadius: '20px',
                        padding: '1.1rem 1.3rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        boxShadow: 'var(--shadow-md)',
                        border: '1px solid var(--border)',
                        backdropFilter: 'var(--glass)',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', bottom: '-12px', right: '-8px', opacity: 0.04 }}>
                            <Activity size={72} strokeWidth={1.5} color="var(--primary)" />
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Ανακτημένες κλήσεις <span style={{ opacity: 0.55, fontWeight: 600 }}>· μήνας</span>
                        </span>
                        <span className="num-animate" style={{ fontSize: '2.4rem', fontWeight: '950', color: 'var(--secondary)', letterSpacing: '-0.05em', lineHeight: 1 }}>
                            {totalRecovered}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            {totalMissed > 0 ? (
                                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700', background: 'rgba(16,185,129,0.1)', padding: '2px 7px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)' }}>
                                    από {totalMissed} αναπάντητες
                                </span>
                            ) : (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                                    καμία αναπάντητη αυτόν τον μήνα
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Recovery rate */}
                    <div className="hero-stat-card" style={{
                        background: 'var(--glass-surface-strong)',
                        borderRadius: '20px',
                        padding: '1.1rem 1.3rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        boxShadow: 'var(--shadow-md)',
                        border: '1px solid var(--border)',
                        backdropFilter: 'var(--glass)',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', bottom: '-12px', right: '-8px', opacity: 0.04 }}>
                            <TrendingUp size={72} strokeWidth={1.5} color="var(--primary)" />
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Ποσοστό Ανάκτησης <span style={{ opacity: 0.55, fontWeight: 600 }}>· μήνας</span>
                        </span>
                        <span className="num-animate" style={{ fontSize: '2.4rem', fontWeight: '950', color: 'var(--secondary)', letterSpacing: '-0.05em', lineHeight: 1 }}>
                            {recoveryRate}%
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                                {todayAppointments?.length ?? 0} ραντεβού σήμερα
                            </span>
                        </div>
                        {/* progress bar */}
                        <div style={{ height: '3px', background: 'var(--border)', borderRadius: '99px', marginTop: '6px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${recoveryRate}%`, background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', borderRadius: '99px', transition: 'width 1s ease' }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── FAB: New Appointment ── */}
            <button 
                onClick={() => setShowModal(true)}
                style={{
                    position: 'fixed',
                    bottom: isMobile ? '16px' : '24px',
                    right: isMobile ? '16px' : '24px',
                    width: isMobile ? '56px' : '60px',
                    height: isMobile ? '56px' : '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                    border: 'none',
                    boxShadow: 'var(--shadow-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                    transition: 'all 0.3s ease',
                    animation: 'fab-pulse 2s infinite'
                }}
                onMouseEnter={e => {
                    if (!isMobile) {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.boxShadow = '0 16px 40px -8px var(--primary-glow)';
                    }
                }}
                onMouseLeave={e => {
                    if (!isMobile) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-primary)';
                    }
                }}
                aria-label="Νέο Ραντεβού"
            >
                <Plus size={isMobile ? 22 : 24} color="white" strokeWidth={3} />
            </button>

            {/* ── MAIN GRID ── */}
            <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.5rem', flex: 1, minHeight: 0 }}>

                {/* Left column: live feed (flex) + recovery performance (fixed) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
                    {/* Live feed — takes all remaining height */}
                    <div className="card-glass" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div style={{ padding: '0.4rem 0.7rem 0.15rem', flexShrink: 0 }}>
                            <SectionHeader icon={Activity}>Recovery Timeline</SectionHeader>
                        </div>
                        <div style={{ padding: '0 0.5rem 0.5rem', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <RecoveryFeed logs={activityFeed} muted={true} token={token} onNavigate={setCurrentTab} avgAppointmentValue={avgAppointmentValue} recoveryLog={logsArray} />
                        </div>
                    </div>
                    {/* Recovery Performance — fixed height */}
                    <div style={{ height: '190px', flexShrink: 0 }}>
                        <RevenueCard stats={recoveryStats} recoveryLog={recoveryLog} systemStats={systemStats} />
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
                        <SectionHeader icon={Zap}>AI Command Center</SectionHeader>
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
            {dialog}
        </div>
    );
};

export default Dashboard;