import React from 'react';

const Badge = ({ type, children }) => {
    const isUrgent = type === 'URGENT';
    const isCompleted = type === 'COMPLETED';
    
    const style = {
        padding: '2px 10px',
        borderRadius: '99px',
        fontSize: '0.65rem',
        fontWeight: '700',
        letterSpacing: '0.01em',
        textTransform: 'uppercase',
        display: 'inline-flex',
        alignItems: 'center',
        background: isUrgent ? '#f8717122' : isCompleted ? '#f1f5f9' : '#10b98122',
        color: isUrgent ? '#dc2626' : isCompleted ? '#64748b' : '#059669',
        border: `1px solid ${isUrgent ? '#f8717144' : isCompleted ? '#e2e8f0' : '#10b98144'}`
    };
    return <span style={style}>{children}</span>;
};

export default Badge;
