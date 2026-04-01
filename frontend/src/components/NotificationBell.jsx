import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, ShieldAlert, Zap, X, MessageSquare, Clock } from 'lucide-react';

const NotificationBell = ({ warnings = [], notifications = [] }) => {
    // warnings: [{ key, message }]
    // notifications: [{ id, text, time, type }]
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    
    const totalCount = warnings.length + notifications.length;

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getIcon = (key, type) => {
        if (key) {
            switch (key) {
                case 'AI': return <AlertTriangle size={16} color="#f59e0b" />;
                case 'webhook': return <Zap size={16} color="#3b82f6" />;
                case 'security': return <ShieldAlert size={16} color="#ef4444" />;
            }
        }
        return <MessageSquare size={16} color="var(--primary)" />;
    };

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'relative',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: isOpen ? '0 0 0 3px var(--primary-light)' : 'var(--shadow-sm)',
                }}
            >
                <Bell size={20} color={totalCount > 0 ? 'var(--primary)' : 'var(--text-light)'} strokeWidth={2.2} />
                {totalCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-3px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: '900',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--bg)',
                        boxShadow: '0 2px 4px rgba(239,68,68,0.3)',
                    }}>
                        {totalCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    right: 0,
                    width: '340px',
                    background: 'var(--modal-bg)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    borderRadius: '24px',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '1.25rem',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Κέντρο Ειδοποιήσεων
                        </h3>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                            <X size={16} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                        {totalCount === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                                <Bell size={32} opacity={0.15} style={{ margin: '0 auto 12px' }} />
                                Δεν υπάρχουν νέες ειδοποιήσεις
                            </div>
                        ) : (
                            <>
                                {/* Warnings Section */}
                                {warnings.map((warning, idx) => (
                                    <div key={`w-${idx}`} style={{
                                        display: 'flex', gap: '12px', padding: '12px', borderRadius: '16px',
                                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)',
                                    }}>
                                        <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon(warning.key)}</div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '0.78rem', fontWeight: '800', color: '#ef4444', lineHeight: '1.4', margin: 0 }}>
                                                {warning.message}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                {/* Notifications Section */}
                                {notifications.map((n) => (
                                    <div key={n.id || n.time} style={{
                                        display: 'flex', gap: '12px', padding: '12px', borderRadius: '16px',
                                        background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                                        boxShadow: 'var(--shadow-sm)'
                                    }}>
                                        <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon(null, n.type)}</div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--secondary)', lineHeight: '1.4', margin: '0 0 4px 0' }}>
                                                {n.text}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-light)' }}>
                                                <Clock size={10} />
                                                <span style={{ fontSize: '0.65rem', fontWeight: '800' }}>{n.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
