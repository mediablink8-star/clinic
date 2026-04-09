import React, { useState } from 'react';
import { Send, X, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';

const MessageModal = ({ isOpen, onClose, patient, token }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({ type: null, text: '' });

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setStatus({ type: null, text: '' });
    try {
      const resp = await api.post('/messages/send', {
        patientId: patient.id,
        message: message.trim()
      });

      if (resp.data.success) {
        const deliveryStatus = resp.data.deliveryStatus;
        const statusMessages = {
          SENT: 'Το μήνυμα στάλθηκε επιτυχώς!',
          SIMULATED: 'Προσομοίωση αποστολής (δεν έχει ρυθμιστεί webhook).',
          FAILED: 'Η αποστολή απέτυχε. Ελέγξτε τις ρυθμίσεις SMS.',
        };
        setStatus({ type: deliveryStatus === 'FAILED' ? 'error' : 'success', text: statusMessages[deliveryStatus] || 'Αποστολή ολοκληρώθηκε.' });
        if (deliveryStatus !== 'FAILED') {
          setTimeout(() => {
            onClose();
            setMessage('');
            setStatus({ type: null, text: '' });
          }, 2000);
        }
      } else {
        setStatus({ type: 'error', text: 'Αποτυχία αποστολής. Δοκιμάστε ξανά.' });
      }
    } catch (err) {
      setStatus({
        type: 'error',
        text: err.response?.data?.error || 'Σφάλμα κατά την αποστολή.'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,23,42,0.5)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem'
    }}>
      <div style={{
        background: 'var(--modal-bg)',
        borderRadius: '24px',
        padding: '2rem',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)',
        animation: 'fadeIn 0.25s ease',
        border: '1px solid var(--modal-border)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
              <MessageSquare size={20} color="var(--primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text)' }}>Αποστολή Μηνύματος</h2>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Προς: {patient.name} ({patient.phone})</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Status */}
        {status.type && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', borderRadius: '10px', marginBottom: '1rem',
            background: status.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: status.type === 'success' ? '#10b981' : '#ef4444',
            fontSize: '0.85rem', fontWeight: '600',
            border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
          }}>
            {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {status.text}
          </div>
        )}

        {/* Textarea */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
            Περιεχόμενο Μηνύματος
          </label>
          <textarea
            autoFocus
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Πληκτρολογήστε το μήνυμά σας εδώ..."
            disabled={sending || status.type === 'success'}
            style={{
              width: '100%', padding: '12px', borderRadius: '12px',
              border: '1px solid var(--border)', fontSize: '0.9rem',
              resize: 'none', minHeight: '140px', boxSizing: 'border-box',
              outline: 'none', fontFamily: 'inherit', color: 'var(--text)'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>
            <span>Προσοχή: 1 Πίστωση ανά μήνυμα</span>
            <span>{message.length} χαρακτήρες</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            disabled={sending}
            style={{ flex: 1, padding: '11px', borderRadius: '12px', border: '1px solid var(--cancel-border)', background: 'var(--cancel-bg)', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', color: 'var(--cancel-color)' }}
          >
            Ακύρωση
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim() || status.type === 'success'}
            style={{
              flex: 2, padding: '11px', borderRadius: '12px', border: 'none',
              background: (sending || !message.trim() || status.type === 'success') ? 'rgba(226,232,240,0.8)' : 'var(--primary)',
              color: (sending || !message.trim() || status.type === 'success') ? '#94a3b8' : 'white',
              cursor: (sending || !message.trim() || status.type === 'success') ? 'not-allowed' : 'pointer',
              fontWeight: '700', fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <Send size={15} />
            {sending ? 'Αποστολή...' : 'Αποστολή SMS'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageModal;
