import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Menu, Building2 } from 'lucide-react';
import api, { setAuthToken, clearAuthToken } from './lib/api';

import { useQuery, useQueryClient } from '@tanstack/react-query';

// Pages
import ClinicLogin from './pages/ClinicLogin';
import ClinicRegister from './pages/ClinicRegister';
import ResetPassword from './pages/ResetPassword';
import ClinicSettings from './pages/ClinicSettings';
import AISettings from './pages/AISettings';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Patients from './pages/Patients';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import PatientBooking from './pages/PatientBooking';
import NotFound from './pages/NotFound';

// Components
import Sidebar from './components/Sidebar';
import NewAppointmentModal from './components/NewAppointmentModal';
import ErrorBoundary from './components/ErrorBoundary';
import { clearAccessToken, refreshAccessToken, setAccessToken } from './lib/authSession';

const App = () => {
  const queryClient = useQueryClient();
  // Simple Routing
  const [path, setPath] = useState(window.location.pathname);
  const [clinic, setClinic] = useState(null);
  const [token, setToken] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    const handleLocationChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1024);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = window.innerWidth <= 1024;
      setIsMobile(nextIsMobile);
      if (!nextIsMobile) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const routeTab = {
      '/dashboard': 'dashboard',
      '/appointments': 'appointments',
      '/patients': 'patients',
      '/reports': 'reports',
      '/settings': 'settings',
      '/ai': 'ai'
    }[path];

    if (routeTab) {
      setCurrentTab(routeTab);
    }
  }, [path]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newAppt, setNewAppt] = useState({ patientId: '', reason: '', date: '', time: '' });
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [booking, setBooking] = useState(false);
  const analysisTimeoutRef = useRef(null);

  // On mount: try to restore session
  useEffect(() => {
    const savedClinic = localStorage.getItem('clinic_data');
    
    if (!savedClinic) {
      setAuthLoading(false);
      return;
    }

    // Attempt silent token refresh — cookie is sent automatically
    refreshAccessToken()
      .then(refreshedToken => {
        setToken(refreshedToken);
        setAuthToken(refreshedToken);
        setClinic(JSON.parse(savedClinic));
      })
      .catch(() => {
        // Refresh failed — clear stale clinic data
        clearAccessToken();
        clearAuthToken();
        localStorage.removeItem('clinic_data');
      })
      .finally(() => {
        // Crucial: check is done, allow UI to render
        setAuthLoading(false);
      });
  }, []);

  // React Queries — all use the shared `api` instance (withCredentials + auto token refresh)
  const { data: appointments = [], isLoading: loadingApts, refetch: refetchApts } = useQuery({
    queryKey: ['appointments', token],
    queryFn: () => api.get('/appointments').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: patients = [], isLoading: loadingPatients } = useQuery({
    queryKey: ['patients', token],
    queryFn: () => api.get('/patients').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: rawNotifications = [], isLoading: loadingNotifs } = useQuery({
    queryKey: ['notifications', token],
    queryFn: () => api.get('/notifications').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: recoveryStats = { recovered: 0, pending: 0, revenue: 0 }, isLoading: loadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['recovery-stats', token],
    queryFn: () => api.get('/recovery/stats').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    staleTime: 0,
    retry: 1,
  });

  const { data: recoveryLog = [], isLoading: loadingLog, refetch: refetchLog } = useQuery({
    queryKey: ['recovery-log', token],
    queryFn: () => api.get('/recovery/log?limit=200').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    staleTime: 0,
    retry: 1,
  });

  const { data: recoveryInsights = { staleNoReply: [], patientEngaged: [], failedSms: [], summary: {} } } = useQuery({
    queryKey: ['recovery-insights', token],
    queryFn: () => api.get('/recovery/insights').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: apiUsage = {}, isLoading: loadingUsage } = useQuery({
    queryKey: ['api-usage', token],
    queryFn: () => api.get('/clinic/usage').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: spending = { totalCreditsUsed: 0, monthCreditsUsed: 0, totalMessagesSent: 0 } } = useQuery({
    queryKey: ['clinic-spending', token],
    queryFn: () => api.get('/clinic/spending').then(res => res.data),
    enabled: !!token,
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: systemStatus = {}, isLoading: loadingSystem } = useQuery({
    queryKey: ['system-status', token],
    queryFn: () => api.get('/system/status').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: systemStats = {}, isLoading: loadingSystemStats } = useQuery({
    queryKey: ['system-stats', token],
    queryFn: () => api.get('/system/stats').then(res => res.data),
    enabled: !!token,
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: systemConfigStatus = { warnings: [] }, isLoading: loadingConfig } = useQuery({
    queryKey: ['system-config', token],
    queryFn: () => api.get('/system/config-status').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const loading = loadingApts || loadingPatients || loadingNotifs || loadingStats || loadingLog || loadingSystem || loadingUsage || loadingSystemStats || loadingConfig;

  const safeTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '--:--';
      return d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const notifications = (Array.isArray(rawNotifications) ? rawNotifications : []).map(n => ({
    id: n.id,
    text: n.message,
    time: safeTime(n.createdAt),
    type: n.type,
    category: 'system'
  }));

  // Build unified notification feed from all data sources
  const unifiedNotifications = React.useMemo(() => {
    const items = [];

    // 1. Stale recoveries — no reply in 24h
    if (recoveryInsights?.staleNoReply?.length > 0) {
      items.push({
        id: 'stale-batch',
        category: 'followup',
        icon: 'send',
        color: '#7c3aed',
        title: `${recoveryInsights.staleNoReply.length} ασθενείς δεν απάντησαν (24h+)`,
        subtitle: 'Αποστολή follow-up SMS',
        action: 'followup',
        time: 'τώρα',
        urgent: true,
        data: recoveryInsights.staleNoReply
      });
    }

    // 2. Patient engaged (replied)
    if (recoveryInsights?.patientEngaged?.length > 0) {
      recoveryInsights.patientEngaged.slice(0, 5).forEach(mc => {
        items.push({
          id: `engaged-${mc.id}`,
          category: 'reply',
          icon: 'reply',
          color: '#3b82f6',
          title: `${mc.patientName || mc.phone} απάντησε`,
          subtitle: 'Ο ασθενής περιμένει απάντηση',
          action: 'view_recovery',
          time: mc.lastSmsSentAt ? safeTime(mc.lastSmsSentAt) : '',
          urgent: true,
          data: mc
        });
      });
    }

    // 3. Recovered appointments (booked via recovery)
    const recentRecovered = Array.isArray(recoveryLog)
      ? recoveryLog.filter(l => l?.status === 'RECOVERED' && l?.recoveredAt &&
          new Date(l.recoveredAt) > new Date(Date.now() - 24 * 60 * 60 * 1000))
      : [];
    recentRecovered.slice(0, 5).forEach(mc => {
      items.push({
        id: `recovered-${mc.id}`,
        category: 'booked',
        icon: 'check',
        color: '#10b981',
        title: `Ραντεβού κλείστηκε — ${mc.patient?.name || mc.fromNumber}`,
        subtitle: 'Ανάκτηση επιτυχής',
        action: 'view_appointments',
        time: safeTime(mc.recoveredAt),
        urgent: false,
        data: mc
      });
    });

    // 4. Failed SMS
    if (recoveryInsights?.failedSms?.length > 0) {
      recoveryInsights.failedSms.slice(0, 3).forEach(mc => {
        items.push({
          id: `failed-${mc.id}`,
          category: 'failed',
          icon: 'alert',
          color: '#ef4444',
          title: `Αποτυχία SMS — ${mc.patientName || mc.phone}`,
          subtitle: mc.smsError || 'Αποτυχία αποστολής',
          action: 'retry_sms',
          time: '',
          urgent: true,
          data: mc
        });
      });
    }

    // 5. System notifications (appointment reminders etc)
    notifications.forEach(n => items.push({ ...n, category: n.category || 'system', icon: 'bell', color: 'var(--primary)', urgent: false }));

    return items;
  }, [recoveryInsights, recoveryLog, notifications]);

  const handleLogin = (loginData) => {
    const { token, clinic } = loginData;
    setAccessToken(token);
    setToken(token);
    setAuthToken(token);
    setClinic(clinic);
    localStorage.setItem('clinic_data', JSON.stringify(clinic));
    queryClient.invalidateQueries();
  };

  const handleRegister = (registerData) => {
    const { token, clinic } = registerData;
    setAccessToken(token);
    setToken(token);
    setAuthToken(token);
    setClinic(clinic);
    localStorage.setItem('clinic_data', JSON.stringify(clinic));
    setCurrentTab('settings');
    queryClient.invalidateQueries();
  };

  const handleLogout = () => {
    api.post('/auth/logout').catch(() => {});
    clearAccessToken();
    setToken(null);
    clearAuthToken();
    setClinic(null);
    localStorage.removeItem('clinic_data');
    queryClient.clear();
  };

  const handleAnalyze = useCallback((reason) => {
    if (reason.length < 10) return;
    if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    analysisTimeoutRef.current = setTimeout(async () => {
      setAnalyzing(true);
      try {
        const resp = await api.post('/analysis/analyze', { reason });
        setAnalysis(resp.data);
      } catch (err) {
        console.error('AI analysis failed:', err);
      } finally {
        setAnalyzing(false);
      }
    }, 800);
  }, []);

  const handleBook = async () => {
    if (booking) return;
    setBooking(true);
    try {
      const startTime = new Date(`${newAppt.date}T${newAppt.time}`);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      await api.post('/appointments', {
        patientId: newAppt.patientId,
        reason: newAppt.reason,
        startTime,
        endTime
      });

      setShowModal(false);
      setNewAppt({ patientId: '', reason: '', date: '', time: '' });
      setAnalysis(null);
      refetchApts();
      toast.success('Το ραντεβού καταχωρήθηκε!');
    } catch (err) {
      const msg = err.response?.data?.error || 'Σφάλμα κατά την κράτηση ραντεβού.';
      toast.error(msg);
    } finally {
      setBooking(false);
    }
  };

  const handleConfirmAppointment = async (id) => {
    try {
      await api.put(`/appointments/${id}/status`, { status: 'CONFIRMED' });
      refetchApts();
      toast.success('Ραντεβού επιβεβαιώθηκε!');
    } catch (err) {
      console.error('Confirm failed:', err);
      toast.error('Αποτυχία επιβεβαίωσης.');
      refetchApts();
    }
  };

  const handleCancelAppointment = async (id) => {
    const confirmed = await new Promise(resolve => {
      toast(
        (t) => (
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', fontWeight: 600 }}>
            Ακύρωση ραντεβού;
            <button
              onClick={() => { toast.dismiss(t.id); resolve(true); }}
              style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
            >
              Ναι
            </button>
            <button
              onClick={() => { toast.dismiss(t.id); resolve(false); }}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}
            >
              Όχι
            </button>
          </span>
        ),
        { duration: 6000, style: { maxWidth: 360, fontSize: '0.82rem' } }
      );
    });
    if (!confirmed) return;
    try {
      await api.delete(`/appointments/${id}`);
      refetchApts();
      toast.success('Ραντεβού ακυρώθηκε.');
    } catch (err) {
      console.error('Cancel failed:', err);
      toast.error('Αποτυχία ακύρωσης.');
      refetchApts();
    }
  };

  // Public Patient Booking View
  if (path === '/book') {
    return <PatientBooking />;
  }

  // Session Restoration Guard
  if (authLoading) {
    return (
      <div className="splash-screen">
        <div className="splash-logo-container">
          <div style={{ background: 'var(--primary)', padding: '16px', borderRadius: '20px', boxShadow: '0 20px 40px var(--primary-glow)' }}>
            <Building2 color="white" size={48} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 900, marginBottom: '4px', letterSpacing: '-0.03em' }}>ClinicFlow</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Επαλήθευση σύνδεσης...</p>
          </div>
          <div className="splash-spinner" />
        </div>
      </div>
    );
  }

  // Handle other public routes if needed, otherwise check auth
  if (!clinic) {
    if (path === '/register') return <ClinicRegister onRegister={handleRegister} />;
    if (path === '/reset-password') return <ResetPassword />;
    if (path === '/' || path === '/login') return <ClinicLogin onLogin={handleLogin} />;
    
    // If not one of the allowed public routes and not logged in, show login (default)
    // unless it's a completely unknown path
    const publicPaths = ['/', '/login', '/register', '/reset-password', '/book', '/dashboard', '/appointments', '/patients', '/reports', '/settings', '/ai'];
    if (publicPaths.includes(path)) return <ClinicLogin onLogin={handleLogin} />;
    return <NotFound />;
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const apts = Array.isArray(appointments) ? appointments : [];

  const todayAppointments = apts.filter(a => a.startTime && typeof a.startTime === 'string' && a.startTime.startsWith(todayStr));
  const upcomingAppointments = apts
    .filter(a => a.startTime && new Date(a.startTime) >= new Date())
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const urgentCount = apts.filter(a => a.priority === 'URGENT').length;
  const patientsCount = Array.isArray(patients) ? patients.length : 0;

  const refreshRecovery = () => {
    setTimeout(() => {
      refetchLog();
      refetchStats();
    }, 300);
  };

  const handleSetCurrentTab = (tab) => {
    setCurrentTab(tab);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard
          clinic={clinic}
          appointments={appointments}
          todayAppointments={todayAppointments}
          upcomingAppointments={upcomingAppointments}
          urgentCount={urgentCount}
          patientsCount={patientsCount}
          patients={patients}
          token={token}
          notifications={unifiedNotifications}
          recoveryStats={recoveryStats}
          recoveryLog={recoveryLog}
          recoveryInsights={recoveryInsights}
          setCurrentTab={setCurrentTab}
          setShowModal={setShowModal}
          systemStatus={systemStatus}
          systemStats={systemStats}
          apiUsage={apiUsage}
          spending={spending}
          loading={loading}
          isMobile={isMobile}
          onRefresh={refreshRecovery}
          onNotificationAction={(action, data) => {
            if (action === 'view_recovery' || action === 'followup') handleSetCurrentTab('dashboard');
            if (action === 'view_appointments') handleSetCurrentTab('appointments');
            if (action === 'retry_sms' && data?.id) {
              api.post(`/recovery/${data.id}/retry`)
                .then(() => { refetchLog(); refetchStats(); toast.success('SMS επαναστάλθηκε!'); })
                .catch(() => toast.error('Αποτυχία επανάληψης SMS.'));
            }
            if (action === 'followup' && Array.isArray(data)) {
              Promise.all(data.slice(0, 10).map(mc =>
                api.post(`/recovery/${mc.id}/followup`).catch(() => {})
              )).then(() => {
                setTimeout(() => { refetchLog(); refetchStats(); }, 1000);
                toast.success('Follow-up SMS εστάλη!');
              });
            }
          }}
          onUpdate={(updated) => {
            const next = { ...clinic, ...updated };
            setClinic(next);
            localStorage.setItem('clinic_data', JSON.stringify(next));
          }}
          warnings={systemConfigStatus.warnings || []}
        />;
      case 'appointments':
        return <Appointments appointments={appointments} token={token} onConfirm={handleConfirmAppointment} onCancel={handleCancelAppointment} onNewAppointment={() => setShowModal(true)} />;
      case 'patients':
        return <Patients patients={patients} setCurrentTab={setCurrentTab} token={token} onPatientCreated={() => queryClient.invalidateQueries({ queryKey: ['patients'] })} />;
      case 'reports':
        return <Reports appointments={appointments} recoveryStats={recoveryStats} recoveryLog={recoveryLog} />;
      case 'analytics':
        return <Analytics recoveryLog={recoveryLog} recoveryStats={recoveryStats} spending={spending} systemStats={systemStats} />;
      case 'settings':
        return <ClinicSettings clinic={clinic} token={token} onUpdate={(updated) => {
          const next = { ...clinic, ...updated };
          setClinic(next);
          localStorage.setItem('clinic_data', JSON.stringify(next));
        }} />;
      case 'ai':
        if (clinic?.role === 'ASSISTANT') return <Dashboard
          clinic={clinic}
          appointments={appointments}
          todayAppointments={todayAppointments}
          upcomingAppointments={upcomingAppointments}
          urgentCount={urgentCount}
          patientsCount={patientsCount}
          patients={patients}
          token={token}
          notifications={unifiedNotifications}
          recoveryStats={recoveryStats}
          recoveryLog={recoveryLog}
          recoveryInsights={recoveryInsights}
          setCurrentTab={setCurrentTab}
          setShowModal={setShowModal}
          systemStatus={systemStatus}
          systemStats={systemStats}
          apiUsage={apiUsage}
          loading={loading}
          isMobile={isMobile}
          warnings={systemConfigStatus.warnings || []}
          onRefresh={refreshRecovery}
          onUpdate={(updated) => {
            const next = { ...clinic, ...updated };
            setClinic(next);
            localStorage.setItem('clinic_data', JSON.stringify(next));
          }}
        />;
        return <AISettings clinic={clinic} token={token} onUpdate={(updated) => {
          const next = { ...clinic, ...updated };
          setClinic(next);
          localStorage.setItem('clinic_data', JSON.stringify(next));
        }} />;
      default:
        return (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '60vh', flexDirection: 'column', gap: '1rem'
          }}>
            <div style={{
              padding: '2rem 2.5rem', borderRadius: '20px',
              background: 'var(--glass-surface)', border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)', textAlign: 'center'
            }}>
              <p style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🚧</p>
              <p style={{ fontWeight: '800', color: 'var(--secondary)', marginBottom: '4px' }}>Σε κατασκευή</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>Αυτή η ενότητα είναι σύντομα διαθέσιμη.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="layout">
      {/* High-Fidelity SVG Grain Filter (Hidden) */}
      <svg style={{ position: 'fixed', opacity: 0, pointerEvents: 'none' }}>
        <filter id="glass-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.06" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" mode="overlay" />
        </filter>
      </svg>

      {/* Liquid Glass Background Elements - Expanded for Desktop Depth */}
      <div className="liquid-bg-blob" style={{ top: '-15%', left: '-5%', width: '70vw', height: '70vw', background: 'radial-gradient(circle, rgba(0,181,173,0.18) 0%, rgba(0,181,173,0) 70%)' }} />
      <div className="liquid-bg-blob" style={{ bottom: '-10%', right: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0) 70%)', animationDelay: '-5s' }} />
      <div className="liquid-bg-blob" style={{ top: '20%', right: '10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, rgba(236,72,153,0) 70%)', animationDelay: '-12s' }} />
      
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '0.82rem', fontWeight: 700, borderRadius: '12px', padding: '10px 14px',
            background: 'var(--modal-bg)', color: 'var(--text)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: 'white' } },
        }}
      />
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={handleSetCurrentTab}
        clinic={clinic}
        onLogout={handleLogout}
        onNewAppointment={() => setShowModal(true)}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        warnings={systemConfigStatus.warnings || []}
        isMobile={isMobile}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {isMobile && isSidebarOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <main className="main-content">
        {isMobile && (
          <div className="mobile-topbar card-glass">
            <button
              className="mobile-menu-button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <div className="mobile-topbar__text">
              <span className="mobile-topbar__label">ClinicFlow</span>
              <strong>{clinic?.name || 'Clinic'}</strong>
            </div>
          </div>
        )}
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
      </main>

      {showModal && (
        <NewAppointmentModal
          onClose={() => { setShowModal(false); setAnalysis(null); }}
          patients={patients}
          newAppt={newAppt}
          setNewAppt={setNewAppt}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
          analysis={analysis}
          onBook={handleBook}
          booking={booking}
        />
      )}
    </div>
  );
};

export default App;
