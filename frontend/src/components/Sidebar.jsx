import React from 'react';
import { LayoutDashboard, Calendar, Users, TrendingUp, Settings, Brain, Plus, LogOut, Sun, Moon } from 'lucide-react';
import logo from '../assets/logo.png';

const Sidebar = ({ currentTab, setCurrentTab, clinic, onLogout, onNewAppointment, darkMode, setDarkMode }) => {
    const navItems = [
        { id: 'dashboard', label: 'Πίνακας Ελέγχου', icon: LayoutDashboard },
        { id: 'appointments', label: 'Ραντεβού', icon: Calendar },
        { id: 'patients', label: 'Ασθενείς', icon: Users },
        { id: 'reports', label: 'Αναφορές', icon: TrendingUp },
        { id: 'ai', label: 'AI', icon: Brain },
        { id: 'settings', label: 'Ρυθμίσεις', icon: Settings },
    ];

    return (
        <aside className="sidebar" style={{
            background: 'rgba(255,255,255,0.68)',
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            borderRight: '1px solid rgba(255,255,255,0.45)',
            boxShadow: '4px 0 40px rgba(0,0,0,0.06)'
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

            <nav style={{ flex: 1, padding: '0 12px' }}>
                {navItems.map((item) => (
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
                            gap: '14px',
                            padding: '16px 20px',
                            textDecoration: 'none',
                            color: currentTab === item.id ? 'var(--primary)' : 'var(--text-light)',
                            background: currentTab === item.id
                                ? 'linear-gradient(135deg, rgba(0,102,255,0.1) 0%, rgba(0,102,255,0.06) 100%)'
                                : 'transparent',
                            borderRadius: '18px',
                            fontWeight: currentTab === item.id ? '900' : '700',
                            marginBottom: '6px',
                            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                            fontSize: '0.95rem',
                            border: `1px solid ${currentTab === item.id ? 'rgba(0,102,255,0.15)' : 'transparent'}`,
                            boxShadow: currentTab === item.id ? '0 4px 14px rgba(0,102,255,0.1)' : 'none'
                        }}
                    >
                        <item.icon size={22} strokeWidth={currentTab === item.id ? 2.5 : 2} /> {item.label}
                    </a>
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
                        border: '1px solid var(--border-glass)',
                        background: darkMode ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        marginBottom: '12px',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-light)' }}>
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
                    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                    border: '1px solid var(--border-glass)'
                }}>
                    <div className="avatar" style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
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
                        <div className="name" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clinic?.name || 'Ιατρείο'}</div>
                        <div className="role" style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Διαχειριστής</div>
                    </div>
                    <button
                        className="btn-icon-sm"
                        onClick={onLogout}
                        title="Αποσύνδεση"
                        style={{ background: '#f8fafc', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', color: '#ef4444' }}
                    >
                        <LogOut size={16} />
                    </button>                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
