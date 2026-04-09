import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

const ResetPassword = () => {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Λείπει το διακριτικό επαναφοράς. Παρακαλώ χρησιμοποιήστε τον σύνδεσμο από το email σας.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Οι κωδικοί δεν ταιριάζουν.');
      return;
    }
    if (password.length < 6) {
      setError('Ο κωδικός πρέπει να είναι τουλάχιστον 6 χαρακτήρες.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Σφάλμα κατά την επαναφορά. Το διακριτικό μπορεί να έχει λήξει.');
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  if (success) {
    return (
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', color: 'white'
      }}>
        <div style={{
          textAlign: 'center', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(24px)',
          padding: '3rem', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '400px'
        }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(16,185,129,0.2)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <CheckCircle2 size={32} color="#10b981" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '900', marginBottom: '1rem' }}>Επιτυχία!</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: '2rem' }}>
            Ο κωδικός σας άλλαξε με επιτυχία. Μπορείτε πλέον να συνδεθείτε.
          </p>
          <button onClick={() => navigateTo('/login')} style={{
            width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
            background: 'var(--primary)', color: 'white', fontWeight: '800', cursor: 'pointer'
          }}>
            Σύνδεση
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', color: 'white'
    }}>
      <div style={{
        width: '400px', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(24px)',
        padding: '2.5rem', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 32px 64px rgba(0,0,0,0.4)'
      }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', marginBottom: '8px' }}>Νέος Κωδικός</h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)' }}>Εισάγετε τον νέο σας κωδικό πρόσβασης</p>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '12px 16px', 
            borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>Νέος Κωδικός</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
              <input
                required type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '14px 14px 14px 44px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>Επιβεβαίωση Κωδικού</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
              <input
                required type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '14px 14px 14px 44px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <button type="submit" disabled={loading || !token} style={{
            marginTop: '0.5rem',
            padding: '14px',
            borderRadius: '14px',
            border: 'none',
            background: 'var(--primary)',
            color: 'white',
            fontWeight: '800',
            fontSize: '0.95rem',
            cursor: loading || !token ? 'not-allowed' : 'pointer',
            opacity: loading || !token ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}>
            {loading ? 'Ενημέρωση...' : <><span>Αλλαγή Κωδικού</span><ArrowRight size={18} /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
