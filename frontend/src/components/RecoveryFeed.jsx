import React from 'react';
import toast from 'react-hot-toast';
import { PhoneMissed, RefreshCw, Phone, PhoneCall, MessageSquare, AlertCircle, CheckCircle, Reply, Clock, Flame } from 'lucide-react';
import ActionPanel from './ActionPanel';
import { getEvent, getPatientLabel, formatTime, getReplyPreview, getRevenue, getInitials } from '../lib/recoveryUtils';

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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

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
        ? [...logs].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 8)
        : [];
    const sorted = allSorted.filter(l => !dismissed.has(l.id));

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

    const stats = React.useMemo(() => {
        const total = allSorted.length;
        const recovered = allSorted.filter(l => l.status === 'RECOVERED').length;
        const recovering = allSorted.filter(l => l.status === 'RECOVERING').length;
        const lost = allSorted.filter(l => l.status === 'LOST').length;
        const rate = total > 0 ? Math.round((recovered / total) * 100) : 0;
        return { total, recovered, recovering, lost, rate };
    }, [allSorted]);

    return (
        <div className="feed-container">
            {allSorted.length > 0 && (
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
            )}
            {(sorted.length < allSorted.length || allSorted.length > 0) && (
                <div className="feed-header">
                    <button className="clear-btn" onClick={() => dismissAll(allSorted.map(l => l.id))}>
                        Καθαρισμός
                    </button>
                </div>
            )}
            <div className="feed-list">
                {sorted.map((log) => {
                    const event = getEvent(log);
                    const Icon = event.icon;
                    const name = getPatientLabel(log);
                    const isFailed = log.smsStatus === 'failed';
                    const replyPreview = getReplyPreview(log);
                    const revenue = getRevenue(log);

                    const IconComponent = STATUS_ICONS[log.status] || PhoneMissed;
                    const isUrgent = log.priority === 'URGENT' || (log.status === 'DETECTED' && !log.smsStatus);

                    return (
                        <div
                            key={log.id}
                            className={`feed-item ${log.status} ${isUrgent ? 'urgent' : ''}`}
                            onClick={() => setSelected(log)}
                        >
                            <div className="feed-status-bar" style={{ background: event.dot }} />
                            <div className="feed-icon-wrapper" style={{ background: event.dot + '15', color: event.dot }}>
                                <IconComponent size={16} />
                            </div>
                            <div className="feed-content">
                                <div className="feed-main-row">
                                    <div className="feed-name-row">
                                        <span className="feed-name">{name}</span>
                                        {isUrgent && <Flame size={12} className="priority-icon" />}
                                    </div>
                                    <span className="feed-time">{formatTime(log.updatedAt || log.createdAt)}</span>
                                </div>
                                <div className="feed-sub-row">
                                    {replyPreview ? (
                                        <span className="feed-preview">{replyPreview}</span>
                                    ) : (
                                        <span className="feed-phone">{log.fromNumber || '—'}</span>
                                    )}
                                </div>
                            </div>
                            <div className="feed-right">
                                {log.status === 'RECOVERED' ? (
                                    <span className="badge-recovered">+€{revenue}</span>
                                ) : log.status === 'RECOVERING' ? (
                                    <span className="badge-recovering">~€{revenue}</span>
                                ) : isFailed ? (
                                    <button className={`btn-retry ${retrying[log.id]}`} onClick={(e) => handleRetry(log.id, e)} disabled={!!retrying[log.id]}>
                                        {retrying[log.id] === 'retrying' ? '...' : retrying[log.id] === 'sent' ? '✓' : '↻'}
                                    </button>
                                ) : (
                                    <div className="status-dot-wrapper">
                                        <span className="status-dot-small" style={{ background: event.dot }} />
                                    </div>
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
                .feed-stats { display: flex; align-items: center; justify-content: space-around; padding: 16px 20px; background: var(--bg-subtle); border-radius: 14px; margin-bottom: 14px; flex-shrink: 0; }
                .stat-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
                .stat-value { font-size: 1.25rem; font-weight: 800; color: var(--text); }
                .stat-label { font-size: 0.65rem; font-weight: 600; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; }
                .stat-item.success .stat-value { color: #10b981; }
                .stat-item.warning .stat-value { color: #3b82f6; }
                .stat-divider { width: 1px; height: 28px; background: var(--border); }
                .feed-header { display: flex; justify-content: flex-end; margin-bottom: 8px; flex-shrink: 0; }
                .clear-btn { background: none; border: none; cursor: pointer; color: var(--text-light); font-size: 0.72rem; font-weight: 600; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; }
                .clear-btn:hover { background: var(--bg-subtle); color: var(--text); }
                .feed-list { display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
                
                .feed-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.5rem 1.5rem; text-align: center; gap: 1rem; border-radius: 16px; background: linear-gradient(135deg, var(--bg-subtle) 0%, rgba(16,185,129,0.03) 100%); border: 1px solid var(--border); }
                .empty-icon { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%); display: flex; align-items: center; justify-content: center; }
                .empty-icon svg { color: #10b981; }
                .empty-title { font-size: 0.9rem; font-weight: 700; color: var(--text); margin: 0; }
                .empty-status { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 20px; background: rgba(16,185,129,0.1); }
                .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                .empty-status span { font-size: 0.7rem; font-weight: 600; color: #059669; }
                
                .feed-item { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 16px; background: var(--bg-card); border: 1px solid var(--border); cursor: pointer; transition: all 0.2s ease; position: relative; overflow: hidden; }
                .feed-item:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: var(--primary); }
                .feed-item.RECOVERED { border-left: 3px solid #10b981; }
                .feed-item.RECOVERING { border-left: 3px solid #3b82f6; }
                .feed-item.DETECTED { border-left: 3px solid #ef4444; }
                .feed-item.LOST { border-left: 3px solid #94a3b8; }
                
                .feed-status-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
                .feed-icon-wrapper { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
                
                .feed-content { flex: 1; min-width: 0; }
                .feed-main-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
                .feed-name-row { display: flex; align-items: center; gap: 8px; }
                .feed-name { font-size: 1rem; font-weight: 700; color: var(--text); white-space: nowrap; }
                .priority-icon { color: #ef4444; animation: flame 1s infinite; }
                @keyframes flame { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                .feed-time { font-size: 0.75rem; color: var(--text-light); font-weight: 500; }
                .feed-sub-row { display: flex; align-items: center; gap: 8px; }
                .feed-preview { font-size: 0.85rem; color: #3b82f6; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
                .feed-phone { font-size: 0.85rem; color: var(--text-light); }
                
                .feed-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
                .badge-recovered { font-size: 0.85rem; font-weight: 800; padding: 6px 14px; border-radius: 20px; background: rgba(16,185,129,0.15); color: #059669; }
                .badge-recovering { font-size: 0.85rem; font-weight: 700; padding: 6px 14px; border-radius: 20px; background: rgba(59,130,246,0.15); color: #2563eb; }
                .btn-retry { width: 34px; height: 34px; border-radius: 50%; border: none; background: rgba(239,68,68,0.1); color: #dc2626; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
                .btn-retry:hover { background: rgba(239,68,68,0.2); transform: rotate(180deg); }
                .btn-retry.sent { background: rgba(16,185,129,0.15); color: #059669; }
                .status-dot-wrapper { width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; }
                .status-dot-small { width: 10px; height: 10px; border-radius: 50%; }
                
                .feed-item.urgent { border-color: #ef4444; }

                .feed-list::-webkit-scrollbar { width: 4px; }
                .feed-list::-webkit-scrollbar-track { background: transparent; }
                .feed-list::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.2); border-radius: 2px; }
                .feed-list::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.4); }
            `}</style>
        </div>
    );
};

export default RecoveryFeed;