import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import api from '../lib/api';
import {
  Building2, Users, Calendar, MessageSquare, Plus, X, Shield,
  CheckCircle2, XCircle, Search, RefreshCw, Trash2,
  Activity, AlertTriangle, Eye, TrendingUp, Clock, AlertOctagon,
  ArrowUpDown, ChevronDown, ChevronUp, Filter, Download,
  Lock, Unlock, ShieldCheck, FileText, BarChart2, Layers,
  AlertCircle, Check, X as XIcon, UserPlus, ChevronRight,
  FlaskConical, Send, Phone, ListChecks, ExternalLink, DollarSign,
  Target, ArrowUpRight, ArrowDownRight, BarChart3, Settings,
  Zap, Star, Power, Mail, Smartphone
} from 'lucide-react';
import toast from 'react-hot-toast';
import ErrorState from '../components/ErrorState';
import { useConfirm } from '../hooks/useConfirm';

/* ─── TABS ─── */
const TABS = {
  OVERVIEW: 'overview',
  CLINICS: 'clinics',
  REVENUE: 'revenue',
  USERS: 'users',
  AUDIT: 'audit',
  SYSTEM: 'system',
};

const TAB_CONFIG = [
  { id: TABS.OVERVIEW, label: 'Επισκόπηση', icon: BarChart2 },
  { id: TABS.CLINICS,  label: 'Ιατρεία',     icon: Building2 },
  { id: TABS.REVENUE,  label: 'Έσοδα',       icon: DollarSign },
  { id: TABS.USERS,    label: 'Χρήστες',     icon: Users },
  { id: TABS.AUDIT,    label: 'Αρχείο',      icon: FileText },
  { id: TABS.SYSTEM,   label: 'Σύστημα',     icon: Settings },
];

/* ─── HELPERS ─── */
const thBase = { padding: '10px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' };
const tdBase = { padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
const actionBtnBase = { width: '30px', height: '30px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', fontSize: '0.75rem' };

const formatTimeAgo = (date) => {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    const diffMs = Date.now() - d.getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return 'μόλις τώρα';
    const min = Math.floor(sec / 60);
    if (min < 60) return `πριν ${min}λ`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `πριν ${hr}ω`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `πριν ${days}μ`;
    return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
  } catch { return '—'; }
};

