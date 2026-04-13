import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, Send, Calendar, X, Search, CheckCircle2, AlertCircle, Phone, FlaskConical } from 'lucide-react';
import api from '../lib/api';

const QuickActionBtn = ({ icon: Icon, label, onClick, variant = 'outline' }) => (
    <button onClick={onClick} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border)', background: variant === 'primary' ? 'var(--primary)' : 'var(--bg-subtle)', color: variant === 'primary' ? 'white' : 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
        <Icon size={16} /> {label}
    </button>
);

const SendSMSModal = ({ patients = [], onClose }) => {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState(null);

    const filtered = patients.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search));

    const handleSend = async () => {
        if (!selected || !message.trim()) return;
        try {
            const resp = await api.post('/messages/send', { patientId: selected.id, message: message.trim() });
            setStatus(resp.data.success ? { type: 'success', text: 'Message sent.' } : { type: 'error', text: 'Send failed.' });
            if (resp.data.success) setTimeout(onClose, 1200);
        } catch (err) {
            setStatus({ type: 'error', text: err.response?.data?.error || 'Error sending message.' });
        }
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--modal-bg)', borderRadius: '20px', padding: '1rem', width: '100%', maxWidth: '440px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Send SMS</strong><button onClick={onClose}><X size={16} /></button></div>
                {!selected ? (
                    <>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient..." style={{ width: '100%', marginTop: '0.75rem' }} />
                        {filtered.map(p => <button key={p.id} onClick={() => setSelected(p)} style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: '0.5rem' }}>{p.name} ({p.phone})</button>)}
                    </>
                ) : (
                    <>
                        <p>{selected.name} ({selected.phone})</p>
                        <textarea value={message} onChange={e => setMessage(e.target.value)} style={{ width: '100%', minHeight: '100px' }} />
                        {status && <div style={{ color: status.type === 'success' ? '#10b981' : '#ef4444' }}>{status.text}</div>}
                        <button className="btn btn-primary" onClick={handleSend}>Send</button>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

const CallPatientModal = ({ patients = [], onClose }) => {
    const [search, setSearch] = useState('');
    const filtered = patients.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search));
    return createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--modal-bg)', borderRadius: '20px', padding: '1rem', width: '100%', maxWidth: '420px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Call Patient</strong><button onClick={onClose}><X size={16} /></button></div>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient..." style={{ width: '100%', marginTop: '0.75rem' }} />
                {filtered.map(p => <a key={p.id} href={`tel:${p.phone}`} onClick={onClose} style={{ display: 'block', marginTop: '0.5rem' }}>{p.name} ({p.phone})</a>)}
            </div>
        </div>, document.body
    );
};

const QuickActions = ({ onViewSchedule, onAddPatient, onNewAppointment, patients = [], onRefresh }) => {
    const [showSMS, setShowSMS] = useState(false);
    const [showCall, setShowCall] = useState(false);
    const [testStatus, setTestStatus] = useState(null);

    const handleTestRecovery = async () => {
        setTestStatus('sending');
        try {
            await api.post('/recovery/test-trigger', { phone: '+30690000000', callSid: `demo_${Date.now()}` });
            setTestStatus('sent');
            if (onRefresh) onRefresh();
            setTimeout(() => setTestStatus(null), 2000);
        } catch {
            setTestStatus('error');
            setTimeout(() => setTestStatus(null), 2000);
        }
    };

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <QuickActionBtn icon={Calendar} label="+ Νέο Ραντεβού" onClick={onNewAppointment || onViewSchedule} variant="primary" />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <QuickActionBtn icon={UserPlus} label="Ασθενείς" onClick={onAddPatient} />
                    <QuickActionBtn icon={Send} label="SMS" onClick={() => setShowSMS(true)} />
                    <QuickActionBtn icon={Phone} label="Κλήση" onClick={() => setShowCall(true)} />
                </div>
                <QuickActionBtn icon={FlaskConical} label={testStatus === 'sending' ? 'Αποστολή...' : 'Δοκιμή SMS Ανάκτησης'} onClick={handleTestRecovery} />
            </div>
            {showSMS && <SendSMSModal patients={patients} onClose={() => setShowSMS(false)} />}
            {showCall && <CallPatientModal patients={patients} onClose={() => setShowCall(false)} />}
        </>
    );
};

export default QuickActions;
