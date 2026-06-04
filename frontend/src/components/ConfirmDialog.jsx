import { AlertTriangle, X } from 'lucide-react';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Επιβεβαίωση', cancelLabel = 'Ακύρωση', variant = 'danger', loading = false }) => {
  if (!isOpen) return null;

  const variantColors = {
    danger: { bg: '#fef2f2', border: '#fecaca', icon: '#ef4444', btn: '#ef4444', btnHover: '#dc2626' },
    warning: { bg: '#fffbeb', border: '#fde68a', icon: '#f59e0b', btn: '#f59e0b', btnHover: '#d97706' },
    info: { bg: '#eff6ff', border: '#bfdbfe', icon: '#3b82f6', btn: '#3b82f6', btnHover: '#2563eb' },
  };

  const colors = variantColors[variant] || variantColors.danger;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(5,11,27,0.45)', backdropFilter: 'blur(12px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-fade"
        style={{
          background: 'var(--modal-bg)',
          borderRadius: '24px', padding: '2rem',
          maxWidth: '420px', width: '100%',
          border: '1px solid var(--modal-border)',
          boxShadow: 'var(--shadow-2xl)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '12px', right: '12px',
            width: '32px', height: '32px', borderRadius: '10px',
            border: 'none', background: 'var(--bg-subtle)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <X size={16} />
        </button>

        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          background: colors.bg, border: `2px solid ${colors.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1.25rem',
        }}>
          <AlertTriangle size={28} color={colors.icon} />
        </div>

        <h3 style={{
          fontSize: '1.15rem', fontWeight: '900', color: 'var(--secondary)',
          marginBottom: '8px', letterSpacing: '-0.02em',
        }}>
          {title}
        </h3>

        <p style={{
          fontSize: '0.9rem', color: 'var(--text-light)',
          lineHeight: '1.6', marginBottom: '1.75rem', fontWeight: '500',
        }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-outline"
            style={{ flex: 1, padding: '12px', borderRadius: '14px', fontSize: '0.85rem' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '12px', borderRadius: '14px', fontSize: '0.85rem',
              fontWeight: '800', border: 'none', cursor: 'pointer',
              background: colors.btn, color: 'white',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Επεξεργασία...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
