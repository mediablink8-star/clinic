import React, { useState, useEffect, useRef, useCallback, lazy, Suspense, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Menu, Building2, Command } from 'lucide-react';
import api, { setAuthToken, clearAuthToken } from './lib/api';
import { playNotificationDing, playSuccessSound, playErrorSound, playInteractionClick } from './lib/sound';
import { DEFAULT_TIMEZONE, API_BASE } from './lib/constants';

const LazyDashboard = lazy(() => import('./pages/Dashboard'));
const LazyCalendarView = lazy(() => import('./pages/CalendarView'));
const LazyAppointments = lazy(() => import('./pages/Appointments'));
const LazyPatients = lazy(() => import('./pages/Patients'));
const LazyReports = lazy(() => import('./pages/Reports'));
const LazyAnalytics = lazy(() => import('./pages/Analytics'));
const LazyClinicSettings = lazy(() => import('./pages/ClinicSettings'));
const LazyAISettings = lazy(() => import('./pages/AISettings'));
const LazyAdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const LazyBilling = lazy(() => import('./pages/Billing'));

const PageLoader = () => (
  <div className="page-skeleton">
    <div className="page-skeleton__header">
      <div className="skeleton" style={{ width: '280px', height: '48px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '400px', height: '20px' }} />
    </div>
    <div className="page-skeleton__stats">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '20px' }} />
      ))}
    </div>
    <div className="page-skeleton__grid">
      <div className="skeleton" style={{ height: '300px', borderRadius: '20px' }} />
      <div className="skeleton" style={{ height: '300px', borderRadius: '20px' }} />
    </div>
  </div>
);

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';

// Auth & System Pages (Eager)
import ClinicLogin from './pages/ClinicLogin';
import ClinicRegister from './pages/ClinicRegister';
import RequestDemo from './pages/RequestDemo';
import ResetPassword from './pages/ResetPassword';
import PatientBooking from './pages/PatientBooking';
import PrivacyPolicy from './pages/PrivacyPolicy';
import DataProcessingAgreement from './pages/DataProcessingAgreement';
import ServerError from './pages/ServerError';

// Components
import Sidebar from './components/Sidebar';
import NewAppointmentModal from './components/NewAppointmentModal';
import ErrorBoundary from './components/ErrorBoundary';
import OnboardingWizard from './components/OnboardingWizard';
import WelcomeModal from './components/WelcomeModal';
import TrialBanner from './components/TrialBanner';
import { clearAccessToken, refreshAccessToken, setAccessToken, decodeToken } from './lib/authSession';
import { getClinicDateKey, getClinicTimePart } from './lib/dateUtils';

// Only store essential auth fields in localStorage — not PII or sensitive data
function sanitizeClinicData(clinic) {
  if (!clinic) return null;
  return {
    id: clinic.id,
    name: clinic.name,
    userId: clinic.userId,
    onboardingCompleted: clinic.onboardingCompleted,
  };
}

