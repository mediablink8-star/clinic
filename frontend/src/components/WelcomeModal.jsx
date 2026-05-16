import React, { useEffect } from 'react';
import { X, CheckCircle2, Building2, Zap, ArrowRight } from 'lucide-react';

const WelcomeModal = ({ clinic, onClose }) => {
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
        background: 'rgba(5,11,27,0.6)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '560px',
          background: 'var(--glass-surface-strong)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          borderRadius: '28px',
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: '0 32px 64px -12px rgba(5,11,27,0.3), 0 0 0 1px rgba(255,255,255,0.3)',
          overflow: 'hidden',
          position: 'relative',
          animation: 'slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards'
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
          padding: '1.5rem 1.75rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--glass-control-soft)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary), #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,102,255,0.3)'
            }}>
              <Building2 size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>
                Καλώς ήρθατε στο ClinicFlow! 🎉
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0, fontWeight: '500' }}>
                Το ιατρείο σας είναι έτοιμο — ας ξεκινήσουμε!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--glass-control)', border: '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--cancel-color)', transition: 'all 0.15s',
              backdropFilter: 'blur(16px) saturate(160%)', zIndex: 2
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>

          {/* Quick-setup cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            {[
              { icon: <Zap size={20} />, label: 'Ρυθμίσεις AI', desc: 'Ρύθμιση ωραρίου και υπηρεσιών', gradient: 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)' },
              { icon: <Building2 size={20} />, label: 'Στοιχεία Ιατρείου', desc: 'Όνομα, τηλέφωνο, τοποθεσία', gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' },
              { icon: <CheckCircle2 size={20} />, label: 'Ανακτήσεις', desc: 'Ελέγξτε τις ρυθμίσεις ανάκτησης', gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)' },
            ].map((item, i) => (
              <div key={i} style={{
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
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '14px',
            padding: '1.25rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text)', margin: '0 0 0.75rem' }}>
              Ελέγξτε τις ρυθμίσεις σας
            </h3>
            {[
              { text: 'Στοιχεία Ιατρείου — Όνομα, τηλέφωνο, email' },
              { text: 'Ωράριο εργασίας και υπηρεσίες' },
              { text: 'API κλειδιά (Twilio, Gemini)' },
              { text: 'Voice AI (προαιρετικό)' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)'
              }}>
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
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
              backdropFilter: 'blur(18px) saturate(160%)',
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