import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

const ErrorState = ({ 
    title = 'Κάτι πήγε στραβά',
    message = 'Προέκυψε σφάλμα. Δοκιμάστε ξανά.',
    onRetry,
    onGoHome,
    style = {}
}) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 2rem',
            textAlign: 'center',
            ...style
        }}>
            <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '20px',
                background: 'rgba(239,68,68,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem',
            }}>
                <AlertTriangle size={32} color="#ef4444" />
            </div>
            <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '800',
                color: 'var(--text)',
                marginBottom: '0.5rem',
            }}>
                {title}
            </h3>
            <p style={{
                fontSize: '0.9rem',
                color: 'var(--text-light)',
                marginBottom: '1.5rem',
                maxWidth: '320px',
            }}>
                {message}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
                {onRetry && (
                    <button 
                        onClick={onRetry}
                        className="btn btn-primary"
                        style={{ padding: '10px 20px' }}
                    >
                        <RefreshCw size={16} /> Δοκιμή ξανά
                    </button>
                )}
                {onGoHome && (
                    <button 
                        onClick={onGoHome}
                        className="btn btn-outline"
                        style={{ padding: '10px 20px' }}
                    >
                        <Home size={16} /> Αρχική
                    </button>
                )}
            </div>
        </div>
    );
};

export default ErrorState;