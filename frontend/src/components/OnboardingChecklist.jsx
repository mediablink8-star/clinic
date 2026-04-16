import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, ExternalLink } from 'lucide-react';

const STORAGE_KEY = 'onboarding_dismissed';

const OnboardingChecklist = ({ clinic, systemStatus, recoveryLog }) => {
    const [collapsed, setCollapsed] = useState(false); // always starts open
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

    const vonageNumber = !!(clinic?.phone && clinic.phone !== '' && clinic.phone !== '+10000000000');
    const hasRecovery = Array.isArray(recoveryLog) && recoveryLog.length > 0;

    const steps = [
        {
            key: 'vonage',
            label: 'Αποκτήστε αριθμό Vonage',
            done: vonageNumber,
            hint: 'vonage.com → Numbers → Buy a number',
            link: 'https://dashboard.nexmo.com/buy-numbers',
            action: 'Αγορά αριθμού →',
        },
        {
            key: 'phone',
            label: 'Καταχωρήστε τον αριθμό στις Ρυθμίσεις',
            done: vonageNumber,
            hint: 'Ρυθμίσεις → Γενικά → Τηλέφωνο Ιατρείου',
            action: null,
        },
        {
            key: 'forward',
            label: 'Ρυθμίστε προώθηση αναπάντητων κλήσεων',
            done: hasRecovery,
            hint: 'Στο τηλέφωνό σας: Προώθηση αναπάντητων → αριθμός Vonage',
            action: null,
        },
    ];

    const completed = steps.filter(s => s.done).length;
    const total = steps.length;
    const allDone = completed === total;
    const pct = Math.round((completed / total) * 100);

    useEffect(() => {
        if (allDone) {
            const t = setTimeout(() => {
                localStorage.setItem(STORAGE_KEY, 'true');
                setDismissed(true);
            }, 5000);
            return () => clearTimeout(t);
        }
    }, [allDone]);

    if (dismissed) return null;

    return (
        <div style={{
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderRadius: '20px',
            border: '1px solid rgba(99,102,241,0.18)',
            boxShadow: '0 4px 24px rgba(99,102,241,0.08)',
            overflow: 'hidden',
            transition: 'all 0.25s ease',
        }}>
            {/* Header row */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.9rem 1.25rem',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(16,185,129,0.04) 100%)',
                borderBottom: collapsed ? 'none' : '1px solid rgba(99,102,241,0.1)',
                cursor: 'pointer',
            }} onClick={() => setCollapsed(c => !c)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: allDone ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {allDone
                            ? <CheckCircle2 size={15} color="#10b981" />
                            : <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#6366f1' }}>{completed}/{total}</span>
                        }
                    </div>
                    <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--secondary)' }}>
                            {allDone ? 'Ρύθμιση ολοκληρώθηκε 🎉' : 'Ξεκινήστε με το ClinicFlow'}
                        </span>
                        {!allDone && (
                            <span style={{ marginLeft: '8px', fontSize: '0.72rem', fontWeight: '600', color: '#6366f1' }}>
                                {completed}/{total} βήματα
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Dismiss Button */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            localStorage.setItem(STORAGE_KEY, 'true');
                            setDismissed(true);
                        }}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex' }}
                        title="Απόκρυψη"
                    >
                        <X size={14} />
                    </button>

                    {/* Progress bar */}
                    {(true || !collapsed) && (
                        <div style={{ width: '80px', height: '5px', borderRadius: '99px', background: 'rgba(99,102,241,0.12)', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: '99px',
                                width: `${pct}%`,
                                background: allDone
                                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                                    : 'linear-gradient(90deg, #6366f1, #818cf8)',
                                transition: 'width 0.4s ease',
                            }} />
                        </div>
                    )}
                    <button
                        onClick={e => { e.stopPropagation(); setCollapsed(c => !c); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
                    >
                        {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                    </button>
                </div>
            </div>

            {/* Steps */}
            {(true || !collapsed) && (
                <div style={{ display: 'flex', padding: '0.85rem 1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {steps.map((step, i) => (
                        <div key={step.key} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '10px',
                            padding: '10px 14px', borderRadius: '12px',
                            background: step.done ? 'rgba(16,185,129,0.07)' : 'rgba(248,250,252,0.8)',
                            border: `1px solid ${step.done ? 'rgba(16,185,129,0.2)' : 'rgba(226,232,240,0.8)'}`,
                            flex: '1 1 200px',
                        }}>
                            <div style={{
                                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                                background: step.done ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: '900',
                                color: step.done ? '#10b981' : '#6366f1',
                                marginTop: '1px',
                            }}>
                                {step.done ? <CheckCircle2 size={13} color="#10b981" /> : i + 1}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{
                                    fontSize: '0.8rem', fontWeight: '700',
                                    color: step.done ? '#065f46' : 'var(--text)',
                                    textDecoration: step.done ? 'line-through' : 'none',
                                    opacity: step.done ? 0.7 : 1,
                                }}>
                                    {step.label}
                                </div>
                                {!step.done && (
                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '500', marginTop: '3px', lineHeight: 1.4 }}>
                                        {step.hint}
                                    </div>
                                )}
                                {!step.done && step.link && (
                                    <a href={step.link} target="_blank" rel="noreferrer" style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        marginTop: '6px', fontSize: '0.7rem', fontWeight: '700',
                                        color: '#6366f1', textDecoration: 'none',
                                    }}>
                                        {step.action} <ExternalLink size={10} />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OnboardingChecklist;
