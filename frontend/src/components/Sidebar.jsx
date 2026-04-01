import React from 'react';
import { LayoutDashboard, Calendar, Users, TrendingUp, Settings, Brain, Plus, LogOut, Sun, Moon } from 'lucide-react';
import logo from '../assets/logo.png';

const Sidebar = ({ currentTab, setCurrentTab, clinic, onLogout, onNewAppointment, darkMode, setDarkMode }) => {
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
        <aside className="sidebar" style={{
            width: '260px',
            background: 'var(--sidebar-bg)',
            backdropFilter: 'blur(32px) saturate(200%)',
            WebkitBackdropFilter: 'blur(32px) saturate(200%)',
            borderRight: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)'
        }}>
            <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 12px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    padding: '5px'
                }}>
                    <img src={logo} alt="Media Blink" style={{ height: '110px', width: 'auto', objectFit: 'contain' }} />
                </div>
            </div>

            <div style={{ padding: '0 24px 40px 24px' }}>
                <button className="btn btn-primary" style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '14px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                    boxShadow: '0 10px 15px -3px var(--primary-glow)'
                }} onClick={onNewAppointment}>
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
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '11px 16px',
                                    textDecoration: 'none',
                                    color: currentTab === item.id ? 'var(--primary)' : 'var(--text-light)',
                                    background: currentTab === item.id
                                        ? 'var(--primary-light)'
                                        : 'transparent',
                                    borderRadius: '14px',
                                    fontWeight: currentTab === item.id ? '800' : '600',
                                    marginBottom: '2px',
                                    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                                    fontSize: '0.875rem',
                                    border: `1px solid ${currentTab === item.id ? 'var(--primary-light)' : 'transparent'}`,
                                    boxShadow: currentTab === item.id ? '0 2px 10px rgba(37,99,235,0.05)' : 'none'
                                }}
                            >
                                <item.icon size={22} strokeWidth={currentTab === item.id ? 2.5 : 2} /> {item.label}
                            </a>
                        ))}
                    </div>
                ))}
            </nav>

            <div style={{ marginTop: 'auto', padding: '24px', borderTop: '1px solid var(--border)' }}>
                {/* Dark mode toggle */}
                <button
                    onClick={() => setDarkMode(d => !d)}
                    title={darkMode ? 'Φωτεινή λειτουργία' : 'Σκοτεινή λειτουργία'}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-subtle)',
                        cursor: 'pointer',
                        marginBottom: '12px',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-light)' }}>
                        {darkMode ? 'Dark Mode' : 'Light Mode'}
                    </span>
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
                </button>

                <div className="user-profile" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: 'var(--card-bg)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--border)'
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
                        fontSize: '1.1rem'
                    }}>
                        {clinic?.name?.[0] || 'D'}
                    </div>
                    <div className="info" style={{ flex: 1, overflow: 'hidden' }}>
                        <div className="name" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clinic?.name || 'Ιατρείο'}</div>
                        <div className="role" style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase' }}>
                            {clinic?.role === 'OWNER' ? 'Ιδιοκτήτης' : clinic?.role === 'RECEPTIONIST' ? 'Γραμματέας' : clinic?.role === 'ASSISTANT' ? 'Βοηθός' : 'Διαχειριστής'}
                        </div>
                    </div>
                    <button 
                        onClick={onLogout}
                        style={{
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            padding: '8px',
                            cursor: 'pointer',
                            color: 'var(--urgent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                        }}
                        title="Αποσύνδεση"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
