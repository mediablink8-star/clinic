import React, { useState } from 'react';
import { Brain, Webhook, PhoneCall, Zap, RefreshCw } from 'lucide-react';

const services = [
    {
        key: 'ai',
        icon: Brain,
        label: 'AI Assistant',
        check: s => s?.aiConfigured,
        offlineLabel: 'Μη ρυθμισμένο',
        actionLabel: 'Ρύθμιση',
        actionTab: 'ai',
    },
    {
        key: 'webhook',
        icon: Zap,
        label: 'n8n Webhook',
        check: s => s?.webhookConfigured,
        offlineLabel: 'Μη ρυθμισμένο',
        actionLabel: 'Ρύθμιση',
        actionTab: 'settings',
    },
    {
        key: 'recovery',
        icon: PhoneCall,
        label: 'Call Recovery',
        check: s => s?.worker,
        offlineLabel: 'Worker σταματημένος',
        actionLabel: 'Επανεκκίνηση',
        actionTab: null,
        actionReload: true,
    },
];

const SystemStatus = ({ status = {}, setCurrentTab }) => {
    const [lastSync] = useState(new Date());
    const allOnline = services.every(s => s.check(status));

    const fmt = (d) => {
        const diff = Math.floor((Date.now() - d) / 1000);
        if (diff < 60) return `${diff}δ πριν`;
        return `${Math.floor(diff / 60)}λ πριν`;
    };

    const handleAction = (svc) => {
        if (svc.actionReload) {
            window.location.reload();
        } else if (svc.actionTab && setCurrentTab) {
            setCurrentTab(svc.actionTab);
        }
    };

    return (
        <div className="grid-cell-glass" style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.5)',
            padding: '1.1rem 1.25rem',
            boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: allOnline ? '#10b981' : '#f59e0b',
                        boxShadow: allOnline ? '0 0 0 3px rgba(16,185,129,0.2)' : '0 0 0 3px rgba(245,158,11,0.2)',
                        animation: 'pulse-green 2s infinite'
                    }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        System Status
                    </span>
                </div>
                <span style={{
                    fontSize: '0.65rem', fontWeight: '700',
                    padding: '3px 8px', borderRadius: '6px',
                    background: allOnline ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: allOnline ? '#10b981' : '#f59e0b',
                }}>
                    {allOnline ? 'ΟΛΑ ΕΝΕΡΓΑ' : 'ΑΠΑΙΤΕΙΤΑΙ ΡΥΘΜΙΣΗ'}
                </span>
            </div>

            {/* Service rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
                {services.map((svc) => {
                    const { key, icon: Icon, label, check, offlineLabel, actionLabel } = svc;
                    const online = check(status);
                    return (
                        <div key={key} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '9px 12px',
                            borderRadius: '12px',
                            background: online ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.04)',
                            border: `1px solid ${online ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)'}`,
                            flex: 1,
                            gap: '8px',
                        }}>
                            {/* Icon + label */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <div style={{
                                    width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
                                    background: online ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Icon size={12} color={online ? '#10b981' : '#ef4444'} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap' }}>{label}</div>
                                    {!online && (
                                        <div style={{ fontSize: '0.62rem', color: '#ef4444', fontWeight: '600', marginTop: '1px' }}>
                                            {offlineLabel}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status dot + action button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                {online ? (
                                    <>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#10b981' }}>Online</span>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handleAction(svc)}
                                        style={{
                                            padding: '3px 9px',
                                            borderRadius: '7px',
                                            border: '1px solid rgba(99,102,241,0.3)',
                                            background: 'rgba(99,102,241,0.08)',
                                            color: '#6366f1',
                                            fontSize: '0.65rem',
                                            fontWeight: '800',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.16)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                                    >
                                        {actionLabel} →
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <RefreshCw size={10} color="#94a3b8" />
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>
                    Τελευταίος έλεγχος: {fmt(lastSync)}
                </span>
            </div>
        </div>
    );
};

export default SystemStatus;
