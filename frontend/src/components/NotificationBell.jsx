import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Bell, AlertTriangle, CheckCircle2, Reply, PhoneMissed, AlertCircle, X, PhoneCall, CreditCard, Clock, ChevronDown, ChevronRight } from 'lucide-react';

const ICON_MAP = {
    check:  { Icon: CheckCircle2, defaultColor: '#10b981' },
    reply:  { Icon: Reply,        defaultColor: '#3b82f6' },
    send:   { Icon: Bell,         defaultColor: '#7c3aed' },
    alert:  { Icon: AlertCircle,  defaultColor: '#ef4444' },
    bell:   { Icon: Bell,         defaultColor: 'var(--primary)' },
};

const NotificationBell = ({ warnings = [], notifications = [], onAction }) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, right: 0 });
    const [dismissed, setDismissed] = useState(() => {
        try {
            const saved = localStorage.getItem('notif_dismissed:v1');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch { return new Set(); }
    });

    const dismissAll = (ids) => {
        const next = new Set(ids);
        setDismissed(next);
        try { localStorage.setItem('notif_dismissed:v1', JSON.stringify([...next])); } catch {}
    };
    const btnRef = useRef(null);

    // Position dropdown relative to button
    const openDropdown = () => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({
                top: rect.bottom + 10,
                right: window.innerWidth - rect.right,
            });
        }
        setOpen(o => !o);
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            const dropdown = document.getElementById('notif-dropdown');
            if (btnRef.current && !btnRef.current.contains(e.target) && dropdown && !dropdown.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const visibleNotifs = notifications.filter(n => !dismissed.has(n.id));
    const urgentCount = visibleNotifs.filter(n => n.urgent).length + warnings.length;
    const totalCount = visibleNotifs.length + warnings.length;

    // Group consecutive notifications with same icon/title
    const groupedNotifs = useMemo(() => {
      const groups = [];
      let current = null;
      for (const n of visibleNotifs) {
        const key = n.icon + '|' + n.title + '|' + (n.color || '');
        if (current && current.key === key && current.items.length < 99) {
          current.items.push(n);
        } else {
          current = { key, items: [n], icon: n.icon, title: n.title, color: n.color, first: n };
          groups.push(current);
        }
      }
      return groups;
    }, [visibleNotifs]);
    const [expandedGroups, setExpandedGroups] = useState(() => new Set());
    const toggleGroup = (key) => {
      setExpandedGroups(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    };

    const dropdown = open ? createPortal(
        <div
            id="notif-dropdown"
            style={{
                position: 'fixed',
                top: pos.top,
                right: pos.right,
                width: '340px',
                maxHeight: '480px',
                background: 'var(--modal-bg)',
                backdropFilter: 'blur(10px) saturate(180%)',
                WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                borderRadius: '20px',
                border: '1px solid var(--modal-border)',
                boxShadow: '0 24px 60px -12px rgba(0,0,0,0.25)',
                zIndex: 45,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)' }}>Ειδοποιήσεις</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {totalCount > 0 && (
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', padding: '2px 8px', borderRadius: '99px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                            {totalCount}
                        </span>
                    )}
                    {visibleNotifs.length > 0 && (
                        <button onClick={() => dismissAll(notifications.map(n => n.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '0.72rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px' }}>Καθαρισμός</button>
                    )}
                    <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '2px', display: 'flex' }}>
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
                {/* Warnings */}
                {warnings.length > 0 && (
                    <div style={{ padding: '10px 14px 6px' }}>
                        <p style={{ fontSize: '0.68rem', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Προειδοποιήσεις Συστήματος</p>
                        {warnings.map((w, i) => (
                            <div key={`warn-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', borderRadius: '10px', marginBottom: '4px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text)', lineHeight: 1.4 }}>{typeof w === 'object' ? w.message : w}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Notifications */}
                {visibleNotifs.length > 0 ? (
                    <div style={{ padding: warnings.length > 0 ? '4px 14px 12px' : '10px 14px 12px' }}>
                        {warnings.length > 0 && (
                            <p style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Δραστηριότητα</p>
                        )}
                        {groupedNotifs.map((group) => {
                            const { Icon, defaultColor } = ICON_MAP[group.icon] || ICON_MAP.bell;
                            const color = group.color || defaultColor;
                            const isExpanded = expandedGroups.has(group.key);
                            const single = group.items.length === 1;
                            return (
                                <div key={group.key} style={{ marginBottom: '4px' }}>
                                    {single ? (
                                        <button
                                            onClick={() => { if (onAction && group.first.action) onAction(group.first.action, group.first.data); setOpen(false); }}
                                            onTouchStart={(e) => {
                                                const touch = e.touches[0];
                                                let startX = touch.clientX;
                                                const onMove = (ev) => {
                                                    const delta = ev.touches[0].clientX - startX;
                                                    if (delta > 80) { dismissAll([group.first.id]); document.removeEventListener('touchmove', onMove); }
                                                };
                                                document.addEventListener('touchmove', onMove);
                                                setTimeout(() => document.removeEventListener('touchmove', onMove), 500);
                                            }}
                                            style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 10px', borderRadius: '12px', background: group.first.urgent ? `${color}0D` : 'transparent', border: group.first.urgent ? `1px solid ${color}22` : '1px solid transparent', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s ease' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                                            onMouseLeave={e => e.currentTarget.style.background = group.first.urgent ? `${color}0D` : 'transparent'}
                                        >
                                            <div style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon size={14} color={color} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '2px', lineHeight: 1.3 }}>{group.first.title}</p>
                                                {group.first.subtitle && <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: '500', lineHeight: 1.3, margin: 0 }}>{group.first.subtitle}</p>}
                                            </div>
                                            {group.first.time && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '500', flexShrink: 0, marginTop: '2px' }}>{group.first.time}</span>}
                                        </button>
                                    ) : (
                                        <div style={{ borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                            <button
                                                onClick={() => toggleGroup(group.key)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', width: '100%', textAlign: 'left', border: 'none', background: 'var(--bg-subtle)', cursor: 'pointer', transition: 'all 0.15s ease' }}
                                            >
                                                <div style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Icon size={14} color={color} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--secondary)', lineHeight: 1.3 }}>{group.title}</p>
                                                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '600' }}>{group.items.length} ειδοποιήσεις</p>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '500' }}>{group.first.time}</span>
                                                    {isExpanded ? <ChevronDown size={14} color="var(--text-light)" /> : <ChevronRight size={14} color="var(--text-light)" />}
                                                </div>
                                            </button>
                                            {isExpanded && group.items.map(n => (
                                                <button
                                                    key={n.id}
                                                    onClick={() => { if (onAction && n.action) onAction(n.action, n.data); setOpen(false); }}
                                                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px 8px 50px', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-light)', transition: 'all 0.15s ease' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <span style={{ flex: 1 }}>{n.subtitle || n.title}</span>
                                                    {n.time && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>{n.time}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : warnings.length === 0 && visibleNotifs.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1.5rem', gap: '8px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bell size={18} color="var(--primary)" />
                        </div>
                        <p style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-light)', margin: 0 }}>Δεν υπάρχουν ειδοποιήσεις</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500', margin: 0, textAlign: 'center' }}>Όλα λειτουργούν κανονικά</p>
                    </div>
                ) : null}
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div style={{ position: 'relative' }}>
            <style>{`
                @keyframes urgentPulse {
                    0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6), 0 0 0 0 rgba(239,68,68,0.3); }
                    50% { box-shadow: 0 0 0 8px rgba(239,68,68,0), 0 0 0 4px rgba(239,68,68,0.15); }
                    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0), 0 0 0 0 rgba(239,68,68,0); }
                }
                @keyframes urgentGlow {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
            `}</style>
            <button
                ref={btnRef}
                onClick={openDropdown}
                aria-label={`Ειδοποιήσεις${totalCount > 0 ? ` (${totalCount})` : ''}`}
                style={{
                    width: '38px', height: '38px', borderRadius: '12px',
                    border: open ? '1px solid rgba(99,91,255,0.36)' : urgentCount > 0 ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.22)',
                    background: urgentCount > 0 && !open ? 'linear-gradient(135deg,rgba(239,68,68,0.15) 0%,rgba(220,38,38,0.08) 100%)' : open ? 'linear-gradient(135deg,rgba(99,91,255,0.18) 0%,rgba(139,92,246,0.1) 100%)' : 'var(--glass-control)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: urgentCount > 0 ? '#ef4444' : open ? 'var(--primary)' : 'var(--text-light)',
                    position: 'relative', transition: 'all 0.18s ease',
                    backdropFilter: 'blur(10px) saturate(160%)',
                    boxShadow: urgentCount > 0 ? '0 0 12px rgba(239,68,68,0.3), var(--shadow-sm)' : 'var(--shadow-sm)',
                    animation: urgentCount > 0 ? 'urgentPulse 2s ease-in-out infinite' : 'none',
                }}
            >
                <Bell size={17} style={{ animation: urgentCount > 0 ? 'urgentGlow 2s ease-in-out infinite' : 'none' }} />
                {urgentCount > 0 && (
                    <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', borderRadius: '50%', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: 'white', fontSize: '0.6rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(239,68,68,0.6)', border: '1.5px solid var(--modal-bg)', lineHeight: 1, animation: 'urgentGlow 2s ease-in-out infinite' }}>
                        {urgentCount > 9 ? '9+' : urgentCount}
                    </span>
                )}
            </button>
            {dropdown}
        </div>
    );
};

export default NotificationBell;
