import React from 'react';

const ILLUSTRATIONS = {
  calendar: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect x="10" y="16" width="60" height="54" rx="10" fill="var(--primary-light)"/>
      <rect x="14" y="24" width="52" height="14" rx="4" fill="var(--primary)" opacity="0.15"/>
      <text x="30" y="54" fontSize="22" fontWeight="900" fill="var(--primary)">📅</text>
      <rect x="18" y="12" width="6" height="10" rx="3" fill="var(--border)"/>
      <rect x="56" y="12" width="6" height="10" rx="3" fill="var(--border)"/>
    </svg>
  ),
  patients: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="32" r="12" fill="var(--primary-light)" stroke="var(--primary)" strokeWidth="2" opacity="0.4"/>
      <circle cx="40" cy="32" r="6" fill="var(--primary)" opacity="0.5"/>
      <ellipse cx="40" cy="56" rx="18" ry="10" fill="var(--primary-light)" opacity="0.3"/>
      <path d="M22 56a28 28 0 0 1 36 0" stroke="var(--primary)" strokeWidth="1.5" opacity="0.2" fill="none"/>
    </svg>
  ),
  inbox: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect x="6" y="22" width="68" height="44" rx="12" stroke="var(--primary)" strokeWidth="2" fill="var(--primary-light)" opacity="0.3"/>
      <path d="M6 44h18l6 8h20l6-8h18" stroke="var(--primary)" strokeWidth="2" fill="none" opacity="0.6"/>
      <circle cx="56" cy="18" r="6" fill="#ef4444" opacity="0.2"/>
      <circle cx="56" cy="18" r="3" fill="#ef4444"/>
    </svg>
  ),
  search: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="32" cy="32" r="16" stroke="var(--primary)" strokeWidth="3" fill="var(--primary-light)" opacity="0.3"/>
      <line x1="44" y1="44" x2="58" y2="58" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
      <circle cx="28" cy="28" r="3" fill="var(--primary)" opacity="0.4"/>
    </svg>
  ),
  default: null,
};

const EmptyState = ({
    type,
    icon: Icon,
    title,
    subtitle,
    action,
    style = {}
}) => {
    const illustration = ILLUSTRATIONS[type] || ILLUSTRATIONS.default;
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            borderRadius: 'var(--radius)',
            border: '2px dashed var(--border)',
            background: 'var(--bg-subtle)',
            ...style
        }}>
            {illustration ? (
                <div style={{ marginBottom: '1rem', opacity: 0.85 }}>{illustration}</div>
            ) : Icon ? (
                <div style={{
                    width: '56px', height: '56px', borderRadius: '14px',
                    background: 'var(--primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '1rem',
                }}>
                    <Icon size={24} color="var(--primary)" />
                </div>
            ) : null}
            <h3 style={{
                fontSize: '1rem', fontWeight: '800', color: 'var(--text)',
                marginBottom: '0.5rem',
            }}>
                {title}
            </h3>
            {subtitle && (
                <p style={{
                    fontSize: '0.85rem', color: 'var(--text-light)',
                    marginBottom: action ? '1.25rem' : 0, maxWidth: '300px',
                }}>
                    {subtitle}
                </p>
            )}
            {action}
        </div>
    );
};

export default EmptyState;