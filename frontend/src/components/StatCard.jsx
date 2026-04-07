import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ icon: Icon, color, bg, title, value, subtitle, trendValue, trendType, onClick, delay, highlighted = false, size }) => {
    const isCompact = size === 'compact';
    const iconBackground = bg || `${color}14`;

    return (
        <div
            className={`card-glass stat-card animate-fade group ${highlighted ? 'stat-card--highlighted' : ''}`}
            style={{
                animationDelay: delay,
                padding: isCompact ? '0.75rem 1rem' : '1.25rem',
                borderRadius: isCompact ? '20px' : '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: isCompact ? '0.4rem' : '0.75rem',
                cursor: onClick ? 'pointer' : 'default',
                minWidth: isCompact ? '160px' : '200px',
                flex: 1,
                borderLeft: highlighted ? `4px solid ${color}` : undefined,
                position: 'relative',
                overflow: 'hidden'
            }}
            onClick={onClick}
        >
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    top: '-34px',
                    right: '-18px',
                    width: isCompact ? '96px' : '124px',
                    height: isCompact ? '96px' : '124px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${color}20 0%, ${color}00 72%)`,
                    pointerEvents: 'none'
                }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="stat-icon" style={{
                    background: `linear-gradient(135deg, ${iconBackground} 0%, ${color}24 100%)`,
                    width: isCompact ? '38px' : '48px',
                    height: isCompact ? '38px' : '48px',
                    borderRadius: isCompact ? '12px' : '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color,
                    border: `1px solid ${color}22`
                }}>
                    <Icon size={isCompact ? 16 : 20} strokeWidth={2.5} />
                </div>
                {(trendValue) && (
                    <div className="stat-trend" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        padding: '4px 8px',
                        borderRadius: '999px',
                        background: trendType === 'up' ? '#f0fdf4' : trendType === 'down' ? '#fef2f2' : '#f1f5f9',
                        color: trendType === 'up' ? '#10b981' : trendType === 'down' ? '#ef4444' : '#64748b'
                    }}>
                        {trendType === 'up' && <TrendingUp size={10} />}
                        {trendType === 'down' && <TrendingDown size={10} />}
                        {trendValue}
                    </div>
                )}
            </div>

            <div className="stat-info">
                <h4 style={{
                    fontSize: isCompact ? '0.68rem' : '0.78rem',
                    fontWeight: '900',
                    color: 'var(--text-light)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '6px'
                }}>
                    {title}
                </h4>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <p style={{
                        fontSize: isCompact ? '1.55rem' : '1.95rem',
                        fontWeight: '950',
                        color: 'var(--secondary)',
                        letterSpacing: '-0.05em',
                        lineHeight: '1.05'
                    }}>
                        {value}
                    </p>
                    {!isCompact && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '10px',
                            background: `${color}10`,
                            color,
                            border: `1px solid ${color}16`
                        }}>
                            <Icon size={14} strokeWidth={2.4} />
                        </span>
                    )}
                </div>
                {(!isCompact && subtitle) && (
                    <p style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-light)',
                        fontWeight: '600',
                        marginTop: '8px',
                        lineHeight: '1.45'
                    }}>
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
};

export default StatCard;
