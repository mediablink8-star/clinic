import React, { useEffect } from 'react';
import { X, CheckCircle2, Building2, Zap, ArrowRight } from 'lucide-react';

const WelcomeModal = ({ clinic, onClose, onNavigate }) => {
  // Auto-close after 12 seconds
  useEffect(() => {
    const timer = setTimeout(() => onClose(), 12000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5,11,27,0.7)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '1rem'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '560px',
          background: 'var(--glass-surface-strong)',
          backdropFilter: 'blur(20px) saturate(220%)',
          WebkitBackdropFilter: 'blur(20px) saturate(220%)',
          borderRadius: '32px',
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: '0 40px 100px -20px rgba(5,11,27,0.6), 0 0 0 1px rgba(255,255,255,0.25)',
          overflow: 'hidden',
          position: 'relative',
          animation: 'slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards'
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            background: 'var(--glass-sheen)',
            pointerEvents: 'none',
            opacity: 0.5
          }}
        />

        {/* Header */}
        <div style={{
          padding: '2rem 2rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          background: 'var(--glass-control-soft)',
          position: 'relative',
          gap: '16px'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '20px',
            background: 'linear-gradient(135deg, var(--primary), #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0,102,255,0.4)',
            marginBottom: '4px'
          }}>
            <Building2 size={32} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: '950', color: 'var(--text)', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
              Καλώς ήρθατε στο ClinicFlow!
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-light)', margin: 0, fontWeight: '600', opacity: 0.9 }}>
              Το ιατρείο σας είναι έτοιμο — ας ξεκινήσουμε!
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '1.5rem', right: '1.5rem',
              width: '32px', height: '32px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--cancel-color)', transition: 'all 0.15s',
              backdropFilter: 'blur(10px)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>

          {/* Quick-setup cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            {[
              { icon: <Zap size={20} />, label: 'Ρυθμίσεις AI', desc: 'Ρύθμιση ωραρίου και υπηρεσιών', gradient: 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)', navigate: 'ai' },
              { icon: <Building2 size={20} />, label: 'Στοιχεία Ιατρείου', desc: 'Όνομα, τηλέφωνο, τοποθεσία', gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', navigate: 'settings' },
              { icon: <CheckCircle2 size={20} />, label: 'Ανακτήσεις', desc: 'Ελέγξτε τις ρυθμίσεις ανάκτησης', gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', navigate: 'dashboard' },
            ].map((item) => (
              <div key={item.label} onClick={() => { if (onNavigate) onNavigate(item.navigate); onClose(); }} style={{
                padding: '1rem', borderRadius: '14px',
                background: item.gradient,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                color: 'white', cursor: 'pointer',
                boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ position: 'relative', zIndex: 1 }}>{item.icon}</div>
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '800' }}>{item.label}</div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.85, marginTop: '2px' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Checklist */}
          <div style={{
            background: 'var(--bg-subtle)',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid var(--border)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: 'var(--text)', margin: '0 0 1rem' }}>
              Ελέγξτε τις ρυθμίσεις σας
            </h3>
            {[
              { text: 'Στοιχεία Ιατρείου — Όνομα, τηλέφωνο, email' },
              { text: 'Ωράριο εργασίας και υπηρεσίες' },
              { text: 'API κλειδιά (Zadarma, Gemini)' },
              { text: 'Voice AI (προαιρετικό)' },
            ].map((item) => (
              <div key={item.text} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 0', fontSize: '0.85rem', color: 'var(--text-light)',
                fontWeight: '600'
              }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={12} color="var(--accent)" />
                </div>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Auto-dismiss hint */}
          <div style={{
            textAlign: 'center', padding: '0.75rem',
            background: 'rgba(99,91,255,0.08)',
            borderRadius: '10px', border: '1px solid rgba(99,91,255,0.15)'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>
              <ArrowRight size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Αυτό το παράθυρο κλείνει αυτόματα σε 12 δευτερόλεπτα
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.75rem 1.25rem', display: 'flex', gap: '0.75rem', position: 'relative' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px',
              borderRadius: '14px', border: '1px solid rgba(255,255,255,0.3)',
              background: 'var(--glass-control)', fontSize: '0.9rem',
              fontWeight: '700', color: 'var(--text)', cursor: 'pointer',
              backdropFilter: 'blur(10px) saturate(160%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)'
            }}
          >
            Ξεκίνα τώρα
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;