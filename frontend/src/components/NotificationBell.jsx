import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, AlertTriangle, ShieldAlert, Zap, X, MessageSquare, Clock } from 'lucide-react';

const NotificationBell = ({ warnings = [], notifications = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 340 });

    const totalCount = warnings.length + notifications.length;

    const updateDropdownPosition = () => {
        if (!buttonRef.current) return;

        const rect = buttonRef.current.getBoundingClientRect();
        const width = Math.min(340, window.innerWidth - 24);
        const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));

        setDropdownPosition({
            top: rect.bottom + 12,
            left,
            width,
        });
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedButton = buttonRef.current && buttonRef.current.contains(event.target);
            const clickedDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);

            if (!clickedButton && !clickedDropdown) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        updateDropdownPosition();

        const handleViewportChange = () => updateDropdownPosition();
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [isOpen]);

    const getIcon = (key) => {
        if (key) {
            switch (key) {
                case 'AI':
                    return <AlertTriangle size={16} color="#f59e0b" />;
                case 'webhook':
                    return <Zap size={16} color="#3b82f6" />;
                case 'security':
                    return <ShieldAlert size={16} color="#ef4444" />;
                default:
                    break;
            }
        }

        return <MessageSquare size={16} color="var(--primary)" />;
    };

    const dropdown = isOpen ? createPortal(
        <div
            ref={dropdownRef}
            style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
                maxWidth: 'calc(100vw - 24px)',
                background: 'var(--glass-surface-strong)',
                backdropFilter: 'blur(30px) saturate(190%)',
                WebkitBackdropFilter: 'blur(30px) saturate(190%)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.28)',
                boxShadow: 'var(--shadow-xl)',
                padding: '1.25rem',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                animation: 'fadeIn 0.2s ease-out',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Notifications
                </h3>
                <button
                    onClick={() => setIsOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}
                >
                    <X size={16} />
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                {totalCount === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                        <Bell size={32} opacity={0.15} style={{ margin: '0 auto 12px' }} />
                        No notifications yet
                    </div>
                ) : (
                    <>
                        {warnings.map((warning, idx) => (
                            <div
                                key={`w-${idx}`}
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                    padding: '12px',
                                    borderRadius: '16px',
                                    background: 'rgba(239,68,68,0.06)',
                                    border: '1px solid rgba(239,68,68,0.12)',
                                }}
                            >
                                <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon(warning.key)}</div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.78rem', fontWeight: '800', color: '#ef4444', lineHeight: '1.4', margin: 0 }}>
                                        {warning.message}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {notifications.map((notification) => (
                            <div
                                key={notification.id || notification.time}
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                    padding: '12px',
                                    borderRadius: '16px',
                                    background: 'var(--glass-control-soft)',
                                    border: '1px solid rgba(255,255,255,0.18)',
                                    boxShadow: 'var(--shadow-sm)',
                                }}
                            >
                                <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon(null)}</div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--secondary)', lineHeight: '1.4', margin: '0 0 4px 0' }}>
                                        {notification.text}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-light)' }}>
                                        <Clock size={10} />
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800' }}>{notification.time}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <div style={{ position: 'relative' }}>
                <button
                    ref={buttonRef}
                    onClick={() => setIsOpen(current => !current)}
                    style={{
                        position: 'relative',
                        background: 'var(--glass-control-soft)',
                        border: '1px solid rgba(255,255,255,0.22)',
                        borderRadius: '12px',
                        padding: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        boxShadow: isOpen ? '0 0 0 3px var(--primary-light)' : 'var(--shadow-sm)',
                        backdropFilter: 'blur(18px) saturate(170%)',
                        WebkitBackdropFilter: 'blur(18px) saturate(170%)',
                    }}
                >
                    <Bell size={20} color={totalCount > 0 ? 'var(--primary)' : 'var(--text-light)'} strokeWidth={2.2} />
                    {totalCount > 0 && (
                        <span
                            style={{
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
                            }}
                        >
                            {totalCount}
                        </span>
                    )}
                </button>
            </div>
            {dropdown}
        </>
    );
};

export default NotificationBell;
