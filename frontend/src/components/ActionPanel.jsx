import React from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { MessageSquare, X, Send, User, UserPlus, Calendar, ChevronRight } from 'lucide-react';
import { getEvent, getPatientLabel, formatTime, getInitials } from '../lib/recoveryUtils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const ActionPanel = ({ log, token, onClose, onNavigate }) => {
    const event = getEvent(log);
    const name = log.patientName || log.patient?.name || log.fromNumber;
    const phone = log.fromNumber;

    const [smsText, setSmsText] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [patientData, setPatientData] = React.useState(log.patient || null);
    const [loadingPatient, setLoadingPatient] = React.useState(false);
    const [savingPatient, setSavingPatient] = React.useState(false);
    const [patientName, setPatientName] = React.useState('');
    const [showNameInput, setShowNameInput] = React.useState(false);
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
    const isKnownPatient = !!(log.patient?.id || patientData?.id);

    React.useEffect(() => {
        if (log.patient?.id) {
            setLoadingPatient(true);
            fetch(`${API_BASE}/appointments/patients`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }).then(r => r.ok ? r.json() : null).then(data => {
                const patient = Array.isArray(data) ? data.find(p => p.id === log.patient.id) : null;
                if (patient) setPatientData(patient);
            }).catch(() => {}).finally(() => setLoadingPatient(false));
        } else if (log.fromNumber) {
            fetch(`${API_BASE}/appointments/patients`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }).then(r => r.ok ? r.json() : null).then(data => {
                const match = Array.isArray(data) ? data.find(p => p.phone === log.fromNumber) : null;
                if (match) setPatientData(match);
            }).catch(() => {});
        }
    }, [log.id]);

    const handleSendSms = async () => {
        if (!smsText.trim() || sending) return;
        setSending(true);
        try {
            if (isKnownPatient) {
                await fetch(`${API_BASE}/messages/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ patientId: log.patient.id, message: smsText.trim() })
                });
            } else {
                toast('Αποθηκεύστε πρώτα τον ασθενή για να στείλετε SMS.');
                setSending(false);
                return;
            }
            toast.success('SMS εστάλη!');
            setSmsText('');
        } catch {
            toast.error('Αποτυχία αποστολής SMS.');
        } finally {
            setSending(false);
        }
    };

    const handleSavePatient = async () => {
        if (!patientName.trim()) { setShowNameInput(true); return; }
        setSavingPatient(true);
        try {
            const res = await fetch(`${API_BASE}/patients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({ name: patientName.trim(), phone })
            });
            const data = await res.json();
            if (data.id) {
                toast.success('Ασθενής αποθηκεύτηκε!');
                setPatientData(data);
                setShowNameInput(false);
            } else {
                toast.error(data.error || 'Σφάλμα αποθήκευσης.');
            }
        } catch {
            toast.error('Σφάλμα σύνδεσης.');
        } finally {
            setSavingPatient(false);
        }
    };

    const renderConversation = () => {
        try {
            const conv = log.aiConversation ? (typeof log.aiConversation === 'string' ? JSON.parse(log.aiConversation) : log.aiConversation) : null;
            if (!Array.isArray(conv) || conv.length === 0) return null;
            
            return (
                <div className="action-panel-section">
                    <div className="action-panel-label">
                        <MessageSquare size={12} />
                        Συνομιλία AI
                    </div>
                    <div className="conversation-messages">
                        {conv.map((msg, idx) => {
                            const isPatient = msg.role === 'user' || msg.direction === 'inbound' || msg.from === 'patient';
                            const isSystem = msg.role === 'system';
                            const content = msg.content || msg.body || msg.text || '';
                            
                            if (!content || (isSystem && content.startsWith('vapi_call_id:'))) return null;
                            
                            return (
                                <div key={idx} className={`message-bubble ${isPatient ? 'patient' : isSystem ? 'system' : 'ai'}`}>
                                    <div className="message-role">
                                        {isPatient ? 'Ασθενής' : isSystem ? 'Σύστημα' : 'AI Assistant'}
                                    </div>
                                    <div className="message-content">{content}</div>
                                    {msg.timestamp && (
                                        <div className="message-time">
                                            {new Date(msg.timestamp).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        } catch {
            return null;
        }
    };

    const renderRecoveryStatus = () => (
        <div className="action-panel-section">
            <div className="action-panel-label">Κατάσταση Ανάκτησης</div>
            <div className="status-grid">
                {[
                    { label: 'Κλήση', value: formatTime(log.createdAt) },
                    { label: log.smsStatus === 'pending' ? 'Κλήση' : 'SMS', value: log.smsStatus === 'sent' ? '✓ Εστάλη' : log.smsStatus === 'failed' ? '✗ Απέτυχε' : log.smsStatus === 'pending' ? '📞 AI Κλήση' : log.smsStatus },
                    { label: 'Κατάσταση', value: log.status },
                    log.recoveredAt && { label: 'Ανακτήθηκε', value: formatTime(log.recoveredAt) },
                ].filter(Boolean).map(({ label, value }) => (
                    <div key={label} className="status-row">
                        <span>{label}</span>
                        <span>{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    return createPortal(
        <div className="action-panel-overlay">
            <div className="action-panel-backdrop" onClick={onClose} />
            <div className="action-panel-slide">
            <style>{`
                .action-panel-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; }
                .action-panel-backdrop { flex: 1; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); }
                .action-panel-slide { width: 360px; background: var(--modal-bg); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow-y: auto; box-shadow: -20px 0 60px rgba(0,0,0,0.15); animation: slideInRight 0.2s ease; }
                @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                .action-panel-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; }
                .event-badge { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
                .event-dot { width: 8px; height: 8px; border-radius: 50%; }
                .event-label { font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
                .patient-name { font-size: 1.1rem; font-weight: 900; color: var(--text); margin: 0; }
                .patient-phone { font-size: 0.78rem; color: var(--text-light); margin: 2px 0 0; }
                .close-btn { background: none; border: none; cursor: pointer; color: #64748b; padding: 4px; }
                .action-panel-content { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
                .action-panel-section { display: flex; flex-direction: column; gap: 0.5rem; }
                .action-panel-label { font-size: 0.72rem; font-weight: 800; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; }
                .patient-status { padding: 0.75rem 1rem; border-radius: 12px; display: flex; align-items: center; gap: 10px; }
                .patient-status.known { background: rgba(16,185,129,0.07); border: 1px solid rgba(16,185,129,0.2); }
                .patient-status.unknown { background: var(--primary-light); border: 1px solid rgba(99,91,255,0.22); }
                .patient-status.known svg { color: #10b981; }
                .patient-status.unknown svg { color: var(--primary); }
                .status-title { font-size: 0.78rem; font-weight: 700; color: #065f46; }
                .patient-status.unknown .status-title { color: var(--primary); }
                .status-sub { font-size: 0.68rem; color: #64748b; margin-top: 2px; }
                .save-patient-section { margin-left: auto; }
                .name-input-row { display: flex; gap: 6px; align-items: center; }
                .name-input { padding: 4px 8px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); font-size: 0.75rem; width: 130px; outline: none; }
                .confirm-btn { padding: 4px 10px; border-radius: 7px; border: none; background: #10b981; color: white; font-size: 0.68rem; font-weight: 800; cursor: pointer; }
                .save-btn { padding: 4px 10px; border-radius: 8px; border: none; background: linear-gradient(135deg, rgba(99,91,255,0.88) 0%, rgba(139,92,246,0.72) 100%); color: white; font-size: 0.68rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px; }
                .sms-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-subtle); color: var(--text); font-size: 0.85rem; resize: none; box-sizing: border-box; outline: none; font-family: inherit; }
                .send-btn { margin-top: 6px; width: 100%; padding: 9px; border-radius: 10px; border: none; background: var(--primary); color: white; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
                .send-btn.disabled { opacity: 0.6; cursor: not-allowed; }
                .quick-actions { display: flex; flex-direction: column; gap: 6px; }
                .quick-action-btn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-subtle); cursor: pointer; color: var(--text); text-align: left; font-family: inherit; }
                .quick-action-btn span { font-size: 0.82rem; font-weight: 600; flex: 1; }
                .quick-action-btn svg:last-child { color: #94a3b8; }
                .conversation-messages { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
                .message-bubble { maxWidth: '85%'; padding: 8px 12px; border-radius: 12px; border: 1px solid; }
                .message-bubble.patient { align-self: flex-end; background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.2); }
                .message-bubble.system { align-self: flex-start; background: rgba(148,163,184,0.08); border-color: rgba(148,163,184,0.15); }
                .message-bubble.ai { align-self: flex-start; background: rgba(99,91,255,0.12); border-color: rgba(99,91,255,0.2); }
                .message-role { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 3px; }
                .message-bubble.patient .message-role { color: #3b82f6; }
                .message-bubble.system .message-role { color: #64748b; }
                .message-bubble.ai .message-role { color: var(--primary); }
                .message-content { font-size: 0.78rem; color: var(--text); line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
                .message-time { font-size: 0.62rem; color: var(--text-light); margin-top: 4px; opacity: 0.7; }
                .status-grid { display: flex; flex-direction: column; gap: 4px; }
                .status-row { display: flex; justify-content: space-between; font-size: 0.75rem; }
                .status-row span:first-child { color: var(--text-light); font-weight: 600; }
                .status-row span:last-child { color: var(--text); font-weight: 700; }
            `}</style>
            <div className="action-panel">
                <div className="action-panel-header">
                    <div>
                        <div className="event-badge">
                            <span className="event-dot" style={{ background: event.dot }} />
                            <span className="event-label" style={{ color: event.dot }}>{event.label}</span>
                        </div>
                        <h3 className="patient-name">{name}</h3>
                        <p className="patient-phone">{phone}</p>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="action-panel-content">
                    <div className={`patient-status ${isKnownPatient ? 'known' : 'unknown'}`}>
                        <User size={16} />
                        <div>
                            <div className="status-title">
                                {isKnownPatient ? 'Υπάρχων ασθενής' : 'Νέος / Άγνωστος ασθενής'}
                            </div>
                            {isKnownPatient && patientData?.appointments && (
                                <div className="status-sub">{patientData.appointments.length} ραντεβού στο ιστορικό</div>
                            )}
                        </div>
                        {!isKnownPatient && !patientData?.id && (
                            <div className="save-patient-section">
                                {showNameInput ? (
                                    <div className="name-input-row">
                                        <input
                                            autoFocus
                                            value={patientName}
                                            onChange={e => setPatientName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSavePatient()}
                                            placeholder="Όνομα ασθενή"
                                            className="name-input"
                                        />
                                        <button onClick={handleSavePatient} disabled={savingPatient} className="confirm-btn">
                                            {savingPatient ? '...' : 'OK'}
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowNameInput(true)} className="save-btn">
                                        <UserPlus size={11} /> Αποθήκευση
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="action-panel-section">
                        <label className="action-panel-label">Αποστολή SMS</label>
                        <textarea
                            value={smsText}
                            onChange={e => setSmsText(e.target.value)}
                            placeholder="Γράψτε μήνυμα..."
                            rows={3}
                            className="sms-input"
                        />
                        <button 
                            onClick={handleSendSms} 
                            disabled={!smsText.trim() || sending} 
                            className={`send-btn ${(!smsText.trim() || sending) ? 'disabled' : ''}`}
                        >
                            <Send size={13} /> {sending ? 'Αποστολή...' : 'Αποστολή SMS'}
                        </button>
                    </div>

                    <div className="action-panel-section">
                        <label className="action-panel-label">Γρήγορες Ενέργειες</label>
                        <div className="quick-actions">
                            <button className="quick-action-btn" onClick={() => { onNavigate && onNavigate('appointments'); onClose(); }}>
                                <Calendar size={15} />
                                <span>Νέο Ραντεβού</span>
                                <ChevronRight size={13} />
                            </button>
                            {isKnownPatient && (
                                <button className="quick-action-btn" onClick={() => { onNavigate && onNavigate('patients'); onClose(); }}>
                                    <User size={15} />
                                    <span>Προφίλ Ασθενή</span>
                                    <ChevronRight size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {renderConversation()}
                    {renderRecoveryStatus()}
                </div>
            </div>
            </div>
        </div>,
        document.body
    );
};

export default ActionPanel;