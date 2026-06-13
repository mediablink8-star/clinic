import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  Building2, Users, Calendar, MessageSquare, Plus, X, Shield,
  CheckCircle2, XCircle, Search, RefreshCw, Trash2, CreditCard,
  Activity, AlertTriangle, Eye, TrendingUp, Clock, AlertOctagon,
  ArrowUpDown, ChevronDown, ChevronUp, Filter, Download,
  Lock, Unlock, ShieldCheck, FileText, BarChart2, Layers,
  AlertCircle, Check, X as XIcon, UserPlus, ChevronLeft, ChevronRight,
  FlaskConical, Send, Phone, ListChecks, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import ErrorState from '../components/ErrorState';
import { useConfirm } from '../hooks/useConfirm';

/* ─── TABS ─── */
const TABS = {
  CLINICS: 'clinics',
  USERS: 'users',
  AUDIT: 'audit',
  STATS: 'stats'
};

const TAB_CONFIG = [
  { id: TABS.CLINICS, label: 'Ιατρεία', icon: Building2 },
  { id: TABS.USERS,   label: 'Χρήστες',  icon: Users },
  { id: TABS.AUDIT,   label: 'Αυδίτο',   icon: FileText },
  { id: TABS.STATS,   label: 'Στατιστικά', icon: BarChart2 }
];

/* ─── HELPERS ─── */
const SortArrow = ({ field, sortBy, sortDir }) => {
  if (sortBy !== field) return <ArrowUpDown size={12} style={{ opacity: 0.3, marginLeft: '4px' }} />;
  return sortDir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--primary)', marginLeft: '4px' }} />
    : <ChevronDown size={12} style={{ color: 'var(--primary)', marginLeft: '4px' }} />;
};

const formatTimeAgo = (date) => {
  if (!date) return '—';
  const diffMs = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'μόλις τώρα';
  const min = Math.floor(sec / 60);
  if (min < 60) return `πριν ${min}λ`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `πριν ${hr}ω`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `πριν ${days}μ`;
  return new Date(date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
};

const thBase = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '0.68rem',
  fontWeight: '800',
  color: 'var(--text-light)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '2px solid var(--border)',
  whiteSpace: 'nowrap'
};

const tdBase = {
  padding: '12px 14px',
  fontSize: '0.82rem',
  color: 'var(--text)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle'
};

const actionBtnBase = {
  width: '30px', height: '30px', borderRadius: '6px',
  border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s', fontSize: '0.75rem'
};

