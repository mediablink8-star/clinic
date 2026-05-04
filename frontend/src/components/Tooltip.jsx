import React, { useState } from 'react';

const Tooltip = ({ children, text, position = 'top' }) => {
    const [show, setShow] = useState(false);

    const positions = {
        top: { bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-8px)', marginBottom: '8px' },
        bottom: { top: '100%', left: '50%', transform: 'translateX(-50%) translateY(8px)', marginTop: '8px' },
        left: { right: '100%', top: '50%', transform: 'translateY(-50%) translateX(-8px)', marginRight: '8px' },
        right: { left: '100%', top: '50%', transform: 'translateY(-50%) translateX(8px)', marginLeft: '8px' },
    };

    return (
        <div
            style={{ position: 'relative', display: 'inline-flex' }}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && text && (
                <div
                    style={{
                        position: 'absolute',
                        ...positions[position],
                        background: 'rgba(15, 23, 42, 0.95)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        zIndex: 10000,
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(8px)',
                        animation: 'tooltip-fade-in 0.15s ease-out',
                    }}
                >
                    {text}
                    <style>{`
                        @keyframes tooltip-fade-in {
                            from {
                                opacity: 0;
                                transform: ${position === 'top' ? 'translateX(-50%) translateY(-4px)' : 
                                           position === 'bottom' ? 'translateX(-50%) translateY(4px)' :
                                           position === 'left' ? 'translateY(-50%) translateX(-4px)' :
                                           'translateY(-50%) translateX(4px)'};
                            }
                            to {
                                opacity: 1;
                                transform: ${position === 'top' ? 'translateX(-50%) translateY(-8px)' : 
                                           position === 'bottom' ? 'translateX(-50%) translateY(8px)' :
                                           position === 'left' ? 'translateY(-50%) translateX(-8px)' :
                                           'translateY(-50%) translateX(8px)'};
                            }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
};

export default Tooltip;
