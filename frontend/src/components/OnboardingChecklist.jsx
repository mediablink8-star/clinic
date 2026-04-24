import { useState } from 'react';
import { CheckCircle2, X, ExternalLink, Phone, MessageSquare, Settings, Zap } from 'lucide-react';

const STORAGE_KEY = 'onboarding_dismissed_v3';

const OnboardingChecklist = ({ clinic, systemStatus, recoveryLog }) => {
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

    let aiCfg = {};
    try { aiCfg = typeof clinic?.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic?.aiConfig || {}); } catch {}

    const hasClinicInfo = !!(clinic?.name && clinic?.phone && clinic.phone !== '+10000000000');
    const hasVoice = !!(clinic?.voiceEnabled && clinic?.vapiPhoneNumberId);
    const hasVonage = !!(clinic?.vonageApiKey);
    const hasWebhooks = !!(clinic?.webhookMissedCall || clinic?.webhookUrl);
    const hasRecovery = Array.isArray(recoveryLog) && recoveryLog.length > 0;

    const steps = [
        {
            key: 'info',
            icon: Settings,
            color: '#6366f1',
            label: 'Στοιχεία Ιατρείου',
            hint: 'Συμπληρώστε όνομα και τηλέφωνο ιατρείου',
            action: 'Ρυθμίσεις → Γενικά',
            done: hasClinicInfo,
        },
        {
            key: 'voice',
            icon: Phone,
            color: '#7c3aed',
            label: 'Voice AI',
            hint: clinic?.vapiPhoneNumberId 
                ? 'Vapi ρυθμισμένο με ελληνικό αριθμό.'
                : 'Προσθέστε Vapi API Key, Assistant ID & Phone Number.',
            action: 'Ρυθμίσεις → Voice AI',
            done: hasVoice,
        },
        {
            key: 'forward',
            icon: Phone,
            color: '#0891b2',
            label: 'Προώθηση Κλήσεων',
            hint: clinic?.vapiPhoneNumberId
                ? 'Ρυθμίστε forwarding στο Vonage.'
                : 'Ρυθμίστε forwarding στο κινητό του ιατρείου.',
            done: hasRecovery,
        },
        {
            key: 'vonage',
            icon: MessageSquare,
            color: '#059669',
            label: 'Vonage — SMS Fallback',
            hint: 'Προσθέστε Vonage API Key και Secret για αποστολή SMS όταν η κλήση δεν απαντηθεί.',
            action: 'Ρυθμίσεις → Webhooks',
            done: hasVonage,
        },
        {
            key: 'webhooks',
            icon: Zap,
            color: '#f59e0b',
            label: 'Webhook URLs (n8n)',
            hint: 'Ορίστε τα URLs των n8n workflows για SMS αποστολή.',
            action: 'Ρυθμίσεις → Webhooks',
            done: hasWebhooks,
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
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
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
                            : <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#6366f1' }}>{completed}/{steps.length}</span>
                        }
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)' }}>
                        {allDone ? 'Ρύθμιση ολοκληρώθηκε 🎉' : `Ρύθμιση ClinicFlow — ${completed}/${steps.length} βήματα`}
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

            {/* Steps */}
            <div style={{ display: 'flex', padding: '0.85rem 1.25rem', gap: '0.6rem', flexWrap: 'wrap' }}>
                {steps.map((step) => {
                    const Icon = step.icon;
                    return (
                        <div key={step.key} style={{
                            flex: '1 1 180px',
                            display: 'flex', alignItems: 'flex-start', gap: '9px',
                            padding: '10px 12px', borderRadius: '12px',
                            background: step.done ? 'rgba(16,185,129,0.07)' : 'rgba(248,250,252,0.9)',
                            border: `1px solid ${step.done ? 'rgba(16,185,129,0.2)' : 'rgba(226,232,240,0.9)'}`,
                        }}>
                            <div style={{
                                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                                background: step.done ? 'rgba(16,185,129,0.15)' : `${step.color}18`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {step.done
                                    ? <CheckCircle2 size={12} color="#10b981" />
                                    : <Icon size={11} color={step.color} />
                                }
                            </div>
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
                                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px', lineHeight: 1.45 }}>
                                        {step.hint}
                                    </div>
                                )}
                                {!step.done && step.action && (
                                    <div style={{ fontSize: '0.68rem', fontWeight: '700', color: step.color, marginTop: '4px' }}>
                                        → {step.action}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OnboardingChecklist;
