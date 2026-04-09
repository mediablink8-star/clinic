import React, { useState } from 'react';
import api from '../lib/api';
import { Building2, Mail, Lock, ArrowRight, Shield } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

const ClinicLogin = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaData, setMfaData] = useState({ required: false, token: '', code: '' });
  const googleAuthConfigured = /^[\w-]+\.apps\.googleusercontent\.com$/.test((import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await api.post('/auth/login', credentials);
      if (resp.data.mfaRequired) {
        setMfaData({ required: true, token: resp.data.mfaToken, code: '' });
      } else {
        onLogin(resp.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Σφάλμα σύνδεσης. Ελέγξτε τα στοιχεία σας.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
        await api.post('/auth/forgot-password', { email: resetEmail });
        setResetSent(true);
    } catch (err) {
        setError(err.response?.data?.error || 'Σφάλμα κατά την αποστολή του email.');
    } finally {
        setLoading(false);
    }
  };

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await api.post('/auth/mfa/login-verify', {
        mfaToken: mfaData.token,
        code: mfaData.code
      });
      onLogin(resp.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Ο κωδικός MFA είναι λανθασμένος.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const resp = await api.post('/auth/google', { idToken: credentialResponse.credential });
      onLogin(resp.data);
    } catch {
      setError('Η σύνδεση μέσω Google απέτυχε.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      {/* Background glows */}
      <div style={{ position: 'absolute', top: '-200px', left: '-200px', width: '600px', height: '600px', background: 'rgba(99,102,241,0.15)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-200px', right: '-200px', width: '500px', height: '500px', background: 'rgba(16,185,129,0.1)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Left panel — branding */}
      <div className="login-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '3rem' }}>
          <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '14px', display: 'flex' }}>
            <Building2 color="white" size={28} />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', letterSpacing: '-0.5px' }}>ClinicFlow</span>
        </div>

        <h2 style={{ fontSize: '3rem', fontWeight: '900', color: 'white', letterSpacing: '-2px', lineHeight: 1.1, marginBottom: '1.5rem' }}>
          Αυτοματισμός<br />
          <span style={{ color: 'var(--primary)' }}>ιατρείου</span><br />
          επόμενης γενιάς.
        </h2>
        <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: '380px' }}>
          Διαχείριση ραντεβού, ανάκτηση χαμένων κλήσεων και αυτόματη επικοινωνία με ασθενείς — όλα σε ένα.
        </p>

        <div className="login-features" style={{ display: 'flex', gap: '2rem', marginTop: '3rem' }}>
          {[['SMS', 'Αυτόματα'], ['AI', 'Ανάλυση'], ['24/7', 'Ανάκτηση']].map(([val, lbl]) => (
            <div key={val}>
              <p style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', letterSpacing: '-1px' }}>{val}</p>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{lbl}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="login-right">
        <div style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '28px',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '2.5rem',
          boxShadow: '0 32px 64px rgba(0,0,0,0.4)'
        }}>
          {mfaData.required ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <Shield size={28} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', marginBottom: '6px' }}>Επαλήθευση</h2>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Εισάγετε τον κωδικό από το Authenticator app.</p>
              </div>

              {error && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '10px 14px', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

              <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                  autoFocus required type="text" maxLength="6"
                  value={mfaData.code}
                  onChange={e => setMfaData({ ...mfaData, code: e.target.value })}
                  placeholder="000000"
                  style={{ textAlign: 'center', fontSize: '2rem', letterSpacing: '0.5rem', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'white', outline: 'none' }}
                />
                <button type="submit" disabled={loading} style={{ padding: '14px', borderRadius: '14px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '800', fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Επαλήθευση...' : 'Επαλήθευση'}
                </button>
                <button type="button" onClick={() => setMfaData({ required: false, token: '', code: '' })} style={{ padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' }}>
                  Ακύρωση
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', marginBottom: '8px' }}>
                    {forgotPassword ? 'Επαναφορά Κωδικού' : 'Καλώς Ήρθατε'}
                </h2>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.45)' }}>
                    {forgotPassword ? 'Εισάγετε το email σας για να λάβετε οδηγίες' : 'Συνδεθείτε στο ιατρείο σας'}
                </p>
              </div>

              {error && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '10px 14px', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

              {forgotPassword ? (
                  resetSent ? (
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <p style={{ fontSize: '0.95rem', fontWeight: '800', color: 'white', marginBottom: '8px' }}>Εστάλθηκε!</p>
                      <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', marginBottom: '1.5rem', lineHeight: 1.6 }}>Αν το email υπάρχει στο σύστημα, θα λάβετε οδηγίες επαναφοράς σύντομα.</p>
                      <button type="button" onClick={() => { setForgotPassword(false); setResetSent(false); setResetEmail(''); }} style={{ padding: '12px 24px', borderRadius: '14px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}>
                        Επιστροφή στη Σύνδεση
                      </button>
                    </div>
                  ) : (
                  <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Email</label>
                          <div style={{ position: 'relative' }}>
                              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                              <input
                                  required type="email"
                                  value={resetEmail}
                                  onChange={e => setResetEmail(e.target.value)}
                                  placeholder="dr@clinic.gr"
                                  style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                              />
                          </div>
                      </div>
                      <button type="submit" disabled={loading} style={{ padding: '14px', borderRadius: '14px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '800', fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                          {loading ? 'Αποστολή...' : 'Αποστολή Οδηγιών'}
                      </button>
                      <button type="button" onClick={() => setForgotPassword(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.85rem' }}>
                          Επιστροφή στη Σύνδεση
                      </button>
                  </form>
                  )
              ) : (
                  <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Email */}
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Email</label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                        <input
                          required type="email"
                          value={credentials.email}
                          onChange={e => setCredentials({ ...credentials, email: e.target.value })}
                          placeholder="dr@clinic.gr"
                          style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Κωδικός</label>
                        <button type="button" onClick={() => setForgotPassword(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', padding: 0 }}>
                            Ξεχάσατε τον κωδικό;
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                        <input
                          required type="password"
                          value={credentials.password}
                          onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                          placeholder="••••••••"
                          style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={loading} style={{
                      marginTop: '0.5rem',
                      padding: '14px',
                      borderRadius: '14px',
                      border: 'none',
                      background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
                      color: 'white',
                      fontWeight: '800',
                      fontSize: '0.95rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 8px 24px rgba(99,102,241,0.35)'
                    }}>
                      {loading ? 'Σύνδεση...' : <><span>Είσοδος</span><ArrowRight size={18} /></>}
                    </button>
                  </form>
              )}

              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
                  Δεν έχετε ιατρείο; <button onClick={() => navigateTo('/register')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', textDecoration: 'none' }}>Δημιουργία Λογαριασμού</button>
                </p>
              </div>

              {googleAuthConfigured && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '1.5rem 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ή</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError('Η σύνδεση μέσω Google απέτυχε.')}
                      useOneTap
                      theme="filled_black"
                      shape="pill"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicLogin;