/* ─── LOADING ─── */
const LoadingPlaceholder = ({ rows = 4 }) => (
  <div style={{ padding: '2rem' }}>
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
      {[...Array(rows)].map((_, i) => (
        <div key={`sk-${i}`} style={{
          flex: 1, height: '72px', borderRadius: '12px',
          background: 'var(--bg-subtle)',
          animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.15}s`
        }} />
      ))}
    </div>
    <div style={{ background: 'var(--bg-subtle)', borderRadius: '12px', height: '200px' }} />
  </div>
);

const DetailRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{label}</span>
    <span style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: '600' }}>{value}</span>
  </div>
);

/* ================================================================
   PLATFORM STATS TAB
   ================================================================ */
const PlatformStats = ({ data, loading, error, onRetry }) => {
  if (loading) return <LoadingPlaceholder rows={3} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (!data) return null;

  const s = data.summary;
  const cards = [
    { label: 'Συνολικά Ιατρεία', value: s.totalClinics, icon: <Building2 size={20} />, accent: 'var(--primary)', bg: 'var(--primary-light)' },
    { label: 'Ενεργά', value: s.activeClinics, icon: <CheckCircle2 size={20} />, accent: 'var(--accent)', bg: 'var(--success-light)' },
    { label: 'Ανενεργά', value: s.inactiveClinics, icon: <XCircle size={20} />, accent: 'var(--urgent)', bg: 'var(--error-light)' },
    { label: 'Σύνολο Χρήστες', value: s.totalUsers, icon: <Users size={20} />, accent: 'var(--ai-blue)', bg: 'var(--info-light)' },
    { label: 'Ραντεβού', value: s.totalAppointments, icon: <Calendar size={18} />, accent: 'var(--warning)', bg: 'var(--warning-light)' },
    { label: 'Μηνύματα', value: s.totalMessages, icon: <MessageSquare size={18} />, accent: 'var(--primary-vibrant)', bg: 'rgba(139,92,246,0.08)' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }} className="stats-grid">
        {cards.map((card) => (
          <div key={card.label} style={{
            background: 'var(--glass-surface)',
            backdropFilter: 'var(--glass-strong)',
            WebkitBackdropFilter: 'var(--glass-strong)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderLeft: `3px solid ${card.accent}`,
            borderRadius: '12px',
            padding: '1.25rem 1.25rem',
            boxShadow: 'var(--shadow-md)',
            display: 'flex', alignItems: 'center', gap: '14px',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: card.bg, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: card.accent
            }}>{card.icon}</div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--secondary)', lineHeight: 1.1, marginTop: '2px' }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Recent Logins */}
        <div style={{
          background: 'var(--glass-surface)',
          backdropFilter: 'var(--glass-strong)',
          WebkitBackdropFilter: 'var(--glass-strong)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-md)'
        }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={14} style={{ color: 'var(--primary)' }} />
            Πρόσφατες Εισόδοι
          </h3>
          {data.recentLogins?.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>Δεν υπάρχουν πρόσφατες εισόδοι</p>
          ) : (
            (data.recentLogins || []).map((u) => (
              <div key={u.email} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600' }}>{u.name || u.email}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.email}</div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Ποτέ'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Low Credit Alert */}
        <div style={{
          background: 'var(--glass-surface)',
          backdropFilter: 'var(--glass-strong)',
          WebkitBackdropFilter: 'var(--glass-strong)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-md)'
        }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
            Ιατρεία Χαμηλών Credits
          </h3>
          {(data.lowCreditClinics || []).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>Όλα τα ιατρεία έχουν επαρκή credits</p>
          ) : (
            (data.lowCreditClinics || []).map((c) => (
              <div key={c.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600' }}>{c.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: c.messageCredits < 20 ? 'var(--urgent)' : 'var(--warning)' }}>
                    {c.messageCredits} / {c.monthlyCreditLimit}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Peak Hours */}
      {data.peakHours && data.peakHours.length > 0 && (
        <div style={{
          background: 'var(--glass-surface)',
          backdropFilter: 'var(--glass-strong)',
          WebkitBackdropFilter: 'var(--glass-strong)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-md)',
          marginTop: '1rem'
        }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={14} style={{ color: 'var(--primary)' }} />
            Πικ Ώρες Ραντεβού
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {data.peakHours.map((h) => (
              <div key={h.hour} style={{
                padding: '8px 16px', borderRadius: '10px',
                background: 'var(--primary-light)',
                border: '1px solid rgba(99,91,255,0.15)',
                fontSize: '0.82rem', fontWeight: '700', color: 'var(--primary)'
              }}>
                {h.hour}: {h.count} ραντεβού
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ================================================================
   USER MANAGEMENT TAB
   ================================================================ */
const UserManagement = () => {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [editingUser, setEditingUser] = useState(null);

  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(res => res.data),
    refetchInterval: 30000
  });

  const filtered = useMemo(() => {
    let result = [...users];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.id || '').toString().toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'all') result = result.filter(u => u.role === roleFilter);
    if (statusFilter === 'active') result = result.filter(u => u.isActive && !u.lockedUntil);
    if (statusFilter === 'locked') result = result.filter(u => u.lockedUntil);
    if (statusFilter === 'inactive') result = result.filter(u => !u.isActive);
    result.sort((a, b) => {
      const va = a[sortBy] ?? '';
      const vb = b[sortBy] ?? '';
      if (typeof va === 'boolean') return sortDir === 'asc' ? (va ? 1 : 0) - (vb ? 1 : 0) : (vb ? 1 : 0) - (va ? 1 : 0);
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return result;
  }, [users, searchTerm, roleFilter, statusFilter, sortBy, sortDir]);

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const handleToggleLock = async (userId, lockedUntil, name) => {
    try {
      if (lockedUntil) {
        await api.patch(`/admin/users/${userId}`, { lockedUntil: null });
        toast.success(`Ξεκλειδώθηκε ο χρήστης "${name}"`);
      } else {
        await api.patch(`/admin/users/${userId}`, { lockedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() });
        toast.success(`Κλειδώθηκε ο χρήστης "${name}" για 7 ημέρες`);
      }
      refetch();
    } catch (err) {
      toast.error('Αποτυχία αλλαγής κατάστασης');
    }
  };

  const handleToggleActive = async (userId, currentState, name) => {
    try {
      await api.patch(`/admin/users/${userId}`, { isActive: !currentState });
      toast.success(currentState ? 'Ανενεργοποιήθηκε' : 'Ενεργοποιήθηκε');
      refetch();
    } catch (err) {
      toast.error('Αποτυχία αλλαγής κατάστασης');
    }
  };

  const handleResetPassword = async (userId, email) => {
    const newPw = prompt(`Νέος κωδικός για ${email}:`);
    if (!newPw || newPw.length < 8) { toast.error('Ο κωδικός πρέπει να είναι τουλάχιστον 8 χαρακτήρες'); return; }
    try {
      await api.patch(`/admin/users/${userId}`, { password: newPw });
      toast.success('Ο κωδικός αλλάχθηκε επιτυχώς');
    } catch (err) {
      toast.error('Αποτυχία αλλαγής κωδικού');
    }
  };

  const handleDeleteUser = async (userId, name) => {
    const confirmed = await confirm(`Διαγραφή χρήστη "${name}"; Αυτή η ενέργεια είναι μη αναστρέψιμη.`, { title: 'Διαγραφή Χρήστη', variant: 'danger', confirmLabel: 'Διαγραφή' });
    if (!confirmed) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('Ο χρήστης διαγράφηκε');
      refetch();
    } catch (err) {
      toast.error('Αποτυχία διαγραφής');
    }
  };

  const handleSortTh = (field, label) => (
    <th onClick={() => handleSort(field)} style={{
      ...thBase,
      cursor: 'pointer', userSelect: 'none',
      background: sortBy === field ? 'rgba(99,91,255,0.08)' : 'transparent'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {label}<SortArrow field={field} sortBy={sortBy} sortDir={sortDir} />
      </div>
    </th>
  );

  if (isLoading) return <LoadingPlaceholder rows={5} />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} className="toolbar-group">
             <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text" placeholder="Αναζήτηση χρηστών..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  style={{ padding: '8px 12px 8px 30px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent', width: '100%', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                />
           </div>
           <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{
             padding: '8px 30px 8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
             background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent',
             appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
             backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath d=%22M6 8L1 3h10z%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E")',
             backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center'
           }}>
             <option value="all">Όλοι οι ρόλοι</option>
             <option value="ADMIN">Διαχειριστής</option>
             <option value="OWNER">Ιδιοκτήτης</option>
             <option value="DOCTOR">Γιατρός</option>
             <option value="RECEPTIONIST">Γραμματέας</option>
             <option value="ASSISTANT">Βοηθός</option>
           </select>
           <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
             padding: '8px 30px 8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
             background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent',
             appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
             backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath d=%22M6 8L1 3h10z%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E")',
             backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center'
           }}>
            <option value="all">Όλες οι καταστάσεις</option>
            <option value="active">Ενεργοί</option>
            <option value="locked">Κλειδωμένοι</option>
            <option value="inactive">Ανενεργοί</option>
          </select>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{filtered.length} χρήστες</span>
      </div>

<div style={{ overflowX: 'auto' }} className="mobile-table-min">
         <table style={{ width: '100%', borderCollapse: 'collapse' }}>
           <thead>
             <tr style={{ background: 'rgba(99,91,255,0.04)', borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
               {handleSortTh('name', 'Όνομα')}
               {handleSortTh('email', 'Email')}
               {handleSortTh('role', 'Ρόλος')}
               {handleSortTh('isActive', 'Κατάσταση')}
               {handleSortTh('createdAt', 'Δημιουργία')}
               <th style={thBase}>Ενέργειες</th>
             </tr>
           </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Δεν βρέθηκαν χρήστες</td></tr>
            ) : filtered.map(user => (
               <tr key={user.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s', background: 'var(--bg-subtle)' }}>
                <td style={tdBase}>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text)' }}>{user.name || '—'}</div>
                  {user.isPlatformAdmin && <span style={{ fontSize: '0.65rem', color: '#635bff', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}><ShieldCheck size={10} /> Platform Admin</span>}
                </td>
                <td style={{ ...tdBase, fontSize: '0.8rem' }}>{user.email}</td>
                <td style={tdBase}>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: '700',
                    padding: '3px 8px', borderRadius: '4px',
                    background: user.role === 'ADMIN' ? 'var(--primary-light)' : user.role === 'OWNER' ? 'rgba(139,92,246,0.1)' : user.role === 'DOCTOR' ? 'var(--info-light)' : 'rgba(148,163,184,0.15)',
                    color: user.role === 'ADMIN' ? 'var(--primary)' : user.role === 'OWNER' ? 'var(--primary-vibrant)' : user.role === 'DOCTOR' ? 'var(--ai-blue)' : 'var(--text-muted)'
                  }}>
                    {user.role === 'ADMIN' ? 'Διαχειριστής' : user.role === 'OWNER' ? 'Ιδιοκτήτης' : user.role === 'DOCTOR' ? 'Γιατρός' : user.role === 'RECEPTIONIST' ? 'Γραμματέας' : 'Βοηθός'}
                  </span>
                </td>
                <td style={tdBase}>
                  {user.lockedUntil ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Lock size={10} /> Κλειδωμένος
                    </span>
                  ) : user.isActive ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={10} /> Ενεργός
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--urgent)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <XCircle size={10} /> Ανενεργός
                    </span>
                  )}
                </td>
                <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  {new Date(user.createdAt).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                      <button title={user.lockedUntil ? 'Ξεκλείδωμα' : 'Κλείδωμα'} onClick={() => handleToggleLock(user.id, user.lockedUntil, user.name)} style={{
                          ...actionBtnBase,
                          color: user.lockedUntil ? 'var(--accent)' : 'var(--warning)',
                          background: user.lockedUntil ? 'var(--success-light)' : 'var(--warning-light)'
                        }}>
                          {user.lockedUntil ? <Unlock size={13} /> : <Lock size={13} />}
                        </button>
                      <button title={user.isActive ? 'Απενεργοποίηση' : 'Ενεργοποίηση'} onClick={() => handleToggleActive(user.id, user.isActive, user.name)} style={{
                          ...actionBtnBase,
                          color: user.isActive ? 'var(--warning)' : 'var(--accent)',
                          background: user.isActive ? 'var(--warning-light)' : 'var(--success-light)'
                      }}>
                        <RefreshCw size={13} />
                      </button>
                    <button title="Αλλαγή κωδικού" onClick={() => handleResetPassword(user.id, user.email)} style={{
                        ...actionBtnBase,
                        color: '#8b5cf6',
                        background: 'rgba(139,92,246,0.08)'
                      }}>
                        <ShieldCheck size={13} />
                      </button>
                    <button title={user.isPlatformAdmin ? 'Αδύνατο — τελευταίος admin' : 'Διαγραφή'} onClick={() => handleDeleteUser(user.id, user.name)} disabled={user.isPlatformAdmin} style={{
                        ...actionBtnBase,
                        color: user.isPlatformAdmin ? '#64748b' : '#ef4444',
                        background: user.isPlatformAdmin ? 'rgba(100,116,139,0.05)' : 'rgba(239,68,68,0.08)',
                        cursor: user.isPlatformAdmin ? 'not-allowed' : 'pointer',
                        opacity: user.isPlatformAdmin ? 0.4 : 1
                      }}>
                        <Trash2 size={13} />
                      </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  );
};

/* ================================================================
   AUDIT LOGS TAB
   ================================================================ */
const AuditLogs = () => {
  const [filters, setFilters] = useState({ action: '', entity: '', startDate: '', endDate: '' });
  const [limit, setLimit] = useState(50);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-audit-logs', filters, limit],
    queryFn: () => api.get('/admin/audit-logs', { params: { ...filters, limit } }).then(res => res.data),
    refetchInterval: 30000
  });

  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ action: '', entity: '', startDate: '', endDate: '' });
    setLimit(50);
  }, []);

  const handleExportCSV = useCallback(() => {
    const logs = data?.data || [];
    const headers = ['Ημερομηνία', 'Ιατρείο', 'Χρήστης', 'Ενέργεια', 'Οντότητα', 'ID Οντότητας', 'Λεπτομέρειες', 'IP'];
    const rows = logs.map(l => [
      new Date(l.createdAt).toLocaleString('el-GR'),
      l.clinic?.name || '',
      l.user?.name || l.user?.email || '',
      l.action,
      l.entity,
      l.entityId || '',
      l.details || '',
      l.ipAddress || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Τα αρχεία εξάχθηκαν σε CSV');
  }, [data]);

  if (isLoading) return <LoadingPlaceholder rows={4} />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      {/* Filters */}
      <div style={{
        background: 'var(--glass-surface)',
        backdropFilter: 'var(--glass-strong)',
        WebkitBackdropFilter: 'var(--glass-strong)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1rem',
        display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end'
      }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label htmlFor="audit-action" style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px', display: 'block' }}>Ενέργεια</label>
          <select id="audit-action" value={filters.action} onChange={e => handleFilterChange('action', e.target.value)} style={{
            width: '100%', padding: '8px 10px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent', fontFamily: 'inherit'
          }}>
            <option value="">Όλες</option>
            <option value="CREATE_APPOINTMENT">Δημιουργία Ραντεβού</option>
            <option value="DELETE_APPOINTMENT">Διαγραφή Ραντεβού</option>
            <option value="UPDATE_APPOINTMENT">Ενημέρωση Ραντεβού</option>
            <option value="CREATE_PATIENT">Δημιουργία Ασθενή</option>
            <option value="UPDATE_PATIENT">Ενημέρωση Ασθενή</option>
            <option value="DELETE_PATIENT">Διαγραφή Ασθενή</option>
            <option value="CREATE_CLINIC">Δημιουργία Ιατρείου</option>
            <option value="UPDATE_CLINIC">Ενημέρωση Ιατρείου</option>
            <option value="SEND_SMS">Αποστολή SMS</option>
            <option value="RESET_DEFAULTS">Επαναφορά προεπιθέσεων</option>
            <option value="LOGIN">Σύνδεση</option>
            <option value="LOGOUT">Αποσύνδεση</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label htmlFor="audit-entity" style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px', display: 'block' }}>Οντότητα</label>
          <select id="audit-entity" value={filters.entity} onChange={e => handleFilterChange('entity', e.target.value)} style={{
            width: '100%', padding: '8px 10px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent', fontFamily: 'inherit'
          }}>
            <option value="">Όλες</option>
            <option value="APPOINTMENT">Ραντεβού</option>
            <option value="PATIENT">Ασθενής</option>
            <option value="CLINIC">Ιατρείο</option>
            <option value="USER">Χρήστης</option>
            <option value="SMS">SMS</option>
            <option value="SETTINGS">Ρυθμίσεις</option>
          </select>
        </div>
        <div style={{ minWidth: '140px' }}>
          <label htmlFor="audit-start-date" style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px', display: 'block' }}>Από</label>
          <input id="audit-start-date" type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} style={{
            width: '100%', padding: '8px 10px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent', fontFamily: 'inherit'
          }} />
        </div>
        <div style={{ minWidth: '140px' }}>
          <label htmlFor="audit-end-date" style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px', display: 'block' }}>Έως</label>
          <input id="audit-end-date" type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} style={{
            width: '100%', padding: '8px 10px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent', fontFamily: 'inherit'
          }} />
        </div>
        <button onClick={handleResetFilters} style={{
          padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.05)', color: 'var(--text-light)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: '700', fontFamily: 'inherit'
        }}>
          <Filter size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
          Επαναφορά
        </button>
        <button onClick={handleExportCSV} style={{
          padding: '8px 16px', borderRadius: '8px', border: 'none',
          background: 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)',
          color: 'white', fontSize: '0.82rem', cursor: 'pointer', fontWeight: '700', fontFamily: 'inherit'
        }}>
          <Download size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
          CSV Εξαγωγή
        </button>
      </div>

      <div style={{
        background: 'var(--glass-surface)',
        backdropFilter: 'var(--glass-strong)',
        WebkitBackdropFilter: 'var(--glass-strong)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '14px',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            Σύνολο: {data?.total || 0} καταχωρήσεις · Εμφανίζονται {data?.data?.length || 0}
          </span>
        </div>
<div style={{ overflowX: 'auto', maxHeight: '500px' }} className="mobile-table-min">
           <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--primary-light)', borderBottom: '2px solid var(--border)' }}>
                <th style={thBase}>Ώρα</th>
                <th style={thBase}>Ιατρείο</th>
                <th style={thBase}>Χρήστης</th>
                <th style={thBase}>Ενέργεια</th>
                <th style={thBase}>Οντότητα</th>
                <th style={thBase}>IP</th>
                <th style={thBase}>Λεπτομέρειες</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Δεν βρέθηκαν καταχωρήσεις αυδίτου</td></tr>
              ) : (data?.data || []).map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}>
                  <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ ...tdBase, fontSize: '0.8rem', fontWeight: '600' }}>{log.clinic?.name || '—'}</td>
                  <td style={{ ...tdBase, fontSize: '0.8rem' }}>{log.user?.name || log.user?.email || '—'}</td>
                  <td style={{ ...tdBase }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: '700',
                      padding: '2px 8px', borderRadius: '4px',
                      background: log.action?.includes('DELETE') ? 'rgba(239,68,68,0.1)' : log.action?.includes('CREATE') ? 'rgba(16,185,129,0.1)' : 'rgba(99,91,255,0.08)',
                      color: log.action?.includes('DELETE') ? '#ef4444' : log.action?.includes('CREATE') ? '#10b981' : '#635bff'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ ...tdBase, fontSize: '0.8rem' }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: '4px',
                      background: 'rgba(255,255,255,0.06)', fontSize: '0.7rem', fontWeight: '600'
                    }}>
                      {log.entity}
                    </span>
                  </td>
                  <td style={{ ...tdBase, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.ipAddress || '—'}</td>
                  <td style={{ ...tdBase, fontSize: '0.78rem', color: 'var(--text-light)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.details || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ================================================================
   MAIN ADMIN DASHBOARD
   ================================================================ */
const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(TABS.CLINICS);

  // Platform stats query (only loads when on STATS tab)
  const { data: statsData, isLoading: statsLoading, error: statsError, refetch: statsRefetch } = useQuery({
    queryKey: ['admin-platform-stats'],
    queryFn: () => api.get('/admin/stats').then(res => res.data),
    enabled: activeTab === TABS.STATS,
    staleTime: 60000
  });

  // Onboarding progress
  const { data: onboardingData } = useQuery({
    queryKey: ['admin-onboarding'],
    queryFn: () => api.get('/admin/onboarding-progress').then(res => res.data),
    refetchInterval: 60000
  });

  const handleTabChange = (tab) => setActiveTab(tab);

  return (
<div className="admin-dashboard-container" style={{ padding: '1.25rem', maxWidth: '1400px', margin: '0 auto' }}>

       {/* ── MOBILE STYLES ── */}
       <style>{`
         @media (min-width: 768px) {
           .admin-dashboard-container { padding: 2rem !important; }
           .kpi-grid { grid-template-columns: repeat(4, 1fr) !important; }
           .kpi-grid-2 { grid-template-columns: repeat(4, 1fr) !important; }
           .stats-grid { grid-template-columns: repeat(3, 1fr) !important; }
           .toolbar-group { flex-direction: row !important; }
           .toolbar-search { width: 220px !important; }
           .bulk-bar { flex-direction: row !important; }
         }
         @media (max-width: 767px) {
           .admin-dashboard-container { padding: 0.75rem !important; }
           .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 0.5rem !important; }
           .kpi-grid-2 { grid-template-columns: repeat(2, 1fr) !important; gap: 0.5rem !important; font-size: 0.85rem !important; }
           .stats-grid { grid-template-columns: 1fr !important; }
           .toolbar-group { flex-direction: column !important; }
           .toolbar-search { width: 100% !important; }
           .bulk-bar { flex-direction: column !important; align-items: stretch !important; }
           .mobile-table-min { min-width: 800px !important; }
           .modal-responsive { max-width: 95vw !important; }
           .filter-row { flex-direction: column !important; }
         }
       `}</style>

       {/* ── PAGE HEADER ── */}
       <div className="admin-dashboard-container" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #635bff, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 18px -6px rgba(99,91,255,0.5)'
            }}>
              <Shield size={18} color="white" />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--secondary)', margin: 0, letterSpacing: '-0.03em' }}>
              Πίνακας Ελέγχου Διαχειριστή
            </h1>
            {onboardingData?.completionRate > 0 && (
              <span style={{
                fontSize: '0.65rem', fontWeight: '700', padding: '3px 8px', marginLeft: '8px',
                borderRadius: '99px', background: 'rgba(16,185,129,0.12)',
                color: '#10b981', border: '1px solid rgba(16,185,129,0.25)'
              }}>
                ΣΥΝΔΕΔΕΜΕΝΟ
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: 0 }}>
            Πλατφόρμα διαχείρισης · {onboardingData?.completionRate || 0}% ολοκλήρωση onboarding
          </p>
        </div>
      </div>

      {/* ── ONBOARDING PROGRESS BAR ── */}
      {onboardingData && (
        <div style={{
          background: 'var(--glass-surface)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: '1rem'
        }}>
          <Layers size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-light)' }}>Onboarding Πρόοδος</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)' }}>{onboardingData.completionRate}%</span>
            </div>
            <div style={{
              width: '100%', height: '6px', borderRadius: '3px',
              background: 'rgba(255,255,255,0.08)'
            }}>
              <div style={{
                width: `${onboardingData.completionRate}%`, height: '100%',
                background: 'linear-gradient(90deg, #635bff, #8b5cf6)',
                borderRadius: '3px', transition: 'width 0.8s ease'
              }} />
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {onboardingData.completed}/{onboardingData.total} ολοκληρωμένα
          </span>
        </div>
      )}

      {/* ── TAB NAVIGATION ── */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.5rem',
        background: 'var(--glass-surface)',
        backdropFilter: 'var(--glass-strong)',
        WebkitBackdropFilter: 'var(--glass-strong)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '14px',
        padding: '0.35rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {TAB_CONFIG.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px 16px', borderRadius: '11px',
                background: isActive ? 'linear-gradient(135deg, rgba(99,91,255,0.15) 0%, rgba(139,92,246,0.1) 100%)' : 'transparent',
                border: isActive ? '1px solid rgba(99,91,255,0.25)' : '1px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-light)',
                fontWeight: isActive ? '800' : '600',
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                outline: '2px solid transparent'
              }}
              onMouseOver={e => !isActive && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      {activeTab === TABS.CLINICS && <ClinicsTab />}
      {activeTab === TABS.USERS && <UserManagement />}
      {activeTab === TABS.AUDIT && <AuditLogs />}
      {activeTab === TABS.STATS && <PlatformStats data={statsData} loading={statsLoading} error={statsError} onRetry={statsRefetch} />}
    </div>
  );
};

const SortThClinic = ({ field, label, sortBy, sortDir, handleSort }) => (
    <th onClick={() => handleSort(field)} style={{
      ...thBase, cursor: 'pointer', userSelect: 'none',
      background: sortBy === field ? 'rgba(99,91,255,0.08)' : 'transparent'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {label}<SortArrow field={field} sortBy={sortBy} sortDir={sortDir} />
      </div>
    </th>
  );

/* ================================================================
   CLINICS TAB (refactored as a subcomponent)
   ================================================================ */
const ClinicsTab = () => {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();

  // Webhook health — per-clinic green/red dot based on last successful delivery
  const { data: webhookHealth } = useQuery({
    queryKey: ['admin-webhook-health'],
    queryFn: () => api.get('/admin/webhook-health').then(res => res.data),
    refetchInterval: 60000
  });

  // Dead-letter alert: toast once per session per clinic if webhooks are
  // stale (>1h since last success) or have failing event types in 24h
  const [webhookAlerted, setWebhookAlerted] = React.useState(new Set());
  React.useEffect(() => {
    if (!webhookHealth?.perClinic) return;
    webhookHealth.perClinic.forEach(c => {
      if (c.stale && !webhookAlerted.has(c.clinicId)) {
        toast.error(
          `⚠️ ${c.clinicName}: τα webhooks δεν έχουν ανταποκριθεί εδώ και >1 ώρα`,
          { duration: 12000 }
        );
        setWebhookAlerted(prev => new Set(prev).add(c.clinicId));
      } else if (c.failingEventTypes?.length > 0 && !webhookAlerted.has(c.clinicId + ':fail')) {
        toast.error(
          `⚠️ ${c.clinicName}: ${c.failingEventTypes.length} events αποτυγχάνουν (${c.failingEventTypes.join(', ')})`,
          { duration: 12000 }
        );
        setWebhookAlerted(prev => new Set(prev).add(c.clinicId + ':fail'));
      }
    });
  }, [webhookHealth, webhookAlerted]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailClinic, setDetailClinic] = useState(null);
  const [newClinic, setNewClinic] = useState({ name: '', ownerEmail: '', ownerPassword: '', ownerName: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [selectedClinics, setSelectedClinics] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [testCallClinic, setTestCallClinic] = useState(null);
  const [testCallPhone, setTestCallPhone] = useState('+30');
  const [testCallResult, setTestCallResult] = useState(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const { data: clinics = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-clinics'],
    queryFn: () => api.get('/admin/usage').then(res => res.data),
    refetchInterval: 30000
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => api.get('/admin/logs').then(res => res.data),
    refetchInterval: 15000
  });

  const { data: testCalls = { perClinic: {} } } = useQuery({
    queryKey: ['admin-test-calls-last'],
    queryFn: () => api.get('/admin/clinics/test-calls/last').then(res => res.data),
    refetchInterval: 30000
  });

  const { data: setupStatus, refetch: refetchSetupStatus } = useQuery({
    queryKey: ['admin-setup-status', detailClinic?.id],
    queryFn: () => api.get(`/admin/clinics/${detailClinic.id}/setup-status`).then(res => res.data),
    enabled: !!detailClinic,
    refetchInterval: 60000
  });

  const metrics = useMemo(() => {
    const total = clinics.length;
    const active = clinics.filter(c => c.isActive).length;
    const inactive = total - active;
    const totalUsers = clinics.reduce((s, c) => s + (c._count?.users || 0), 0);
    const totalApps = clinics.reduce((s, c) => s + (c._count?.appointments || 0), 0);
    const totalPatients = clinics.reduce((s, c) => s + (c._count?.patients || 0), 0);
    const totalMsgs = clinics.reduce((s, c) => s + (c.messageCredits || 0), 0);
    const totalUsedMsgs = clinics.reduce((s, c) => s + (c.dailyUsedCount || 0), 0);
    const totalLogs = logs.length;
    const sentLogs = logs.filter(l => l.status === 'SENT').length;
    const failedLogs = logs.filter(l => l.status === 'FAILED').length;
    return { total, active, inactive, totalUsers, totalApps, totalPatients, totalMsgs, totalUsedMsgs, totalLogs, sentLogs, failedLogs };
  }, [clinics, logs]);

  const filteredClinics = useMemo(() => {
    let result = [...clinics];
    if (statusFilter !== 'all') result = result.filter(c => c.isActive === (statusFilter === 'active'));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || String(c.id)?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const va = a[sortBy] ?? '';
      const vb = b[sortBy] ?? '';
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return result;
  }, [clinics, searchTerm, statusFilter, sortBy, sortDir]);

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const handleToggleActive = async (clinicId, currentState, name) => {
    const msg = currentState
      ? `Απενεργοποίηση "${name}"; Όλες οι αυτοματοποιήσεις θα σταματήσουν.`
      : `Ενεργοποίηση "${name}";`;
    const confirmed = await confirm(msg, {
      title: currentState ? 'Απενεργοποίηση Ιατρείου' : 'Ενεργοποίηση Ιατρείου',
      variant: currentState ? 'warning' : 'info',
      confirmLabel: currentState ? 'Απενεργοποίηση' : 'Ενεργοποίηση'
    });
    if (!confirmed) return;
    try {
      await api.post(`/admin/clinics/${clinicId}/toggle-status`, { isActive: !currentState });
      toast.success(currentState ? 'Ανενεργοποιήθηκε' : 'Ενεργοποιήθηκε');
      refetch();
    } catch (err) {
      toast.error('Αποτυχία αλλαγής κατάστασης');
    }
  };

  const handleAddCredits = async (clinicId) => {
    const amount = prompt('Ποσό credits να προστεθούν;');
    if (!amount || isNaN(amount) || Number(amount) <= 0) return;
    try {
      await api.post('/admin/add-credits', { clinicId, amount: Number(amount) });
      toast.success(`+${amount} credits προστέθηκαν`);
      refetch();
    } catch (err) {
      toast.error('Αποτυχία προσθήκης credits');
    }
  };

const handleDeleteClinic = async (clinicId, name) => {
    const confirmed = await new Promise(resolve => {
      toast(
        t => (
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', fontWeight: 600 }}>
            Διαγραφή "{name}"; Αυτή η ενέργεια είναι μη αναστρέψιμη.
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
      await api.delete(`/admin/clinics/${clinicId}`);
      toast.success('Το ιατρείο διαγράφηκε');
      refetch();
    } catch (err) {
      toast.error('Αποτυχία διαγραφής');
    }
  };

  const openTestCallModal = (clinic) => {
    setTestCallClinic(clinic);
    setTestCallPhone('+30');
    setTestCallResult(null);
  };

  const closeTestCallModal = () => {
    setTestCallClinic(null);
    setTestCallResult(null);
    setIsSendingTest(false);
  };

  const handleSendTestCall = async () => {
    if (!testCallClinic) return;
    if (!testCallPhone || testCallPhone.replace(/\D/g, '').length < 8) {
      toast.error('Σφάλμα: Εισάγετε έγκυρο αριθμό τηλεφώνου');
      return;
    }
    setIsSendingTest(true);
    setTestCallResult(null);
    try {
      const res = await api.post(`/admin/clinics/${testCallClinic.id}/test-missed-call`, { phone: testCallPhone });
      setTestCallResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['admin-test-calls-last'] });
      if (res.data?.smsStatus === 'sent') {
        toast.success('Test missed call: SMS εστάλη επιτυχώς');
      } else if (res.data?.smsStatus === 'scheduled') {
        toast.success('Test missed call: SMS προγραμματίστηκε (εκτός ωραρίου)');
      } else if (res.data?.smsStatus === 'skipped') {
        toast('Test missed call: παραλείφθηκε', { icon: '⚠️' });
      } else {
        toast.error('Test missed call: αποτυχία SMS');
      }
    } catch (err) {
      setTestCallResult({ success: false, error: err.response?.data?.error || err.message });
      toast.error('Σφάλμα: ' + (err.response?.data?.error || err.message || 'Αποτυχία'));
    } finally {
      setIsSendingTest(false);
    }
  };

  const [zadarmaTestRunning, setZadarmaTestRunning] = useState(false);
  const [zadarmaTestResult, setZadarmaTestResult] = useState(null);

  const handleRunZadarmaTest = async (clinic) => {
    if (!clinic) return;
    setZadarmaTestRunning(true);
    setZadarmaTestResult(null);
    try {
      const res = await api.post(`/admin/clinics/${clinic.id}/test-zadarma-webhook`, {});
      setZadarmaTestResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['admin-test-calls-last'] });
      refetchSetupStatus();
      if (res.data?.end?.smsStatus === 'sent') {
        toast.success('Zadarma test: SMS εστάλη επιτυχώς');
      } else if (res.data?.end?.smsStatus === 'scheduled') {
        toast.success('Zadarma test: SMS προγραμματίστηκε');
      } else if (res.data?.end?.smsStatus === 'skipped') {
        toast('Zadarma test: παραλείφθηκε', { icon: '⚠️' });
      } else {
        toast.error('Zadarma test: αποτυχία');
      }
    } catch (err) {
      setZadarmaTestResult({ success: false, error: err.response?.data?.error || err.message });
      toast.error('Σφάλμα: ' + (err.response?.data?.error || err.message || 'Αποτυχία'));
    } finally {
      setZadarmaTestRunning(false);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedClinics.length === 0) { toast.warning('Επιλέξτε ιατρεία'); return; }
    if (!action) { toast.warning('Επιλέξτε ενέργεια'); return; }
    let value;
    if (action === 'reset_credits') {
      const raw = prompt('Νέος αριθμός credits:', '100');
      if (!raw) return;
      const parsed = Number(raw);
      if (isNaN(parsed) || parsed < 0) return;
      value = parsed;
    }
    const confirmed = await new Promise(resolve => {
      toast(
        t => (
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', fontWeight: 600 }}>
            Εκτέλεση bulk action σε {selectedClinics.length} ιατρεία;
            <button
              onClick={() => { toast.dismiss(t.id); resolve(true); }}
              style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
            >
              Εντάξει
            </button>
            <button
              onClick={() => { toast.dismiss(t.id); resolve(false); }}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}
            >
              Ακύρωση
            </button>
          </span>
        ),
        { duration: 6000, style: { maxWidth: 360, fontSize: '0.82rem' } }
      );
    });
    if (!confirmed) return;
    try {
      await api.post('/admin/bulk-action', { clinicIds: selectedClinics, action, value });
      toast.success(`Επιδράθηκαν ${selectedClinics.length} ιατρεία`);
      setSelectedClinics([]);
      setBulkAction('');
      refetch();
    } catch (err) {
      toast.error('Αποτυχία bulk ενέργειας');
    }
  };

  const handleExportCSV = useCallback(() => {
    const rows = filteredClinics.map(c => ({
      'ID': c.id,
      'Όνομα': c.name,
      'Email': c.email,
      'Credits': c.messageCredits,
      'Όριο': c.monthlyCreditLimit,
      'Χρήση ημέρας': c.dailyUsedCount,
      'Ημερήσιο όριο': c.dailyMessageCap,
      'Ενεργό': c.isActive ? 'Ναι' : 'Όχι',
      'Χρήστες': c._count?.users || 0,
      'Ραντεβού': c._count?.appointments || 0,
      'Ασθενείς': c._count?.patients || 0,
      'Δημιουργία': new Date(c.createdAt).toLocaleDateString('el-GR')
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(';'), ...rows.map(r => headers.map(h => {
         const v = r[h];
         return `"${(v !== undefined && v !== null ? v : '').toString().replace(/"/g, '""')}"`;
       }).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `clinics_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Εξαγωγή CSV ολοκληρώθηκε');
  }, [filteredClinics]);

  if (isLoading) return <LoadingPlaceholder />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      {/* KPI ROWS */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }} className="kpi-grid">
         {[
           { label: 'Συνολικά Ιατρεία', value: metrics.total, icon: <Building2 size={20} />, accent: '#635bff', bg: 'rgba(99,91,255,0.08)' },
           { label: 'Ενεργά', value: metrics.active, icon: <CheckCircle2 size={20} />, accent: '#10b981', bg: 'rgba(16,185,129,0.08)' },
           { label: 'Ανενεργά', value: metrics.inactive, icon: <XCircle size={20} />, accent: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
           { label: 'Σύνολο Χρήστες', value: metrics.totalUsers, icon: <Users size={20} />, accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
          ].map((card) => (
          <div key={card.label} style={{
            background: 'var(--glass-surface)',
            backdropFilter: 'var(--glass-strong)',
            WebkitBackdropFilter: 'var(--glass-strong)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${card.accent}`,
            borderRadius: '12px',
            padding: '1.25rem 1.25rem',
            boxShadow: 'var(--shadow-md)',
            display: 'flex', alignItems: 'center', gap: '14px',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: card.bg, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: card.accent
            }}>{card.icon}</div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--secondary)', lineHeight: 1.1, marginTop: '2px' }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* KPI ROW 2: Messages & Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }} className="kpi-grid-2">
        {[
          { label: 'Ραντεβού', value: metrics.totalApps, icon: <Calendar size={18} />, accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
          { label: 'Μηνύματα / Ημέρα', value: `${metrics.totalUsedMsgs} / ${metrics.totalMsgs}`, icon: <MessageSquare size={18} />, accent: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', sub: `${Math.round((metrics.totalUsedMsgs / (metrics.totalMsgs || 1)) * 100)}% χρησιμοποίηση` },
          { label: 'Μεταβίβαση SMS', value: metrics.totalLogs, icon: <TrendingUp size={18} />, accent: '#10b981', bg: 'rgba(16,185,129,0.08)', sub: `${metrics.sentLogs} OK / ${metrics.failedLogs} λάθη` },
          { label: 'Ποσοστό Ενεργών', value: `${Math.round((metrics.active / (metrics.total || 1)) * 100)}%`, icon: <Activity size={18} />, accent: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
        ].map((card) => (
          <div key={card.label} style={{
            background: 'var(--glass-surface)',
            backdropFilter: 'var(--glass-strong)',
            WebkitBackdropFilter: 'var(--glass-strong)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderLeft: `3px solid ${card.accent}`,
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
            boxShadow: 'var(--shadow-md)',
            display: 'flex', alignItems: 'center', gap: '12px',
            transition: 'transform 0.2s'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: card.bg, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: card.accent
            }}>{card.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{card.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--secondary)', lineHeight: 1.1, marginTop: '2px' }}>{card.value}</div>
              {card.sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>{card.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* BULK ACTIONS BAR */}
      {selectedClinics.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,91,255,0.08) 0%, rgba(139,92,246,0.06) 100%)',
          border: '1px solid rgba(99,91,255,0.2)',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--primary)' }}>
            <CheckCircle2 size={16} style={{ display: 'inline-block', marginRight: '6px' }} />
            Επιλέχθηκαν {selectedClinics.length} ιατρεία
          </span>
<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} className="bulk-bar">
             <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} style={{
               padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
               background: 'var(--glass-control)', color: 'var(--text)',
               fontSize: '0.78rem', fontWeight: '600', outline: '2px solid transparent', fontFamily: 'inherit',
               appearance: 'none', cursor: 'pointer'
             }}>
               <option value="">Επιλέξτε ενέργεια…</option>
               <option value="activate">Ενεργοποίηση</option>
               <option value="deactivate">Απενεργοποίηση</option>
               <option value="reset_credits">Επαναφορά Credits</option>
             </select>
             <button onClick={() => { handleBulkAction(bulkAction); }} style={{
              padding: '6px 14px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #635bff, #8b5cf6)', color: 'white',
              fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
            }}>Ομαδική Ενέργεια</button>
            <button onClick={handleExportCSV} style={{
              padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
              background: 'var(--glass-control)', color: 'var(--text-light)',
              fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
            }}>
              <Download size={14} style={{ display: 'inline-block', marginRight: '4px' }} /> CSV
            </button>
            <button onClick={() => setSelectedClinics([])} style={{
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: 'rgba(239,68,68,0.08)', color: '#ef4444',
              fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
            }}>Κατάργηση</button>
          </div>
        </div>
      )}

      {/* TOOLBAR & TABLE */}
      <div style={{
        background: 'var(--glass-surface)',
        backdropFilter: 'var(--glass-strong)',
        WebkitBackdropFilter: 'var(--glass-strong)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '14px',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text" placeholder="Αναζήτηση..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '8px 12px 8px 30px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent', width: '200px', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
              />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
              padding: '8px 30px 8px 12px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent',
              appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath d=%22M6 8L1 3h10z%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center'
            }}>
              <option value="all">Όλοι</option>
              <option value="active">Ενεργοί</option>
              <option value="inactive">Ανενεργοί</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{filteredClinics.length} ιατρεία</span>
            <button onClick={handleExportCSV} style={{
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: 'rgba(16,185,129,0.1)', color: '#10b981',
              fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              <Download size={13} /> CSV
            </button>
          </div>
        </div>

<div style={{ overflowX: 'auto' }} className="mobile-table-min">
         <table style={{ width: '100%', borderCollapse: 'collapse' }}>
           <thead>
             <tr style={{ background: 'rgba(99,91,255,0.04)', borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
               <th style={{ ...thBase, width: '36px' }}>
                 <input type="checkbox" onChange={(e) => {
                   if (e.target.checked) setSelectedClinics(filteredClinics.map(c => c.id));
                   else setSelectedClinics([]);
                 }} checked={selectedClinics.length === filteredClinics.length && filteredClinics.length > 0} style={{ accentColor: 'var(--primary)' }} />
               </th>
               <SortThClinic field="name" label="Ιατρείο" sortBy={sortBy} sortDir={sortDir} handleSort={handleSort} />
                <SortThClinic field="email" label="Email" sortBy={sortBy} sortDir={sortDir} handleSort={handleSort} />
                <SortThClinic field="_count.users" label="Χρήστες" sortBy={sortBy} sortDir={sortDir} handleSort={handleSort} />
                <th style={thBase}>Τελευταίο Test</th>
                <SortThClinic field="createdAt" label="Δημιουργία" sortBy={sortBy} sortDir={sortDir} handleSort={handleSort} />
                <th style={thBase}>Ενέργειες</th>
             </tr>
           </thead>
            <tbody>
              {filteredClinics.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Δεν βρέθηκαν ιατρεία</td></tr>
               ) : filteredClinics.map(clinic => {
                 const msgPct = clinic.dailyMessageCap > 0 ? Math.round((clinic.dailyUsedCount / clinic.dailyMessageCap) * 100) : 0;
                 const msgColor = msgPct > 80 ? '#ef4444' : msgPct > 50 ? '#f59e0b' : '#10b981';
                 const wh = webhookHealth?.perClinic?.find(c => c.clinicId === clinic.id);
                 const whDot = !wh ? '#64748b' : wh.stale ? '#ef4444' : (wh.failingEventTypes?.length > 0 ? '#f59e0b' : '#10b981');
                 const whTitle = !wh ? 'No webhook activity yet'
                   : wh.stale ? `Stale — last success: ${wh.lastSuccessAt ? new Date(wh.lastSuccessAt).toLocaleString('el-GR') : 'never'}`
                   : wh.failingEventTypes?.length > 0 ? `Some events failing: ${wh.failingEventTypes.join(', ')}`
                   : `OK — last success: ${wh.lastSuccessAt ? new Date(wh.lastSuccessAt).toLocaleString('el-GR') : '—'}`;
                 return (
                   <tr key={clinic.id} style={{
                     borderBottom: '1px solid rgba(255,255,255,0.04)',
                     transition: 'background 0.15s',
                     background: selectedClinics.includes(clinic.id) ? 'rgba(99,91,255,0.04)' : 'rgba(255,255,255,0.01)'
                   }}>
                     <td style={tdBase}>
                       <input type="checkbox" checked={selectedClinics.includes(clinic.id)} onChange={(e) => {
                         setSelectedClinics(prev => e.target.checked ? [...prev, clinic.id] : prev.filter(id => id !== clinic.id));
                       }} style={{ accentColor: 'var(--primary)' }} />
                     </td>
                     <td style={tdBase}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <Tooltip title={whTitle}>
                           <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: whDot, flexShrink: 0, boxShadow: whDot === '#ef4444' ? '0 0 6px rgba(239,68,68,0.6)' : 'none' }} />
                         </Tooltip>
                         <div>
                           <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text)' }}>{clinic.name || '—'}</div>
                           <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>{clinic.email || ''}</div>
                         </div>
                       </div>
                     </td>
                    <td style={{ ...tdBase, fontSize: '0.72rem' }}>{clinic.email || '—'}</td>
                    <td style={tdBase}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '50px', height: '6px', borderRadius: '3px',
                          background: 'rgba(255,255,255,0.08)', overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(100, msgPct)}%`, height: '100%',
                            background: msgColor, borderRadius: '3px',
                            transition: 'width 0.5s'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: msgColor, fontWeight: '600' }}>
                          {clinic.dailyUsedCount}/{clinic.dailyMessageCap}
                        </span>
                      </div>
                    </td>
                    <td style={tdBase}>
                      <span style={{ fontWeight: '700', fontSize: '0.82rem' }}>{clinic._count?.users || 0}</span>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>📅 {clinic._count?.appointments || 0} 👤 {clinic._count?.patients || 0}</div>
                    </td>
                    <td style={tdBase}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 10px', borderRadius: '99px',
                        fontSize: '0.7rem', fontWeight: '700',
                        background: clinic.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        color: clinic.isActive ? '#10b981' : '#ef4444',
                        border: `1px solid ${clinic.isActive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`
                      }}>
                        {clinic.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {clinic.isActive ? 'Ενεργό' : 'Σε Παύση'}
                      </span>
                    </td>
                    <td style={{ ...tdBase, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const tc = testCalls?.perClinic?.[clinic.id];
                        if (!tc) {
                          return (
                            <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b', display: 'inline-block' }} />
                              <span style={{ fontWeight: '600' }}>Δεν έχει γίνει</span>
                            </span>
                          );
                        }
                        const isOk = tc.smsStatus === 'sent';
                        const isScheduled = tc.smsStatus === 'scheduled';
                        const isFail = tc.smsStatus === 'failed' || (!isOk && !isScheduled);
                        const dotColor = isOk ? '#10b981' : isScheduled ? '#f59e0b' : isFail ? '#ef4444' : '#64748b';
                        const statusLabel = isOk ? 'Εστάλη' : isScheduled ? 'Προγραμματίστηκε' : isFail ? 'Απέτυχε' : (tc.smsStatus || '—');
                        const ago = tc.sentAt ? formatTimeAgo(new Date(tc.sentAt)) : '—';
                        return (
                          <Tooltip title={`${tc.smsStatus || '—'} · ${ago}${tc.smsError ? ' · ' + tc.smsError : ''}`}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, boxShadow: dotColor === '#ef4444' ? '0 0 6px rgba(239,68,68,0.6)' : 'none' }} />
                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                <span style={{ fontWeight: '700', color: 'var(--text)' }}>{statusLabel}</span>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{ago}</span>
                              </div>
                            </span>
                          </Tooltip>
                        );
                      })()}
                    </td>
                    <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      <Clock size={10} style={{ display: 'inline-block', marginRight: '3px' }} />
                      {new Date(clinic.createdAt).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                        <Tooltip title="Επιπλέον πληροφορίες">
                          <button onClick={() => setDetailClinic(clinic)} style={{
                            ...actionBtnBase, color: 'var(--primary)', background: 'rgba(99,91,255,0.08)'
                          }}><Eye size={14} /></button>
                        </Tooltip>
                        <Tooltip title="🧪 Send test missed call">
                          <button onClick={() => openTestCallModal(clinic)} style={{
                            ...actionBtnBase, color: '#06b6d4', background: 'rgba(6,182,212,0.08)'
                          }}><FlaskConical size={14} /></button>
                        </Tooltip>
                        <Tooltip title={clinic.isActive ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}>
                          <button onClick={() => handleToggleActive(clinic.id, clinic.isActive, clinic.name)} style={{
                            ...actionBtnBase,
                            color: clinic.isActive ? '#f59e0b' : '#10b981',
                            background: clinic.isActive ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)'
                          }}><RefreshCw size={14} /></button>
                        </Tooltip>
                        <Tooltip title="Προσθήκη Credits">
                          <button onClick={() => handleAddCredits(clinic.id)} style={{
                            ...actionBtnBase, color: '#8b5cf6', background: 'rgba(139,92,246,0.08)'
                          }}><CreditCard size={14} /></button>
                        </Tooltip>
                        <Tooltip title="Διαγραφή">
                          <button onClick={() => handleDeleteClinic(clinic.id, clinic.name)} style={{
                            ...actionBtnBase, color: '#ef4444', background: 'rgba(239,68,68,0.08)'
                          }}><Trash2 size={14} /></button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECENT ACTIVITY — only show on clinics tab */}
      <div style={{
        background: 'var(--glass-surface)',
        backdropFilter: 'var(--glass-strong)',
        WebkitBackdropFilter: 'var(--glass-strong)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '14px',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '1rem', paddingBottom: '0.75rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: 'var(--primary)' }} />
            Πρόσφατη Δραστηριότητα
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {metrics.sentLogs} ✓ / {metrics.failedLogs} ✗
          </span>
        </div>
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Δεν υπάρχουν ακόμα λειτουργίες
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(99,91,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={thBase}>Ιατρείο</th>
                  <th style={thBase}>Τύπος</th>
                  <th style={thBase}>Κατάσταση</th>
                  <th style={thBase}>Κόστος</th>
                  <th style={thBase}>Χρόνος</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 15).map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}>
                    <td style={tdBase}><span style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--text)' }}>{log.clinic?.name || '—'}</span></td>
                    <td style={{ ...tdBase, textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontWeight: '700',
                        background: log.type === 'SMS' ? 'rgba(99,91,255,0.1)' : log.type === 'VOICE' ? 'rgba(37,99,235,0.1)' : 'rgba(139,92,246,0.1)',
                        color: log.type === 'SMS' ? '#635bff' : log.type === 'VOICE' ? '#2563eb' : '#8b5cf6'
                      }}>{log.type}</span>
                    </td>
                    <td style={tdBase}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: '700',
                        color: log.status === 'SENT' ? '#10b981' : log.status === 'FAILED' ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {log.status === 'SENT' ? '✓ Απεστάλη' : log.status === 'FAILED' ? '✗ Απέτυχε' : log.status}
                      </span>
                    </td>
                    <td style={tdBase}><span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{log.cost} cr</span></td>
                    <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString('el-GR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE CLINIC MODAL */}
      {showCreateModal && (
<div onClick={() => setShowCreateModal(false)} style={{
           position: 'fixed', inset: 0, zIndex: 100,
           background: 'rgba(5,11,27,0.65)',
           backdropFilter: 'blur(10px) saturate(160%)',
           WebkitBackdropFilter: 'blur(10px) saturate(160%)',
           display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
         }}>
           <div onClick={e => e.stopPropagation()} style={{
             width: '100%', maxWidth: '480px',
             background: 'var(--glass-surface-strong)',
backdropFilter: 'blur(10px) saturate(200%)',
              WebkitBackdropFilter: 'blur(10px) saturate(200%)',
             borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)',
             boxShadow: '0 32px 64px -12px rgba(5,11,27,0.4)',
             overflow: 'hidden', position: 'relative'
           }} className="modal-responsive">
            <div style={{ position: 'absolute', inset: 0, background: 'var(--glass-sheen)', pointerEvents: 'none', opacity: 0.4 }} />
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-control-soft)', position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #635bff, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={16} color="white" />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>Δημιουργία Νέου Ιατρείου</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{
                width: '28px', height: '28px', borderRadius: '6px',
                background: 'var(--glass-control)', border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--cancel-color)', backdropFilter: 'blur(10px)'
              }}><X size={14} /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newClinic.name || !newClinic.ownerEmail || !newClinic.ownerPassword) return;
                setIsCreating(true);
                try {
                  await api.post('/admin/clinics', newClinic);
                  toast.success('Το ιατρείο δημιουργήθηκε');
                  setShowCreateModal(false);
                  setNewClinic({ name: '', ownerEmail: '', ownerPassword: '', ownerName: '' });
                  refetch();
                } catch (err) {
                  toast.error(err.response?.data?.error || 'Αποτυχία δημιουργίας');
                } finally {
                  setIsCreating(false);
                }
              }}
              style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Στοιχεία Ιατρείου</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div><label htmlFor="new-clinic-name" style={formLabel}>Όνομα Ιατρείου *</label><input id="new-clinic-name" required style={inputBase} value={newClinic.name} onChange={e => setNewClinic(prev => ({ ...prev, name: e.target.value }))} placeholder="π.χ. Οδοντιατρείο Παπαδόπουλου" /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.25rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Στοιχεία Ιδιοκτήτη</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div><label htmlFor="new-owner-name" style={formLabel}>Όνομα Ιδιοκτήτη</label><input id="new-owner-name" style={inputBase} value={newClinic.ownerName} onChange={e => setNewClinic(prev => ({ ...prev, ownerName: e.target.value }))} placeholder="Πλήρες όνομα" /></div>
              <div><label htmlFor="new-owner-email" style={formLabel}>Email Ιδιοκτήτη *</label><input id="new-owner-email" required type="email" style={inputBase} value={newClinic.ownerEmail} onChange={e => setNewClinic(prev => ({ ...prev, ownerEmail: e.target.value }))} placeholder="owner@clinic.gr" /></div>
              <div><label htmlFor="new-owner-password" style={formLabel}>Αρχικός Κωδικός *</label><input id="new-owner-password" required type="password" style={inputBase} value={newClinic.ownerPassword} onChange={e => setNewClinic(prev => ({ ...prev, ownerPassword: e.target.value }))} placeholder="••••••••" /></div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'var(--glass-control)', color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s' }}>Ακύρωση</button>
                <button type="submit" disabled={isCreating} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: isCreating ? 'var(--glass-control)' : 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)', color: isCreating ? 'var(--text-light)' : 'white', fontWeight: '800', fontSize: '0.88rem', cursor: isCreating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 6px 18px -6px rgba(99,91,255,0.4)', transition: 'all 0.2s' }}>
                  {isCreating ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
                  {isCreating ? 'Δημιουργία...' : 'Δημιουργία Ιατρείου & Λογαριασμού'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLINIC DETAIL MODAL */}
      {detailClinic && (
<div onClick={() => setDetailClinic(null)} style={{
           position: 'fixed', inset: 0, zIndex: 100,
           background: 'rgba(5,11,27,0.65)',
           backdropFilter: 'blur(10px) saturate(160%)',
           WebkitBackdropFilter: 'blur(10px) saturate(160%)',
           display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
         }}>
           <div onClick={e => e.stopPropagation()} style={{
              width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
              background: 'var(--glass-surface-strong)',
backdropFilter: 'blur(10px) saturate(200%)',
               WebkitBackdropFilter: 'blur(10px) saturate(200%)',
              borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 32px 64px -12px rgba(5,11,27,0.4)', overflow: 'hidden', position: 'relative'
            }} className="modal-responsive">
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-control-soft)', position: 'relative' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>{detailClinic.name}</h3>
              <button onClick={() => setDetailClinic(null)} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--glass-control)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cancel-color)', backdropFilter: 'blur(10px)' }}><X size={14} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <DetailRow label="ID" value={detailClinic.id} />
              <DetailRow label="Πακέτο" value={
                <span style={{
                  textTransform: 'uppercase', fontWeight: '800', fontSize: '0.75rem',
                  color: detailClinic.plan === 'enterprise' ? '#8b5cf6' :
                         detailClinic.plan === 'trial' ? 'var(--text-muted)' : 'var(--primary)'
                }}>
                  {detailClinic.plan || 'trial'}
                </span>
              } />
              <DetailRow label="Email" value={detailClinic.email || '—'} />
              <DetailRow label="Τηλέφωνο" value={detailClinic.phone || '—'} />
              <DetailRow label="Τόπος" value={detailClinic.location || '—'} />
              <DetailRow label="Credits" value={`${detailClinic.messageCredits || 0} / ${detailClinic.monthlyCreditLimit || 0}`} />
              <DetailRow label="Ημερήσιο όριο" value={`${detailClinic.dailyUsedCount || 0} / ${detailClinic.dailyMessageCap || 0}`} />
              <DetailRow label="Λογαριασμός SMS" value={`${detailClinic.smsMonthlyLimit || 0} / μήνα`} />
              <DetailRow label="Λογαριασμός AI" value={`${detailClinic.aiMonthlyLimit || 0} / μήνα`} />
              <DetailRow label="Χρήστες" value={detailClinic._count?.users || 0} />
              <DetailRow label="Ραντεβού" value={detailClinic._count?.appointments || 0} />
              <DetailRow label="Ασθενείς" value={detailClinic._count?.patients || 0} />
              <DetailRow label="Κατάσταση" value={
                <span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: '700', background: detailClinic.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: detailClinic.isActive ? '#10b981' : '#ef4444' }}>
                  {detailClinic.isActive ? 'Ενεργό' : 'Ανενεργό'}
                </span>
              } />
              <DetailRow label="Onboarding" value={
                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: detailClinic.onboardingCompleted ? '#10b981' : 'var(--text-muted)' }}>
                  {detailClinic.onboardingCompleted ? 'Ολοκληρωμένο' : 'Εκκρεμεί'}
                </span>
              } />
              <DetailRow label="Onboarding %" value={
                <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>
                  {detailClinic.onboardingCompleted ? '100%' : '0%'}
                </span>
              } />
              {testCalls?.perClinic?.[detailClinic.id] && (() => {
                const tc = testCalls.perClinic[detailClinic.id];
                const isOk = tc.smsStatus === 'sent';
                const isScheduled = tc.smsStatus === 'scheduled';
                const isFail = tc.smsStatus === 'failed' || (!isOk && !isScheduled);
                const dotColor = isOk ? '#10b981' : isScheduled ? '#f59e0b' : isFail ? '#ef4444' : '#64748b';
                return (
                  <DetailRow label="Τελευταίο Test" value={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor }} />
                      <span style={{ fontWeight: '700' }}>
                        {isOk ? 'Εστάλη' : isScheduled ? 'Προγραμματίστηκε' : 'Απέτυχε'}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>· {formatTimeAgo(tc.sentAt)}</span>
                    </span>
                  } />
                );
              })()}
              <button
                onClick={() => { setDetailClinic(null); openTestCallModal(detailClinic); }}
                style={{
                  marginTop: '0.5rem',
                  padding: '10px 14px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)',
                  color: 'white', fontSize: '0.85rem', fontWeight: '800',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 6px 18px -6px rgba(6,182,212,0.4)'
                }}>
                <FlaskConical size={15} />
                🧪 Send test missed call
              </button>

              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <h4 style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ListChecks size={14} style={{ color: 'var(--primary)' }} />
                    Setup Checklist
                  </h4>
                  {setupStatus?.checklist && (() => {
                    const entries = Object.entries(setupStatus.checklist);
                    const passed = entries.filter(([k, v]) => {
                      if (k === 'trialActive') return v === true;
                      return v === 'configured' || v === 'verified' || v === 'passed';
                    }).length;
                    return (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                        {passed}/{entries.length}
                      </span>
                    );
                  })()}
                </div>

                {!setupStatus ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Φόρτωση...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[
                      { key: 'zadarmaNumber', label: 'Zadarma Number', okWhen: ['configured'] },
                      { key: 'zadarmaWebhookTest', label: 'Zadarma Webhook Test', okWhen: ['passed'] },
                      { key: 'vapiSipTest', label: 'Vapi SIP Test', okWhen: ['passed'] },
                      { key: 'twilioCreds', label: 'Twilio Credentials', okWhen: ['configured'] },
                      { key: 'twilioSender', label: 'Twilio Sender', okWhen: ['verified'] },
                      { key: 'workingHours', label: 'Working Hours', okWhen: ['configured'] },
                      { key: 'webhookUrls', label: 'Webhook URLs', okWhen: ['configured'] },
                      { key: 'testMissedCall', label: 'Test Missed Call', okWhen: ['passed'] },
                      { key: 'trialActive', label: 'Trial Active', okWhen: [true] },
                    ].map(({ key, label, okWhen }) => {
                      const v = setupStatus.checklist[key];
                      const ok = okWhen.includes(v);
                      const warn = !ok && v !== 'missing' && v !== 'failed' && v !== 'untested' && v !== 'unverified' && v !== false;
                      const dotColor = ok ? '#10b981' : warn ? '#f59e0b' : '#ef4444';
                      const displayVal = v === true ? 'ναι' : v === false ? 'όχι' : v;
                      const linkTarget = key === 'workingHours' || key === 'webhookUrls' || key === 'zadarmaNumber'
                        ? '/settings'
                        : key === 'vapiSipTest' ? '/ai' : null;
                      return (
                        <div key={key} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 10px', borderRadius: '8px',
                          background: ok ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                          border: `1px solid ${ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0,
                              boxShadow: dotColor === '#ef4444' ? '0 0 6px rgba(239,68,68,0.5)' : 'none'
                            }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text)' }}>{label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em',
                              color: ok ? '#10b981' : warn ? '#f59e0b' : '#ef4444'
                            }}>{displayVal}</span>
                            {linkTarget && (
                              <Tooltip title={`Άνοιγμα ${linkTarget}`}>
                                <button
                                  onClick={() => window.open(linkTarget, '_blank')}
                                  style={{
                                    width: '20px', height: '20px', borderRadius: '4px',
                                    background: 'rgba(99,91,255,0.08)', border: 'none',
                                    cursor: 'pointer', color: 'var(--primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                  <ExternalLink size={11} />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div style={{ display: 'flex', gap: '6px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => refetchSetupStatus()}
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.15)', background: 'var(--glass-control)',
                          color: 'var(--text-light)', fontSize: '0.72rem', fontWeight: '700',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                        }}>
                        <RefreshCw size={12} /> Ανανέωση
                      </button>
                      <button
                        onClick={() => handleRunZadarmaTest(detailClinic)}
                        disabled={zadarmaTestRunning || !setupStatus?.checklist?.zadarmaNumber || setupStatus?.checklist?.zadarmaNumber === 'missing'}
                        style={{
                          flex: 2, padding: '6px 10px', borderRadius: '8px', border: 'none',
                          background: (zadarmaTestRunning || !setupStatus?.checklist?.zadarmaNumber || setupStatus?.checklist?.zadarmaNumber === 'missing')
                            ? 'var(--glass-control)' : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                          color: 'white', fontSize: '0.72rem', fontWeight: '700',
                          cursor: (zadarmaTestRunning || !setupStatus?.checklist?.zadarmaNumber || setupStatus?.checklist?.zadarmaNumber === 'missing') ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                        }}>
                        {zadarmaTestRunning ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={12} />}
                        {zadarmaTestRunning ? 'Εκτέλεση...' : 'Test Zadarma Webhook'}
                      </button>
                    </div>

                    {zadarmaTestResult && (
                      <div style={{
                        marginTop: '0.4rem', padding: '8px 10px', borderRadius: '8px', fontSize: '0.7rem',
                        background: zadarmaTestResult.end?.smsStatus === 'sent' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${zadarmaTestResult.end?.smsStatus === 'sent' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
                      }}>
                        <div style={{ fontWeight: '800', marginBottom: '4px' }}>
                          {zadarmaTestResult.end?.smsStatus === 'sent' ? '✓ Zadarma test: SMS εστάλη' :
                           zadarmaTestResult.end?.smsStatus === 'scheduled' ? '⏱ Zadarma test: προγραμματίστηκε' :
                           zadarmaTestResult.end?.smsStatus === 'skipped' ? '⚠ Zadarma test: παραλείφθηκε' :
                           zadarmaTestResult.success === false ? '✗ Zadarma test: αποτυχία' : 'Zadarma test αποτέλεσμα'}
                        </div>
                        {zadarmaTestResult.callSid && <div style={{ color: 'var(--text-muted)' }}>callSid: <code>{zadarmaTestResult.callSid}</code></div>}
                        {zadarmaTestResult.end?.missedCallId && <div style={{ color: 'var(--text-muted)' }}>missedCallId: <code>{zadarmaTestResult.end.missedCallId}</code></div>}
                        {zadarmaTestResult.end?.smsStatus && <div style={{ color: 'var(--text-muted)' }}>smsStatus: {zadarmaTestResult.end.smsStatus}</div>}
                        {zadarmaTestResult.end?.reason && <div style={{ color: 'var(--text-muted)' }}>reason: {zadarmaTestResult.end.reason}</div>}
                        {zadarmaTestResult.error && <div style={{ color: '#ef4444' }}>error: {zadarmaTestResult.error}</div>}
                        {zadarmaTestResult.elapsedMs !== undefined && <div style={{ color: 'var(--text-muted)' }}>elapsed: {zadarmaTestResult.elapsedMs}ms</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEST MISSED CALL MODAL */}
      {testCallClinic && (
        <div onClick={closeTestCallModal} style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(5,11,27,0.65)',
          backdropFilter: 'blur(10px) saturate(160%)',
          WebkitBackdropFilter: 'blur(10px) saturate(160%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: '480px',
            background: 'var(--glass-surface-strong)',
            backdropFilter: 'blur(10px) saturate(200%)',
            WebkitBackdropFilter: 'blur(10px) saturate(200%)',
            borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 32px 64px -12px rgba(5,11,27,0.4)',
            overflow: 'hidden', position: 'relative'
          }} className="modal-responsive">
            <div style={{ position: 'absolute', inset: 0, background: 'var(--glass-sheen)', pointerEvents: 'none', opacity: 0.4 }} />
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-control-soft)', position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlaskConical size={16} color="white" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>🧪 Test missed call</h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{testCallClinic.name}</p>
                </div>
              </div>
              <button onClick={closeTestCallModal} style={{
                width: '28px', height: '28px', borderRadius: '6px',
                background: 'var(--glass-control)', border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--cancel-color)', backdropFilter: 'blur(10px)'
              }}><X size={14} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', position: 'relative' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', lineHeight: 1.5, padding: '10px 12px', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.18)', borderRadius: '8px' }}>
                <strong>Τι κάνει:</strong> Στέλνει ένα συνθετικό missed call στον αριθμό που θα επιλέξετε,
                ενεργοποιώντας τη ροή ανάκτησης (Twilio SMS). Δεν καλεί πραγματικά τηλέφωνο και δεν ενεργοποιεί Vapi.
              </div>
              <div>
                <label htmlFor="test-call-phone" style={{
                  display: 'block', fontSize: '0.7rem', fontWeight: '700',
                  color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px'
                }}>Αριθμός τηλεφώνου (GR)</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="test-call-phone"
                    type="tel"
                    value={testCallPhone}
                    onChange={e => setTestCallPhone(e.target.value)}
                    placeholder="+3069XXXXXXXX"
                    style={{
                      width: '100%', padding: '10px 12px 10px 34px', borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)', color: 'white',
                      fontSize: '0.85rem', outline: '2px solid transparent', fontFamily: 'inherit',
                      transition: 'border-color 0.2s', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {testCallResult && (
                <div style={{
                  padding: '12px 14px', borderRadius: '10px',
                  border: `1px solid ${testCallResult.smsStatus === 'sent' ? 'rgba(16,185,129,0.3)' :
                                       testCallResult.smsStatus === 'scheduled' ? 'rgba(245,158,11,0.3)' :
                                       testCallResult.smsStatus === 'skipped' ? 'rgba(148,163,184,0.3)' :
                                       'rgba(239,68,68,0.3)'}`,
                  background: testCallResult.smsStatus === 'sent' ? 'rgba(16,185,129,0.08)' :
                              testCallResult.smsStatus === 'scheduled' ? 'rgba(245,158,11,0.08)' :
                              testCallResult.smsStatus === 'skipped' ? 'rgba(148,163,184,0.08)' :
                              'rgba(239,68,68,0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {testCallResult.smsStatus === 'sent' ? <CheckCircle2 size={16} color="#10b981" /> :
                     testCallResult.smsStatus === 'scheduled' ? <Clock size={16} color="#f59e0b" /> :
                     testCallResult.smsStatus === 'skipped' ? <AlertCircle size={16} color="#94a3b8" /> :
                     <XCircle size={16} color="#ef4444" />}
                    <span style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--text)' }}>
                      {testCallResult.smsStatus === 'sent' ? 'SMS εστάλη επιτυχώς' :
                       testCallResult.smsStatus === 'scheduled' ? 'SMS προγραμματίστηκε' :
                       testCallResult.smsStatus === 'skipped' ? 'Παραλείφθηκε' :
                       testCallResult.success === false ? 'Αποτυχία' : 'Αποτέλεσμα'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                    {testCallResult.missedCallId && <div><strong>missedCallId:</strong> <code style={{ fontSize: '0.7rem' }}>{testCallResult.missedCallId}</code></div>}
                    {testCallResult.smsStatus && <div><strong>smsStatus:</strong> <code style={{ fontSize: '0.7rem' }}>{testCallResult.smsStatus}</code></div>}
                    {testCallResult.callSid && <div><strong>callSid:</strong> <code style={{ fontSize: '0.7rem' }}>{testCallResult.callSid}</code></div>}
                    {testCallResult.scheduledSmsAt && <div><strong>scheduledSmsAt:</strong> {new Date(testCallResult.scheduledSmsAt).toLocaleString('el-GR')}</div>}
                    {testCallResult.reason && <div><strong>reason:</strong> {testCallResult.reason}</div>}
                    {testCallResult.elapsedMs !== undefined && <div><strong>elapsed:</strong> {testCallResult.elapsedMs}ms</div>}
                    {testCallResult.error && <div style={{ color: '#ef4444' }}><strong>error:</strong> {testCallResult.error}</div>}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '0.25rem' }}>
                <button type="button" onClick={closeTestCallModal} style={{
                  flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                  background: 'var(--glass-control)', color: 'var(--text-light)', fontSize: '0.85rem',
                  fontWeight: '700', cursor: 'pointer'
                }}>Κλείσιμο</button>
                <button
                  type="button"
                  onClick={handleSendTestCall}
                  disabled={isSendingTest}
                  style={{
                    flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
                    background: isSendingTest ? 'var(--glass-control)' : 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)',
                    color: isSendingTest ? 'var(--text-light)' : 'white',
                    fontWeight: '800', fontSize: '0.88rem', cursor: isSendingTest ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    boxShadow: '0 6px 18px -6px rgba(6,182,212,0.4)'
                  }}>
                  {isSendingTest ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                  {isSendingTest ? 'Αποστολή...' : 'Εκτέλεση Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
};

const Tooltip = ({ title, children }) => (
  <div title={title} style={{ display: 'inline-flex' }}>{children}</div>
);

const formLabel = {
  display: 'block', fontSize: '0.7rem', fontWeight: '700',
  color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px'
};

const inputBase = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)', color: 'white',
  fontSize: '0.85rem', outline: '2px solid transparent', fontFamily: 'inherit',
  transition: 'border-color 0.2s', boxSizing: 'border-box'
};

export default AdminDashboard;