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
            {/* Compact stats bar */}
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
                    <span className="stat-label">Ενεργές</span>
                </div>
                <div className="stat-divider" />
                <div className="stat-item">
                    <span className="stat-value">{stats.rate}%</span>
                    <span className="stat-label">Επιτυχία</span>
                </div>
            </div>
            
            {/* Activity feed */}
            <div className="feed-list">
                {sorted.map((log, index) => {
                    const event = getEvent(log);
                    const IconComponent = STATUS_ICONS[log.status] || PhoneMissed;
                    const name = getPatientLabel(log);
                    const initials = getInitials(name);
                    const isFailed = log.smsStatus === 'failed';
                    const replyPreview = getReplyPreview(log);
                    const revenue = getRevenue(log);

                    // Status badge
                    const getStatusBadge = () => {
                        if (log.status === 'RECOVERED') {
                            return { text: 'Κλείστηκε', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '✓' };
                        }
                        if (log.status === 'RECOVERING') {
                            return { text: 'Ενεργό', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: '⟳' };
                        }
                        if (log.status === 'LOST') {
                            return { text: 'Χάθηκε', color: '#dc2626', bg: 'rgba(239,68,68,0.1)', icon: '✕' };
                        }
                        if (log.smsStatus === 'failed') {
                            return { text: 'Απέτυχε', color: '#dc2626', bg: 'rgba(239,68,68,0.1)', icon: '!' };
                        }
                        return null;
                    };

                    const statusBadge = getStatusBadge();

                    return (
                        <div
                            key={log.id}
                            className="feed-item-modern"
                            onClick={() => setSelected(log)}
                        >
                            {/* Avatar with initials */}
                            <div className="feed-avatar" style={{ background: event.bg, borderColor: event.dot }}>
                                <span style={{ color: event.dot, fontSize: '0.75rem', fontWeight: '800' }}>{initials}</span>
                            </div>

                            {/* Content */}
                            <div className="feed-content-modern">
                                <div className="feed-header-row">
                                    <span className="feed-name-modern">{name}</span>
                                    {statusBadge && (
                                        <span className="status-badge-modern" style={{ background: statusBadge.bg, color: statusBadge.color }}>
                                            <span className="status-icon">{statusBadge.icon}</span>
                                            {statusBadge.text}
                                        </span>
                                    )}
                                </div>
                                <div className="feed-message">
                                    {replyPreview || log.fromNumber || 'Αναπάντητη κλήση'}
                                </div>
                            </div>

                            {/* Right side - time and revenue */}
                            <div className="feed-meta">
                                <span className="feed-time-modern">{formatTime(log.updatedAt || log.createdAt)}</span>
                                {log.status === 'RECOVERED' ? (
                                    <span className="revenue-badge success">+€{revenue}</span>
                                ) : log.status === 'RECOVERING' ? (
                                    <span className="revenue-badge pending">~€{revenue}</span>
                                ) : isFailed ? (
                                    <button className={`retry-btn-modern ${retrying[log.id]}`} onClick={(e) => handleRetry(log.id, e)} disabled={!!retrying[log.id]}>
                                        {retrying[log.id] === 'retrying' ? <RefreshCw size={12} className="spinning" /> : retrying[log.id] === 'sent' ? '✓' : '↻'}
                                    </button>
                                ) : null}
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
                .feed-container { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 8px; }
                
                /* Stats bar */
                .feed-stats { 
                    display: flex; 
                    align-items: center; 
                    justify-content: space-around; 
                    padding: 10px 14px; 
                    background: linear-gradient(135deg, var(--glass-surface) 0%, var(--bg-subtle) 100%); 
                    backdrop-filter: blur(16px); 
                    border: 1.5px solid var(--border-glass); 
                    border-radius: 12px; 
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                }
                .stat-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
                .stat-value { font-size: 1.35rem; font-weight: 900; color: var(--secondary); letter-spacing: -0.03em; }
                .stat-label { font-size: 0.68rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
                .stat-item.success .stat-value { color: #10b981; }
                .stat-item.warning .stat-value { color: var(--primary); }
                .stat-divider { width: 1px; height: 28px; background: var(--border); opacity: 0.5; }
                
                /* Feed list */
                .feed-list { 
                    display: flex; 
                    flex-direction: column; 
                    gap: 6px; 
                    flex: 1; 
                    min-height: 0; 
                    overflow-y: auto; 
                    padding-right: 2px;
                }
                
                /* Modern feed item */
                .feed-item-modern {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 14px;
                    border-radius: 12px;
                    background: var(--glass-surface);
                    border: 1.5px solid var(--border-glass);
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }
                
                .feed-item-modern::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 3px;
                    background: var(--primary);
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                
                .feed-item-modern:hover {
                    transform: translateX(2px);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
                    border-color: var(--primary);
                    background: linear-gradient(135deg, var(--glass-surface) 0%, var(--bg-subtle) 100%);
                }
                
                .feed-item-modern:hover::before {
                    opacity: 1;
                }
                
                /* Avatar */
                .feed-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    border: 2px solid;
                    font-weight: 800;
                    transition: transform 0.2s ease;
                }
                
                .feed-item-modern:hover .feed-avatar {
                    transform: scale(1.05);
                }
                
                /* Content */
                .feed-content-modern {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .feed-header-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .feed-name-modern {
                    font-size: 0.9rem;
                    font-weight: 800;
                    color: var(--text);
                    letter-spacing: -0.01em;
                }
                
                .status-badge-modern {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 8px;
                    border-radius: 8px;
                    font-size: 0.7rem;
                    font-weight: 800;
                    letter-spacing: 0.01em;
                }
                
                .status-icon {
                    font-size: 0.65rem;
                }
                
                .feed-message {
                    font-size: 0.8rem;
                    color: var(--text-light);
                    font-weight: 500;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    max-width: 200px;
                }
                
                /* Meta (time + revenue) */
                .feed-meta {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 6px;
                    flex-shrink: 0;
                }
                
                .feed-time-modern {
                    font-size: 0.72rem;
                    color: var(--text-muted);
                    font-weight: 600;
                }
                
                .revenue-badge {
                    font-size: 0.75rem;
                    font-weight: 900;
                    padding: 4px 10px;
                    border-radius: 8px;
                    letter-spacing: -0.01em;
                }
                
                .revenue-badge.success {
                    background: rgba(16,185,129,0.15);
                    color: #059669;
                    box-shadow: 0 0 12px rgba(16,185,129,0.2);
                }
                
                .revenue-badge.pending {
                    background: rgba(99,102,241,0.15);
                    color: var(--primary);
                    box-shadow: 0 0 12px rgba(99,102,241,0.2);
                }
                
                .retry-btn-modern {
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    border: none;
                    background: rgba(239,68,68,0.12);
                    color: #dc2626;
                    font-size: 0.8rem;
                    font-weight: 800;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                
                .retry-btn-modern:hover {
                    background: rgba(239,68,68,0.2);
                    transform: scale(1.05);
                }
                
                .retry-btn-modern.sent {
                    background: rgba(16,185,129,0.15);
                    color: #059669;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .spinning {
                    animation: spin 1s linear infinite;
                }
                
                /* Empty state */
                .feed-empty { 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    padding: 2rem 1rem; 
                    text-align: center; 
                    gap: 0.75rem; 
                    border-radius: 12px; 
                    background: var(--glass-surface); 
                    border: 1.5px solid var(--border-glass); 
                }
                .empty-icon { 
                    width: 48px; 
                    height: 48px; 
                    border-radius: 12px; 
                    background: var(--primary-light); 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                }
                .empty-icon svg { color: var(--primary); }
                .empty-title { font-size: 0.9rem; font-weight: 800; color: var(--text); margin: 0; }
                .empty-status { 
                    display: flex; 
                    align-items: center; 
                    gap: 6px; 
                    padding: 6px 12px; 
                    border-radius: 10px; 
                    background: var(--primary-light); 
                }
                .empty-status .status-dot { 
                    width: 6px; 
                    height: 6px; 
                    border-radius: 50%; 
                    background: var(--primary); 
                }
                .empty-status span { 
                    font-size: 0.75rem; 
                    font-weight: 700; 
                    color: var(--primary); 
                }
                
                /* Scrollbar */
                .feed-list::-webkit-scrollbar { width: 4px; }
                .feed-list::-webkit-scrollbar-track { background: transparent; }
                .feed-list::-webkit-scrollbar-thumb { 
                    background: var(--border); 
                    border-radius: 4px; 
                }
                .feed-list::-webkit-scrollbar-thumb:hover { 
                    background: var(--primary); 
                }
            `}</style>
        </div>
    );
};

export default RecoveryFeed;