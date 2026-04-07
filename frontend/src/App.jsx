import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Toaster } from 'react-hot-toast';
import { Menu } from 'lucide-react';
import { setAuthToken, clearAuthToken } from './lib/api';

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
import PatientBooking from './pages/PatientBooking';
import NotFound from './pages/NotFound';
import ServerError from './pages/ServerError';

// Components
import Sidebar from './components/Sidebar';
import NewAppointmentModal from './components/NewAppointmentModal';
import ErrorBoundary from './components/ErrorBoundary';
import { clearAccessToken, refreshAccessToken, setAccessToken } from './lib/authSession';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const App = () => {
  const queryClient = useQueryClient();
  // Simple Routing
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const [clinic, setClinic] = useState(null);
  const [token, setToken] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1024);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newAppt, setNewAppt] = useState({ patientId: '', reason: '', date: '', time: '' });
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // On mount: try to restore session
  useEffect(() => {
    const savedClinic = localStorage.getItem('clinic_data');
    if (!savedClinic) return;


        // Refresh failed — if we had a saved token try to keep session alive
        // Only clear if we have no token at all
    // Attempt silent token refresh — cookie is sent automatically
    refreshAccessToken()
      .then(refreshedToken => {
        setToken(refreshedToken);
        setAuthToken(refreshedToken);
        setClinic(JSON.parse(savedClinic));
      })
      .catch(() => {
        // Refresh failed — clear stale clinic data and show login
        clearAccessToken();
        clearAuthToken();
        localStorage.removeItem('clinic_data');
      });
  }, []);

  const getHeaders = () => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // React Queries
  const { data: appointments = [], isLoading: loadingApts, refetch: refetchApts } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => axios.get(`${API_BASE}/appointments`, { headers: getHeaders() }).then(res => res.data),
    enabled: !!token,
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: patients = [], isLoading: loadingPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => axios.get(`${API_BASE}/patients`, { headers: getHeaders() }).then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: rawNotifications = [], isLoading: loadingNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => axios.get(`${API_BASE}/notifications`, { headers: getHeaders() }).then(res => res.data),
    enabled: !!token,
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: recoveryStats = { recovered: 0, pending: 0, revenue: 0 }, isLoading: loadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['recovery-stats'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/recovery/stats`, { headers: getHeaders() });
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 15000,
    staleTime: 0,
    retry: 1,
  });

  const { data: recoveryLog = [], isLoading: loadingLog, refetch: refetchLog } = useQuery({
    queryKey: ['recovery-log'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/recovery/log`, { headers: getHeaders() });
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 15000,
    staleTime: 0,
    retry: 1,
  });

  const { data: apiUsage = {}, isLoading: loadingUsage } = useQuery({
    queryKey: ['api-usage'],
    queryFn: () => axios.get(`${API_BASE}/clinic/usage`, { headers: getHeaders() }).then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: spending = { totalCreditsUsed: 0, monthCreditsUsed: 0, totalMessagesSent: 0 } } = useQuery({
    queryKey: ['clinic-spending'],
    queryFn: () => axios.get(`${API_BASE}/clinic/spending`, { headers: getHeaders() }).then(res => res.data),
    enabled: !!token,
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: systemStatus = {}, isLoading: loadingSystem } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => axios.get(`${API_BASE}/system/status`, { headers: getHeaders() }).then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: systemStats = {}, isLoading: loadingSystemStats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => axios.get(`${API_BASE}/system/stats`, { headers: getHeaders() }).then(res => res.data),
    enabled: !!token,
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: systemConfigStatus = { warnings: [] }, isLoading: loadingConfig } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => axios.get(`${API_BASE}/system/config-status`, { headers: getHeaders() }).then(res => res.data),
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
    type: n.type
  }));

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
    axios.post(`${API_BASE}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
    clearAccessToken();
    setToken(null);
    clearAuthToken();
    setClinic(null);
    localStorage.removeItem('clinic_data');
    queryClient.clear();
  };

  let analysisTimeout = null;
  const handleAnalyze = (reason) => {
    if (reason.length < 10) return;
    if (analysisTimeout) clearTimeout(analysisTimeout);
    
    analysisTimeout = setTimeout(async () => {
      setAnalyzing(true);
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const resp = await axios.post(`${API_BASE}/analysis/analyze`, { reason }, { headers });
        setAnalysis(resp.data);
      } catch (err) {
        console.error("AI analysis failed:", err);
      } finally {
        setAnalyzing(false);
      }
    }, 800);
  };

  const handleBook = async () => {
    try {
      const startTime = new Date(`${newAppt.date}T${newAppt.time}`);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      await axios.post(`${API_BASE}/appointments`, {
        patientId: newAppt.patientId,
        reason: newAppt.reason,
        startTime,
        endTime
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setShowModal(false);
      setNewAppt({ patientId: '', reason: '', date: '', time: '' });
      setAnalysis(null);
      refetchApts();
    } catch (err) {
      alert("Σφάλμα κατά την κράτηση!");
    }
  };

  const handleConfirmAppointment = async (id) => {
    try {
      await axios.put(`${API_BASE}/appointments/${id}/status`,
        { status: 'CONFIRMED' },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      refetchApts();
    } catch (err) {
      console.error('Confirm failed:', err);
      refetchApts();
    }
  };

  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Να ακυρωθεί το ραντεβού;')) return;
    try {
      await axios.delete(`${API_BASE}/appointments/${id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      refetchApts();
    } catch (err) {
      console.error('Cancel failed:', err);
      refetchApts();
    }
  };

  // Public Patient Booking View
  if (path === '/book') {
    return <PatientBooking />;
  }

  // Handle other public routes if needed, otherwise check auth
  if (!clinic) {
    if (path === '/register') return <ClinicRegister onRegister={handleRegister} />;
    if (path === '/reset-password') return <ResetPassword />;
    if (path === '/' || path === '/login') return <ClinicLogin onLogin={handleLogin} />;
    
    // If not one of the allowed public routes and not logged in, show login (default)
    // unless it's a completely unknown path
    const publicPaths = ['/', '/login', '/register', '/reset-password', '/book'];
    if (!publicPaths.includes(path)) {
      return <NotFound />;
    }
    return <ClinicLogin onLogin={handleLogin} />;
  }

  // Filter Logic
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
          notifications={notifications}
          recoveryStats={recoveryStats}
          recoveryLog={recoveryLog}
          setCurrentTab={setCurrentTab}
          setShowModal={setShowModal}
          systemStatus={systemStatus}
          systemStats={systemStats}
          apiUsage={apiUsage}
          spending={spending}
          loading={loading}
          onRefresh={refreshRecovery}
          onUpdate={(updated) => {
            const next = { ...clinic, ...updated };
            setClinic(next);
            localStorage.setItem('clinic_data', JSON.stringify(next));
          }}
          warnings={systemConfigStatus.warnings || []}
        />;
      case 'appointments':
        return <Appointments appointments={appointments} token={token} onConfirm={handleConfirmAppointment} onCancel={handleCancelAppointment} />;
      case 'patients':
        return <Patients patients={patients} setCurrentTab={setCurrentTab} token={token} onPatientCreated={() => queryClient.invalidateQueries({ queryKey: ['patients'] })} />;
      case 'reports':
        return <Reports appointments={appointments} recoveryStats={recoveryStats} recoveryLog={recoveryLog} />;
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
          notifications={notifications}
          recoveryStats={recoveryStats}
          recoveryLog={recoveryLog}
          setCurrentTab={setCurrentTab}
          setShowModal={setShowModal}
          systemStatus={systemStatus}
          systemStats={systemStats}
          apiUsage={apiUsage}
          loading={loading}
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
        return <div>Σε κατασκευή...</div>;
    }
  };

  return (
    <div className="layout">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: '0.82rem', fontWeight: 700, borderRadius: '10px', padding: '10px 14px' },
          success: { style: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' } },
          error:   { style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' } },
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
          onClose={() => setShowModal(false)}
          patients={patients}
          newAppt={newAppt}
          setNewAppt={setNewAppt}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
          analysis={analysis}
          onBook={handleBook}
        />
      )}
    </div>
  );
};

export default App;
