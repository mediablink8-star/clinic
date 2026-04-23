import React from 'react';

const EmptyState = ({ 
    icon: Icon, 
    title, 
    subtitle, 
    action,
    style = {} 
}) => {
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
            {Icon && (
                <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: 'var(--primary-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                }}>
                    <Icon size={24} color="var(--primary)" />
                </div>
            )}
            <h3 style={{
                fontSize: '1rem',
                fontWeight: '800',
                color: 'var(--text)',
                marginBottom: '0.5rem',
            }}>
                {title}
            </h3>
            {subtitle && (
                <p style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-light)',
                    marginBottom: action ? '1.25rem' : 0,
                    maxWidth: '300px',
                }}>
                    {subtitle}
                </p>
            )}
            {action}
        </div>
    );
};

export default EmptyState;