import React, { useState } from 'react';
import api from '../lib/api';
import { Building2, Mail, Lock, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';

const ClinicRegister = ({ onRegister }) => {
  const [formData, setFormData] = useState({
    clinicName: '',
    email: '',
    password: '',
    phone: '',
    agreedToTerms: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.agreedToTerms) {
        setError('Πρέπει να αποδεχτείτε τους όρους χρήσης και την πολιτική απορρήτου.');
        return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...formData,
        phone: formData.phone.replace(/[\s()-]/g, '')
      };
      const resp = await api.post('/auth/register', payload);
      setSuccess(true);
      // Optional: Auto-login after 2 seconds or let user click a button
      setTimeout(() => {
        onRegister(resp.data);
      }, 2000);
    } catch (err) {
      const apiError = err.response?.data?.error;
      if (apiError === 'Registration could not be completed with the provided details.') {
        setError('Δεν ήταν δυνατή η ολοκλήρωση της εγγραφής με αυτά τα στοιχεία. Αν έχετε ήδη λογαριασμό, δοκιμάστε σύνδεση ή επαναφορά κωδικού.');
      } else if ((apiError || '').includes('Greek phone number')) {
        setError('Χρησιμοποιήστε έγκυρο ελληνικό τηλέφωνο, π.χ. 2101234567 ή 6912345678.');
      } else {
        setError(apiError || 'Σφάλμα εγγραφής. Παρακαλώ δοκιμάστε ξανά.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        color: 'white'
      }}>
        <div style={{
          textAlign: 'center',
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(24px)',
          padding: '3rem',
          borderRadius: '28px',
          border: '1px solid rgba(255,255,255,0.1)',
          maxWidth: '400px'
        }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(16,185,129,0.2)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <CheckCircle2 size={32} color="#10b981" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '900', marginBottom: '1rem' }}>Επιτυχία!</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            Το ιατρείο σας <strong>{formData.clinicName}</strong> δημιουργήθηκε. Μεταφέρεστε στο dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glows */}
      <div style={{ position: 'absolute', top: '-200px', left: '-200px', width: '600px', height: '600px', background: 'rgba(99,102,241,0.15)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-200px', right: '-200px', width: '500px', height: '500px', background: 'rgba(16,185,129,0.1)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Left panel — branding */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '4rem',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '3rem' }}>
          <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '14px', display: 'flex' }}>
            <Building2 color="white" size={28} />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', letterSpacing: '-0.5px' }}>ClinicFlow</span>
        </div>

        <h2 style={{ fontSize: '3rem', fontWeight: '900', color: 'white', letterSpacing: '-2px', lineHeight: 1.1, marginBottom: '1.5rem' }}>
          Ξεκινήστε την<br />
          <span style={{ color: 'var(--primary)' }}>αυτοματοποίηση</span><br />
          σήμερα.
        </h2>
        <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: '380px' }}>
          Δημιουργήστε το δικό σας ψηφιακό ιατρείο σε λιγότερο από 2 λεπτά και κερδίστε χρόνο για τους ασθενείς σας.
        </p>

        <div style={{ display: 'flex', gap: '2rem', marginTop: '3rem' }}>
          {[['ΔΩΡΕΑΝ', 'Δοκιμή'], ['100', 'Credits'], ['AI', 'Έτοιμο']].map(([val, lbl]) => (
            <div key={val}>
              <p style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', letterSpacing: '-1px' }}>{val}</p>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{lbl}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        width: '520px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative',
        zIndex: 1
      }}>
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
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', marginBottom: '6px' }}>Δημιουργία Ιατρείου</h2>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)' }}>Συμπληρώστε τα παρακάτω στοιχεία</p>
          </div>

          {error && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '10px 14px', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Clinic Name */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Όνομα Ιατρείου</label>
              <div style={{ position: 'relative' }}>
                <Building2 size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  required type="text"
                  value={formData.clinicName}
                  onChange={e => setFormData({ ...formData, clinicName: e.target.value })}
                  placeholder="Οδοντιατρείο Παπαδόπουλος"
                  style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Email Ιδιοκτήτη</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  required type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="dr@clinic.gr"
                  style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Τηλέφωνο Επικοινωνίας</label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  required type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="6912345678 ή 2101234567"
                  style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <p style={{ marginTop: '6px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                Χρησιμοποιήστε ελληνικό τηλέφωνο, π.χ. 2101234567 ή 6912345678.
              </p>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Κωδικός Πρόσβασης</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  required type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', margin: '0.5rem 0' }}>
              <input 
                type="checkbox" 
                id="agreedToTerms"
                checked={formData.agreedToTerms}
                onChange={e => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                style={{ marginTop: '4px', cursor: 'pointer' }}
              />
              <label htmlFor="agreedToTerms" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, cursor: 'pointer' }}>
                Αποδέχομαι τους <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Όρους Χρήσης</span> και την <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Πολιτική Απορρήτου (GDPR)</span> του ClinicFlow.
              </label>
            </div>

            <button type="submit" disabled={loading} style={{
              marginTop: '0.5rem',
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              background: 'var(--primary)',
              color: 'white',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 10px 20px -5px rgba(99,102,241,0.4)',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.7 : 1
            }}>
              {loading ? 'Δημιουργία...' : 'Δημιουργία Ιατρείου'}
              {!loading && <ArrowRight size={18} />}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
                Έχετε ήδη λογαριασμό; <button onClick={() => navigateTo('/login')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', textDecoration: 'none' }}>Συνδεθείτε</button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClinicRegister;
