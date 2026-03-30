import { useState, useEffect, useRef } from 'react';
import { PhoneMissed, MessageSquare, MessageCircle, CalendarCheck, ChevronDown } from 'lucide-react';

const STEPS = [
    {
        key: 'missed',
        label: 'Αναπάντητες',
        icon: PhoneMissed,
        color: '#64748b',
        bg: 'rgba(100,116,139,0.1)',
        barColor: 'linear-gradient(90deg, #64748b, #94a3b8)',
    },
    {
        key: 'smsSent',
        label: 'SMS Εστάλη',
        icon: MessageSquare,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.1)',
        barColor: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
    },
    {
        key: 'responded',
        label: 'Απάντησαν',
        icon: MessageCircle,
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.1)',
        barColor: 'linear-gradient(90deg, #6366f1, #818cf8)',
    },
    {
        key: 'booked',
        label: 'Κλείσανε Ραντεβού',
        icon: CalendarCheck,
        color: '#10b981',
        bg: 'rgba(16,185,129,0.1)',
        barColor: 'linear-gradient(90deg, #10b981, #34d399)',
    },
];

const RecoveryFunnel = ({ logs = [], stats = {} }) => {
    const logArray = Array.isArray(logs) ? logs : [];

    const missed    = logArray.length || 0;
    const smsSent   = logArray.filter(l => l && ['PENDING', 'RECOVERING', 'RECOVERED', 'SENT'].includes(l.status)).length || 0;
    const responded = logArray.filter(l => l && ['RECOVERING', 'RECOVERED'].includes(l.status)).length || 0;
    const booked    = stats?.recovered || 0;

    const counts = { missed, smsSent, responded, booked };
    const top = missed || 1;
    const convRate = missed > 0 ? Math.round((booked / missed) * 100) : 0;

    // Flash + toast when booked count increases
    const prevBooked = useRef(booked);
    const [flashing, setFlashing] = useState(false);
    const [toast, setToast] = useState(null); // null | string

    useEffect(() => {
        if (booked > prevBooked.current) {
            const delta = booked - prevBooked.current;
            setFlashing(false);
            // force reflow so re-adding the class triggers the animation
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setFlashing(true));
            });
            setToast(`+${delta} ανάκτηση${delta > 1 ? 'ς' : ''} εντοπίστηκε`);
            const t = setTimeout(() => {
                setFlashing(false);
                setToast(null);
            }, 2200);
            return () => clearTimeout(t);
        }
        prevBooked.current = booked;
    }, [booked]);

    return (
        <div
            className={`grid-cell-glass card-hover${flashing ? ' recovery-flash' : ''}`}
            style={{
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.5)',
                padding: '1.25rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.07)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                overflowY: 'auto',
                position: 'relative',
            }}
        >
            {/* Toast overlay */}
            {toast && (
                <div
                    className="recovery-toast"
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '99px',
                        background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.35)',
                        color: '#059669',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        zIndex: 10,
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    <CalendarCheck size={11} />
                    {toast}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                        Patient Journey
                    </h3>
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>Funnel ανάκτησης ασθενών</p>
                </div>
                <div style={{
                    padding: '4px 10px',
                    borderRadius: '99px',
                    background: convRate >= 30 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                    color: convRate >= 30 ? '#10b981' : '#f59e0b',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                }}>
                    {convRate}% conversion
                </div>
            </div>

            {/* Funnel steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {STEPS.map((step, idx) => {
                    const count = counts[step.key];
                    const pct = Math.round((count / top) * 100);
                    const prevCount = idx > 0 ? counts[STEPS[idx - 1].key] : null;
                    const dropPct = prevCount && prevCount > 0
                        ? Math.round(((prevCount - count) / prevCount) * 100)
                        : null;

                    return (
                        <div key={step.key}>
                            {idx > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0 4px 36px' }}>
                                    <ChevronDown size={12} color="#cbd5e1" />
                                    {dropPct !== null && dropPct > 0 && (
                                        <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600 }}>
                                            -{dropPct}% drop
                                        </span>
                                    )}
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '8px',
                                    background: step.bg,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <step.icon size={14} color={step.color} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)' }}>
                                            {step.label}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: step.color }}>
                                            {count}
                                        </span>
                                    </div>
                                    <div style={{ height: '6px', background: 'rgba(148,163,184,0.15)', borderRadius: '99px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${pct}%`,
                                            background: step.barColor,
                                            borderRadius: '99px',
                                            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                                        }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div style={{
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'rgba(99,102,241,0.07)',
                border: '1px solid rgba(99,102,241,0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                <CalendarCheck size={14} color="#6366f1" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6366f1', lineHeight: 1.4, margin: 0 }}>
                    {booked > 0
                        ? `${booked} ραντεβού ανακτήθηκαν από ${missed} αναπάντητες κλήσεις`
                        : 'Δεν υπάρχουν δεδομένα ακόμα — δοκιμάστε Test Recovery SMS'}
                </p>
            </div>
        </div>
    );
};

export default RecoveryFunnel;
