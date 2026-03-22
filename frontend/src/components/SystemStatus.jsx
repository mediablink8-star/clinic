import React, { useState } from 'react';
import { Brain, MessageSquare, PhoneCall, Zap, RefreshCw } from 'lucide-react';

const services = [
    { key: 'ai',       icon: Brain,        label: 'AI Assistant',    check: s => s?.aiConfigured },
    { key: 'sms',      icon: MessageSquare, label: 'SMS Service',    check: s => s?.voiceConfigured },
    { key: 'recovery', icon: PhoneCall,     label: 'Call Recovery',  check: s => s?.worker },
    { key: 'webhook',  icon: Zap,           label: 'Automations',    check: s => s?.webhookConfigured },
];

const SystemStatus = ({ status = {} }) => {
    const [lastSync] = useState(new Date());
    const allOnline = services.every(s => s.check(status));

    const fmt = (d) => {
        const diff = Math.floor((Date.now() - d) / 1000);
        if (diff < 60) return `${diff}δ πριν`;
        return `${Math.floor(diff / 60)}λ πριν`;
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
                    {allOnline ? 'ΟΛΑ ΕΝΕΡΓΑ' : 'ΜΕΡΙΚΩΣ'}
                </span>
            </div>

            {/* Service rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {services.map(({ key, icon: Icon, label, check }) => {
                    const online = check(status);
                    return (
                        <div key={key} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            background: online ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                            border: `1px solid ${online ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`,
                            flex: 1,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '8px',
                                    background: online ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Icon size={13} color={online ? '#10b981' : '#ef4444'} />
                                </div>
                                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text)' }}>{label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    background: online ? '#10b981' : '#ef4444',
                                    boxShadow: online ? '0 0 6px rgba(16,185,129,0.6)' : 'none',
                                }} />
                                <span style={{ fontSize: '0.68rem', fontWeight: '800', color: online ? '#10b981' : '#ef4444' }}>
                                    {online ? 'Online' : 'Offline'}
                                </span>
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