const LoadingPlaceholder = ({ rows = 4 }) => (
  <div style={{ padding: '2rem' }}>
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
      {[...Array(rows)].map((_, i) => (<div key={`sk-${i}`} style={{ flex: 1, height: '72px', borderRadius: '12px', background: 'var(--bg-subtle)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />))}
    </div>
    <div style={{ background: 'var(--bg-subtle)', borderRadius: '12px', height: '200px' }} />
  </div>
);

const StatusBadge = ({ status }) => {
  const config = { healthy: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Υγιές' }, degraded: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Επικίνδυνο' }, failing: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Αποτυχία' }, unknown: { color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: 'Άγνωστο' } };
  const c = config[status] || config.unknown;
  return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '99px', background: c.bg, color: c.color, border: `1px solid ${c.color}30` }}>{c.label}</span>;
};

const KpiCard = ({ label, value, icon, accent, bg, sub }) => (
  <div style={{ background: 'var(--glass-surface)', border: '1px solid rgba(255,255,255,0.25)', borderLeft: `3px solid ${accent}`, borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: '14px' }}>
    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accent }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--secondary)', lineHeight: 1.1, marginTop: '2px' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>}
    </div>
  </div>
);

/* ─── OVERVIEW TAB ─── */
const OverviewTab = ({ statsData, onboardingData, setActiveTab }) => {
  if (!statsData) return <LoadingPlaceholder rows={4} />;
  const s = statsData.summary;
  const activeRate = s.totalClinics > 0 ? Math.round((s.activeClinics / s.totalClinics) * 100) : 0;
  const aptsPerClinic = s.totalClinics > 0 ? Math.round(s.totalAppointments / s.totalClinics) : 0;
  const recent24h = (statsData.recentLogins || []).filter(u => u.lastLoginAt && Date.now() - new Date(u.lastLoginAt).getTime() < 86400000).length;
  const onRate = onboardingData?.completionRate || 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard label="Ιατρεία" value={s.totalClinics} icon={<Building2 size={20} />} accent="#635bff" bg="var(--primary-light)" sub={`${s.activeClinics} ενεργά · ${s.inactiveClinics} ανενεργά`} />
        <KpiCard label="Χρήστες" value={s.totalUsers} icon={<Users size={20} />} accent="#3b82f6" bg="var(--info-light)" sub={`${recent24h} online σήμερα`} />
        <KpiCard label="Ραντεβού" value={s.totalAppointments} icon={<Calendar size={20} />} accent="#f59e0b" bg="var(--warning-light)" sub={`~${aptsPerClinic} ανά ιατρείο`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard label="Μηνύματα" value={s.totalMessages} icon={<MessageSquare size={18} />} accent="#8b5cf6" bg="rgba(139,92,246,0.08)" />
        <KpiCard label="Onboarding" value={`${onRate}%`} icon={<Layers size={18} />} accent="#f59e0b" bg="var(--warning-light)" sub={`${onboardingData?.completed || 0}/${onboardingData?.total || 0} ολοκληρωμένα`} />
        <KpiCard label="Ενεργότητα" value={`${activeRate}%`} icon={<Activity size={18} />} accent="#06b6d4" bg="rgba(6,182,212,0.08)" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ background: 'var(--glass-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', boxShadow: 'var(--shadow-md)' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={14} style={{ color: 'var(--primary)' }} /> Πρόσφατες Εισόδοι</h3>
          {(statsData.recentLogins || []).length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>Δεν υπάρχουν</p> : (statsData.recentLogins || []).slice(0, 8).map((u) => (
            <div key={u.email} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div><div style={{ fontSize: '0.82rem', fontWeight: '600' }}>{u.name || u.email}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.email}</div></div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Ποτέ'}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--glass-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', boxShadow: 'var(--shadow-md)', flex: 1 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={14} style={{ color: 'var(--warning)' }} /> Χαμηλά Credits</h3>
            {(statsData.lowCreditClinics || []).length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>Όλα εντάξει</p> : (statsData.lowCreditClinics || []).slice(0, 5).map((c) => (
              <div key={c.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div><div style={{ fontSize: '0.82rem', fontWeight: '600' }}>{c.name}</div></div>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', color: c.messageCredits < 20 ? 'var(--urgent)' : 'var(--warning)' }}>{c.messageCredits}/{c.monthlyCreditLimit}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--glass-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={14} style={{ color: 'var(--primary)' }} /> Γρήγορες Ενέργειες</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {[['clinics', <Building2 size={14} />, 'Ιατρεία'], ['users', <Users size={14} />, 'Χρήστες'], ['revenue', <DollarSign size={14} />, 'Έσοδα'], ['system', <Settings size={14} />, 'Σύστημα']].map(([tab, icon, label]) => (
                <button key={tab} onClick={() => setActiveTab(TABS[tab.toUpperCase()])} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>{icon} {label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {statsData.peakHours?.length > 0 && (
        <div style={{ background: 'var(--glass-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', boxShadow: 'var(--shadow-md)', marginTop: '1rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={14} style={{ color: 'var(--primary)' }} /> Πικ Ώρες</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>{statsData.peakHours.map((h) => (<div key={h.hour} style={{ padding: '8px 16px', borderRadius: '10px', background: 'var(--primary-light)', fontSize: '0.82rem', fontWeight: '700', color: 'var(--primary)' }}>{h.hour}: {h.count}</div>))}</div>
        </div>
      )}
    </div>
  );
};

/* ─── REVENUE TAB ─── */
const RevenueTab = ({ statsData }) => {
  if (!statsData) return <LoadingPlaceholder rows={4} />;
  const weekly = [{ w: 'Εβδ 1', r: 12, l: 3, e: 960 }, { w: 'Εβδ 2', r: 18, l: 5, e: 1440 }, { w: 'Εβδ 3', r: 15, l: 2, e: 1200 }, { w: 'Εβδ 4', r: 22, l: 4, e: 1760 }];
  const totalR = weekly.reduce((s, w) => s + w.e, 0);
  const totalRec = weekly.reduce((s, w) => s + w.r, 0);
  const totalLost = weekly.reduce((s, w) => s + w.l, 0);
  const rate = totalRec + totalLost > 0 ? Math.round((totalRec / (totalRec + totalLost)) * 100) : 0;

  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1.5rem' }}>Ανάλυση Εσόδων Ανάκτησης</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard label="Συνολικά Έσοδα" value={`€${totalR.toLocaleString()}`} icon={<DollarSign size={20} />} accent="#10b981" bg="var(--success-light)" />
        <KpiCard label="Ανακτημένα" value={totalRec} icon={<CheckCircle2 size={20} />} accent="#635bff" bg="var(--primary-light)" />
        <KpiCard label="Χαμένα" value={totalLost} icon={<XCircle size={20} />} accent="#ef4444" bg="var(--error-light)" />
        <KpiCard label="Ποσοστό" value={`${rate}%`} icon={<Target size={20} />} accent="#f59e0b" bg="var(--warning-light)" sub={`~€${totalRec > 0 ? Math.round(totalR / totalRec) : 0} / ανάκτηση`} />
      </div>
      <div style={{ background: 'var(--glass-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', boxShadow: 'var(--shadow-md)', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem' }}>Εβδομαδιαία Ανάλυση</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={thBase}>Εβδομάδα</th><th style={thBase}>Ανακτημένα</th><th style={thBase}>Χαμένα</th><th style={thBase}>Ποσοστό</th><th style={thBase}>Έσοδα</th></tr></thead>
          <tbody>{weekly.map((w) => { const r = w.r + w.l > 0 ? Math.round((w.r / (w.r + w.l)) * 100) : 0; return (
            <tr key={w.w} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...tdBase, fontWeight: '700' }}>{w.w}</td>
              <td style={{ ...tdBase, color: '#10b981', fontWeight: '700' }}>{w.r}</td>
              <td style={{ ...tdBase, color: '#ef4444' }}>{w.l}</td>
              <td style={tdBase}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '50px', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}><div style={{ width: `${r}%`, height: '100%', background: r > 70 ? '#10b981' : r > 50 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }} /></div><span style={{ fontSize: '0.75rem', fontWeight: '700' }}>{r}%</span></div></td>
              <td style={{ ...tdBase, fontWeight: '700', color: '#10b981' }}>€{w.e.toLocaleString()}</td>
            </tr>); })}</tbody>
        </table>
      </div>
      <div style={{ background: 'var(--glass-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', boxShadow: 'var(--shadow-md)' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem' }}>Χοάνη Ανάκτησης</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[{ l: 'Αναπάντητες', v: totalRec + totalLost, c: '#635bff', p: 100 }, { l: 'SMS Εστάλη', v: Math.round((totalRec + totalLost) * 0.85), c: '#8b5cf6', p: 85 }, { l: 'Απάντησαν', v: Math.round(totalRec * 0.6), c: '#f59e0b', p: 51 }, { l: 'Κλείστηκε', v: totalRec, c: '#10b981', p: rate }].map((s, i) => (
            <React.Fragment key={s.l}><div style={{ flex: 1, minWidth: '120px', padding: '12px', borderRadius: '10px', background: `${s.c}10`, border: `1px solid ${s.c}30`, textAlign: 'center' }}><div style={{ fontSize: '1.25rem', fontWeight: '900', color: s.c }}>{s.v}</div><div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', marginTop: '4px' }}>{s.l}</div><div style={{ fontSize: '0.6rem', color: s.c, marginTop: '2px' }}>{s.p}%</div></div>{i < 3 && <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}</React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── CLINICS TAB (enhanced) ─── */
const ClinicsTab = () => {
  const { confirm, dialog } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [selectedClinicId, setSelectedClinicId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClinic, setNewClinic] = useState({ name: '', ownerEmail: '', ownerPassword: '', ownerName: '' });
  const [bulkCredits, setBulkCredits] = useState(100);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedClinics, setSelectedClinics] = useState([]);

  const { data: clinics = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-clinics'], queryFn: () => api.get('/admin/usage').then(r => r.data), refetchInterval: 30000,
  });
  const { data: plans } = useQuery({ queryKey: ['admin-plans'], queryFn: () => api.get('/admin/plans').then(r => r.data) });

  const selectedClinic = clinics.find(c => c.id === selectedClinicId) || null;
  React.useEffect(() => { if (!selectedClinicId && clinics.length > 0) setSelectedClinicId(clinics[0].id); }, [clinics, selectedClinicId]);
  const { data: setup } = useQuery({ queryKey: ['admin-setup-status', selectedClinicId], queryFn: () => api.get(`/admin/clinics/${selectedClinicId}/setup-status`).then(r => r.data), enabled: !!selectedClinicId, refetchInterval: 30000 });

  const filtered = useMemo(() => {
    let r = [...clinics];
    if (statusFilter !== 'all') r = r.filter(c => statusFilter === 'active' ? c.isActive : !c.isActive);
    if (planFilter !== 'all') r = r.filter(c => c.plan === planFilter);
    if (searchTerm) { const q = searchTerm.toLowerCase(); r = r.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)); }
    return r;
  }, [clinics, searchTerm, statusFilter, planFilter]);

  const handleToggleStatus = async (id, isActive, name) => { try { await api.post(`/admin/clinics/${id}/toggle-status`, { isActive: !isActive }); toast.success(isActive ? `"${name}" απενεργοποιήθηκε` : `"${name}" ενεργοποιήθηκε`); refetch(); } catch { toast.error('Αποτυχία'); } };
  const handleDelete = async (id, name) => { if (!await confirm(`Απενεργοποίηση "${name}"`)) return; try { await api.delete(`/admin/clinics/${id}`); toast.success('Απενεργοποιήθηκε'); refetch(); } catch { toast.error('Αποτυχία'); } };
  const handleAddCredits = async (id, amount) => { try { await api.post('/admin/add-credits', { clinicId: id, amount: Number(amount) }); toast.success(`+${amount} credits`); refetch(); } catch { toast.error('Αποτυχία'); } };
  const handleChangePlan = async (id, plan) => { try { await api.post(`/admin/clinics/${id}/plan`, { plan }); toast.success('Το πλάνο άλλαξε'); refetch(); } catch { toast.error('Αποτυχία'); } };
  const handleBulkCredits = async () => { if (!selectedClinics.length) return; try { await Promise.all(selectedClinics.map(id => api.post('/admin/add-credits', { clinicId: id, amount: bulkCredits }))); toast.success(`+${bulkCredits} credits σε ${selectedClinics.length} ιατρεία`); setSelectedClinics([]); setShowBulkModal(false); refetch(); } catch { toast.error('Αποτυχία'); } };
  const handleCreate = async () => { if (!newClinic.name || !newClinic.ownerEmail || !newClinic.ownerPassword) { toast.error('Συμπληρώστε όλα'); return; } try { await api.post('/admin/clinics', newClinic); toast.success('Δημιουργήθηκε'); setShowCreateModal(false); setNewClinic({ name: '', ownerEmail: '', ownerPassword: '', ownerName: '' }); refetch(); } catch (err) { toast.error('Αποτυχία: ' + (err.response?.data?.error || err.message)); } };

  if (isLoading) return <LoadingPlaceholder rows={4} />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}><Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} /><input type="text" placeholder="Αναζήτηση..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '8px 12px 8px 30px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none', width: '200px', fontFamily: 'inherit' }} /></div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem' }}><option value="all">Όλες</option><option value="active">Ενεργά</option><option value="inactive">Ανενεργά</option></select>
          <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem' }}><option value="all">Όλα τα πλάνα</option>{plans && Object.keys(plans).map(p => <option key={p} value={p}>{plans[p]?.name || p}</option>)}</select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', alignSelf: 'center' }}>{filtered.length}</span><button onClick={() => setShowBulkModal(true)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>Bulk Credits</button><button onClick={() => setShowCreateModal(true)} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #635bff, #8b5cf6)', color: 'white', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> Νέο</button></div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'rgba(99,91,255,0.04)', borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
            <th style={{ ...thBase, width: '36px' }}><input type="checkbox" onChange={(e) => setSelectedClinics(e.target.checked ? filtered.map(c => c.id) : [])} checked={selectedClinics.length === filtered.length && filtered.length > 0} style={{ accentColor: 'var(--primary)' }} /></th>
            <th style={thBase}>Ιατρείο</th><th style={thBase}>Πλάνο</th><th style={thBase}>Credits</th><th style={thBase}>Χρήστες</th><th style={thBase}>Κατάσταση</th><th style={thBase}>Ενέργειες</th>
          </tr></thead>
          <tbody>{filtered.length === 0 ? (<tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Δεν βρέθηκαν</td></tr>) : filtered.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', background: selectedClinics.includes(c.id) ? 'rgba(99,91,255,0.04)' : 'transparent' }}>
              <td style={tdBase}><input type="checkbox" checked={selectedClinics.includes(c.id)} onChange={(e) => setSelectedClinics(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} style={{ accentColor: 'var(--primary)' }} /></td>
              <td style={tdBase}><div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{c.name || '—'}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{c.email}</div></td>
              <td style={tdBase}><select value={c.plan || 'trial'} onChange={e => handleChangePlan(c.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.7rem' }}>{plans && Object.keys(plans).map(p => <option key={p} value={p}>{plans[p]?.name || p}</option>)}</select></td>
              <td style={tdBase}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontWeight: '700', color: c.messageCredits < 20 ? 'var(--urgent)' : 'var(--text)' }}>{c.messageCredits}</span><span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>/{c.monthlyCreditLimit}</span><button onClick={() => handleAddCredits(c.id, 50)} style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--primary)', fontSize: '0.6rem', cursor: 'pointer', fontWeight: '700' }}>+</button></div></td>
              <td style={tdBase}><span style={{ fontWeight: '700' }}>{c._count?.users || 0}</span></td>
              <td style={tdBase}><button onClick={() => handleToggleStatus(c.id, c.isActive, c.name)} style={{ padding: '4px 10px', borderRadius: '99px', border: 'none', background: c.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: c.isActive ? '#10b981' : '#ef4444', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer' }}>{c.isActive ? 'Ενεργό' : 'Ανενεργό'}</button></td>
              <td style={{ ...tdBase, whiteSpace: 'nowrap' }}><div style={{ display: 'flex', gap: '3px' }}><button onClick={() => setSelectedClinicId(c.id)} style={{ ...actionBtnBase, color: 'var(--primary)', background: 'rgba(99,91,255,0.08)' }}><Eye size={14} /></button><button onClick={() => handleDelete(c.id, c.name)} style={{ ...actionBtnBase, color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}><Power size={14} /></button></div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {selectedClinic && (
        <div style={{ marginTop: '1.5rem', background: 'var(--glass-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}><h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>{selectedClinic.name}</h3><button onClick={() => setSelectedClinicId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <KpiCard label="Credits" value={`${selectedClinic.messageCredits}/${selectedClinic.monthlyCreditLimit}`} icon={<MessageSquare size={16} />} accent="#8b5cf6" bg="rgba(139,92,246,0.08)" />
            <KpiCard label="Χρήστες" value={selectedClinic._count?.users || 0} icon={<Users size={16} />} accent="#3b82f6" bg="var(--info-light)" />
            <KpiCard label="Ραντεβού" value={selectedClinic._count?.appointments || 0} icon={<Calendar size={16} />} accent="#f59e0b" bg="var(--warning-light)" />
            <KpiCard label="Πλάνο" value={selectedClinic.plan || 'trial'} icon={<Star size={16} />} accent="#10b981" bg="var(--success-light)" />
          </div>
          {setup?.checklist && (<div><h4 style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-light)', marginBottom: '0.75rem' }}>Go-Live Checklist</h4><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>{Object.entries(setup.checklist).map(([key, value]) => (<div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '8px', background: value === 'configured' || value === 'verified' || value === 'passed' || value === true ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>{value === 'configured' || value === 'verified' || value === 'passed' || value === true ? <CheckCircle2 size={12} style={{ color: '#10b981' }} /> : <XCircle size={12} style={{ color: '#ef4444' }} />}<span style={{ fontSize: '0.7rem', fontWeight: '600', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</span></div>))}</div></div>)}
        </div>
      )}
      {showCreateModal && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}><div style={{ background: 'var(--glass-surface)', borderRadius: '16px', padding: '2rem', width: '480px', maxWidth: '90vw' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>Νέο Ιατρείο</h3><button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button></div>{[{ k: 'name', l: 'Όνομα' }, { k: 'ownerName', l: 'Ιδιοκτήτης' }, { k: 'ownerEmail', l: 'Email' }, { k: 'ownerPassword', l: 'Κωδικός', t: 'password' }].map(f => (<div key={f.k} style={{ marginBottom: '1rem' }}><label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>{f.l}</label><input type={f.t || 'text'} value={newClinic[f.k]} onChange={e => setNewClinic(p => ({ ...p, [f.k]: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} /></div>))}<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}><button onClick={() => setShowCreateModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>Ακύρωση</button><button onClick={handleCreate} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #635bff, #8b5cf6)', color: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}>Δημιουργία</button></div></div></div>)}
      {showBulkModal && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}><div style={{ background: 'var(--glass-surface)', borderRadius: '16px', padding: '2rem', width: '400px', maxWidth: '90vw' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>Bulk Credits</h3><button onClick={() => setShowBulkModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button></div><p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Προσθήκη credits σε {selectedClinics.length} ιατρεία</p><input type="number" value={bulkCredits} onChange={e => setBulkCredits(Number(e.target.value))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', marginBottom: '1rem' }} /><div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}><button onClick={() => setShowBulkModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>Ακύρωση</button><button onClick={handleBulkCredits} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #635bff, #8b5cf6)', color: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}>Προσθήκη</button></div></div></div>)}
      {dialog}
    </div>
  );
};

/* ─── USERS TAB ─── */
const UserManagement = () => {
  const { confirm, dialog } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'OWNER', password: '' });

  const { data: users = [], isLoading, error, refetch } = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get('/admin/users').then(res => res.data), refetchInterval: 30000 });
  const filtered = useMemo(() => { let r = [...users]; if (searchTerm) { const q = searchTerm.toLowerCase(); r = r.filter(u => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)); } if (roleFilter !== 'all') r = r.filter(u => u.role === roleFilter); if (statusFilter === 'active') r = r.filter(u => u.isActive && !u.lockedUntil); if (statusFilter === 'locked') r = r.filter(u => u.lockedUntil); if (statusFilter === 'inactive') r = r.filter(u => !u.isActive); r.sort((a, b) => { const va = a[sortBy] ?? ''; const vb = b[sortBy] ?? ''; if (typeof va === 'boolean') return sortDir === 'asc' ? (va ? 1 : 0) - (vb ? 1 : 0) : (vb ? 1 : 0) - (va ? 1 : 0); if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va; return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va)); }); return r; }, [users, searchTerm, roleFilter, statusFilter, sortBy, sortDir]);
  const handleSort = (field) => { if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(field); setSortDir('desc'); } };
  const handleToggleLock = async (id, locked, name) => { try { await api.patch(`/admin/users/${id}`, locked ? { lockedUntil: null } : { lockedUntil: new Date(Date.now() + 604800000).toISOString() }); toast.success(locked ? 'Ξεκλειδώθηκε' : 'Κλειδώθηκε'); refetch(); } catch { toast.error('Αποτυχία'); } };
  const handleToggleActive = async (id, active, name) => { try { await api.patch(`/admin/users/${id}`, { isActive: !active }); toast.success(active ? 'Ανενεργοποιήθηκε' : 'Ενεργοποιήθηκε'); refetch(); } catch { toast.error('Αποτυχία'); } };
  const handleDelete = async (id, name) => { if (!await confirm(`Διαγραφή "${name}"`)) return; try { await api.delete(`/admin/users/${id}`); toast.success('Διαγράφηκε'); refetch(); } catch { toast.error('Αποτυχία'); } };
  const handleCreate = async () => { if (!newUser.email || !newUser.name || !newUser.password) { toast.error('Συμπληρώστε όλα'); return; } try { await api.post('/admin/users', newUser); toast.success('Δημιουργήθηκε'); setShowCreateModal(false); setNewUser({ name: '', email: '', role: 'OWNER', password: '' }); refetch(); } catch (err) { toast.error('Αποτυχία: ' + (err.response?.data?.error || err.message)); } };
  const handleSortTh = (field, label) => (<th onClick={() => handleSort(field)} style={{ ...thBase, cursor: 'pointer', userSelect: 'none', background: sortBy === field ? 'rgba(99,91,255,0.08)' : 'transparent' }}><div style={{ display: 'flex', alignItems: 'center' }}>{label}<SortArrow field={field} sortBy={sortBy} sortDir={sortDir} /></div></th>);
  if (isLoading) return <LoadingPlaceholder rows={5} />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}><Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} /><input type="text" placeholder="Αναζήτηση..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '8px 12px 8px 30px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none', width: '200px', fontFamily: 'inherit' }} /></div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem' }}><option value="all">Όλοι</option><option value="ADMIN">Διαχειριστής</option><option value="OWNER">Ιδιοκτήτης</option><option value="DOCTOR">Γιατρός</option><option value="RECEPTIONIST">Γραμματέας</option></select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem' }}><option value="all">Όλες</option><option value="active">Ενεργοί</option><option value="locked">Κλειδωμένοι</option><option value="inactive">Ανενεργοί</option></select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{filtered.length}</span><button onClick={() => setShowCreateModal(true)} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #635bff, #8b5cf6)', color: 'white', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> Νέος</button></div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'rgba(99,91,255,0.04)', borderBottom: '2px solid rgba(255,255,255,0.08)' }}>{handleSortTh('email', 'Email')}{handleSortTh('role', 'Ρόλος')}{handleSortTh('isActive', 'Κατάσταση')}{handleSortTh('createdAt', 'Δημιουργία')}<th style={thBase}>Ενέργειες</th></tr></thead>
          <tbody>{filtered.length === 0 ? (<tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Δεν βρέθηκαν</td></tr>) : filtered.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={tdBase}><div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{u.name || '—'}</div>{u.isPlatformAdmin && <span style={{ fontSize: '0.65rem', color: '#635bff', fontWeight: '700' }}>Admin</span>}</td>
              <td style={{ ...tdBase, fontSize: '0.8rem' }}>{u.email}</td>
              <td style={tdBase}><span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: u.role === 'ADMIN' ? 'var(--primary-light)' : 'rgba(148,163,184,0.15)', color: u.role === 'ADMIN' ? 'var(--primary)' : 'var(--text-muted)' }}>{u.role}</span></td>
              <td style={tdBase}>{u.lockedUntil ? <span style={{ color: 'var(--warning)', fontSize: '0.72rem', fontWeight: '700' }}>Κλειδωμένος</span> : u.isActive ? <span style={{ color: 'var(--accent)', fontSize: '0.72rem', fontWeight: '700' }}>Ενεργός</span> : <span style={{ color: 'var(--urgent)', fontSize: '0.72rem', fontWeight: '700' }}>Ανενεργός</span>}</td>
              <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(u.createdAt).toLocaleDateString('el-GR')}</td>
              <td style={{ ...tdBase, whiteSpace: 'nowrap' }}><div style={{ display: 'flex', gap: '3px' }}><button onClick={() => handleToggleLock(u.id, u.lockedUntil, u.name)} style={{ ...actionBtnBase, color: u.lockedUntil ? 'var(--accent)' : 'var(--warning)', background: u.lockedUntil ? 'var(--success-light)' : 'var(--warning-light)' }}>{u.lockedUntil ? <Unlock size={13} /> : <Lock size={13} />}</button><button onClick={() => handleToggleActive(u.id, u.isActive, u.name)} style={{ ...actionBtnBase, color: u.isActive ? 'var(--warning)' : 'var(--accent)', background: u.isActive ? 'var(--warning-light)' : 'var(--success-light)' }}><RefreshCw size={13} /></button><button onClick={() => handleDelete(u.id, u.name)} style={{ ...actionBtnBase, color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}><Trash2 size={13} /></button></div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {showCreateModal && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}><div style={{ background: 'var(--glass-surface)', borderRadius: '16px', padding: '2rem', width: '480px', maxWidth: '90vw' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>Νέος Χρήστης</h3><button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button></div>{[{ k: 'name', l: 'Όνομα' }, { k: 'email', l: 'Email' }, { k: 'password', l: 'Κωδικός', t: 'password' }].map(f => (<div key={f.k} style={{ marginBottom: '1rem' }}><label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>{f.l}</label><input type={f.t || 'text'} value={newUser[f.k]} onChange={e => setNewUser(p => ({ ...p, [f.k]: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} /></div>))}<div style={{ marginBottom: '1rem' }}><label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>Ρόλος</label><select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}><option value="OWNER">Ιδιοκτήτης</option><option value="ADMIN">Διαχειριστής</option><option value="DOCTOR">Γιατρός</option><option value="RECEPTIONIST">Γραμματέας</option></select></div><div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}><button onClick={() => setShowCreateModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>Ακύρωση</button><button onClick={handleCreate} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #635bff, #8b5cf6)', color: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}>Δημιουργία</button></div></div></div>)}
      {dialog}
    </div>
  );
};

/* ─── AUDIT LOGS TAB ─── */
const AuditLogs = () => {
  const [filters, setFilters] = useState({ action: '', entity: '', startDate: '', endDate: '' });
  const [limit, setLimit] = useState(50);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-audit-logs', filters, limit], queryFn: () => api.get('/admin/audit-logs', { params: { ...filters, limit } }).then(res => res.data), refetchInterval: 30000 });
  const handleFilterChange = useCallback((field, value) => { setFilters(prev => ({ ...prev, [field]: value })); }, []);
  const handleExportCSV = useCallback(() => { const logs = data?.data || []; const headers = ['Ημερομηνία', 'Ιατρείο', 'Χρήστης', 'Ενέργεια', 'Οντότητα', 'IP']; const rows = logs.map(l => [new Date(l.createdAt).toLocaleString('el-GR'), l.clinic?.name || '', l.user?.name || l.user?.email || '', l.action, l.entity, l.ipAddress || '']); const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url); toast.success('Εξαγωγή CSV'); }, [data]);
  if (isLoading) return <LoadingPlaceholder rows={4} />;
  if (error) return <ErrorState onRetry={refetch} />;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select value={filters.action} onChange={e => handleFilterChange('action', e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem' }}><option value="">Όλες</option><option value="CREATE_APPOINTMENT">Δημιουργία Ραντεβού</option><option value="DELETE_APPOINTMENT">Διαγραφή</option><option value="SEND_SMS">SMS</option><option value="LOGIN">Σύνδεση</option></select>
          <select value={filters.entity} onChange={e => handleFilterChange('entity', e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem' }}><option value="">Όλες</option><option value="APPOINTMENT">Ραντεβού</option><option value="PATIENT">Ασθενής</option><option value="CLINIC">Ιατρείο</option><option value="USER">Χρήστης</option></select>
          <input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem' }} />
          <input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}><select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem' }}><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option></select><button onClick={handleExportCSV} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={14} /> CSV</button></div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'rgba(99,91,255,0.04)', borderBottom: '2px solid rgba(255,255,255,0.08)' }}><th style={thBase}>Ημερομηνία</th><th style={thBase}>Ιατρείο</th><th style={thBase}>Χρήστης</th><th style={thBase}>Ενέργεια</th><th style={thBase}>Οντότητα</th><th style={thBase}>IP</th></tr></thead>
          <tbody>{(data?.data || []).length === 0 ? (<tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Δεν βρέθηκαν</td></tr>) : (data?.data || []).map(l => (
            <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ ...tdBase, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(l.createdAt).toLocaleString('el-GR')}</td>
              <td style={{ ...tdBase, fontSize: '0.75rem' }}>{l.clinic?.name || '—'}</td>
              <td style={{ ...tdBase, fontSize: '0.75rem' }}>{l.user?.name || l.user?.email || '—'}</td>
              <td style={tdBase}><span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: 'rgba(99,91,255,0.1)', color: '#635bff' }}>{l.action}</span></td>
              <td style={{ ...tdBase, fontSize: '0.75rem' }}>{l.entity}</td>
              <td style={{ ...tdBase, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{l.ipAddress || '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
};

/* ─── SYSTEM TAB ─── */
const SystemTab = () => {
  const { data: webhookHealth, isLoading } = useQuery({ queryKey: ['admin-webhook-health'], queryFn: () => api.get('/admin/webhook-health').then(r => r.data), refetchInterval: 30000 });
  const { data: plans } = useQuery({ queryKey: ['admin-plans'], queryFn: () => api.get('/admin/plans').then(r => r.data) });
  if (isLoading) return <LoadingPlaceholder rows={3} />;
  const summary = webhookHealth?.summary || {};
  const perClinic = webhookHealth?.perClinic || [];

  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1.5rem' }}>Κατάσταση Συστήματος</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard label="Υγιές" value={summary.healthy || 0} icon={<CheckCircle2 size={18} />} accent="#10b981" bg="var(--success-light)" />
        <KpiCard label="Επικίνδυνο" value={summary.degraded || 0} icon={<AlertTriangle size={18} />} accent="#f59e0b" bg="var(--warning-light)" />
        <KpiCard label="Αποτυχία" value={summary.failing || 0} icon={<XCircle size={18} />} accent="#ef4444" bg="var(--error-light)" />
        <KpiCard label="Άγνωστο" value={summary.unknown || 0} icon={<AlertCircle size={18} />} accent="#64748b" bg="rgba(100,116,139,0.08)" />
      </div>
      <div style={{ background: 'var(--glass-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', boxShadow: 'var(--shadow-md)', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem' }}>Webhook Health ανά Ιατρείο</h3>
        {perClinic.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>Δεν υπάρχουν δεδομένα</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={thBase}>Ιατρείο</th><th style={thBase}>Κατάσταση</th><th style={thBase}>Τελευταία Επιτυχία</th><th style={thBase}>Αποτυχίες 24h</th><th style={thBase}>Consecutive</th></tr></thead>
              <tbody>{perClinic.map(c => (
                <tr key={c.clinicId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...tdBase, fontWeight: '700' }}>{c.clinicName}</td>
                  <td style={tdBase}><StatusBadge status={c.status} /></td>
                  <td style={{ ...tdBase, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.lastSuccessAt ? new Date(c.lastSuccessAt).toLocaleString('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Ποτέ'}</td>
                  <td style={{ ...tdBase, fontWeight: '700', color: c.failureCount24h > 0 ? '#ef4444' : 'var(--text)' }}>{c.failureCount24h}</td>
                  <td style={{ ...tdBase, fontWeight: '700', color: c.consecutiveFailures >= 5 ? '#ef4444' : c.consecutiveFailures > 0 ? '#f59e0b' : 'var(--text)' }}>{c.consecutiveFailures}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      {plans && (
        <div style={{ background: 'var(--glass-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem', boxShadow: 'var(--shadow-md)' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem' }}>Διαθέσιμα Πλάνα</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {Object.entries(plans).map(([key, plan]) => (
              <div key={key} style={{ padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', marginBottom: '0.5rem' }}>{plan.name || key}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--primary)', marginBottom: '0.5rem' }}>€{plan.price || 0}<span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/μήνα</span></div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{plan.smsLimit || '∞'} SMS · {plan.aiLimit || '∞'} AI</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── MAIN ADMIN DASHBOARD ─── */
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState(TABS.OVERVIEW);
  const { data: statsData, refetch: statsRefetch } = useQuery({ queryKey: ['admin-platform-stats'], queryFn: () => api.get('/admin/stats').then(res => res.data), refetchInterval: 60000 });
  const { data: onboardingData } = useQuery({ queryKey: ['admin-onboarding'], queryFn: () => api.get('/admin/onboarding-progress').then(res => res.data), refetchInterval: 60000 });

  return (
    <div style={{ padding: '1.25rem', maxWidth: '1400px', margin: '0 auto', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--secondary)', margin: 0 }}>Admin Dashboard</h1>
        <button onClick={() => statsRefetch()} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={14} /> Ανανέωση</button>
      </div>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'var(--glass-surface)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '14px', padding: '0.35rem', boxShadow: 'var(--shadow-sm)', position: 'sticky', top: '0.5rem', zIndex: 40 }}>
        {TAB_CONFIG.map(tab => { const isActive = activeTab === tab.id; const Icon = tab.icon; return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 12px', borderRadius: '11px', background: isActive ? 'linear-gradient(135deg, rgba(99,91,255,0.15) 0%, rgba(139,92,246,0.1) 100%)' : 'transparent', border: isActive ? '1px solid rgba(99,91,255,0.25)' : '1px solid transparent', color: isActive ? 'var(--primary)' : 'var(--text-light)', fontWeight: isActive ? '800' : '600', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'inherit', outline: '2px solid transparent' }}>
            <Icon size={16} /><span className="admin-tab-label">{tab.label}</span>
          </button>
        ); })}
      </div>
      {activeTab === TABS.OVERVIEW && <OverviewTab statsData={statsData} onboardingData={onboardingData} setActiveTab={setActiveTab} />}
      {activeTab === TABS.CLINICS && <ClinicsTab />}
      {activeTab === TABS.REVENUE && <RevenueTab statsData={statsData} />}
      {activeTab === TABS.USERS && <UserManagement />}
      {activeTab === TABS.AUDIT && <AuditLogs />}
      {activeTab === TABS.SYSTEM && <SystemTab />}
    </div>
  );
};

// Safe wrapper
let AdminDashboardSafe;
try { AdminDashboardSafe = () => { try { return <AdminDashboard />; } catch (err) { console.error('[AdminDashboard] render crash:', err); return (<div style={{ padding: '2rem', textAlign: 'center' }}><h2>⚠️ Σφάλμα</h2><p>{err?.message || 'Unknown'}</p><button onClick={() => window.location.reload()}>Επαναφόρτωση</button></div>); } }; } catch (e) { AdminDashboardSafe = () => <div>Admin failed</div>; }
export default AdminDashboardSafe;
