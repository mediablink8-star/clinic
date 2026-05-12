import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  Building2, Users, Calendar, MessageSquare, Plus, X, ShieldAlert,
  CheckCircle2, XCircle, Search, ArrowUpDown, ArrowUp, ArrowDown,
  CreditCard, Activity, AlertTriangle, RefreshCw, Trash2, Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
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

  // Metrics computed from data
  const metrics = useMemo(() => {
    const total = clinics.length;
    const active = clinics.filter(c => c.isActive).length;
    const inactive = total - active;
    const totalUsers = clinics.reduce((sum, c) => sum + (c._count?.users || 0), 0);
    const totalApps = clinics.reduce((sum, c) => sum + (c._count?.appointments || 0), 0);
    const totalPatients = clinics.reduce((sum, c) => sum + (c._count?.patients || 0), 0);
    const totalMsgs = clinics.reduce((sum, c) => sum + (c.messageCredits || 0), 0);
    const totalUsedMsgs = clinics.reduce((sum, c) => sum + (c.dailyUsedCount || 0), 0);
    return { total, active, inactive, totalUsers, totalApps, totalPatients, totalMsgs, totalUsedMsgs };
  }, [clinics]);

  // Filtered & sorted clinics
  const filteredClinics = useMemo(() => {
    let result = [...clinics];
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
  }, [clinics, searchTerm, sortBy, sortDir]);

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const handleToggleActive = async (clinicId, currentState) => {
    if (!window.confirm(currentState
      ? 'Απενεργοποίηση ιατρείου; Όλες οι αυτοματοποιήσεις θα σταματήσουν.'
      : 'Ενεργοποίηση ιατρείου;'
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

  const handleCreateClinic = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await api.post('/admin/clinics', newClinic);
      toast.success('Το ιατρείο δημιουργήθηκε!');
      setShowCreateModal(false);
      setNewClinic({ name: '', ownerEmail: '', ownerPassword: '', ownerName: '' });
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Αποτυχία δημιουργίας');
    } finally {
      setIsCreating(false);
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

  const SortHeader = ({ field, label }) => (
    <th
      onClick={() => handleSort(field)}
      style={{
        ...thStyle,
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}
        <ArrowUpDown size={12} style={{ opacity: sortBy === field ? 1 : 0.4 }} />
      </div>
    </th>
  );

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page Header */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
         <div>
           <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.03em' }}>
             <ShieldAlert size={22} style={{ color: 'var(--primary)' }} />
             Πίνακας Ελέγχου Διαχειριστή
           </h1>
           <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px' }}>
             Πλατφόρμα διαχείρισης ιατρείων · {metrics.total} εγγραφές
           </p>
         </div>
         <button
           onClick={() => setShowCreateModal(true)}
           style={{
             display: 'flex', alignItems: 'center', gap: '8px',
             padding: '10px 18px', borderRadius: '12px', border: 'none',
             background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
             color: 'white', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
             boxShadow: '0 8px 20px -4px rgba(99,91,255,0.4)', transition: 'all 0.2s'
           }}
         >
           <Plus size={16} /> Νέο Ιατρείο
</button>
        </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { icon: <Building2 size={18} />, label: 'Ιατρεία', value: metrics.total, color: 'var(--primary)', bg: 'rgba(99,91,255,0.1)' },
          { icon: <CheckCircle2 size={18} />, label: 'Ενεργά', value: metrics.active, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { icon: <XCircle size={18} />, label: 'Ανενεργά', value: metrics.inactive, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          { icon: <Users size={18} />, label: 'Χρήστες', value: metrics.totalUsers, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
          { icon: <Calendar size={18} />, label: 'Ραντεβού', value: metrics.totalApps, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { icon: <MessageSquare size={18} />, label: 'Credits', value: `${metrics.totalUsedMsgs}/${metrics.totalMsgs}`, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
        ].map((card, i) => (
          <div key={i} style={kpiCardStyle(card.bg)}>
            <div style={{ ...kpiIconStyle(card.color), background: card.bg }}>{card.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--secondary)', lineHeight: 1.1, marginBottom: '2px' }}>{card.value}</div>
            <div style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Clinics Table */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '-0.02em' }}>
            <Building2 size={16} style={{ color: 'var(--primary)' }} />
            Ιατρεία ({filteredClinics.length})
          </h2>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Αναζήτηση..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                padding: '8px 12px 8px 32px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text)', fontSize: '0.82rem', outline: 'none',
                width: '220px', maxWidth: '100%', fontFamily: 'inherit',
                transition: 'border-color 0.2s'
              }}
            />
          </div>
        </div>

        <div className="card-glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(99,91,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <SortHeader field="name" label="Όνομα" />
                  <SortHeader field="email" label="Email" />
                  <th style={thStyle}>Ημέσια / Όρια</th>
                  <SortHeader field="_count" label="Χρήστες" />
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {filteredClinics.map(clinic => (
                  <tr key={clinic.id} style={trStyle}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text)' }}>{clinic.name || '—'}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{clinic.email || '—'}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Progress value={clinic.dailyUsedCount} max={clinic.dailyMessageCap} size="sm" />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{clinic.dailyUsedCount}/{clinic.dailyMessageCap}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '0.8rem' }}>{clinic._count?.users || 0}</span>
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge active={clinic.isActive} />
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Tooltip text="Ενημέρωση">
                          <button onClick={() => handleToggleActive(clinic.id, clinic.isActive)} style={iconBtnStyle}>
                            <RefreshCw size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip text="Προσθήκη Credits">
                          <button onClick={() => handleAddCredits(clinic.id)} style={{ ...iconBtnStyle, color: 'var(--accent)' }}>
                            <CreditCard size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip text="Διαγραφή">
                          <button onClick={() => handleDeleteClinic(clinic.id, clinic.name)} style={{ ...iconBtnStyle, color: 'var(--urgent)' }}>
                            <Trash2 size={14} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity Log */}
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '-0.02em' }}>
          <Activity size={16} style={{ color: 'var(--primary)' }} />
          Πρόσφατη Δραστηριότητα
        </h2>
        <div className="card-glass" style={{ borderRadius: '16px', padding: '0', maxHeight: '320px', overflow: 'hidden' }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Δεν υπάρχουν ακόμα λειτουργίες</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(99,91,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={thStyle}>Ιατρείο</th>
                  <th style={thStyle}>Τύπος</th>
                  <th style={thStyle}>Κατάσταση</th>
                  <th style={thStyle}>Κόστος</th>
                  <th style={thStyle}>Ώρα</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map(log => (
                  <tr key={log.id} style={trStyle}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: '600', fontSize: '0.82rem' }}>{log.clinic?.name || '—'}</span>
                    </td>
                    <td style={{ ...tdStyle, textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.03em' }}>
                      <span style={logTypeBadgeStyle(log.type)}>{log.type}</span>
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge active={log.status === 'SENT'} small />
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{log.cost} cr</span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(log.timestamp).toLocaleString('el-GR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && <CreateModal onClose={() => setShowCreateModal(false)} onSubmit={handleCreateClinic} loading={isCreating} values={newClinic} onChange={setNewClinic} />}
    </div>
  );
};

/* ── Sub-components ── */

const StatusBadge = ({ active, small }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: small ? '3px 8px' : '5px 10px',
    borderRadius: '99px', fontSize: small ? '0.68rem' : '0.72rem',
    fontWeight: '700',
    background: active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
    color: active ? '#10b981' : '#ef4444',
    border: `1px solid ${active ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`
  }}>
    {active ? <CheckCircle2 size={small ? 10 : 12} /> : <XCircle size={small ? 10 : 12} />}
    {active ? 'Ενεργό' : 'Ανενεργό'}
  </span>
);

const Progress = ({ value, max, size }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981';
  return (
    <div style={{ width: size === 'sm' ? '60px' : '80px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s' }} />
    </div>
  );
};

const Tooltip = ({ text, children }) => (
  <div style={{ position: 'relative' }} title={text}>{children}</div>
);

const CreateModal = ({ onClose, onSubmit, loading, values, onChange }) => (
  <div onClick={onClose} style={{
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'rgba(5,11,27,0.6)',
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
  }}>
    <div onClick={e => e.stopPropagation()} style={{
      width: '100%', maxWidth: '480px',
      background: 'var(--glass-surface-strong)',
      backdropFilter: 'blur(32px) saturate(200%)',
      WebkitBackdropFilter: 'blur(32px) saturate(200%)',
      borderRadius: '20px', border: '1px solid rgba(255,255,255,0.25)',
      boxShadow: '0 32px 64px -12px rgba(5,11,27,0.3)', overflow: 'hidden', position: 'relative'
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--glass-sheen)', pointerEvents: 'none', opacity: 0.5 }} />
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-control-soft)', position: 'relative' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>Δημιουργία Νέου Ιατρείου</h3>
        <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--glass-control)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cancel-color)', backdropFilter: 'blur(12px)' }}>
          <X size={14} />
        </button>
      </div>
      <form onSubmit={onSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
        <Input label="Όνομα Ιατρείου *" value={values.name} onChange={v => onChange({ ...values, name: v })} required />
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Στοιχεία Ιδιοκτήτη</p>
        </div>
        <Input label="Όνομα" value={values.ownerName} onChange={v => onChange({ ...values, ownerName: v })} required />
        <Input label="Email *" type="email" value={values.ownerEmail} onChange={v => onChange({ ...values, ownerEmail: v })} required />
        <Input label="Αρχικός Κωδικός *" type="password" value={values.ownerPassword} onChange={v => onChange({ ...values, ownerPassword: v })} required />
        <button type="submit" disabled={loading} style={{
          marginTop: '0.5rem', padding: '11px', borderRadius: '12px', border: 'none',
          background: loading ? 'var(--glass-control)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
          color: loading ? 'var(--text-light)' : 'white', fontWeight: '800', fontSize: '0.88rem',
          cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          boxShadow: '0 8px 20px -4px rgba(99,91,255,0.4)', transition: 'all 0.2s'
        }}>
          {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
          {loading ? 'Δημιουργία...' : 'Δημιουργία Ιατρείου'}
        </button>
      </form>
    </div>
  </div>
);

const Input = ({ label, type = 'text', value, onChange, required }) => (
  <div>
    <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: '4px' }}>{label}</label>
    <input type={type} required={required} value={value} onChange={e => onChange(e.target.value)} style={{
      width: '100%', padding: '10px 12px', borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
      color: 'white', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
      transition: 'border-color 0.2s', boxSizing: 'border-box'
    }} />
  </div>
);

const kpiCardStyle = (bg) => ({
  background: 'var(--glass-surface)',
  backdropFilter: 'var(--glass-strong)',
  WebkitBackdropFilter: 'var(--glass-strong)',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: '14px',
  padding: '1.25rem',
  boxShadow: 'var(--shadow-md)',
  position: 'relative',
  overflow: 'hidden'
});

const kpiIconStyle = (color) => ({
  width: '42px', height: '42px', borderRadius: '12px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 8px 20px -8px rgba(0,0,0,0.3)',
  background: color,
  color: 'white',
  marginBottom: '8px'
});

const thStyle = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '0.68rem',
  fontWeight: '800',
  color: 'var(--text-light)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(255,255,255,0.08)'
};

const tdStyle = {
  padding: '10px 14px',
  fontSize: '0.82rem',
  color: 'var(--text)',
  borderBottom: '1px solid rgba(255,255,255,0.04)'
};

const trStyle = {
  transition: 'background 0.15s',
  background: 'rgba(255,255,255,0.01)'
};

const iconBtnStyle = {
  width: '30px', height: '30px', borderRadius: '6px',
  background: 'rgba(255,255,255,0.06)', border: 'none',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-light)', transition: 'all 0.15s'
};

const logTypeBadgeStyle = (type) => ({
  padding: '2px 8px', borderRadius: '4px', fontWeight: '700',
  background: type === 'SMS' ? 'rgba(99,91,255,0.12)' : type === 'VOICE' ? 'rgba(37,99,235,0.12)' : 'rgba(139,92,246,0.12)',
  color: type === 'SMS' ? '#635bff' : type === 'VOICE' ? '#2563eb' : '#8b5cf6'
});

const ErrorState = ({ onRetry }) => (
  <div style={{ textAlign: 'center', padding: '3rem' }}>
    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
    <p style={{ color: 'var(--urgent)', fontWeight: '700', marginBottom: '1rem' }}>Αποτυχία φόρτωσης δεδομένων</p>
    <button onClick={onRetry} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
      Επανάληψη
    </button>
  </div>
);

const LoadingSkeleton = () => (
  <div style={{ padding: '2rem' }}>
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
      {[...Array(6)].map((_, i) => <div key={i} style={{ flex: 1, height: '60px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
    </div>
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1rem', height: '200px' }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ width: '120px', height: '14px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ flex: 1, height: '14px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ width: '80px', height: '14px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ width: '100px', height: '14px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }} />
        </div>
      ))}
    </div>
  </div>
);

export default AdminDashboard;