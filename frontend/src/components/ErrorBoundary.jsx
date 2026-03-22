import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: '60vh', gap: '1rem', padding: '2rem', textAlign: 'center'
                }}>
                    <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '16px' }}>
                        <AlertTriangle size={40} color="#ef4444" />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--secondary)', margin: 0 }}>
                        Κάτι πήγε στραβά
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: 0 }}>
                        {this.state.error?.message || 'Παρουσιάστηκε απροσδόκητο σφάλμα.'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            padding: '10px 24px', borderRadius: '12px', border: 'none',
                            background: 'var(--primary)', color: 'white', fontWeight: '700',
                            cursor: 'pointer', fontSize: '0.875rem'
                        }}
                    >
                        Δοκιμάστε ξανά
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
