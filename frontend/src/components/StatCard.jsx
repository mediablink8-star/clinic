import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ icon: Icon, color, bg, title, value, subtitle, trendValue, trendType, onClick, delay, highlighted = false, size }) => {
    const isCompact = size === 'compact';

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="stat-icon" style={{
                    background: `${color}15`,
                    width: isCompact ? '32px' : '42px',
                    height: isCompact ? '32px' : '42px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color
                }}>
                    <Icon size={isCompact ? 16 : 20} strokeWidth={2.5} />
                </div>
                {(trendValue) && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '6px',
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
                    fontSize: isCompact ? '0.65rem' : '0.75rem',
                    fontWeight: '800',
                    color: 'var(--text-light)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '2px'
                }}>
                    {title}
                </h4>
                <p style={{
                    fontSize: isCompact ? '1.5rem' : '1.75rem',
                    fontWeight: '900',
                    color: 'var(--secondary)',
                    letterSpacing: '-0.04em',
                    lineHeight: '1.1'
                }}>
                    {value}
                </p>
                {(!isCompact && subtitle) && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '500', marginTop: '6px' }}>
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
};

export default StatCard;
