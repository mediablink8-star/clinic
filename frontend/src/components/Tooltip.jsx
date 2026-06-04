import React, { useState, useRef, useEffect } from 'react';

const Tooltip = ({ children, text, position = 'top', style = {} }) => {
    const [show, setShow] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const containerRef = useRef(null);
    const tooltipRef = useRef(null);

    useEffect(() => {
        if (show && containerRef.current && tooltipRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            
            let top, left;
            
            switch (position) {
                case 'top':
                    top = containerRect.top - tooltipRect.height - 8;
                    left = containerRect.left + (containerRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'bottom':
                    top = containerRect.bottom + 8;
                    left = containerRect.left + (containerRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'left':
                    top = containerRect.top + (containerRect.height / 2) - (tooltipRect.height / 2);
                    left = containerRect.left - tooltipRect.width - 8;
                    break;
                case 'right':
                    top = containerRect.top + (containerRect.height / 2) - (tooltipRect.height / 2);
                    left = containerRect.right + 8;
                    break;
                default:
                    top = containerRect.top - tooltipRect.height - 8;
                    left = containerRect.left + (containerRect.width / 2) - (tooltipRect.width / 2);
            }
            
            // Keep tooltip within viewport
            const padding = 8;
            if (left < padding) left = padding;
            if (left + tooltipRect.width > window.innerWidth - padding) {
                left = window.innerWidth - tooltipRect.width - padding;
            }
            if (top < padding) top = padding;
            if (top + tooltipRect.height > window.innerHeight - padding) {
                top = window.innerHeight - tooltipRect.height - padding;
            }
            
            setTooltipStyle({ 
                top: `${top}px`, 
                left: `${left}px`,
                opacity: 1
            });
        }
    }, [show, position]);

    return (
        <div
            ref={containerRef}
            style={{ position: 'relative', display: 'flex', ...style }}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onFocus={() => setShow(true)}
            onBlur={() => setShow(false)}
        >
            {children}
            {show && text && (
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    style={{
                        position: 'fixed',
                        ...tooltipStyle,
                        background: 'rgba(15, 23, 42, 0.95)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        zIndex: 55,
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(8px)',
                        opacity: 0,
                        transition: 'opacity 0.15s ease-out',
                    }}
                >
                    {text}
                </div>
            )}
        </div>
    );
};

export default Tooltip;
