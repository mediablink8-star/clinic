import React from 'react';
import { LayoutDashboard, Calendar, Users, TrendingUp, Settings, Brain, Plus, LogOut, X, BarChart2 } from 'lucide-react';

const Sidebar = ({ currentTab, setCurrentTab, clinic, onLogout, onNewAppointment, isMobile = false, isOpen = false, onClose }) => {
    const navSections = [
        {
            label: 'Κύρια Μενού',
            items: [
                { id: 'dashboard', label: 'Πίνακας Ελέγχου', icon: LayoutDashboard },
                { id: 'appointments', label: 'Ραντεβού', icon: Calendar },
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
    ];

    return (
        <aside className={`sidebar ${isMobile ? 'sidebar-mobile' : ''} ${isOpen ? 'sidebar-open' : ''}`} style={{
            width: '260px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.46) 100%)',
            backdropFilter: 'blur(34px) saturate(190%)',
            WebkitBackdropFilter: 'blur(34px) saturate(190%)',
            borderRight: '1px solid rgba(255,255,255,0.42)',
            boxShadow: 'var(--shadow-sm)'
        }}>
            {isMobile && (
                <div className="sidebar-mobile__header">
                    <span className="sidebar-mobile__title">ClinicFlow</span>
                    <button className="sidebar-mobile__close" onClick={onClose} aria-label="Close navigation menu">
                        <X size={18} />
                    </button>
                </div>
            )}
            <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}>
                    {/* ClinicFlow wordmark */}
                    <div style={{
                        width: '34px', height: '34px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, var(--primary) 0%, #10b981 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 20px -8px rgba(0,181,173,0.55)',
                        flexShrink: 0,
                    }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M9 2C5.13 2 2 5.13 2 9s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm0 2.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" fill="white" fillOpacity="0.3"/>
                            <path d="M9 5.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm-1 2h2v1.5l1 1-1.06 1.06L8.5 9.56V7.5z" fill="white"/>
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: '900', color: 'var(--secondary)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>ClinicFlow</div>
                        <div style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>Διαχείριση Ιατρείου</div>
                    </div>
                </div>
            </div>

            <div style={{ padding: '0 24px 40px 24px' }}>
                <button className="btn btn-primary" style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '14px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, rgba(0,181,173,0.78) 0%, rgba(38,198,189,0.56) 100%)',
                    border: '1px solid rgba(255,255,255,0.26)',
                    boxShadow: '0 18px 28px -20px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.34)'
                }} onClick={() => {
                    onNewAppointment();
                    if (isMobile && onClose) onClose();
                }}>
                    <Plus size={18} /> Νέο Ραντεβού
                </button>
            </div>

            <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
                {navSections.map((section, si) => (
                    <div key={section.label} style={{ marginBottom: si < navSections.length - 1 ? '8px' : 0 }}>
                        <div style={{
                            fontSize: '0.65rem',
                            fontWeight: '800',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'var(--text-light)',
                            opacity: 0.5,
                            padding: '10px 20px 4px 20px',
                        }}>
                            {section.label}
                        </div>
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
                                    gap: '12px',
                                    padding: '12px 16px',
                                    textDecoration: 'none',
                                    color: currentTab === item.id ? 'var(--primary)' : 'var(--text-light)',
                                    background: currentTab === item.id
                                        ? 'linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(0,181,173,0.14) 100%)'
                                        : 'transparent',
                                    borderRadius: '16px',
                                    fontWeight: currentTab === item.id ? '800' : '650',
                                    marginBottom: '4px',
                                    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                                    fontSize: '0.9rem',
                                    border: `1px solid ${currentTab === item.id ? 'rgba(0,181,173,0.18)' : 'transparent'}`,
                                    boxShadow: currentTab === item.id ? '0 10px 24px -16px rgba(0,181,173,0.6)' : 'none'
                                }}
                            >
                                <span className="nav-link__icon" style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '11px',
                                    background: currentTab === item.id ? 'rgba(255,255,255,0.78)' : 'transparent',
                                    color: currentTab === item.id ? 'var(--primary)' : 'currentColor',
                                    transition: 'all 0.2s ease'
                                }}>
                                    <item.icon size={19} strokeWidth={currentTab === item.id ? 2.5 : 2.15} />
                                </span>
                                <span style={{ flex: 1 }}>{item.label}</span>
                            </a>
                        ))}
                    </div>
                ))}
            </nav>

            <div style={{ marginTop: 'auto', padding: '24px', borderTop: '1px solid var(--border)' }}>
                <div className="user-profile" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    background: 'var(--card-bg)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid rgba(255,255,255,0.26)'
                }}>
                    <div title={`${clinic?.name || 'Ιατρείο'} · ${clinic?.role === 'OWNER' ? 'Ιδιοκτήτης' : clinic?.role === 'RECEPTIONIST' ? 'Γραμματέας' : clinic?.role === 'ASSISTANT' ? 'Βοηθός' : 'Διαχειριστής'}`} style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, var(--primary) 0%, #10b981 100%)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '0.95rem',
                        flexShrink: 0,
                        cursor: 'default',
                        boxShadow: '0 4px 12px -4px rgba(0,181,173,0.4)',
                    }}>
                        {(clinic?.name?.[0] || 'I').toUpperCase()}
                    </div>
                    <div className="info" style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clinic?.name || 'Ιατρείο'}</div>
                        <div style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {clinic?.role === 'OWNER' ? 'Ιδιοκτήτης' : clinic?.role === 'RECEPTIONIST' ? 'Γραμματέας' : clinic?.role === 'ASSISTANT' ? 'Βοηθός' : 'Διαχειριστής'}
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        style={{
                            background: 'var(--bg-subtle)',
                            border: '1px solid rgba(255,255,255,0.16)',
                            borderRadius: '10px',
                            padding: '7px',
                            cursor: 'pointer',
                            color: 'var(--urgent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            boxShadow: 'var(--shadow-sm)',
                        }}
                        title="Αποσύνδεση"
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
