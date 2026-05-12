import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  Building2, Users, Calendar, MessageSquare, Plus, X, Shield,
  CheckCircle2, XCircle, Search, RefreshCw, Trash2, CreditCard,
  Activity, AlertTriangle, Eye, TrendingUp, Clock, AlertOctagon,
  ArrowUpDown, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [detailClinic, setDetailClinic] = useState(null);
  const [newClinic, setNewClinic] = useState({
    name: '', ownerEmail: '', ownerPassword: '', ownerName: ''
  });
  const [isCreating, setIsCreating] = useState(false);

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
    if (statusFilter !== 'all') {
      result = result.filter(c => c.isActive === (statusFilter === 'active'));
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.id?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const va = a[sortBy] ?? '';
      const vb = b[sortBy] ?? '';
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return result;
  }, [clinics, searchTerm, statusFilter, sortBy, sortDir]);

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const handleToggleActive = async (clinicId, currentState, name) => {
    if (!window.confirm(currentState
      ? `Απενεργοποίηση "${name}"; Όλες οι αυτοματοποιήσεις θα σταματήσουν.`
      : `Ενεργοποίηση "${name}";`
    )) return;
    try {
      await api.post('/clinic/toggle-status', { isActive: !currentState });
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
    if (!window.confirm(`Διαγραφή "${name}"; Αυτή η ενέργεια είναι μη αναστρέψιμη.`)) return;
    try {
      await api.delete(`/admin/clinics/${clinicId}`);
      toast.success('Το ιατρείο διαγράφηκε');
      refetch();
    } catch (err) {
      toast.error('Αποτυχία διαγραφής');
    }
  };

  const SortArrow = ({ field }) => {
    if (sortBy !== field) return <ArrowUpDown size={12} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ color: 'var(--primary)', marginLeft: '4px' }} />
      : <ChevronDown size={12} style={{ color: 'var(--primary)', marginLeft: '4px' }} />;
  };

  const SortTh = ({ field, label }) => (
    <th onClick={() => handleSort(field)} style={{
      ...thBase,
      cursor: 'pointer', userSelect: 'none',
      background: sortBy === field ? 'rgba(99,91,255,0.08)' : 'transparent'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {label}<SortArrow field={field} />
      </div>
    </th>
  );

  const activePct = metrics.total > 0 ? Math.round((metrics.active / metrics.total) * 100) : 0;
  const msgUsagePct = metrics.totalMsgs > 0 ? Math.round((metrics.totalUsedMsgs / metrics.totalMsgs) * 100) : 0;

  if (isLoading) return <LoadingPlaceholder />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{
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
            {metrics.active > 0 && <span style={{
              fontSize: '0.65rem', fontWeight: '700', padding: '3px 8px',
              borderRadius: '99px', background: 'rgba(16,185,129,0.12)',
              color: '#10b981', border: '1px solid rgba(16,185,129,0.25)'
            }}>ΣΥΝΔΕΔΕΜΕΝΟ</span>}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: 0 }}>
            Πλατφόρμα διαχείρισης · {metrics.active} ενεργά / {metrics.total} συνολικά ιατρεία
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)',
            color: 'white', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
            boxShadow: '0 6px 20px -6px rgba(99,91,255,0.5)',
            transition: 'all 0.2s ease', whiteSpace: 'nowrap'
          }}
          onMouseOver={e => e.currentTarget.style.boxShadow = '0 8px 28px -6px rgba(99,91,255,0.6)'}
          onMouseOut={e => e.currentTarget.style.boxShadow = '0 6px 20px -6px rgba(99,91,255,0.5)'}
        >
          <Plus size={16} />
          Νέο Ιατρείο
        </button>
      </div>

      {/* ── KPI ROW 1: 4 big cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Συνολικά Ιατρεία', value: metrics.total, icon: <Building2 size={20} />, accent: '#635bff', bg: 'rgba(99,91,255,0.08)' },
          { label: 'Ενεργά', value: metrics.active, icon: <CheckCircle2 size={20} />, accent: '#10b981', bg: 'rgba(16,185,129,0.08)' },
          { label: 'Ανενεργά', value: metrics.inactive, icon: <XCircle size={20} />, accent: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
          { label: 'Σύνολο Χρήστες', value: metrics.totalUsers, icon: <Users size={20} />, accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
        ].map((card, i) => (
          <div key={i} style={{
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

      {/* ── KPI ROW 2: Messages & Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Ραντεβού', value: metrics.totalApps, icon: <Calendar size={18} />, accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
          { label: 'Μηνύματα / Ημέρα', value: `${metrics.totalUsedMsgs} / ${metrics.totalMsgs}`, icon: <MessageSquare size={18} />, accent: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', sub: `${msgUsagePct}% χρησιμοποίηση` },
          { label: 'Μεταβίβαση SMS', value: metrics.totalLogs, icon: <TrendingUp size={18} />, accent: '#10b981', bg: 'rgba(16,185,129,0.08)', sub: `${metrics.sentLogs} OK / ${metrics.failedLogs} λάθη` },
          { label: 'Ποσοστό Ενεργών', value: `${activePct}%`, icon: <Activity size={18} />, accent: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
        ].map((card, i) => (
          <div key={i} style={{
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

      {/* ── TOOLBAR & TABLE ── */}
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
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Αναζήτηση..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  padding: '8px 12px 8px 30px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text)', fontSize: '0.82rem', outline: 'none',
                  width: '200px', fontFamily: 'inherit',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 30px 8px 12px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text)', fontSize: '0.82rem', outline: 'none',
                appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath d=%22M6 8L1 3h10z%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center'
              }}
            >
              <option value="all">Όλοι</option>
              <option value="active">Ενεργοί</option>
              <option value="inactive">Ανενεργοί</option>
            </select>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {filteredClinics.length} ιατρεία
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(99,91,255,0.04)', borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                <SortTh field="name" label="Ιατρείο" />
                <th style={thBase}>Credits</th>
                <th style={thBase}>Χρήστες</th>
                <th style={thBase}>Status</th>
                <th style={thBase}>Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {filteredClinics.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Δεν βρέθηκαν ιατρεία</td></tr>
              ) : filteredClinics.map(clinic => {
                const msgPct = clinic.dailyMessageCap > 0 ? Math.round((clinic.dailyUsedCount / clinic.dailyMessageCap) * 100) : 0;
                const msgColor = msgPct > 80 ? '#ef4444' : msgPct > 50 ? '#f59e0b' : '#10b981';
                return (
                  <tr key={clinic.id} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s',
                    background: 'rgba(255,255,255,0.01)'
                  }}>
                    <td style={tdBase}>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text)' }}>{clinic.name || '—'}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{clinic.email || ''}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} />
                        {new Date(clinic.createdAt).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
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
                      <span style={{
                        fontSize: '0.82rem', fontWeight: '700',
                        color: (clinic._count?.users || 0) > 0 ? 'var(--text)' : 'var(--text-muted)'
                      }}>
                        {clinic._count?.users || 0}
                      </span>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        📅 {clinic._count?.appointments || 0} &nbsp; 👤 {clinic._count?.patients || 0}
                      </div>
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
                    <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Tooltip title="Επιπλέον πληροφορίες">
                          <button onClick={() => setDetailClinic(clinic)} style={{
                            ...actionBtnBase,
                            color: 'var(--primary)',
                            background: 'rgba(99,91,255,0.08)'
                          }}>
                            <Eye size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip title={clinic.isActive ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}>
                          <button onClick={() => handleToggleActive(clinic.id, clinic.isActive, clinic.name)} style={{
                            ...actionBtnBase,
                            color: clinic.isActive ? '#f59e0b' : '#10b981',
                            background: clinic.isActive ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)'
                          }}>
                            <RefreshCw size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip title="Προσθήκη Credits">
                          <button onClick={() => handleAddCredits(clinic.id)} style={{
                            ...actionBtnBase,
                            color: '#8b5cf6',
                            background: 'rgba(139,92,246,0.08)'
                          }}>
                            <CreditCard size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip title="Διαγραφή">
                          <button onClick={() => handleDeleteClinic(clinic.id, clinic.name)} style={{
                            ...actionBtnBase,
                            color: '#ef4444',
                            background: 'rgba(239,68,68,0.08)'
                          }}>
                            <Trash2 size={14} />
                          </button>
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

      {/* ── RECENT ACTIVITY SECTION ── */}
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
                  <tr key={log.id} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    transition: 'background 0.15s'
                  }}>
                    <td style={tdBase}>
                      <span style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--text)' }}>
                        {log.clinic?.name || '—'}
                      </span>
                    </td>
                    <td style={{ ...tdBase, textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontWeight: '700',
                        background: log.type === 'SMS' ? 'rgba(99,91,255,0.1)' : log.type === 'VOICE' ? 'rgba(37,99,235,0.1)' : 'rgba(139,92,246,0.1)',
                        color: log.type === 'SMS' ? '#635bff' : log.type === 'VOICE' ? '#2563eb' : '#8b5cf6'
                      }}>
                        {log.type}
                      </span>
                    </td>
                    <td style={tdBase}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: '700',
                        color: log.status === 'SENT' ? '#10b981' : log.status === 'FAILED' ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {log.status === 'SENT' ? '✓ Απεστάλη' : log.status === 'FAILED' ? '✗ Απέτυχε' : log.status}
                      </span>
                    </td>
                    <td style={tdBase}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{log.cost} cr</span>
                    </td>
                    <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString('el-GR', {
                        hour: '2-digit', minute: '2-digit',
                        day: 'numeric', month: 'short'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(5,11,27,0.65)',
            backdropFilter: 'blur(16px) saturate(160%)',
            WebkitBackdropFilter: 'blur(16px) saturate(160%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '480px',
              background: 'var(--glass-surface-strong)',
              backdropFilter: 'blur(32px) saturate(200%)',
              WebkitBackdropFilter: 'blur(32px) saturate(200%)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 32px 64px -12px rgba(5,11,27,0.4)',
              overflow: 'hidden', position: 'relative'
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'var(--glass-sheen)', pointerEvents: 'none', opacity: 0.4 }} />

            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--glass-control-soft)', position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #635bff, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Building2 size={16} color="white" />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>
                  Δημιουργία Νέου Ιατρείου
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: 'var(--glass-control)', border: '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--cancel-color)', transition: 'all 0.15s', backdropFilter: 'blur(12px)'
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleCreateClinic}
              style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}
            >
              {/* Section divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <span style={{
                  fontSize: '0.65rem', fontWeight: '800', color: 'var(--primary)',
                  textTransform: 'uppercase', letterSpacing: '0.08em'
                }}>
                  Στοιχεία Ιατρείου
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>

              <div>
                <label style={formLabel}>Όνομα Ιατρείου *</label>
                <input
                  required
                  style={inputBase}
                  value={newClinic.name}
                  onChange={e => setNewClinic({ ...newClinic, name: e.target.value })}
                  placeholder="π.χ. Οδοντιατρείο Παπαδόπουλου"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.25rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <span style={{
                  fontSize: '0.65rem', fontWeight: '800', color: 'var(--primary)',
                  textTransform: 'uppercase', letterSpacing: '0.08em'
                }}>
                  Στοιχεία Ιδιοκτήτη
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>

              <div>
                <label style={formLabel}>Όνομα Ιδιοκτήτη</label>
                <input
                  required
                  style={inputBase}
                  value={newClinic.ownerName}
                  onChange={e => setNewClinic({ ...newClinic, ownerName: e.target.value })}
                  placeholder="Πλήρες όνομα"
                />
              </div>
              <div>
                <label style={formLabel}>Email Ιδιοκτήτη *</label>
                <input
                  required
                  type="email"
                  style={inputBase}
                  value={newClinic.ownerEmail}
                  onChange={e => setNewClinic({ ...newClinic, ownerEmail: e.target.value })}
                  placeholder="owner@clinic.gr"
                />
              </div>
              <div>
                <label style={formLabel}>Αρχικός Κωδικός *</label>
                <input
                  required
                  type="password"
                  style={inputBase}
                  value={newClinic.ownerPassword}
                  onChange={e => setNewClinic({ ...newClinic, ownerPassword: e.target.value })}
                  placeholder="••••••••"
                />
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'var(--glass-control)',
                    color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '700',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  style={{
                    flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
                    background: isCreating
                      ? 'var(--glass-control)'
                      : 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)',
                    color: isCreating ? 'var(--text-light)' : 'white',
                    fontWeight: '800', fontSize: '0.88rem',
                    cursor: isCreating ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    boxShadow: '0 6px 18px -6px rgba(99,91,255,0.4)',
                    transition: 'all 0.2s'
                  }}
                >
                  {isCreating
                    ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Plus size={14} />}
                  {isCreating ? 'Δημιουργία...' : 'Δημιουργία Ιατρείου & Λογαριασμού'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CLINIC DETAIL MODAL ── */}
      {detailClinic && (
        <div
          onClick={() => setDetailClinic(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(5,11,27,0.65)',
            backdropFilter: 'blur(16px) saturate(160%)',
            WebkitBackdropFilter: 'blur(16px) saturate(160%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
              background: 'var(--glass-surface-strong)',
              backdropFilter: 'blur(32px) saturate(200%)',
              WebkitBackdropFilter: 'blur(32px) saturate(200%)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 32px 64px -12px rgba(5,11,27,0.4)',
              overflow: 'hidden', position: 'relative'
            }}
          >
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--glass-control-soft)', position: 'relative'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>
                {detailClinic.name}
              </h3>
              <button
                onClick={() => setDetailClinic(null)}
                style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: 'var(--glass-control)', border: '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--cancel-color)', backdropFilter: 'blur(12px)'
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <DetailRow label="ID" value={detailClinic.id} />
              <DetailRow label="Email" value={detailClinic.email || '—'} />
              <DetailRow label="Ήθος" value={detailClinic.tone || '—'} />
              <DetailRow label="Βασικός αριθμός" value={detailClinic.phone || '—'} />
              <DetailRow label="Credits" value={`${detailClinic.messageCredits || 0} / ${detailClinic.monthlyCreditLimit || 0}`} />
              <DetailRow label="Ημερήσιο όριο" value={`${detailClinic.dailyUsedCount || 0} / ${detailClinic.dailyMessageCap || 0}`} />
              <DetailRow label="Χρήστες" value={detailClinic._count?.users || 0} />
              <DetailRow label="Ραντεβού" value={detailClinic._count?.appointments || 0} />
              <DetailRow label="Ασθενείς" value={detailClinic._count?.patients || 0} />
              <DetailRow label="Κατάσταση" value={
                <span style={{
                  padding: '3px 8px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: '700',
                  background: detailClinic.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: detailClinic.isActive ? '#10b981' : '#ef4444'
                }}>
                  {detailClinic.isActive ? 'Ενεργό' : 'Ανενεργό'}
                </span>
              } />
              <DetailRow label="Onboarding" value={
                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: detailClinic.onboardingCompleted ? '#10b981' : 'var(--text-muted)' }}>
                  {detailClinic.onboardingCompleted ? 'Ολοκληρωμένο' : 'Εκκρεμεί'}
                </span>
              } />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Helper Components ── */

const Tooltip = ({ title, children }) => (
  <div title={title} style={{ display: 'inline-flex' }}>{children}</div>
);

const DetailRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{label}</span>
    <span style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: '600' }}>{value}</span>
  </div>
);

const LoadingPlaceholder = () => (
  <div style={{ padding: '2rem' }}>
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{
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

/* ── Style Constants ── */

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

const formLabel = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: '700',
  color: 'var(--text-light)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  marginBottom: '4px'
};

const inputBase = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: 'white',
  fontSize: '0.85rem',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box'
};

export default AdminDashboard;