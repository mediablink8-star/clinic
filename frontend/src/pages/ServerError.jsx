import React from 'react';
import { Home, AlertCircle, RefreshCw } from 'lucide-react';

const ServerError = ({ error }) => {
  const reload = () => {
    window.location.reload();
  };

  const navigateToHome = () => {
    window.location.href = '/';
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '24px',
        background: 'rgba(239, 68, 68, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '2rem'
      }}>
        <AlertCircle size={40} color="#ef4444" />
      </div>
      
      <h1 style={{ 
        fontSize: '3rem', 
        fontWeight: '900', 
        color: 'var(--secondary)', 
        marginBottom: '1rem',
        letterSpacing: '-0.04em'
      }}>
        500
      </h1>
      
      <h2 style={{ 
        fontSize: '1.5rem', 
        fontWeight: '700', 
        color: 'var(--secondary)', 
        marginBottom: '1.5rem' 
      }}>
        Σφάλμα Συστήματος
      </h2>
      
      <p style={{ 
        color: '#64748b', 
        maxWidth: '500px', 
        lineHeight: '1.6',
        marginBottom: '2.5rem'
      }}>
        Παρουσιάστηκε ένα μη αναμενόμενο σφάλμα στο σύστημα. Παρακαλώ δοκιμάστε ξανά σε λίγο.
        {error && (
          <code style={{ 
            display: 'block', 
            background: 'rgba(0,0,0,0.05)', 
            padding: '10px', 
            borderRadius: '8px', 
            marginTop: '15px',
            fontSize: '0.8rem',
            color: '#ef4444'
          }}>
            {error.message || error}
          </code>
        )}
      </p>
      
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button 
          onClick={reload}
          className="btn btn-outline"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={18} />
          Επαναφόρτωση
        </button>
        
        <button 
          onClick={navigateToHome}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Home size={18} />
          Επιστροφή στην Αρχική
        </button>
      </div>
    </div>
  );
};

export default ServerError;
