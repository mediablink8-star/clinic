import React from 'react';
import { ClipboardList, TrendingUp, ThumbsUp, Minus, ThumbsDown, Calendar, PhoneMissed, CheckCircle2, Euro } from 'lucide-react';

const Reports = ({ appointments, recoveryStats: recoveryStatsProp, recoveryLog: recoveryLogProp }) => {
    const recoveryStats = recoveryStatsProp || null;
    const recoveryLog = Array.isArray(recoveryLogProp) ? recoveryLogProp : [];

    const sentimentStats = appointments.reduce((acc, apt) => {
        apt.feedbacks?.forEach(f => {
            acc[f.sentiment || 'NEUTRAL'] = (acc[f.sentiment || 'NEUTRAL'] || 0) + 1;
        });
        return acc;
    }, { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 });

    const allFeedbacks = appointments
        .filter(a => a.feedbacks && a.feedbacks.length > 0)
        .flatMap(a => a.feedbacks.map(f => ({ ...f, patientName: a.patient?.name || 'Επισκέπτης' })));

    // Appointment status breakdown
    const aptByStatus = appointments.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
    }, {});

    // Recovery breakdown
    const recoveredCount = recoveryLog.filter(l => l.status === 'RECOVERED').length;
    const lostCount = recoveryLog.filter(l => l.status === 'LOST').length;
    const recoveringCount = recoveryLog.filter(l => l.status === 'RECOVERING').length;
    const totalMissed = recoveryLog.length;
    const recoveryRate = totalMissed > 0 ? Math.round((recoveredCount / totalMissed) * 100) : 0;

    const topCards = [
        { label: 'Σύνολο Ραντεβού', value: appointments.length, icon: Calendar, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
        { label: 'Αναπάντητες Κλήσεις', value: totalMissed, icon: PhoneMissed, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
        { label: 'Ανακτήθηκαν', value: recoveredCount, icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        { label: 'Εκτιμ. Έσοδα', value: `€${recoveryStats?.revenue || 0}`, icon: Euro, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    ];

    const sentimentCards = [
        { label: 'Θετικές Εμπειρίες', value: sentimentStats.POSITIVE, icon: ThumbsUp, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
        { label: 'Ουδέτερη Στάση', value: sentimentStats.NEUTRAL, icon: Minus, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
        { label: 'Προς Βελτίωση', value: sentimentStats.NEGATIVE, icon: ThumbsDown, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
    ];

    const cardStyle = {
        background: 'var(--card-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '1.25rem',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex', alignItems: 'center', gap: '1rem'
    };

    return (
        <section className="animate-fade">
            <header style={{
                marginBottom: 'var(--section-gap)', padding: '2rem',
                background: 'linear-gradient(135deg, var(--secondary) 0%, #1a253a 100%)',
                borderRadius: '24px', color: 'white', boxShadow: 'var(--shadow-lg)',
                position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '14px', padding: '10px', display: 'flex' }}>
                        <TrendingUp size={28} color="white" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-1px', marginBottom: '4px', color: 'white' }}>Αναφορές & Στατιστικά</h1>
                        <p style={{ fontSize: '0.95rem', fontWeight: '500', opacity: 0.7 }}>Ανάλυση απόδοσης ιατρείου και εμπειρίας ασθενών.</p>
                    </div>
                </div>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'var(--primary)', filter: 'blur(100px)', opacity: 0.3, borderRadius: '50%' }} />
            </header>

            {/* Top KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                {topCards.map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} style={cardStyle}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={22} color={color} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{label}</p>
                            <p style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recovery funnel + Appointment breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                {/* Recovery funnel */}
                <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(12px)', borderRadius: '20px', padding: '1.5rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Πρόοδος Ασθενών</h3>
                    {[
                        { label: 'Αναπάντητες', value: totalMissed, color: '#ef4444', pct: 100 },
                        { label: 'Σε Ανάκτηση', value: recoveringCount, color: '#f59e0b', pct: totalMissed > 0 ? Math.round((recoveringCount / totalMissed) * 100) : 0 },
                        { label: 'Ανακτήθηκαν', value: recoveredCount, color: '#10b981', pct: recoveryRate },
                        { label: 'Χαμένες', value: lostCount, color: '#94a3b8', pct: totalMissed > 0 ? Math.round((lostCount / totalMissed) * 100) : 0 },
                    ].map(({ label, value, color, pct }) => (
                        <div key={label} style={{ marginBottom: '0.9rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-light)' }}>{label}</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: '900', color }}>{value} <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', opacity: 0.7 }}>({pct}%)</span></span>
                            </div>
                            <div style={{ height: '7px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                            </div>
                        </div>
                    ))}
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: recoveryRate >= 50 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', borderRadius: '10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '800', color: recoveryRate >= 50 ? '#10b981' : '#f59e0b' }}>
                            Ποσοστό Ανάκτησης: {recoveryRate}%
                        </span>
                    </div>
                </div>

                {/* Appointment status breakdown */}
                <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(12px)', borderRadius: '20px', padding: '1.5rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Κατάσταση Ραντεβού</h3>
                    {[
                        { key: 'CONFIRMED', label: 'Επιβεβαιωμένα', color: '#10b981' },
                        { key: 'PENDING', label: 'Εκκρεμή', color: '#f59e0b' },
                        { key: 'CANCELLED', label: 'Ακυρωμένα', color: '#ef4444' },
                    ].map(({ key, label, color }) => {
                        const count = aptByStatus[key] || 0;
                        const pct = appointments.length > 0 ? Math.round((count / appointments.length) * 100) : 0;
                        return (
                            <div key={key} style={{ marginBottom: '0.9rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-light)' }}>{label}</span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: '900', color }}>{count} <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', opacity: 0.7 }}>({pct}%)</span></span>
                                </div>
                                <div style={{ height: '7px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sentiment cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                {sentimentCards.map(({ label, value, icon: Icon, color, bg, border }) => (
                    <div key={label} style={{ ...cardStyle, border: `1px solid ${border}` }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={22} color={color} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{label}</p>
                            <p style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Feedback list */}
            <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Πρόσφατα Feedback Ασθενών
                </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {allFeedbacks.length > 0 ? allFeedbacks.map((f, idx) => {
                    const isPos = f.sentiment === 'POSITIVE';
                    const isNeg = f.sentiment === 'NEGATIVE';
                    const color = isPos ? '#10b981' : isNeg ? '#ef4444' : '#94a3b8';
                    const bg = isPos ? 'rgba(16,185,129,0.08)' : isNeg ? 'rgba(239,68,68,0.08)' : 'rgba(148,163,184,0.08)';
                    const label = isPos ? 'ΘΕΤΙΚΟ' : isNeg ? 'ΑΡΝΗΤΙΚΟ' : 'ΟΥΔΕΤΕΡΟ';
                    return (
                        <div key={f.id || idx} className="animate-fade" style={{
                            animationDelay: `${idx * 0.05}s`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '1.25rem 1.5rem',
                            background: 'var(--card-bg)', backdropFilter: 'blur(12px)',
                            borderRadius: '16px', border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <ClipboardList size={18} color={color} />
                                </div>
                                <div>
                                    <p style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--secondary)', marginBottom: '2px' }}>{f.patientName}</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontStyle: 'italic' }}>"{f.comment}"</p>
                                </div>
                            </div>
                            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', background: bg, color, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                                {label}
                            </span>
                        </div>
                    );
                }) : (
                    <div style={{ padding: '4rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '20px', border: '2px dashed var(--border)' }}>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Δεν υπάρχουν ακόμα δεδομένα feedback.</p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default Reports;
