import React, { useState } from 'react';
import { Brain, PhoneCall, Zap, RefreshCw, MessageSquare, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

const services = [
    {
        key: 'ai',
        icon: Brain,
        label: 'AI Assistant',
        check: s => s?.aiConfigured,
        offlineLabel: 'Not Configured',
        actionLabel: 'Configure',
        actionTab: 'ai',
    },
    {
        key: 'webhook',
        icon: Zap,
        label: 'n8n Webhook',
        check: s => s?.webhookConfigured,
        offlineLabel: 'Not Configured',
        actionLabel: 'Configure',
        actionTab: 'settings',
    },
    {
        key: 'recovery',
        icon: PhoneCall,
        label: 'Call Recovery',
        check: s => s?.worker,
        offlineLabel: 'Worker Disconnected',
        actionLabel: 'Reload Page',
        actionTab: null,
        actionReload: true,
    },
];

const MetricPill = ({ icon: Icon, label, value, color = '#6366f1', warn = false }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 10px',
        borderRadius: '10px',
        background: warn ? 'rgba(239,68,68,0.05)' : 'rgba(99,102,241,0.04)',
        border: `1px solid ${warn ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.1)'}`,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon size={11} color={warn ? '#ef4444' : color} />
            <span style={{ fontSize: '0.68rem', fontWeight: '600', color: '#64748b' }}>{label}</span>
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: warn ? '#ef4444' : color }}>{value}</span>
    </div>
);

const SystemStatus = ({ status = {}, stats = {}, setCurrentTab }) => {
    const [lastSync] = useState(new Date());
    const allOnline = services.every(s => s.check(status));

    const fmt = (d) => {
        const diff = Math.floor((Date.now() - d) / 1000);
        if (diff < 60) return `${diff}s ago`;
        return `${Math.floor(diff / 60)}m ago`;
    };

    const handleAction = (svc) => {
        if (svc.actionReload) window.location.reload();
        else if (svc.actionTab && setCurrentTab) setCurrentTab(svc.actionTab);
    };

    const hasStats = Object.keys(stats).length > 0;

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
            overflowY: 'auto',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: allOnline ? '#10b981' : '#f59e0b',
                        boxShadow: allOnline ? '0 0 0 3px rgba(16,185,129,0.2)' : '0 0 0 3px rgba(245,158,11,0.2)',
                        animation: 'pulse-green 2s infinite',
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
                    {allOnline ? 'All Online' : 'Needs Attention'}
                </span>
            </div>

            {/* Service rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {services.map((svc) => {
                    const { key, icon: Icon, label, check, offlineLabel, actionLabel } = svc;
                    const online = check(status);
                    return (
                        <div key={key} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '9px 12px', borderRadius: '12px', gap: '8px',
                            background: online ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.04)',
                            border: `1px solid ${online ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)'}`,
                        }}>
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
                                            padding: '3px 9px', borderRadius: '7px', cursor: 'pointer',
                                            border: '1px solid rgba(99,102,241,0.3)',
                                            background: 'rgba(99,102,241,0.08)',
                                            color: '#6366f1', fontSize: '0.65rem', fontWeight: '800',
                                            whiteSpace: 'nowrap', transition: 'background 0.15s',
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

            {/* Operational metrics */}
            {hasStats && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Metrics
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '0.45rem' }}>
                        <MetricPill icon={PhoneCall} label="Missed Calls Today" value={stats.missedCallsToday ?? '�'} color="#6366f1" />
                        <MetricPill icon={MessageSquare} label="SMS Sent Today" value={stats.smsSentToday ?? '�'} color="#10b981" />
                        {stats.smsFailedToday > 0 && (
                            <MetricPill icon={AlertTriangle} label="SMS Failed" value={stats.smsFailedToday} warn />
                        )}
                        <MetricPill icon={Clock} label="Pending Notifications" value={stats.pendingNotifications ?? '�'} color="#f59e0b" />
                        <MetricPill icon={TrendingUp} label="Recovery (Today)" value={`${stats.recoveryRate ?? 0}%`} color="#3b82f6" />
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <RefreshCw size={10} color="#94a3b8" />
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>
                    Last synced: {fmt(lastSync)}
                </span>
            </div>
        </div>
    );
};

export default SystemStatus;
