import React from 'react';
import { Home, AlertCircle } from 'lucide-react';

const NotFound = () => {
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
        404
      </h1>
      
      <h2 style={{ 
        fontSize: '1.5rem', 
        fontWeight: '700', 
        color: 'var(--secondary)', 
        marginBottom: '1.5rem' 
      }}>
        Η σελίδα δεν βρέθηκε
      </h2>
      
      <p style={{ 
        color: '#64748b', 
        maxWidth: '400px', 
        lineHeight: '1.6',
        marginBottom: '2.5rem'
      }}>
        Λυπούμαστε, αλλά η σελίδα που αναζητάτε δεν υπάρχει ή έχει μετακινηθεί.
      </p>
      
      <button 
        onClick={navigateToHome}
        className="btn btn-primary"
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Home size={18} />
        Επιστροφή στην Αρχική
      </button>
    </div>
  );
};

export default NotFound;
