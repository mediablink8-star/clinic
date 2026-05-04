import React from 'react';
import toast from 'react-hot-toast';
import { PhoneMissed, RefreshCw, Phone, PhoneCall, MessageSquare, AlertCircle, CheckCircle, Reply, Clock } from 'lucide-react';
import ActionPanel from './ActionPanel';
import { getEvent, getPatientLabel, formatTime, getReplyPreview, getRevenue, getInitials } from '../lib/recoveryUtils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const STATUS_ICONS = {
    RECOVERED: CheckCircle,
    RECOVERING: Reply,
    DETECTED: PhoneMissed,
    LOST: AlertCircle,
    SMS_SENT: MessageSquare,
    SMS_FAILED: AlertCircle,
    PENDING: Clock,
    VOICE_CALL: Phone,
    VOICE_ANSWERED: PhoneCall,
};

const RecoveryFeed = ({ logs = [], token, onNavigate }) => {
    const [retrying, setRetrying] = React.useState({});
    const [selected, setSelected] = React.useState(null);
    const [dismissed, setDismissed] = React.useState(() => {
        try {
            const saved = localStorage.getItem('feed_dismissed');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch { return new Set(); }
    });

    const dismissAll = (ids) => {
        const next = new Set(ids);
        setDismissed(next);
        try { localStorage.setItem('feed_dismissed', JSON.stringify([...next])); } catch {}
    };

    const handleRetry = async (logId, e) => {
        e.stopPropagation();
        if (retrying[logId]) return;
        setRetrying(r => ({ ...r, [logId]: 'retrying' }));
        const authToken = token || localStorage.getItem('accessToken');
        if (!authToken) { toast.error('Session expired.'); return; }
        try {
            const res = await fetch(`${API_BASE}/recovery/${logId}/retry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }
            });
            const data = await res.json();
            const status = data.data?.smsStatus === 'sent' ? 'sent' : 'failed';
            setRetrying(r => ({ ...r, [logId]: status }));
            if (status === 'sent') toast.success('Το SMS στάλθηκε!');
            else toast.error('Αποτυχία — ελέγξτε ρυθμίσεις');
        } catch {
            setRetrying(r => ({ ...r, [logId]: 'failed' }));
            toast.error('Σφάλμα σύνδεσης');
        } finally {
            setTimeout(() => setRetrying(r => { const n = { ...r }; delete n[logId]; return n; }), 3000);
        }
    };

    const allSorted = Array.isArray(logs)
        ? [...logs].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 15)
        : [];
    const sorted = allSorted.filter(l => !dismissed.has(l.id));

    const stats = React.useMemo(() => {
        const total = logs.length || allSorted.length;
        const recovered = (logs || []).filter(l => l.status === 'RECOVERED').length || allSorted.filter(l => l.status === 'RECOVERED').length;
        const recovering = (logs || []).filter(l => l.status === 'RECOVERING').length || allSorted.filter(l => l.status === 'RECOVERING').length;
        const rate = total > 0 ? Math.round((recovered / total) * 100) : 0;
        return { total, recovered, recovering, rate };
    }, [logs, allSorted]);

    if (allSorted.length === 0) {
        return (
            <div className="feed-empty">
                <div className="empty-icon">
                    <PhoneMissed size={20} />
                </div>
                <p className="empty-title">Δεν υπάρχει δραστηριότητα</p>
                <div className="empty-status">
                    <span className="status-dot" />
                    <span>Σε αναμονή</span>
                </div>
            </div>
        );
    }

    return (
        <div className="feed-container">
            <div className="feed-stats">
                <div className="stat-item">
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-label">Σύνολο</span>
                </div>
                <div className="stat-divider" />
                <div className="stat-item success">
                    <span className="stat-value">{stats.recovered}</span>
                    <span className="stat-label">Ανακτήθηκαν</span>
                </div>
                <div className="stat-divider" />
                <div className="stat-item warning">
                    <span className="stat-value">{stats.recovering}</span>
                    <span className="stat-label">Σε εξέλιξη</span>
                </div>
                <div className="stat-divider" />
                <div className="stat-item">
                    <span className="stat-value">{stats.rate}%</span>
                    <span className="stat-label">Ποσοστό</span>
                </div>
            </div>
            
            <div className="feed-header">
                <button className="clear-btn" onClick={() => dismissAll(allSorted.map(l => l.id))}>
                    Καθαρισμός
                </button>
            </div>
            
            <div className="feed-list">
                {sorted.map((log) => {
                    const event = getEvent(log);
                    const IconComponent = STATUS_ICONS[log.status] || PhoneMissed;
                    const name = getPatientLabel(log);
                    const isFailed = log.smsStatus === 'failed';
                    const replyPreview = getReplyPreview(log);
                    const revenue = getRevenue(log);

                    // Get background color based on action type
                    const getActionBackground = () => {
                        // Purple for recovered appointments
                        if (log.status === 'RECOVERED') {
                            return 'rgba(147,51,234,0.08)'; // Purple
                        }
                        // Red for missed calls / detected
                        if (log.status === 'DETECTED' || log.status === 'LOST') {
                            return 'rgba(239,68,68,0.08)'; // Red
                        }
                        // Yellow for SMS sent
                        if (log.smsStatus === 'sent' || log.smsStatus === 'simulated') {
                            return 'rgba(234,179,8,0.08)'; // Yellow
                        }
                        // Red for failed SMS
                        if (log.smsStatus === 'failed') {
                            return 'rgba(239,68,68,0.08)'; // Red
                        }
                        // Green for recovering/active conversations
                        if (log.status === 'RECOVERING') {
                            return 'rgba(16,185,129,0.08)'; // Green
                        }
                        return sorted.indexOf(log) % 2 === 0 ? 'var(--glass-surface)' : 'transparent';
                    };

                    // Outcome badges
                    const getOutcomeBadge = () => {
                        if (log.status === 'RECOVERED') {
                            return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>🟢 Κλείστηκε</span>;
                        }
                        if (log.status === 'RECOVERING') {
                            return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'rgba(99,91,255,0.12)', color: '#6366f1', border: '1px solid rgba(99,91,255,0.2)' }}>🟡 Ενεργό</span>;
                        }
                        if (log.status === 'LOST') {
                            return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>🔴 Χάθηκε</span>;
                        }
                        if (log.smsStatus === 'failed') {
                            return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>❌ Απέτυχε</span>;
                        }
                        return null;
                    };

                    return (
                        <div
                            key={log.id}
                            className={`feed-item ${log.status}`}
                            style={{ 
                                borderLeftColor: event.dot,
                                backgroundColor: getActionBackground()
                            }}
                            onClick={() => setSelected(log)}
                        >
                            <div className="feed-icon" style={{ background: event.bg, borderColor: event.border }}>
                                <IconComponent size={18} color={event.dot} />
                            </div>
                            <div className="feed-content">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <div className="feed-name">{name}</div>
                                    {getOutcomeBadge()}
                                </div>
                                <div className="feed-sub">
                                    {replyPreview || log.fromNumber || '—'}
                                </div>
                            </div>
                            <div className="feed-right">
                                <span className="feed-time">{formatTime(log.updatedAt || log.createdAt)}</span>
                                {log.status === 'RECOVERED' ? (
                                    <span className="badge-success">+€{revenue}</span>
                                ) : log.status === 'RECOVERING' ? (
                                    <span className="badge-primary">~€{revenue}</span>
                                ) : isFailed ? (
                                    <button className={`btn-retry ${retrying[log.id]}`} onClick={(e) => handleRetry(log.id, e)} disabled={!!retrying[log.id]}>
                                        {retrying[log.id] === 'retrying' ? '...' : retrying[log.id] === 'sent' ? '✓' : '↻'}
                                    </button>
                                ) : (
                                    <span className="status-dot" style={{ background: event.dot }} />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {selected && (
                <ActionPanel
                    log={selected}
                    token={token}
                    onClose={() => setSelected(null)}
                    onNavigate={onNavigate}
                />
            )}

            <style>{`
                .feed-container { display: flex; flex-direction: column; height: 100%; min-height: 0; }
                .feed-stats { display: flex; align-items: center; justify-content: space-around; padding: 8px 12px; background: var(--glass-surface); backdrop-filter: blur(16px); border: 1px solid var(--border-glass); border-radius: 10px; margin-bottom: 6px; flex-shrink: 0; }
                .stat-item { display: flex; flex-direction: column; align-items: center; gap: 1px; }
                .stat-value { font-size: 1.25rem; font-weight: 900; color: var(--secondary); letterSpacing: '-0.02em'; }
                .stat-label { font-size: 0.55rem; fontWeight: 500; color: var(--text-muted); text-transform: uppercase; letterSpacing: '0.05em'; }
                .stat-item.success .stat-value { color: #10b981; }
                .stat-item.warning .stat-value { color: var(--primary); }
                .stat-divider { width: 1px; height: 24px; background: var(--border); }
                
                .feed-header { display: flex; justify-content: flex-end; margin-bottom: 4px; }
                .clear-btn { background: none; border: none; cursor: pointer; color: var(--text-light); font-size: 0.65rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; }
                .clear-btn:hover { background: var(--primary-light); color: var(--primary); }
                
                .feed-list { display: flex; flex-direction: column; gap: 4px; flex: 1; min-height: 0; overflow-y: auto; }
                
                .feed-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.5rem 1rem; text-align: center; gap: 0.5rem; border-radius: 10px; background: var(--glass-surface); border: 1px solid var(--border-glass); }
                .empty-icon { width: 32px; height: 32px; border-radius: 50%; background: var(--primary-light); display: flex; align-items: center; justify-content: center; }
                .empty-icon svg { color: var(--primary); }
                .empty-title { font-size: 0.75rem; font-weight: 700; color: var(--text); margin: 0; }
                .empty-status { display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 8px; background: var(--primary-light); }
                .empty-status .status-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--primary); }
                .empty-status span { font-size: 0.55rem; font-weight: 600; color: var(--primary); }
                
.feed-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-glass); border-left: 3px solid; cursor: pointer; transition: all 0.15s; position: relative; }
                .feed-item:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); background: var(--glass-surface) !important; }
                
                .feed-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid; }
                .feed-content { flex: 1; min-width: 0; }
                .feed-name { font-size: 0.9rem; font-weight: 700; color: var(--text); }
                .feed-sub { font-size: 0.78rem; color: var(--text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
                
                .feed-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
                .feed-time { font-size: 0.72rem; color: var(--text-light); font-weight: 500; }
                .badge-success { font-size: 0.7rem; font-weight: 800; padding: 3px 8px; border-radius: 10px; background: rgba(16,185,129,0.12); color: #059669; }
                .badge-primary { font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 10px; background: rgba(99,91,255,0.12); color: var(--primary); }
                .btn-retry { width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(239,68,68,0.1); color: #dc2626; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .btn-retry.sent { background: rgba(16,185,129,0.12); color: #059669; }
                .status-dot { width: 8px; height: 8px; border-radius: 50%; }
                
                .feed-list::-webkit-scrollbar { width: 3px; }
                .feed-list::-webkit-scrollbar-track { background: transparent; }
                .feed-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
            `}</style>
        </div>
    );
};

export default RecoveryFeed;