const App = () => {
  const queryClient = useQueryClient();
  // Simple Routing
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      const pathname = window.location.pathname;
      setPath(pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    const tab = path.startsWith('/') ? path.slice(1) : path;
    const validTabs = ['dashboard', 'calendar', 'appointments', 'patients', 'reports', 'analytics', 'settings', 'ai', 'admin', 'billing'];
    if (validTabs.includes(tab)) {
      setCurrentTab(tab);
    } else if (path !== '/' && path !== '/login' && path !== '/register' && path !== '/demo-request' && path !== '/book' && path !== '/privacy' && path !== '/dpa' && path !== '/reset-password' && path !== '/404') {
      // Unknown path while logged in — never render 404, always fall back to dashboard
      // and correct the URL so refreshes work.
      setCurrentTab('dashboard');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [path]);

  const [clinic, setClinic] = useState(null);
  const [token, setToken] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1024);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Η σύνδεση στο διαδίκτυο αποκαταστάθηκε!', { id: 'offline-toast', duration: 4000 });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Η σύνδεση στο διαδίκτυο χάθηκε! Ελέγξτε τη σύνδεσή σας.', { id: 'offline-toast', duration: 10000 });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
  const [booking, setBooking] = useState(false);
  const analysisTimeoutRef = useRef(null);
  const prevAppointmentIdsRef = useRef(new Set());
  const prevNotifCountRef = useRef(0);

  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!token || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === '1' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCurrentTab('dashboard');
      } else if (e.key === '2' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCurrentTab('calendar');
      } else if (e.key === '3' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCurrentTab('appointments');
      } else if (e.key === '4' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCurrentTab('patients');
      } else if (e.key === '5' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCurrentTab('analytics');
      } else if (e.key === '6' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCurrentTab('settings');
      } else       if ((e.key === 'n' || e.key === 'Ν') && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowModal(true);
      }
      if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts(s => !s);
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setShowModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [token, currentTab]);

  // On mount: try to restore session
  useEffect(() => {
    const savedClinic = localStorage.getItem('clinic_data:v1');

    if (!savedClinic) {
      setAuthLoading(false);
      return;
    }

    // Attempt silent token refresh — cookie is sent automatically
    refreshAccessToken()
      .then(async refreshedToken => {
      setToken(refreshedToken);
      setAuthToken(refreshedToken);
      
      const decoded = decodeToken(refreshedToken);
      
      // Load minimal data from localStorage — only id, name for initial state
      let localClinic = null;
      try {
        const raw = JSON.parse(savedClinic);
        localClinic = {
          ...raw,
          role: decoded?.role,
          isAdmin: decoded?.role === 'ADMIN' || decoded?.role === 'OWNER',
          isPlatformAdmin: decoded?.isPlatformAdmin,
        };
      }
      catch (e) { console.warn('[App] Failed to parse clinic data:', e); localStorage.removeItem('clinic_data:v1'); }
      if (localClinic) setClinic(localClinic);
        // Then fetch fresh clinic data from API to pick up any DB changes (e.g. webhook URLs)
        try {
          const res = await fetch(`${API_BASE}/clinic`, {
            headers: { Authorization: `Bearer ${refreshedToken}` }
          });
          if (res.ok) {
            const freshClinic = await res.json();
            setClinic(freshClinic);
            localStorage.setItem('clinic_data:v1', JSON.stringify(sanitizeClinicData(freshClinic)));
            
            // Show onboarding if not completed and not a platform admin
            if (!freshClinic.onboardingCompleted && !freshClinic.isPlatformAdmin) {
              setShowOnboarding(true);
            }
          }
        } catch { /* keep localStorage version */ }
      })
      .catch(() => {
        // Refresh failed — clear stale clinic data
        clearAccessToken();
        clearAuthToken();
        localStorage.removeItem('clinic_data:v1');
      })
      .finally(() => {
        // Crucial: check is done, allow UI to render
        setAuthLoading(false);
      });
  }, []);

  // Appointments data — useState + useEffect (avoids TanStack Query subtle timing issues)
  const [appointments, setAppointments] = useState([]);
  const [loadingApts, setLoadingApts] = useState(true);
  const [fetchingApts, setFetchingApts] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState(null);
  const aptIntervalRef = useRef(null);

  const isFetchingAptsRef = useRef(false);

  // Compute date range: current month ± 1 month (3-month window)
  const getAptDateRange = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }, []);

  const refetchApts = useCallback(async ({ force = false } = {}) => {
    if (!force && isFetchingAptsRef.current) return;
    if (!token) { setAppointments([]); setFetchingApts(false); setLoadingApts(false); return; }
    isFetchingAptsRef.current = true;
    setFetchingApts(true);
    try {
      const { dateFrom, dateTo } = getAptDateRange();
      const res = await api.get(`/appointments?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}&_t=${Date.now()}`);
      const items = res.data && Array.isArray(res.data.data) ? res.data.data : [];
      setAppointments(items);
      setAppointmentsError(null);
    } catch (err) {
      setAppointmentsError(err);
    } finally {
      isFetchingAptsRef.current = false;
      setFetchingApts(false);
      setLoadingApts(false);
    }
  }, [token, getAptDateRange]);

  useEffect(() => {
    if (token) { refetchApts(); } else { setAppointments([]); setLoadingApts(true); setAppointmentsError(null); }
  }, [token, refetchApts]);

  // Refetch every 15s — but only when tab is visible
  useEffect(() => {
    if (!token) return;
    const tick = () => {
      if (!document.hidden) refetchApts();
    };
    aptIntervalRef.current = setInterval(tick, 15000);
    // Also refetch immediately when tab becomes visible again
    const handleVis = () => { if (!document.hidden) refetchApts(); };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      if (aptIntervalRef.current) clearInterval(aptIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, [token, refetchApts]);

  const { data: patients = [], isLoading: loadingPatients, isFetching: fetchingPatients, error: patientsError } = useQuery({
    queryKey: ['patients'],
    queryFn: () => api.get('/patients').then(res => res.data.data || []),
    enabled: !!token,
    placeholderData: keepPreviousData,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    staleTime: 30000,
    retry: 1,
  });

  const { data: rawNotifications = [], isLoading: loadingNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(res => res.data),
    enabled: !!token,
    placeholderData: keepPreviousData,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: recoveryStats = { recovered: 0, pending: 0, revenue: 0 }, isLoading: loadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['recovery-stats'],
    queryFn: () => api.get('/recovery/stats').then(res => res.data),
    enabled: !!token,
    placeholderData: keepPreviousData,
    refetchInterval: 60000,
    staleTime: 0,
    retry: 1,
  });

  const { data: recoveryLog = [], isLoading: loadingLog, refetch: refetchLog } = useQuery({
    queryKey: ['recovery-log'],
    queryFn: () => api.get('/recovery/log?limit=200').then(res => res.data),
    enabled: !!token,
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
    staleTime: 0,
    retry: 1,
  });

  const { data: activityFeed = [], refetch: refetchFeed } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => api.get('/activity-feed?limit=50').then(res => res.data),
    enabled: !!token,
    refetchInterval: 30000,
    staleTime: 0,
    retry: 1,
  });

  const { data: recoveryInsights = { staleNoReply: [], patientEngaged: [], failedSms: [], summary: {} } } = useQuery({
    queryKey: ['recovery-insights'],
    queryFn: () => api.get('/recovery/insights').then(res => res.data),
    enabled: !!token,
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: apiUsage = {}, isLoading: loadingUsage } = useQuery({
    queryKey: ['api-usage'],
    queryFn: () => api.get('/clinic/usage').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: spending = { totalCreditsUsed: 0, monthCreditsUsed: 0, totalMessagesSent: 0 } } = useQuery({
    queryKey: ['clinic-spending'],
    queryFn: () => api.get('/clinic/spending').then(res => res.data),
    enabled: !!token,
    refetchInterval: 120000,
    retry: 1,
  });

  const { data: systemStatus = {}, isLoading: loadingSystem } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.get('/system/status').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: systemStats = {}, isLoading: loadingSystemStats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => api.get('/system/stats').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: doctorAnalytics = [], isLoading: loadingDoctorAnalytics } = useQuery({
    queryKey: ['doctor-analytics'],
    queryFn: () => api.get('/doctors/analytics').then(res => res.data.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: systemConfigStatus = { warnings: [] }, isLoading: loadingConfig } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => api.get('/system/config-status').then(res => res.data),
    enabled: !!token,
    refetchInterval: 60000,
    retry: 1,
  });

  const loading = (loadingApts || loadingPatients) && appointments.length === 0 && patients.length === 0;

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

  // Filter Logic
  const timezone = clinic?.timezone || DEFAULT_TIMEZONE;
  const todayStr = getClinicDateKey(new Date(), timezone);
  const apts = Array.isArray(appointments) ? appointments : [];

  // Filter for appointments that are TODAY in the clinic's local time
  const todayAppointments = apts.filter(a => {
    if (!a.startTime) return false;
    return getClinicDateKey(a.startTime, timezone) === todayStr;
  });
  const upcomingAppointments = apts
    .filter(a => a.startTime && new Date(a.startTime) >= new Date())
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const urgentCount = apts.filter(a => a.priority === 'URGENT').length;
  const patientsCount = Array.isArray(patients) ? patients.length : 0;

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

    // 6. Missed calls today
    const missedToday = systemStats?.missedCallsToday;
    if (missedToday && Number(missedToday) > 0) {
      items.push({
        id: 'missed-calls-today',
        category: 'missed',
        icon: 'alert',
        color: '#ef4444',
        title: `${missedToday} αναπάντητες κλήσεις σήμερα`,
        subtitle: 'Πατήστε για προβολή αναπάντητων',
        action: 'view_recovery',
        time: 'σήμερα',
        urgent: true,
      });
    }

    // 7. Appointments starting soon (within next hour)
    const soonApts = Array.isArray(upcomingAppointments)
      ? upcomingAppointments.filter(a => a.startTime && new Date(a.startTime) < new Date(Date.now() + 60 * 60 * 1000))
      : [];
    soonApts.slice(0, 5).forEach(apt => {
      items.push({
        id: `soon-${apt.id}`,
        category: 'upcoming',
        icon: 'bell',
        color: '#f59e0b',
        title: `Ραντεβού σε λίγο — ${apt.patient?.name || 'Ασθενής'}`,
        subtitle: apt.reason || 'Χωρίς αιτιολογία',
        action: 'view_appointments',
        time: safeTime(apt.startTime),
        urgent: false,
      });
    });

    // 8. Low credit warning
    const monthCredits = Number(spending?.monthCreditsUsed) || 0;
    if (monthCredits > 0 && monthCredits >= 800) {
      items.push({
        id: 'credit-warning',
        category: 'credit',
        icon: 'alert',
        color: '#f59e0b',
        title: monthCredits >= 950
          ? '⚠️ Πιστωτικό όριο σχεδόν εξαντλημένο'
          : `Πιστωτικά μονάδες: ${monthCredits}/1000`,
        subtitle: 'Αναβαθμίστε το πακέτο σας για περισσότερες μονάδες',
        action: 'view_settings',
        time: '',
        urgent: monthCredits >= 950,
      });
    }

    return items;
  }, [recoveryInsights, recoveryLog, notifications, systemStats, upcomingAppointments, spending]);

  // Desktop push notifications for new appointments (when tab not focused)
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!appointments.length || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    const currentIds = new Set(appointments.map(a => a.id));
    const prevIds = prevAppointmentIdsRef.current;
    if (prevIds.size > 0) {
      const newIds = [...currentIds].filter(id => !prevIds.has(id));
      if (newIds.length > 0) {
        const newApt = appointments.find(a => newIds.includes(a.id));
        if (newApt) {
          new Notification('Νέο ραντεβού', {
            body: `${newApt.patient?.name || 'Ασθενής'} — ${newApt.startTime ? new Date(newApt.startTime).toLocaleString('el-GR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''}`,
            icon: '/favicon.ico',
            silent: true,
          });
        }
      }
    }
  }, [appointments]);

  // Detect new appointments from polling — notify with ding sound
  useEffect(() => {
    if (!appointments.length) return;
    const currentIds = new Set(appointments.map(a => a.id));
    const prevIds = prevAppointmentIdsRef.current;

    if (prevIds.size > 0) {
      const newIds = [...currentIds].filter(id => !prevIds.has(id));
      if (newIds.length > 0) {
        playNotificationDing({ urgent: false });
        const newAppointments = appointments.filter(a => newIds.includes(a.id));
        newAppointments.forEach(apt => {
          const patientName = apt.patient?.name || apt.patientId || 'Ασθενής';
          toast.success(
            `🆕 Νέο ραντεβού προγραμματίστηκε — ${patientName}${apt.startTime ? ` για ${new Date(apt.startTime).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' })}` : ''}`,
            { duration: 5000, icon: '📅' }
          );
        });
      }
    }

    prevAppointmentIdsRef.current = currentIds;
  }, [appointments]);

  // Listen for backend 402 BILLING_LOCKED — toast and route to billing.
  // We re-throw so the calling code's catch() still runs and can show a
  // contextual error (e.g. "Booking failed: trial expired"). We only redirect
  // to /billing on the next tick so the user actually sees the toast first.
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 402 && err.response?.data?.error === 'BILLING_LOCKED') {
          toast.error(err.response.data.message || 'Η δοκιμή σας έληξε. Επιλέξτε πλάνο για να συνεχίσετε.', { duration: 8000 });
          setTimeout(() => {
            setCurrentTab('billing');
            window.history.pushState({ tab: 'billing' }, '', '/billing');
            setPath('/billing');
          }, 800);
        } else if (err.response?.status === 402 && err.response?.data?.error === 'PLAN_UPGRADE_REQUIRED') {
          toast.error(err.response.data.message || 'Απαιτείται αναβάθμιση πλάνου.', { duration: 8000 });
          setTimeout(() => {
            setCurrentTab('billing');
            window.history.pushState({ tab: 'billing' }, '', '/billing');
            setPath('/billing');
          }, 800);
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  // Show a toast when returning from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      toast.success('Η πληρωμή ολοκληρώθηκε! Καλωσορίσατε στο νέο σας πλάνο.', { duration: 6000 });
      queryClient.invalidateQueries({ queryKey: ['billing-status'] });
      queryClient.invalidateQueries({ queryKey: ['clinic'] });
      // Clean the URL
      window.history.replaceState({}, '', '/billing');
    } else if (status === 'cancelled') {
      toast('Η πληρωμή ακυρώθηκε.', { icon: 'ℹ️' });
      window.history.replaceState({}, '', '/billing');
    }
  }, []);

  // Play ding sound when new notifications arrive
  useEffect(() => {
    const currentCount = unifiedNotifications.length;
    if (prevNotifCountRef.current > 0 && currentCount > prevNotifCountRef.current) {
      const newItems = unifiedNotifications.slice(prevNotifCountRef.current);
      const hasUrgent = newItems.some(n => n.urgent);
      playNotificationDing({ urgent: hasUrgent });
    }
    prevNotifCountRef.current = currentCount;
  }, [unifiedNotifications]);

  const handleLogin = (loginData) => {
     const { token, clinic } = loginData;
      setAccessToken(token);
      setToken(token);
      setAuthToken(token);
      setClinic(clinic);
      // Support deep linking
      const tabs = ['dashboard', 'calendar', 'appointments', 'patients', 'reports', 'analytics', 'settings', 'ai', 'admin', 'billing'];
      const requestedTab = path.startsWith('/') ? path.slice(1) : path;
  
      if (clinic?.isPlatformAdmin) {
        setCurrentTab('admin');
      } else if (!clinic?.onboardingCompleted && !clinic?.isPlatformAdmin) {
        setShowOnboarding(true);
      } else if (tabs.includes(requestedTab) && requestedTab !== 'admin') {
        setCurrentTab(requestedTab);
      } else {
        setCurrentTab('dashboard');
      }
     localStorage.setItem('clinic_data:v1', JSON.stringify(sanitizeClinicData(clinic)));
     queryClient.invalidateQueries();
  };

   const handleWelcomeComplete = () => {
     setShowWelcome(false);
   };

  const handleRegister = (registerData) => {
    const { token, clinic } = registerData;
    setAccessToken(token);
    setToken(token);
    setAuthToken(token);
    setClinic(clinic);
    localStorage.setItem('clinic_data:v1', JSON.stringify(sanitizeClinicData(clinic)));
    setShowOnboarding(true); // show wizard for new registrations
    queryClient.invalidateQueries();
  };

  const handleLogout = () => {
    api.post('/auth/logout').catch(() => {});
    clearAccessToken();
    setToken(null);
    clearAuthToken();
    setClinic(null); setCurrentTab('dashboard');
    localStorage.removeItem('clinic_data:v1');
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
  }, [token]);

  const handleBook = async (overridePatientId) => {
    if (booking) return;
    setBooking(true);
    try {
      await api.post('/appointments', {
        patientId: overridePatientId || newAppt.patientId,
        reason: newAppt.reason,
        date: newAppt.date,
        time: newAppt.time,
        ...(newAppt.doctorId ? { doctorId: newAppt.doctorId } : {})
      });

      playSuccessSound();
      // Show success toast first
      toast.success('✓ Το ραντεβού καταχωρήθηκε επιτυχώς!', {
        duration: 4000,
        style: {
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          fontWeight: '800',
          fontSize: '0.9rem',
          padding: '14px 18px',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
        }
      });

      // Give the user a moment to read the success toast before closing.
      setTimeout(() => {
        setShowModal(false);
        setNewAppt({ patientId: '', reason: '', date: '', time: '', doctorId: '' });
        setAnalysis(null);
      }, 800);

      refetchApts({ force: true });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    } catch (err) {
      playErrorSound();
      const status = err.response?.status;
      const code = err.response?.data?.error;
      let msg = err.response?.data?.error || err.response?.data?.message || 'Σφάλμα κατά την κράτηση ραντεβού.';
      if (status === 402 && code === 'BILLING_LOCKED') {
        msg = 'Η δοκιμή σας έληξε. Κλείστε ένα πλάνο για να δημιουργήσετε νέα ραντεβού.';
      } else if (status === 400) {
        msg = err.response?.data?.message || err.response?.data?.error || 'Ελέγξτε τα στοιχεία και δοκιμάστε ξανά.';
      } else if (status === 409) {
        msg = 'Η ώρα αυτή μόλις κλείστηκε. Παρακαλώ επιλέξτε άλλη.';
      } else if (!err.response) {
        msg = 'Αδυναμία σύνδεσης με τον διακομιστή. Ελέγξτε το internet σας.';
      }
      toast.error(msg, { duration: 5000 });
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
    const aptToRestore = appointments.find(a => a.id === id);
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
      toast(
        (t) => (
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', fontWeight: 600 }}>
            ✓ Ραντεβού ακυρώθηκε
            {aptToRestore && (
              <button
                onClick={async () => {
                  toast.dismiss(t.id);
                  try {
                    const tz = clinic?.timezone || DEFAULT_TIMEZONE;
                    const payload = {
                      patientId: aptToRestore.patientId,
                      reason: aptToRestore.reason,
                      date: getClinicDateKey(aptToRestore.startTime, tz),
                      time: getClinicTimePart(aptToRestore.startTime, tz),
                      ...(aptToRestore.doctorId ? { doctorId: aptToRestore.doctorId } : {})
                    };
                    await api.post('/appointments', payload);
                    refetchApts();
                    toast.success('✓ Το ραντεβού επαναφέρθηκε επιτυχώς!');
                  } catch (err) {
                    toast.error('Αποτυχία επαναφοράς.');
                  }
                }}
                style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
              >
                Αναίρεση
              </button>
            )}
          </span>
        ),
        { duration: 6000 }
      );
    } catch (err) {
      console.error('Cancel failed:', err);
      toast.error('Αποτυχία ακύρωσης.');
      refetchApts();
    }
  };

  // Public Patient Booking View
  if (path === '/privacy') return <PrivacyPolicy />;
  if (path === '/dpa') return <DataProcessingAgreement />;

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
    if (path === '/register' || path === '/demo-request') return <RequestDemo />;
    if (path === '/reset-password') return <ResetPassword />;
    if (path === '/' || path === '/login') return <ClinicLogin onLogin={handleLogin} />;

    // Public-only paths
    const publicPaths = ['/', '/login', '/register', '/demo-request', '/reset-password', '/book', '/privacy', '/dpa'];
    if (publicPaths.includes(path)) {
      return <ClinicLogin onLogin={handleLogin} />;
    }
    
    // Any other path (e.g. /dashboard, /appointments) — user is not logged in
    // Redirect to login instead of showing 404
    return <ClinicLogin onLogin={handleLogin} />;
  }

  const refreshRecovery = () => {
    setTimeout(() => {
      refetchLog();
      refetchStats();
    }, 300);
  };

  const handleSetCurrentTab = (tab) => {
    playInteractionClick();
    setCurrentTab(tab);
    window.history.pushState({ tab }, '', `/${tab}`);
    setPath(`/${tab}`);
    // Refetch appointments when navigating to appointments or calendar tab
    // so public bookings and external changes show up immediately
    if (tab === 'appointments' || tab === 'calendar') {
      refetchApts();
    }
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Suspense fallback={<PageLoader />}><LazyDashboard
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
          activityFeed={activityFeed}
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
            if (action === 'view_settings') handleSetCurrentTab('settings');
            if (action === 'retry_sms' && data?.id) {
              api.post(`/recovery/${data.id}/retry`).then(() => { refetchLog(); refetchStats(); toast.success('SMS επαναστάλθηκε!'); })
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
            localStorage.setItem('clinic_data:v1', JSON.stringify(sanitizeClinicData(next)));
          }}
          warnings={systemConfigStatus.warnings || []}
        /></Suspense>;
      case 'calendar':
        return <Suspense fallback={<PageLoader />}><LazyCalendarView 
          appointments={appointments} 
          gcalConnected={clinic?.googleCalendarConnected || false}
          clinic={clinic}
          loading={loadingApts}
          onAppointmentClick={(apt) => {
            setCurrentTab('appointments');
            toast.success(`Ραντεβού: ${apt.patient?.name || 'Ασθενής'}`);
          }}
        /></Suspense>;
      case 'appointments':
        return <Suspense fallback={<PageLoader />}><LazyAppointments appointments={appointments} token={token} onConfirm={handleConfirmAppointment} onCancel={handleCancelAppointment} onNewAppointment={() => setShowModal(true)} isLoading={fetchingApts} error={appointmentsError} onRetry={refetchApts} clinic={clinic} /></Suspense>;
      case 'patients':
        return <Suspense fallback={<PageLoader />}><LazyPatients patients={patients} clinic={clinic} setCurrentTab={setCurrentTab} token={token} onPatientCreated={() => queryClient.invalidateQueries({ queryKey: ['patients'] })} isLoading={fetchingPatients} error={patientsError} onRetry={() => queryClient.invalidateQueries({ queryKey: ['patients'] })} /></Suspense>;
      case 'reports':
        return <Suspense fallback={<PageLoader />}><LazyReports appointments={appointments} recoveryStats={recoveryStats} recoveryLog={recoveryLog} loading={loadingStats || loadingLog} /></Suspense>;
      case 'analytics':
        return <Suspense fallback={<PageLoader />}><LazyAnalytics recoveryLog={recoveryLog} recoveryStats={recoveryStats} spending={spending} systemStats={systemStats} doctorAnalytics={doctorAnalytics} loading={loadingLog || loadingStats || loadingDoctorAnalytics} /></Suspense>;
      case 'settings':
        return <Suspense fallback={<PageLoader />}><LazyClinicSettings clinic={clinic} token={token} onUpdate={(updated) => {
          const next = { ...clinic, ...updated };
          setClinic(next);
          localStorage.setItem('clinic_data:v1', JSON.stringify(sanitizeClinicData(next)));
        }} /></Suspense>;
      case 'admin':
        if (!clinic?.isPlatformAdmin) {
          setCurrentTab('dashboard');
          return null;
        }
        return (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <LazyAdminDashboard />
            </Suspense>
          </ErrorBoundary>
        );
      case 'billing':
        if (clinic?.role !== 'OWNER' && clinic?.role !== 'ADMIN') {
          setCurrentTab('dashboard');
          return null;
        }
        return <Suspense fallback={<PageLoader />}><LazyBilling clinic={clinic} onUpdate={(updated) => {
          const next = { ...clinic, ...updated };
          setClinic(next);
          localStorage.setItem('clinic_data:v1', JSON.stringify(sanitizeClinicData(next)));
        }} /></Suspense>;
      case 'ai':
        if (clinic?.role === 'ASSISTANT') return <Suspense fallback={<PageLoader />}><LazyDashboard
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
          activityFeed={activityFeed}
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
            localStorage.setItem('clinic_data:v1', JSON.stringify(sanitizeClinicData(next)));
          }}
        /></Suspense>;
        return <Suspense fallback={<PageLoader />}><LazyAISettings clinic={clinic} token={token} onUpdate={(updated) => {
          const next = { ...clinic, ...updated };
          setClinic(next);
          localStorage.setItem('clinic_data:v1', JSON.stringify(sanitizeClinicData(next)));
        }} /></Suspense>;
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
      <TrialBanner onUpgradeClick={() => handleSetCurrentTab('billing')} />
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
          color: 'white',
          padding: '10px 16px',
          fontSize: '0.82rem',
          fontWeight: '800',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          zIndex: 9999,
          boxShadow: '0 4px 16px rgba(239, 68, 68, 0.45)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'white',
            display: 'inline-block',
            animation: 'pulse 1.5s infinite'
          }} />
          <strong>Εκτός Σύνδεσης:</strong> Η σύνδεση στο διαδίκτυο χάθηκε. Οποιεσδήποτε αλλαγές ενδέχεται να μην αποθηκευτούν.
        </div>
      )}
{showOnboarding && (
         <ErrorBoundary>
           <OnboardingWizard
             clinic={clinic}
             token={token}
             onComplete={() => {
               setShowOnboarding(false);
               setShowWelcome(true);
               setCurrentTab('dashboard');
             }}
               onUpdate={(updated) => {
                 const next = { ...clinic, ...updated };
                 setClinic(next);
                 localStorage.setItem('clinic_data:v1', JSON.stringify(sanitizeClinicData(next)));
               }}
           />
         </ErrorBoundary>
       )}
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

      {showShortcuts && (
        <div onClick={() => setShowShortcuts(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--modal-bg)', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '400px', border: '1px solid var(--modal-border)', boxShadow: 'var(--shadow-2xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Command size={16} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>Συντομεύσεις</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: '1', label: 'Πίνακας Ελέγχου' },
                { key: '2', label: 'Ημερολόγιο' },
                { key: '3', label: 'Ραντεβού' },
                { key: '4', label: 'Ασθενείς' },
                { key: '5', label: 'Αναλυτικά' },
                { key: '6', label: 'Ρυθμίσεις' },
                { key: 'N', label: 'Νέο ραντεβού (παγκόσμιο)' },
                { key: '?', label: 'Αυτή η βοήθεια' },
              ].map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-subtle)' }}>
                  <kbd style={{ minWidth: '28px', height: '28px', borderRadius: '8px', background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: '800', color: 'var(--primary)', boxShadow: 'var(--shadow-sm)' }}>{s.key}</kbd>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>{s.label}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowShortcuts(false)} style={{ marginTop: '1.5rem', width: '100%', padding: '10px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}>Κλείσιμο</button>
          </div>
        </div>
      )}
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
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

{isMobile && isSidebarOpen && (
         <button
           className="sidebar-backdrop"
           onClick={() => setIsSidebarOpen(false)}
           aria-label="Close navigation menu"
         />
       )}

        {showWelcome && (
          <WelcomeModal clinic={clinic} onClose={handleWelcomeComplete} onNavigate={(tab) => handleSetCurrentTab(tab)} />
        )}

      <main className="main-content" style={{ maxWidth: isSidebarCollapsed && !isMobile ? '1620px' : undefined }}>
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
              <strong>{clinic?.name || 'Ιατρείο'}</strong>
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
          appointments={appointments}
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
