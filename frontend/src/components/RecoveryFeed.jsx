import React from 'react';
import toast from 'react-hot-toast';
import { Sparkles, MessageSquare, PhoneMissed, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { getAccessToken } from '../lib/authSession';

const RecoveryFeed = ({ logs = [], muted = false, token }) => {
    const [retrying, setRetrying] = React.useState({});

    const handleRetry = async (logId) => {
        if (retrying[logId]) return;
        setRetrying(r => ({ ...r, [logId]: 'retrying' }));
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
        const authToken = token || getAccessToken();
        if (!authToken) {
            toast.error('Session expired. Refresh the page and try again.');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/recovery/${logId}/retry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }
            });
            const data = await res.json();
            const status = data.data?.smsStatus === 'sent' ? 'sent' : 'failed';
            setRetrying(r => ({ ...r, [logId]: status }));
            if (status === 'sent') toast.success('Το SMS στάλθηκε με επιτυχία!');
            else toast.error('Η αποστολή απέτυχε — ελέγξτε τις ρυθμίσεις');
        } catch {
            setRetrying(r => ({ ...r, [logId]: 'failed' }));
            toast.error('Πρόβλημα στη σύνδεση με το διακομιστή');
        } finally {
            setTimeout(() => setRetrying(r => { const n = { ...r }; delete n[logId]; return n; }), 3000);
        }
    };
    const getStatusInfo = (status) => {
        switch (status) {
            case 'RECOVERED':
                return { icon: CheckCircle2, color: '#10b981', bg: '#f0fdf4', label: 'Επέστρεψε' };
            case 'RECOVERING':
                return { icon: MessageSquare, color: '#f59e0b', bg: '#fffbeb', label: 'Σε επικοινωνία' };
            case 'LOST':
                return { icon: AlertCircle, color: '#ef4444', bg: '#fef2f2', label: 'Δεν απάντησε' };
            case 'DETECTED':
                return { icon: PhoneMissed, color: 'var(--primary)', bg: 'var(--primary-light)', label: 'Νέα κλήση' };
            default:
                return { icon: Clock, color: '#64748b', bg: '#f1f5f9', label: status };
        }
    };

    const sortedLogs = Array.isArray(logs)
        ? [...logs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20)
        : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {sortedLogs.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '2.5rem 1.5rem', textAlign: 'center', gap: '0.5rem',
                        borderRadius: '16px',
                        background: 'linear-gradient(180deg, #f8fafc, #f1f5f9)',
                        border: '1px dashed #e2e8f0'
                    }}>
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '14px',
                            background: 'rgba(16,185,129,0.1)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', marginBottom: '4px'
                        }}>
                            <PhoneMissed size={20} color="#10b981" />
                        </div>
                        <p style={{ fontSize: '0.82rem', fontWeight: '700', color: '#475569', margin: 0 }}>
                            Σύστημα έτοιμο
                        </p>
                        <p style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '500', margin: 0, lineHeight: 1.6 }}>
                            Οι αναπάντητες κλήσεις θα εμφανίζονται<br />εδώ αυτόματα.
                        </p>
                        <div style={{
                            marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '8px',
                            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)'
                        }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px rgba(16,185,129,0.5)' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#059669' }}>Παρακολούθηση ενεργή</span>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {sortedLogs.map((log) => {
                            const { icon: StatusIcon, color, bg, label } = getStatusInfo(log.status);
                            const time = new Date(log.createdAt).toLocaleTimeString('el-GR', {
                                hour: '2-digit',
                                minute: '2-digit'
                            });

                            return (
                                <div key={log.id} className="animate-fade" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.32rem 0.65rem',
                                    borderRadius: '8px',
                                    border: log.smsStatus === 'failed' ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(226,232,240,0.25)',
                                    background: log.smsStatus === 'failed' ? 'rgba(254,242,242,0.6)' : 'rgba(255,255,255,0.4)',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                }}>
                                    {/* phone number */}
                                    <span style={{ fontWeight: '600', fontSize: '0.75rem', color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                        {log.fromNumber}
                                    </span>
                                    {/* SMS Failed badge */}
                                    {log.smsStatus === 'failed' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '6px', background: 'rgba(239,68,68,0.12)', flexShrink: 0 }}>
                                            <AlertCircle size={9} color="#dc2626" />
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: '#dc2626' }}>Αποτυχία SMS</span>
                                        </div>
                                    )}
                                    {/* dot + label */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                                        <span style={{ fontSize: '0.62rem', fontWeight: '500', color: '#64748b' }}>{label}</span>
                                    </div>
                                    {/* time */}
                                    <span style={{ fontSize: '0.58rem', color: '#b0bec5', fontWeight: '400', flexShrink: 0 }}>{time}</span>
                                    {/* error message */}
                                    {log.smsStatus === 'failed' && log.smsError && (
                                        <p style={{ width: '100%', margin: '2px 0 0', fontSize: '0.62rem', color: '#dc2626', fontWeight: '600' }}>
                                            {log.smsError}
                                        </p>
                                    )}
                                    {/* retry button */}
                                    {log.smsStatus === 'failed' && (
                                        <button
                                            onClick={() => handleRetry(log.id)}
                                            disabled={!!retrying[log.id]}
                                            style={{
                                                marginTop: '4px',
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                padding: '3px 10px', borderRadius: '6px',
                                                border: '1px solid rgba(239,68,68,0.3)',
                                                background: retrying[log.id] === 'sent'
                                                    ? 'rgba(16,185,129,0.1)'
                                                    : 'rgba(239,68,68,0.08)',
                                                color: retrying[log.id] === 'sent' ? '#059669' : '#dc2626',
                                                fontSize: '0.62rem', fontWeight: '800',
                                                cursor: retrying[log.id] ? 'not-allowed' : 'pointer',
                                                opacity: retrying[log.id] === 'retrying' ? 0.6 : 1,
                                            }}
                                        >
                                            <RefreshCw size={9} />
                                            {retrying[log.id] === 'retrying'
                                                ? 'Προσπάθεια...'
                                                : retrying[log.id] === 'sent'
                                                    ? '✓ Εστάλη!'
                                                    : retrying[log.id] === 'failed'
                                                        ? '✗ Απέτυχε'
                                                        : 'Νέα Προσπάθεια'}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
        </div>
    );
};

export default RecoveryFeed;
