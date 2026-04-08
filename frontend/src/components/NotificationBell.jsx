import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle2, Reply, PhoneMissed, AlertCircle, X } from 'lucide-react';

const ICON_MAP = {
    check:  { Icon: CheckCircle2, defaultColor: '#10b981' },
    reply:  { Icon: Reply,        defaultColor: '#3b82f6' },
    send:   { Icon: Bell,         defaultColor: '#7c3aed' },
    alert:  { Icon: AlertCircle,  defaultColor: '#ef4444' },
    bell:   { Icon: Bell,         defaultColor: 'var(--primary)' },
};

const NotificationBell = ({ warnings = [], notifications = [], onAction }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const urgentCount = notifications.filter(n => n.urgent).length + warnings.length;
    const totalCount = notifications.length + warnings.length;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Bell Button */}
            <button
                id="notification-bell-btn"
                onClick={() => setOpen(o => !o)}
                aria-label={`Ειδοποιήσεις${totalCount > 0 ? ` (${totalCount})` : ''}`}
                style={{
                    width: '38px', height: '38px',
                    borderRadius: '12px',
                    border: open
                        ? '1px solid rgba(0,181,173,0.35)'
                        : '1px solid rgba(255,255,255,0.22)',
                    background: open
                        ? 'linear-gradient(135deg, rgba(0,181,173,0.18) 0%, rgba(0,181,173,0.08) 100%)'
                        : 'var(--glass-control)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: open ? 'var(--primary)' : 'var(--text-light)',
                    position: 'relative',
                    transition: 'all 0.18s ease',
                    backdropFilter: 'blur(16px) saturate(160%)',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <Bell size={17} />
                {urgentCount > 0 && (
                    <span style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: 'white', fontSize: '0.55rem', fontWeight: '900',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(239,68,68,0.5)',
                        border: '1.5px solid var(--modal-bg)',
                        lineHeight: 1,
                    }}>
                        {urgentCount > 9 ? '9+' : urgentCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    id="notification-bell-dropdown"
                    style={{
                        position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                        width: '320px', maxHeight: '420px',
                        background: 'var(--modal-bg)',
                        backdropFilter: 'blur(28px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                        borderRadius: '20px',
                        border: '1px solid var(--modal-border)',
                        boxShadow: 'var(--shadow-xl)',
                        zIndex: 200,
                        overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px 10px',
                        borderBottom: '1px solid var(--border)',
                    }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--secondary)' }}>
                            Ειδοποιήσεις
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {totalCount > 0 && (
                                <span style={{
                                    fontSize: '0.62rem', fontWeight: '800', padding: '2px 7px',
                                    borderRadius: '99px', background: 'var(--primary-light)',
                                    color: 'var(--primary)',
                                }}>
                                    {totalCount}
                                </span>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '2px', display: 'flex' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {/* System warnings */}
                        {warnings.length > 0 && (
                            <div style={{ padding: '8px 12px 4px' }}>
                                <p style={{ fontSize: '0.58rem', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                                    Προειδοποιήσεις Συστήματος
                                </p>
                                {warnings.map((w, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                                        padding: '8px 10px', borderRadius: '10px', marginBottom: '4px',
                                        background: 'rgba(245,158,11,0.08)',
                                        border: '1px solid rgba(245,158,11,0.2)',
                                    }}>
                                        <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
                                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text)', lineHeight: 1.4 }}>
                                            {typeof w === 'object' ? w.message : w}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Notifications */}
                        {notifications.length > 0 ? (
                            <div style={{ padding: warnings.length > 0 ? '4px 12px 10px' : '8px 12px 10px' }}>
                                {warnings.length > 0 && (
                                    <p style={{ fontSize: '0.58rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                                        Δραστηριότητα
                                    </p>
                                )}
                                {notifications.map((n) => {
                                    const { Icon, defaultColor } = ICON_MAP[n.icon] || ICON_MAP.bell;
                                    const color = n.color || defaultColor;
                                    return (
                                        <button
                                            key={n.id}
                                            onClick={() => {
                                                if (onAction && n.action) onAction(n.action, n.data);
                                                setOpen(false);
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                                padding: '9px 10px', borderRadius: '12px', marginBottom: '4px',
                                                background: n.urgent ? `${color}0D` : 'transparent',
                                                border: n.urgent ? `1px solid ${color}22` : '1px solid transparent',
                                                cursor: 'pointer', width: '100%', textAlign: 'left',
                                                transition: 'all 0.15s ease',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                                            onMouseLeave={e => e.currentTarget.style.background = n.urgent ? `${color}0D` : 'transparent'}
                                        >
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                                                background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <Icon size={13} color={color} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '2px', lineHeight: 1.3 }}>
                                                    {n.title}
                                                </p>
                                                {n.subtitle && (
                                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-light)', fontWeight: '500', lineHeight: 1.3 }}>
                                                        {n.subtitle}
                                                    </p>
                                                )}
                                            </div>
                                            {n.time && (
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '500', flexShrink: 0, marginTop: '2px' }}>
                                                    {n.time}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : warnings.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1.5rem', gap: '8px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bell size={18} color="var(--primary)" />
                                </div>
                                <p style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-light)', margin: 0 }}>
                                    Δεν υπάρχουν ειδοποιήσεις
                                </p>
                                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '500', margin: 0, textAlign: 'center' }}>
                                    Όλα λειτουργούν κανονικά
                                </p>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
