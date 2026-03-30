import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from 'lucide-react';

const STORAGE_KEY = 'onboarding_dismissed';

const OnboardingChecklist = ({ clinic, systemStatus, recoveryLog }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

    const steps = [
        {
            key: 'clinic',
            label: 'Πληροφορίες ιατρείου',
            done: !!(clinic?.name && clinic.name !== 'Local Health Clinic'),
            hint: 'Ρυθμίσεις → Πληροφορίες',
        },
        {
            key: 'ai',
            label: 'Σύνδεση AI (Gemini)',
            done: !!(systemStatus?.aiConfigured),
            hint: 'Ρυθμίσεις AI → Πάροχος AI',
        },
        {
            key: 'recovery',
            label: 'Δοκιμή ανάκτησης SMS',
            done: Array.isArray(recoveryLog) && recoveryLog.length > 0,
            hint: 'Dashboard → Γρήγορες Ενέργειες → Test Recovery',
        },
    ];

    const completed = steps.filter(s => s.done).length;
    const total = steps.length;
    const allDone = completed === total;
    const pct = Math.round((completed / total) * 100);

    // Auto-dismiss when all done
    useEffect(() => {
        if (allDone) {
            const t = setTimeout(() => {
                localStorage.setItem(STORAGE_KEY, 'true');
                setDismissed(true);
            }, 2000);
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
                    {!collapsed && (
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
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            localStorage.setItem(STORAGE_KEY, 'true');
                            setDismissed(true);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
                        title="Απόκρυψη"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Steps */}
            {!collapsed && (
                <div style={{ display: 'flex', padding: '0.85rem 1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {steps.map((step) => (
                        <div key={step.key} style={{
                            display: 'flex', alignItems: 'center', gap: '7px',
                            padding: '6px 12px', borderRadius: '10px',
                            background: step.done ? 'rgba(16,185,129,0.07)' : 'rgba(248,250,252,0.8)',
                            border: `1px solid ${step.done ? 'rgba(16,185,129,0.2)' : 'rgba(226,232,240,0.8)'}`,
                            flex: '1 1 180px',
                            transition: 'all 0.2s ease',
                        }}>
                            {step.done
                                ? <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0 }} />
                                : <Circle size={14} color="#cbd5e1" style={{ flexShrink: 0 }} />
                            }
                            <div style={{ minWidth: 0 }}>
                                <div style={{
                                    fontSize: '0.78rem', fontWeight: '700',
                                    color: step.done ? '#065f46' : 'var(--text)',
                                    textDecoration: step.done ? 'line-through' : 'none',
                                    opacity: step.done ? 0.7 : 1,
                                }}>
                                    {step.label}
                                </div>
                                {!step.done && (
                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '500', marginTop: '1px' }}>
                                        {step.hint}
                                    </div>
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
