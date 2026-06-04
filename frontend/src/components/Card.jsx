import React from 'react';

export const Card = ({ 
    children, 
    className = '', 
    style = {}, 
    variant = 'glass',
    padding = '1rem',
    onClick,
    ...props 
}) => {
    const baseStyles = {
        glass: {
            background: 'var(--glass-surface)',
            backdropFilter: 'var(--glass-strong)',
            WebkitBackdropFilter: 'var(--glass-strong)',
            border: '1px solid rgba(255,255,255,0.48)',
            boxShadow: 'var(--shadow-md)',
        },
        solid: {
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
        },
        elevated: {
            background: 'var(--modal-bg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
        },
    };

    const variantStyles = baseStyles[variant] || baseStyles.glass;

    return (
        <div
            className={`card ${className}`}
            onClick={onClick}
            style={{
                borderRadius: 'var(--radius)',
                padding,
                transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                cursor: onClick ? 'pointer' : 'default',
                ...variantStyles,
                ...style,
            }}
            {...props}
        >
            {children}
        </div>
    );
};

export const CardHover = ({ children, className = '', style = {}, ...props }) => (
    <Card 
        className={`card-hover ${className}`}
        style={{
            ...style,
        }}
        {...props}
    >
        {children}
    </Card>
);

export default Card;