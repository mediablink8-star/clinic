import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2, Plus, ArrowRight } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const ClinicLogin = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await axios.post(`${API_BASE}/auth/login`, credentials);
      onLogin(resp.data); // This will pass { token, clinic }
    } catch (err) {
      setError(err.response?.data?.error || 'Σφάλμα σύνδεσης. Ελέγξτε τα στοιχεία σας.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const resp = await axios.post(`${API_BASE}/auth/google`, {
        idToken: credentialResponse.credential
      });
      onLogin(resp.data);
    } catch (err) {
      setError('Η σύνδεση μέσω Google απέτυχε.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="layout center">Φόρτωση...</div>;

  return (
    <div className="login-container">
      <div className="login-card animate-fade">
        <div className="logo center" style={{ marginBottom: '2rem' }}>
          <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px', marginRight: '10px' }}>
            <Building2 color="white" size={32} />
          </div>
          <h1 style={{ fontSize: '1.75rem', color: 'var(--text)' }}>ClinicFlow SaaS</h1>
        </div>

        <form onSubmit={handleLoginSubmit}>
          <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-light)' }}>
            Είσοδος στο ιατρείο σας
          </p>

          {error && (
            <div style={{ background: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              required
              type="email"
              value={credentials.email}
              onChange={e => setCredentials({ ...credentials, email: e.target.value })}
              placeholder="π.χ. dr@clinic.gr"
            />
          </div>
          <div className="form-group">
            <label>Κωδικός Πρόσβασης</label>
            <input
              required
              type="password"
              value={credentials.password}
              onChange={e => setCredentials({ ...credentials, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn btn-primary full-width" disabled={loading}>
            {loading ? 'Σύνδεση...' : 'Είσοδος'}
          </button>

          <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-light)' }}>
            <p>Default credentials: password123</p>
          </div>

          <div className="divider">
            <span>Ή συνδεθείτε με</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Η σύνδεση μέσω Google απέτυχε.')}
              useOneTap
              theme="outline"
              shape="pill"
            />
          </div>
        </form>
      </div>

      <style>{`
        .login-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        }
        .login-card {
          background: white;
          padding: 2.5rem;
          borderRadius: 24px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          width: 100%;
          max-width: 420px;
        }
        .clinic-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .clinic-btn {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }
        .clinic-btn:hover {
          border-color: var(--primary);
          background: var(--bg);
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .icon-box {
          background: var(--bg);
          padding: 8px;
          border-radius: 10px;
        }
        .divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 1.5rem 0;
          color: var(--text-light);
          font-size: 0.875rem;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--border);
        }
        .divider span {
          padding: 0 10px;
        }
        .full-width { width: 100%; }
        .center { display: flex; align-items: center; justify-content: center; }
        .btn-group { display: flex; gap: 1rem; margin-top: 1.5rem; }
      `}</style>
    </div>
  );
};

export default ClinicLogin;
