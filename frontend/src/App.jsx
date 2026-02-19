import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calendar, User, Phone, AlertCircle,
  CheckCircle, LayoutDashboard, Users,
  Settings, Bell, Plus, Search, Filter,
  Clock, ClipboardList, TrendingUp, LogOut
} from 'lucide-react';

import ClinicLogin from './pages/ClinicLogin';
import ClinicSettings from './pages/ClinicSettings';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const App = () => {
  const [clinic, setClinic] = useState(null); // Authenticated Clinic
  const [token, setToken] = useState(null); // JWT Token

  // State
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('dashboard');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newAppt, setNewAppt] = useState({ patientId: '', reason: '', date: '', time: '' });
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Νέο επείγον περιστατικό εντοπίστηκε από το AI.', time: '2 λεπτά πριν', type: 'URGENT' },
    { id: 2, text: 'Ο καθαρισμός του κ. Παπαδόπουλου επιβεβαιώθηκε.', time: '1 ώρα πριν', type: 'SUCCESS' },
    { id: 3, text: 'Χαμηλή βαθμολογία feedback εντοπίστηκε.', time: '3 ώρες πριν', type: 'WARNING' }
  ]);

  useEffect(() => {
    const savedToken = localStorage.getItem('clinic_token');
    const savedClinic = localStorage.getItem('clinic_data');
    if (savedToken && savedClinic) {
      setToken(savedToken);
      setClinic(JSON.parse(savedClinic));
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [token, currentTab]);

  const handleLogin = (loginData) => {
    const { token, clinic } = loginData;
    setToken(token);
    setClinic(clinic);
    localStorage.setItem('clinic_token', token);
    localStorage.setItem('clinic_data', JSON.stringify(clinic));
  };

  const handleLogout = () => {
    setToken(null);
    setClinic(null);
    localStorage.removeItem('clinic_token');
    localStorage.removeItem('clinic_data');
    setAppointments([]);
    setPatients([]);
  };

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [aptResp, patResp, notifResp] = await Promise.all([
        axios.get(`${API_BASE}/appointments`, { headers }),
        axios.get(`${API_BASE}/patients`, { headers }),
        axios.get(`${API_BASE}/notifications`, { headers })
      ]);
      setAppointments(aptResp.data);
      setPatients(patResp.data);

      // Map DB notifications to UI format
      const mappedNotifs = notifResp.data.map(n => ({
        id: n.id,
        text: n.message,
        time: new Date(n.createdAt).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
        type: n.type
      }));
      setNotifications(mappedNotifs);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (reason) => {
    if (reason.length < 5) return;
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
      fetchData();
    } catch (err) {
      alert("Σφάλμα κατά την κράτηση!");
    }
  };

  // If not logged in, show Login Screen
  if (!clinic) {
    return <ClinicLogin onLogin={handleLogin} />;
  }

  // Filter Logic for Dashboard
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const todayAppointments = appointments.filter(a => a.startTime.startsWith(todayStr));
  const upcomingAppointments = appointments
    .filter(a => new Date(a.startTime) >= new Date()) // Future only
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime)); // Nearest first

  const urgentCount = appointments.filter(a => a.priority === 'URGENT').length; // Keep global for now or filter by today? Let's keep global count of urgent.

  const renderContent = () => {
    if (loading && currentTab !== 'settings') return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <Clock className="animate-spin" size={48} color="var(--primary)" />
        <p>Φόρτωση δεδομένων...</p>
      </div>
    );

    switch (currentTab) {
      case 'dashboard':
        return (
          <>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '1.8rem', marginBottom: '4px' }}>
                  {new Date().getHours() < 12 ? '🌅 Καλημέρα' : new Date().getHours() < 18 ? '☀️ Καλησπέρα' : '🌙 Καλησπέρα'}, {clinic.name.split(' ')[0]}!
                </h1>
                <p style={{ color: '#64748b' }}>
                  Το σύστημα είναι <span style={{ color: '#22c55e', fontWeight: '600' }}>● Online</span> και παρακολουθεί τις ειδοποιήσεις.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)' }}>
                  {new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                  {new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
            </header>

            <div className="grid-dashboard" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem' }}>
              {/* Left Column: Stats & Upcoming */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <section className="stats-grid">
                  <div className="stat-card animate-fade" style={{ animationDelay: '0.1s' }}>
                    <div className="stat-icon" style={{ background: '#fef3c7' }}>
                      <Clock color="#d97706" />
                    </div>
                    <div className="stat-info">
                      <h4>Σημερινά Ραντεβού</h4>
                      <p>{todayAppointments.length}</p>
                    </div>
                  </div>
                  <div className="stat-card animate-fade" style={{ animationDelay: '0.2s' }}>
                    <div className="stat-icon" style={{ background: '#fee2e2' }}>
                      <AlertCircle color="#ef4444" />
                    </div>
                    <div className="stat-info">
                      <h4>Επείγοντα</h4>
                      <p>{urgentCount}</p>
                    </div>
                  </div>
                  <div className="stat-card animate-fade" style={{ animationDelay: '0.3s' }}>
                    <div className="stat-icon" style={{ background: '#e0f2fe' }}>
                      <TrendingUp color="#0284c7" />
                    </div>
                    <div className="stat-info">
                      <h4>Νέοι Ασθενείς</h4>
                      <p>{patients.length}</p>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="section-header">
                    <h2>📅 Επόμενα Ραντεβού</h2>
                    <button className="btn btn-outline" onClick={() => setCurrentTab('appointments')}>Προβολή όλων</button>
                  </div>
                  <div className="appointment-list">
                    {upcomingAppointments.length === 0 ? (
                      <p style={{ color: '#94a3b8', padding: '1rem', fontStyle: 'italic' }}>Κανένα μελλοντικό ραντεβού.</p>
                    ) : (
                      upcomingAppointments.slice(0, 3).map((apt, idx) => (
                        <div key={apt.id} className="appointment-card animate-fade" style={{ animationDelay: `${0.5 + idx * 0.1}s` }}>
                          <div className="apt-main">
                            <div className="apt-time">
                              <div className="hour">{new Date(apt.startTime).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}</div>
                              <div className="date">{new Date(apt.startTime).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })}</div>
                            </div>
                            <div className="apt-patient">
                              <h3>{apt.patient?.name}</h3>
                              <p>{apt.patient?.phone}</p>
                            </div>
                          </div>
                          <span className={`badge ${apt.priority === 'URGENT' ? 'badge-urgent' : 'badge-normal'}`}>
                            {apt.priority === 'URGENT' ? 'ΕΠΕΙΓΟΝ' : 'ΚΑΝΟΝΙΚΟ'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column: Live Activity Feed */}
              <div className="animate-fade" style={{ animationDelay: '0.4s' }}>
                <div className="section-header">
                  <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="status-pulse"></div> Live Activity
                  </h2>
                </div>
                <div className="activity-feed">
                  {notifications.length === 0 ? (
                    <p className="text-light">No content.</p>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} className="feed-item">
                        <div className="feed-time">{notif.time}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: '500', marginBottom: '2px', fontSize: '0.85rem' }}>{notif.text}</p>
                          <span style={{ fontSize: '0.75rem', color: notif.type === 'URGENT' ? 'var(--urgent)' : 'var(--primary)' }}>
                            {notif.type}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick Actions */}
                <div style={{ marginTop: '2rem' }}>
                  <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-light)' }}>ΓΡΗΓΟΡΕΣ ΕΝΕΡΓΕΙΕΣ</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ justifyContent: 'start' }} onClick={() => setShowModal(true)}>
                      <Plus size={16} /> Νέο Ραντεβού
                    </button>
                    <button className="btn btn-outline" style={{ justifyContent: 'start' }} onClick={() => setCurrentTab('patients')}>
                      <User size={16} /> Αναζήτηση Ασθενή
                    </button>
                    <button className="btn btn-outline" style={{ justifyContent: 'start' }} onClick={() => setCurrentTab('settings')}>
                      <Settings size={16} /> Ρυθμίσεις Vapi
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      case 'appointments':
        return (
          <section>
            <header>
              <h1>Πρόγραμμα Ραντεβού</h1>
              <p>Διαχείριση και ανασκόπηση όλων των προγραμματισμένων επισκέψεων.</p>
            </header>

            <div className="section-header">
              <h2>Όλα τα Ραντεβού</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input type="text" placeholder="Αναζήτηση..." style={{ padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }} />
                </div>
                <button className="btn btn-outline btn-icon"><Filter size={18} /></button>
              </div>
            </div>

            <div className="appointment-list">
              {appointments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                  <p>Δεν υπάρχουν προγραμματισμένα ραντεβού.</p>
                </div>
              ) : (
                appointments.map(apt => (
                  <div key={apt.id} className="appointment-card">
                    <div className="apt-main">
                      <div className="apt-time">
                        <div className="hour">
                          {new Date(apt.startTime).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="date">
                          {new Date(apt.startTime).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <div className="apt-patient">
                        <h3>{apt.patient?.name || 'Unknown'}</h3>
                        <p>{apt.patient?.phone}</p>
                      </div>
                      <div className="apt-reason" style={{ flex: 2 }}>
                        <p>{apt.reason}</p>
                        <div className="apt-ai" style={{ color: 'var(--primary)', fontWeight: '600' }}>AI: {apt.aiClassification}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                      <span className={`badge ${apt.priority === 'URGENT' ? 'badge-urgent' : 'badge-normal'}`}>
                        {apt.priority === 'URGENT' ? 'ΕΠΕΙΓΟΝ' : 'ΚΑΝΟΝΙΚΟ'}
                      </span>
                      <div className="apt-actions">
                        <button className="btn btn-outline btn-icon" title="Επιβεβαίωση"><CheckCircle size={18} /></button>
                        <button className="btn btn-outline btn-icon" title="Ακύρωση"><AlertCircle size={18} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        );
      case 'patients':
        return (
          <section>
            <header>
              <h1>Αρχείο Ασθενών</h1>
              <p>Λεπτομερές ιστορικό ασθενών και στοιχεία επικοινωνίας.</p>
            </header>
            <div className="appointment-list">
              {patients.map(p => (
                <div key={p.id} className="appointment-card">
                  <div className="apt-main">
                    <div className="stat-icon" style={{ background: 'var(--primary-light)' }}>
                      <User color="var(--primary)" />
                    </div>
                    <div className="apt-patient">
                      <h3>{p.name}</h3>
                      <p>{p.phone} • {p.email}</p>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                        Σύνολο Ραντεβού: {p.appointments?.length || 0}
                      </p>
                    </div>
                  </div>
                  <button className="btn btn-outline btn-icon" onClick={() => setCurrentTab('dashboard')}><Clock size={18} /></button>
                </div>
              ))}
            </div>
          </section>
        );
      case 'reports':
        const sentimentStats = appointments.reduce((acc, apt) => {
          apt.feedbacks?.forEach(f => {
            acc[f.sentiment || 'NEUTRAL'] = (acc[f.sentiment || 'NEUTRAL'] || 0) + 1;
          });
          return acc;
        }, { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 });

        const allFeedbacks = appointments
          .filter(a => a.feedbacks && a.feedbacks.length > 0)
          .flatMap(a => a.feedbacks.map(f => ({ ...f, patientName: a.patient?.name || 'Επισκέπτης' })));

        return (
          <section>
            <header>
              <h1>Αναφορές & Analytics</h1>
              <p>Ανάλυση ικανοποίησης ασθενών και απόδοσης ιατρείου.</p>
            </header>

            <div className="stats-grid">
              <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
                <div className="stat-info">
                  <h4>Θετικές Εμπειρίες</h4>
                  <p>{sentimentStats.POSITIVE}</p>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div className="stat-info">
                  <h4>Ουδέτερη Στάση</h4>
                  <p>{sentimentStats.NEUTRAL}</p>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                <div className="stat-info">
                  <h4>Προς Βελτίωση</h4>
                  <p>{sentimentStats.NEGATIVE}</p>
                </div>
              </div>
            </div>

            <div className="section-header" style={{ marginTop: '2rem' }}>
              <h2>Πρόσφατα Feedback (AI Sentiment)</h2>
            </div>

            <div className="appointment-list">
              {allFeedbacks.length > 0 ? (
                allFeedbacks.map(f => (
                  <div key={f.id} className="appointment-card">
                    <div className="apt-main">
                      <div className="stat-icon" style={{
                        background: f.sentiment === 'POSITIVE' ? '#dcfce7' : f.sentiment === 'NEGATIVE' ? '#fee2e2' : '#f3f4f6'
                      }}>
                        <ClipboardList color={f.sentiment === 'POSITIVE' ? '#10b981' : f.sentiment === 'NEGATIVE' ? '#ef4444' : '#64748b'} />
                      </div>
                      <div className="apt-patient">
                        <h3>{f.patientName}</h3>
                        <p>"{f.comment}"</p>
                      </div>
                    </div>
                    <span className={`badge ${f.sentiment === 'POSITIVE' ? 'badge-normal' : f.sentiment === 'NEGATIVE' ? 'badge-urgent' : ''}`}>
                      {f.sentiment || 'NEUTRAL'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="appointment-card" style={{ padding: '3rem', textAlign: 'center', background: 'white' }}>
                  <p>Δεν υπάρχουν ακόμα δεδομένα feedback.</p>
                </div>
              )}
            </div>
          </section>
        );
      case 'settings':
        return <ClinicSettings clinic={clinic} token={token} onUpdate={(updated) => setClinic({ ...clinic, ...updated })} />;
      default:
        return <div>Σε κατασκευή...</div>;
    }
  };

  return (
    <div className="layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo">
          <div style={{ background: 'var(--primary)', padding: '6px', borderRadius: '8px' }}>
            <ClipboardList color="white" size={24} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span>ClinicFlow</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '400', opacity: 0.8, background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px' }}>SaaS Pro</span>
          </div>
        </div>

        <div style={{ padding: '0 12px 20px 12px' }}>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowModal(true)}>
            <Plus size={18} /> Νέο Ραντεβού
          </button>
        </div>

        <nav>
          <a href="#" className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentTab('dashboard'); }}>
            <LayoutDashboard /> Dashboard
          </a>
          <a href="#" className={`nav-link ${currentTab === 'appointments' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentTab('appointments'); }}>
            <Calendar /> Ραντεβού
          </a>
          <a href="#" className={`nav-link ${currentTab === 'patients' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentTab('patients'); }}>
            <Users /> Ασθενείς
          </a>
          <a href="#" className={`nav-link ${currentTab === 'reports' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentTab('reports'); }}>
            <TrendingUp /> Αναφορές
          </a>
          <a href="#" className={`nav-link ${currentTab === 'settings' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentTab('settings'); }}>
            <Settings /> Ρυθμίσεις
          </a>
        </nav>

        <div style={{ marginTop: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="user-profile">
            <div className="avatar">{clinic.name[0]}</div>
            <div className="info">
              <div className="name">{clinic.name}</div>
              <div className="role">Admin</div>
            </div>
            <button className="btn-icon-sm" onClick={handleLogout} title="Αποσύνδεση">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {renderContent()}
      </main>

      {/* New Appointment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="appointment-card" style={{ width: '500px', flexDirection: 'column', gap: '1rem', padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem' }}>Νέο Ραντεβού</h2>
              <button className="btn btn-outline btn-icon" onClick={() => setShowModal(false)}><Plus style={{ transform: 'rotate(45deg)' }} /></button>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '4px' }}>Ασθενής</label>
              <select
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                value={newAppt.patientId}
                onChange={e => setNewAppt({ ...newAppt, patientId: e.target.value })}
              >
                <option value="">Επιλέξτε ασθενή...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '4px' }}>Αιτία</label>
              <textarea
                placeholder="Περιγράψτε το πρόβλημα..."
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '80px' }}
                value={newAppt.reason}
                onChange={e => {
                  setNewAppt({ ...newAppt, reason: e.target.value });
                  if (e.target.value.length > 10) handleAnalyze(e.target.value);
                }}
              />
              {analyzing && <p style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Ανάλυση AI...</p>}
              {analysis && (
                <div style={{ marginTop: '8px', padding: '8px', background: 'var(--primary-light)', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle size={16} color={analysis.priority === 'URGENT' ? 'var(--urgent)' : 'var(--primary)'} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: '600' }}>
                    {analysis.priority === 'URGENT' ? 'ΕΠΕΙΓΟΝ' : 'ΚΑΝΟΝΙΚΟ'}: {analysis.greekSummary}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '4px' }}>Ημερομηνία</label>
                <input type="date" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} value={newAppt.date} onChange={e => setNewAppt({ ...newAppt, date: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '4px' }}>Ώρα</label>
                <input type="time" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} value={newAppt.time} onChange={e => setNewAppt({ ...newAppt, time: e.target.value })} />
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleBook} disabled={!newAppt.patientId || !newAppt.reason || !newAppt.date || !newAppt.time}>
              Καταχώρηση Ραντεβού
            </button>
          </div>
        </div>
      )}
      <style>{`
        .user-profile {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            background: rgba(0,0,0,0.03);
            border-radius: 12px;
        }
        .user-profile .avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
        }
        .user-profile .info {
            flex: 1;
            overflow: hidden;
        }
        .user-profile .name {
            font-size: 0.85rem;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .user-profile .role {
            font-size: 0.75rem;
            color: var(--text-light);
        }
        .btn-icon-sm {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            color: var(--text-light);
        }
        .btn-icon-sm:hover {
            background: rgba(0,0,0,0.05);
            color: var(--danger);
        }
      `}</style>
    </div>
  );
};

export default App;
