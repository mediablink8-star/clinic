import { useState } from 'react';
import { CheckCircle2, Circle, X, ExternalLink } from 'lucide-react';

const STORAGE_KEY = 'onboarding_dismissed_v2';

const OnboardingChecklist = ({ clinic, recoveryLog }) => {
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

    const hasPhone = !!(clinic?.phone && clinic.phone.trim() !== '' && clinic.phone !== '+10000000000');
    const hasRecovery = Array.isArray(recoveryLog) && recoveryLog.length > 0;

    const steps = [
        {
            key: 'vonage',
            num: 1,
            label: 'Αποκτήστε αριθμό Vonage',
            done: hasPhone,
            hint: 'Πηγαίνετε στο vonage.com και αγοράστε έναν αριθμό τηλεφώνου.',
            link: 'https://dashboard.nexmo.com/buy-numbers',
            linkLabel: 'Αγορά αριθμού →',
        },
        {
            key: 'phone',
            num: 2,
            label: 'Καταχωρήστε τον αριθμό στις Ρυθμίσεις',
            done: hasPhone,
            hint: 'Ρυθμίσεις → Γενικά → πεδίο Τηλέφωνο Ιατρείου',
        },
        {
            key: 'forward',
            num: 3,
            label: 'Ρυθμίστε προώθηση αναπάντητων κλήσεων',
            done: hasRecovery,
            hint: 'Στο κινητό σας: Ρυθμίσεις → Προώθηση κλήσεων → Αναπάντητες → αριθμός Vonage',
        },
    ];

    const completed = steps.filter(s => s.done).length;
    const allDone = completed === steps.length;

    if (dismissed) return null;

    return (
        <div style={{
            background: 'var(--card-bg)',
            borderRadius: '20px',
            border: '1px solid rgba(99,102,241,0.2)',
            boxShadow: '0 4px 24px rgba(99,102,241,0.08)',
            overflow: 'hidden',
            marginBottom: '0.4rem',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.9rem 1.25rem',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(16,185,129,0.04) 100%)',
                borderBottom: '1px solid rgba(99,102,241,0.1)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: allDone ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {allDone
                            ? <CheckCircle2 size={15} color="#10b981" />
                            : <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#6366f1' }}>{completed}/3</span>
                        }
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)' }}>
                        {allDone ? 'Ρύθμιση ολοκληρώθηκε 🎉' : 'Ξεκινήστε με το ClinicFlow — 3 βήματα'}
                    </span>
                </div>
                <button
                    onClick={() => { localStorage.setItem(STORAGE_KEY, 'true'); setDismissed(true); }}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex' }}
                    title="Απόκρυψη"
                >
                    <X size={14} />
                </button>
            </div>

            <div style={{ display: 'flex', padding: '1rem 1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                {steps.map((step) => (
                    <div key={step.key} style={{
                        flex: '1 1 200px',
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '12px 14px', borderRadius: '14px',
                        background: step.done ? 'rgba(16,185,129,0.07)' : 'rgba(248,250,252,0.9)',
                        border: `1px solid ${step.done ? 'rgba(16,185,129,0.2)' : 'rgba(226,232,240,0.9)'}`,
                    }}>
                        <div style={{
                            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                            background: step.done ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.65rem', fontWeight: '900',
                            color: step.done ? '#10b981' : '#6366f1',
                        }}>
                            {step.done ? <CheckCircle2 size={13} color="#10b981" /> : step.num}
                        </div>
                        <div>
                            <div style={{
                                fontSize: '0.82rem', fontWeight: '700',
                                color: step.done ? '#065f46' : 'var(--text)',
                                textDecoration: step.done ? 'line-through' : 'none',
                                opacity: step.done ? 0.7 : 1,
                            }}>
                                {step.label}
                            </div>
                            {!step.done && (
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', lineHeight: 1.5 }}>
                                    {step.hint}
                                </div>
                            )}
                            {!step.done && step.link && (
                                <a href={step.link} target="_blank" rel="noreferrer" style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    marginTop: '6px', fontSize: '0.72rem', fontWeight: '700',
                                    color: '#6366f1', textDecoration: 'none',
                                }}>
                                    {step.linkLabel} <ExternalLink size={10} />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OnboardingChecklist;