import React from 'react';
import { LayoutDashboard, Calendar, Users, TrendingUp, Settings, Brain, Plus, LogOut, Sun, Moon, X, BarChart2, CalendarCheck, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = ({ currentTab, setCurrentTab, clinic, onLogout, onNewAppointment, darkMode, setDarkMode, isMobile = false, isOpen = false, onClose, isCollapsed = false, setIsCollapsed }) => {
    const navSections = [
        {
            label: 'Κύρια Μενού',
            items: [
                { id: 'dashboard', label: 'Πίνακας Ελέγχου', icon: LayoutDashboard },
                { id: 'calendar', label: 'Ημερολόγιο', icon: Calendar },
                { id: 'appointments', label: 'Ραντεβού', icon: CalendarCheck },
                { id: 'patients', label: 'Ασθενείς', icon: Users },
            ]
        },
        {
            label: 'Εργαλεία',
            items: [
                ...(clinic?.role !== 'ASSISTANT' ? [{ id: 'ai', label: 'Τεχνητή Νοημοσύνη', icon: Brain }] : []),
                { id: 'analytics', label: 'Αναλυτικά Ανάκτησης', icon: BarChart2 },
                { id: 'reports', label: 'Αναφορές', icon: TrendingUp },
            ]
        },
        {
            label: 'Διαχείριση',
            items: [
                { id: 'settings', label: 'Ρυθμίσεις Ιατρείου', icon: Settings },
            ]
        },
        ...(clinic?.isPlatformAdmin ? [{
            label: 'Διαχειριστής',
            items: [
                { id: 'admin', label: 'Πίνακας Ελέγχου', icon: ShieldAlert },
            ]
        }] : []),
    ];

    return (
        <aside className={`sidebar ${isMobile ? 'sidebar-mobile' : ''} ${isOpen ? 'sidebar-open' : ''}`} style={{
            width: isCollapsed && !isMobile ? '80px' : '260px',
            padding: isCollapsed && !isMobile ? '1.75rem 0' : undefined,
            background: 'var(--sidebar-bg)',
            backdropFilter: 'var(--glass-strong)',
            WebkitBackdropFilter: 'var(--glass-strong)',
            borderRight: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {isMobile && (
                <div className="sidebar-mobile__header">
                    <span className="sidebar-mobile__title">ClinicFlow</span>
                    <button className="sidebar-mobile__close" onClick={onClose} aria-label="Close navigation menu">
                        <X size={18} />
                    </button>
                </div>
            )}
            <div className="logo" style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed && !isMobile ? 'center' : 'space-between', gap: '16px', padding: isCollapsed && !isMobile ? '14px 4px 10px' : '14px 12px 10px' }}>
                {isCollapsed && !isMobile ? (
                    <span className="brand-wordmark" style={{ fontSize: '1.25rem', width: 'auto' }}>CF</span>
                ) : (
                    <span className="brand-wordmark" aria-label="ClinicFlow">ClinicFlow</span>
                )}
                {!isMobile && (
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px',
                            borderRadius: '6px'
                        }}
                        title={isCollapsed ? 'Ανάπτυξη μενού' : 'Σύμπτυξη μενού'}
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                )}
            </div>

            <div style={{ padding: isCollapsed && !isMobile ? '0 10px 14px' : '0 24px 14px 24px' }}>
                <button className="btn-premium" style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '11px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer'
                }} onClick={() => {
                    onNewAppointment();
                    if (isMobile && onClose) onClose();
                }}>
                    <Plus size={18} /> {(!isCollapsed || isMobile) && 'Νέο Ραντεβού'}
                </button>
            </div>

            <nav style={{ flex: 1, padding: isCollapsed && !isMobile ? '0 4px' : '0 10px', overflowY: 'auto' }}>
                {navSections.map((section, si) => (
                    <div key={section.label} style={{ marginBottom: si < navSections.length - 1 ? '16px' : 0 }}>
                        {(!isCollapsed || isMobile) && (
                            <div style={{
                                fontSize: '0.62rem',
                                fontWeight: '900',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--text-muted)',
                                padding: '6px 14px 6px 14px',
                                opacity: 0.8
                            }}>
                                {section.label}
                            </div>
                        )}
                        {section.items.map((item) => (
                            <a
                                key={item.id}
                                href="#"
                                className={`nav-link ${currentTab === item.id ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    setCurrentTab(item.id);
                                    if (isMobile && onClose) onClose();
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: isCollapsed && !isMobile ? 'center' : undefined,
                                    gap: '10px',
                                    padding: isCollapsed && !isMobile ? '8px 4px' : '8px 12px',
                                    textDecoration: 'none',
                                    color: currentTab === item.id ? 'var(--primary)' : 'var(--text-light)',
                                    background: currentTab === item.id
                                        ? 'var(--primary-light)'
                                        : 'transparent',
                                    borderRadius: '12px',
                                    fontWeight: currentTab === item.id ? '800' : '600',
                                    marginBottom: '4px',
                                    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                                    fontSize: '0.88rem',
                                    border: `1px solid ${currentTab === item.id ? 'rgba(99,91,255,0.12)' : 'transparent'}`,
                                    position: 'relative'
                                }}
                            >
                                <span className="nav-link__icon" style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '10px',
                                    background: currentTab === item.id ? 'white' : 'transparent',
                                    color: currentTab === item.id ? 'var(--primary)' : 'currentColor',
                                    transition: 'all 0.2s ease',
                                    boxShadow: currentTab === item.id ? '0 4px 10px rgba(99,91,255,0.15)' : 'none'
                                }}>
                                    <item.icon size={18} strokeWidth={currentTab === item.id ? 2.5 : 2} />
                                </span>
                                {(!isCollapsed || isMobile) && <span style={{ flex: 1 }}>{item.label}</span>}
                                {currentTab === item.id && (!isCollapsed || isMobile) && (
                                    <div style={{
                                        position: 'absolute',
                                        right: '12px',
                                        width: '4px',
                                        height: '4px',
                                        borderRadius: '50%',
                                        background: 'var(--primary)',
                                        boxShadow: '0 0 8px var(--primary)'
                                    }} />
                                )}
                            </a>
                        ))}
                    </div>
                ))}
            </nav>

            <div style={{ marginTop: 'auto', padding: isCollapsed && !isMobile ? '12px' : '24px', borderTop: '1px solid var(--border)' }}>
                {/* Dark mode toggle */}
                <button
                    onClick={() => setDarkMode(d => !d)}
                    title={darkMode ? 'Φωτεινή λειτουργία' : 'Σκοτεινή λειτουργία'}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed && !isMobile ? 'center' : 'space-between',
                        padding: '10px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.18)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)',
                        cursor: 'pointer',
                        marginBottom: '12px',
                        transition: 'all 0.2s ease',
                        boxShadow: 'var(--shadow-sm)',
                        backdropFilter: 'blur(10px) saturate(160%)'
                    }}
                >
                    {(!isCollapsed || isMobile) && (
                        <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-light)' }}>
                            {darkMode ? 'Σκοτεινή Λειτουργία' : 'Φωτεινή Λειτουργία'}
                        </span>
                    )}
                    {isCollapsed && !isMobile ? (
                        darkMode ? <Moon size={16} color="var(--primary)" /> : <Sun size={16} color="#f59e0b" />
                    ) : (
                        <div style={{
                            width: '36px',
                            height: '20px',
                            borderRadius: '10px',
                            background: darkMode ? 'var(--primary)' : 'rgba(148,163,184,0.3)',
                            position: 'relative',
                            transition: 'background 0.2s ease',
                            flexShrink: 0,
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: '2px',
                                left: darkMode ? '18px' : '2px',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: 'white',
                                transition: 'left 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            }}>
                                {darkMode
                                    ? <Moon size={9} color="#6366f1" />
                                    : <Sun size={9} color="#f59e0b" />
                                }
                            </div>
                        </div>
                    )}
                </button>

                <div className="user-profile" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed && !isMobile ? 'center' : 'flex-start',
                    gap: isCollapsed && !isMobile ? '0' : '12px',
                    padding: isCollapsed && !isMobile ? '8px' : '12px',
                    background: 'var(--card-bg)',
                    backdropFilter: 'blur(10px) saturate(180%)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid rgba(255,255,255,0.26)'
                }}>
                    <div className="avatar" style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '1.1rem',
                        flexShrink: 0
                    }} title={clinic?.name}>
                        {clinic?.name?.[0] || 'D'}
                    </div>
                    {(!isCollapsed || isMobile) && (
                        <div className="info" style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="name" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clinic?.name || 'Ιατρείο'}</div>
                            <div className="role" style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {clinic?.role === 'OWNER' ? 'Ιδιοκτήτης' : clinic?.role === 'RECEPTIONIST' ? 'Γραμματέας' : clinic?.role === 'ASSISTANT' ? 'Βοηθός' : 'Διαχειριστής'}
                            </div>
                        </div>
                    )}
                    {(!isCollapsed || isMobile) && (
                        <button 
                            onClick={onLogout}
                            style={{
                                background: 'var(--bg-subtle)',
                                border: '1px solid rgba(255,255,255,0.16)',
                                borderRadius: '10px',
                                padding: '8px',
                                cursor: 'pointer',
                                color: 'var(--urgent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease',
                                boxShadow: 'var(--shadow-sm)',
                                backdropFilter: 'blur(10px) saturate(160%)'
                            }}
                            title="Αποσύνδεση"
                            aria-label="Αποσύνδεση"
                        >
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
