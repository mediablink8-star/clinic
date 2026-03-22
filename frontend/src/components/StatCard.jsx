import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ icon: Icon, color, bg, title, value, subtitle, trend, trendValue, trendType, onClick, delay, size = 'lg', highlighted = false }) => {
    const isLg = size === 'lg';
    const isCompact = size === 'compact';

    // Gradient icon background: mixes bg color with a slightly darker tint
    const iconGradient = `linear-gradient(145deg, ${bg}, ${bg})`;
    const iconShadow = `0 3px 8px ${color}22`;

    return (
        <div
            className={`stat-card animate-fade group${highlighted ? ' stat-card--highlighted' : ''}`}
            style={{
                animationDelay: delay,
                background: 'white',
                padding: highlighted ? '1.5rem 1.25rem' : (isCompact ? '0.75rem' : (isLg ? '1.25rem 1rem' : '0.75rem 0.5rem')),
                borderRadius: highlighted ? '24px' : (isCompact ? '18px' : (isLg ? '24px' : '20px')),
                border: '1px solid var(--border)',
                boxShadow: highlighted ? '0 8px 24px -4px rgba(59,130,246,0.12), var(--shadow-sm)' : 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: isCompact ? 'row' : 'column',
                alignItems: 'center',
                justifyContent: isCompact ? 'flex-start' : 'center',
                textAlign: isCompact ? 'left' : 'center',
                gap: isCompact ? '12px' : (isLg ? '0.5rem' : '0.35rem'),
                cursor: onClick ? 'pointer' : 'default',
                width: highlighted ? '175px' : (isCompact ? 'auto' : (isLg ? '160px' : '110px')),
                flex: isCompact ? '1' : 'none',
                minWidth: isCompact ? '180px' : 'none',
                height: highlighted ? '148px' : (isCompact ? '88px' : (isLg ? '140px' : '110px')),
                flexShrink: 0,
                borderLeft: highlighted ? '3px solid #3b82f6' : undefined
            }}
            onClick={onClick}
        >
            <div className="stat-icon" style={{
                background: iconGradient,
                width: highlighted ? '40px' : (isCompact ? '42px' : (isLg ? '36px' : '28px')),
                height: highlighted ? '40px' : (isCompact ? '42px' : (isLg ? '36px' : '28px')),
                borderRadius: highlighted ? '12px' : (isCompact ? '14px' : (isLg ? '10px' : '8px')),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: iconShadow,
                flexShrink: 0
            }}>
                <Icon color={color} size={highlighted ? 20 : (isCompact ? 20 : (isLg ? 18 : 14))} />
            </div>

            <div className="stat-info" style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{
                    fontSize: highlighted ? '0.65rem' : (isCompact ? '0.65rem' : (isLg ? '0.6rem' : '0.5rem')),
                    fontWeight: '800',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: isCompact ? '0' : '2px'
                }}>
                    {title}
                </h4>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <p style={{
                        fontSize: highlighted ? '1.75rem' : (isCompact ? '1.25rem' : (isLg ? '1.5rem' : '1rem')),
                        fontWeight: '900',
                        color: 'var(--secondary)',
                        letterSpacing: '-0.5px',
                        lineHeight: '1.1'
                    }}>
                        {value}
                    </p>
                    {(trend || trendValue) && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            fontSize: '0.6rem',
                            fontWeight: '800',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            background: trendType === 'up' ? '#f0fdf4' : trendType === 'down' ? '#fef2f2' : '#f1f5f9',
                            color: trendType === 'up' ? '#10b981' : trendType === 'down' ? '#ef4444' : '#64748b'
                        }}>
                            {trendType === 'up' && <TrendingUp size={9} />}
                            {trendType === 'down' && <TrendingDown size={9} />}
                            {trendValue}
                        </div>
                    )}
                </div>
                {subtitle && (
                    <p style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: '500', marginTop: '2px', lineHeight: 1.3 }}>
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
};

export default StatCard;
