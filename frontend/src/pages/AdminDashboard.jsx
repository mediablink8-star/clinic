import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  Building2, Users, Calendar, MessageSquare, Plus, X, Shield,
  CheckCircle2, XCircle, Search, RefreshCw, Trash2, CreditCard,
  Activity, AlertTriangle, Eye, TrendingUp, Clock, AlertOctagon,
  ArrowUpDown, ChevronDown, ChevronUp, Filter, Download,
  Lock, Unlock, ShieldCheck, FileText, BarChart2, Layers,
  AlertCircle, Check, X as XIcon, UserPlus, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

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

const thBase = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '0.68rem',
  fontWeight: '800',
  color: 'var(--text-light)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '2px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap'
};

const tdBase = {
  padding: '12px 14px',
  fontSize: '0.82rem',
  color: 'var(--text)',
  borderBottom: '1px solid rgba(255,255,255,0.03)',
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
          background: 'rgba(255,255,255,0.03)',
          animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.15}s`
        }} />
      ))}
    </div>
    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', height: '200px' }} />
  </div>
);

const ErrorState = ({ onRetry }) => (
  <div style={{ textAlign: 'center', padding: '3rem' }}>
    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
    <p style={{ color: 'var(--urgent)', fontWeight: '700', marginBottom: '1.5rem' }}>Αποτυχία φόρτωσης δεδομένων</p>
    <button onClick={onRetry} style={{
      padding: '10px 24px', borderRadius: '10px', border: 'none',
      background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
      color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem'
    }}>
      <RefreshCw size={14} style={{ marginRight: '6px' }} />
      Επανάληψη
    </button>
  </div>
);

const DetailRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
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
    { label: 'Συνολικά Ιατρεία', value: s.totalClinics, icon: <Building2 size={20} />, accent: '#635bff', bg: 'rgba(99,91,255,0.08)' },
    { label: 'Ενεργά', value: s.activeClinics, icon: <CheckCircle2 size={20} />, accent: '#10b981', bg: 'rgba(16,185,129,0.08)' },
    { label: 'Ανενεργά', value: s.inactiveClinics, icon: <XCircle size={20} />, accent: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
    { label: 'Σύνολο Χρήστες', value: s.totalUsers, icon: <Users size={20} />, accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
    { label: 'Ραντεβού', value: s.totalAppointments, icon: <Calendar size={18} />, accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    { label: 'Μηνύματα', value: s.totalMessages, icon: <MessageSquare size={18} />, accent: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
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
          border: '1px solid rgba(255,255,255,0.25)',
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
              <div key={u.email} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
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
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '14px',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-md)'
        }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
            Ιατρεία Χαμηλών Credits
          </h3>
          {(data.lowCreditClinics || []).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>Όλα τα ιατρεία έχουν επαρκή credits</p>
          ) : (
            (data.lowCreditClinics || []).map((c) => (
              <div key={c.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600' }}>{c.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: c.messageCredits < 20 ? '#ef4444' : '#f59e0b' }}>
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
          border: '1px solid rgba(255,255,255,0.25)',
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
                background: 'rgba(99,91,255,0.08)',
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
    if (!window.confirm(`Διαγραφή χρήστη "${name}"; Αυτή η ενέργεια είναι μη αναστρέψιμη.`)) return;
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
                 style={{ padding: '8px 12px 8px 30px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent', width: '100%', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
               />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{
            padding: '8px 30px 8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent',
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
            padding: '8px 30px 8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.82rem', outline: '2px solid transparent',
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
              <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s', background: 'rgba(255,255,255,0.01)' }}>
                <td style={tdBase}>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text)' }}>{user.name || '—'}</div>
                  {user.isPlatformAdmin && <span style={{ fontSize: '0.65rem', color: '#635bff', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}><ShieldCheck size={10} /> Platform Admin</span>}
                </td>
                <td style={{ ...tdBase, fontSize: '0.8rem' }}>{user.email}</td>
                <td style={tdBase}>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: '700',
                    padding: '3px 8px', borderRadius: '4px',
                    background: user.role === 'ADMIN' ? 'rgba(99,91,255,0.1)' : user.role === 'OWNER' ? 'rgba(139,92,246,0.1)' : user.role === 'DOCTOR' ? 'rgba(37,99,235,0.1)' : 'rgba(148,163,184,0.15)',
                    color: user.role === 'ADMIN' ? '#635bff' : user.role === 'OWNER' ? '#8b5cf6' : user.role === 'DOCTOR' ? '#2563eb' : '#64748b'
                  }}>
                    {user.role === 'ADMIN' ? 'Διαχειριστής' : user.role === 'OWNER' ? 'Ιδιοκτήτης' : user.role === 'DOCTOR' ? 'Γιατρός' : user.role === 'RECEPTIONIST' ? 'Γραμματέας' : 'Βοηθός'}
                  </span>
                </td>
                <td style={tdBase}>
                  {user.lockedUntil ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Lock size={10} /> Κλειδωμένος
                    </span>
                  ) : user.isActive ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={10} /> Ενεργός
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
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
                        color: user.lockedUntil ? '#10b981' : '#f59e0b',
                        background: user.lockedUntil ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)'
                      }}>
                        {user.lockedUntil ? <Unlock size={13} /> : <Lock size={13} />}
                      </button>
                    <button title={user.isActive ? 'Απενεργοποίηση' : 'Ενεργοποίηση'} onClick={() => handleToggleActive(user.id, user.isActive, user.name)} style={{
                        ...actionBtnBase,
                        color: user.isActive ? '#f59e0b' : '#10b981',
                        background: user.isActive ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)'
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
    const headers = ['Timestamp', 'Ιατρείο', 'Χρήστης', 'Ενέργεια', 'Οντότητα', 'ID Οντότητας', 'Λεπτομέρειες', 'IP'];
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
              <tr style={{ background: 'rgba(99,91,255,0.04)', borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
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
              Admin Control Plane
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
    if (!window.confirm(currentState ? `Απενεργοποίηση "${name}"; Όλες οι αυτοματοποιήσεις θα σταματήσουν.` : `Ενεργοποίηση "${name}";`)) return;
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
               <SortThClinic field="createdAt" label="Δημιουργία" sortBy={sortBy} sortDir={sortDir} handleSort={handleSort} />
               <th style={thBase}>Ενέργειες</th>
             </tr>
           </thead>
            <tbody>
              {filteredClinics.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Δεν βρέθηκαν ιατρεία</td></tr>
              ) : filteredClinics.map(clinic => {
                const msgPct = clinic.dailyMessageCap > 0 ? Math.round((clinic.dailyUsedCount / clinic.dailyMessageCap) * 100) : 0;
                const msgColor = msgPct > 80 ? '#ef4444' : msgPct > 50 ? '#f59e0b' : '#10b981';
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
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text)' }}>{clinic.name || '—'}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>{clinic.email || ''}</div>
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
              <div><label htmlFor="new-clinic-name" style={formLabel}>Όνομα Ιατρείου *</label><input id="new-clinic-name" required style={inputBase} value={newClinic.name} onChange={e => setNewClinic({ ...newClinic, name: e.target.value })} placeholder="π.χ. Οδοντιατρείο Παπαδόπουλου" /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.25rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Στοιχεία Ιδιοκτήτη</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div><label htmlFor="new-owner-name" style={formLabel}>Όνομα Ιδιοκτήτη</label><input id="new-owner-name" style={inputBase} value={newClinic.ownerName} onChange={e => setNewClinic({ ...newClinic, ownerName: e.target.value })} placeholder="Πλήρες όνομα" /></div>
              <div><label htmlFor="new-owner-email" style={formLabel}>Email Ιδιοκτήτη *</label><input id="new-owner-email" required type="email" style={inputBase} value={newClinic.ownerEmail} onChange={e => setNewClinic({ ...newClinic, ownerEmail: e.target.value })} placeholder="owner@clinic.gr" /></div>
              <div><label htmlFor="new-owner-password" style={formLabel}>Αρχικός Κωδικός *</label><input id="new-owner-password" required type="password" style={inputBase} value={newClinic.ownerPassword} onChange={e => setNewClinic({ ...newClinic, ownerPassword: e.target.value })} placeholder="••••••••" /></div>
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
             width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
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
                  {onboardingData?.clinics?.find(c => c.id === detailClinic.id) ?
                    `${onboardingData.clinics.find(c => c.id === detailClinic.id).onboardingCompleted ? '100%' : '0%'}` : '—'}
                </span>
              } />
            </div>
          </div>
        </div>
      )}
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