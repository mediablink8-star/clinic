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
            const saved = localStorage.getItem('feed_dismissed:v1');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch { return new Set(); }
    });

    const dismissAll = (ids) => {
        const next = new Set(ids);
        setDismissed(next);
        try { localStorage.setItem('feed_dismissed:v1', JSON.stringify([...next])); } catch {}
    };

    const handleRetry = async (logId, e) => {
        e.stopPropagation();
        if (retrying[logId]) return;
        setRetrying(r => ({ ...r, [logId]: 'retrying' }));
        if (!token) { toast.error('Η σύνδεση έληξε. Παρακαλώ συνδεθείτε ξανά.'); return; }
        try {
            const res = await fetch(`${API_BASE}/recovery/${logId}/retry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
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
                            return 'rgba(147,51,234,0.09)'; // Purple
                        }
                        // Red for missed calls / detected
                        if (log.status === 'DETECTED' || log.status === 'LOST') {
                            return 'var(--error-light)'; // Red
                        }
                        // Yellow for SMS sent
                        if (log.smsStatus === 'sent' || log.smsStatus === 'simulated') {
                            return 'var(--warning-light)'; // Yellow
                        }
                        // Red for failed SMS
                        if (log.smsStatus === 'failed') {
                            return 'var(--error-light)'; // Red
                        }
                        // Green for recovering/active conversations
                        if (log.status === 'RECOVERING') {
                            return 'var(--success-light)'; // Green
                        }
                        return sorted.indexOf(log) % 2 === 0 ? 'var(--glass-surface)' : 'transparent';
                    };

                    // Outcome badges
                    const getOutcomeBadge = () => {
                        if (log.status === 'RECOVERED') {
                            return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'var(--success-light)', color: 'var(--accent)', border: '1px solid rgba(16,185,129,0.25)' }}>🟢 Κλείστηκε</span>;
                        }
                        if (log.status === 'RECOVERING') {
                            return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid rgba(99,91,255,0.2)' }}>🟡 Ενεργό</span>;
                        }
                        if (log.status === 'LOST') {
                            return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'var(--error-light)', color: 'var(--urgent)', border: '1px solid rgba(239,68,68,0.2)' }}>🔴 Χάθηκε</span>;
                        }
                        if (log.smsStatus === 'failed') {
                            return <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '6px', background: 'var(--error-light)', color: 'var(--urgent)', border: '1px solid rgba(239,68,68,0.2)' }}>❌ Απέτυχε</span>;
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
                .feed-stats { 
                    display: flex; 
                    align-items: center; 
                    justify-content: space-around; 
                    padding: 10px 12px; 
                    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%);
                    backdrop-filter: blur(12px) saturate(180%); 
                    border: 1px solid rgba(255,255,255,0.14); 
                    border-radius: 12px; 
                    margin-bottom: 8px; 
                    flex-shrink: 0;
                    box-shadow: 0 3px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.15);
                }
                .stat-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
                .stat-value { font-size: 1.3rem; font-weight: 950; color: var(--secondary); letter-spacing: -0.03em; line-height: 1; }
                .stat-label { font-size: 0.58rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.8; }
                .stat-item.success .stat-value { 
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .stat-item.warning .stat-value { 
                    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .stat-divider { width: 1px; height: 28px; background: linear-gradient(180deg, transparent 0%, var(--border) 50%, transparent 100%); opacity: 0.5; }
                
                .feed-header { display: flex; justify-content: flex-end; margin-bottom: 6px; }
                .clear-btn { 
                    background: rgba(255,255,255,0.06); 
                    border: 1px solid rgba(255,255,255,0.1); 
                    cursor: pointer; 
                    color: var(--text-light); 
                    font-size: 0.65rem; 
                    font-weight: 700; 
                    padding: 4px 10px; 
                    border-radius: 8px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .clear-btn:hover { 
                    background: var(--primary-light); 
                    color: var(--primary); 
                    border-color: var(--primary);
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(99,91,255,0.15);
                }
                
                .feed-list { display: flex; flex-direction: column; gap: 5px; flex: 1; min-height: 0; overflow-y: auto; padding-right: 2px; }
                
                .feed-empty { 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    padding: 2rem 1rem; 
                    text-align: center; 
                    gap: 0.75rem; 
                    border-radius: 12px; 
                    background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
                    border: 1px solid rgba(255,255,255,0.1);
                    backdrop-filter: blur(12px);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
                }
                .empty-icon { 
                    width: 40px; 
                    height: 40px; 
                    border-radius: 50%; 
                    background: linear-gradient(135deg, var(--primary-light) 0%, rgba(99,91,255,0.1) 100%);
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    box-shadow: 0 4px 14px rgba(99,91,255,0.18), inset 0 1px 0 rgba(255,255,255,0.2);
                }
                .empty-icon svg { color: var(--primary); }
                .empty-title { font-size: 0.8rem; font-weight: 700; color: var(--text); margin: 0; }
                .empty-status { 
                    display: flex; 
                    align-items: center; 
                    gap: 6px; 
                    padding: 5px 12px; 
                    border-radius: 10px; 
                    background: linear-gradient(135deg, var(--primary-light) 0%, rgba(99,91,255,0.1) 100%);
                    border: 1px solid rgba(99,91,255,0.18);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
                }
                .empty-status .status-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--primary); animation: pulse 2s infinite; }
                .empty-status span { font-size: 0.6rem; font-weight: 700; color: var(--primary); }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(0.9); }
                }
                
                .feed-item { 
                    display: flex; 
                    align-items: center; 
                    gap: 12px; 
                    padding: 12px 14px; 
                    border-radius: 12px; 
                    border: 1px solid rgba(255,255,255,0.1); 
                    border-left: 3px solid; 
                    cursor: pointer; 
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
                    position: relative;
                    backdrop-filter: blur(12px);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
                }
                .feed-item:hover { 
                    transform: translateX(4px) translateY(-2px); 
                    box-shadow: 0 10px 28px rgba(0,0,0,0.09), 0 0 0 1px rgba(255,255,255,0.14) inset;
                    background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.07) 100%) !important;
                    border-color: rgba(255,255,255,0.18);
                }
                
                .feed-icon { 
                    width: 36px; 
                    height: 36px; 
                    border-radius: 10px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    flex-shrink: 0; 
                    border: 1px solid;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.15);
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .feed-item:hover .feed-icon {
                    transform: scale(1.05);
                    box-shadow: 0 5px 14px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2);
                }
                .feed-content { flex: 1; min-width: 0; }
                .feed-name { font-size: 0.88rem; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
                .feed-sub { font-size: 0.76rem; color: var(--text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; margin-top: 2px; }
                
                .feed-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
                .feed-time { font-size: 0.7rem; color: var(--text-light); font-weight: 600; opacity: 0.7; }
                .badge-success { 
                    font-size: 0.7rem; 
                    font-weight: 900; 
                    padding: 4px 9px; 
                    border-radius: 10px; 
                    background: linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.1) 100%);
                    color: #059669;
                    border: 1px solid rgba(16,185,129,0.22);
                    box-shadow: 0 2px 8px rgba(16,185,129,0.12), inset 0 1px 0 rgba(255,255,255,0.15);
                }
                .badge-primary { 
                    font-size: 0.7rem; 
                    font-weight: 800; 
                    padding: 4px 9px; 
                    border-radius: 10px; 
                    background: linear-gradient(135deg, rgba(99,91,255,0.18) 0%, rgba(99,91,255,0.1) 100%);
                    color: var(--primary);
                    border: 1px solid rgba(99,91,255,0.22);
                    box-shadow: 0 2px 8px rgba(99,91,255,0.12), inset 0 1px 0 rgba(255,255,255,0.15);
                }
                .btn-retry { 
                    width: 26px; 
                    height: 26px; 
                    border-radius: 8px; 
                    border: 1px solid rgba(239,68,68,0.22); 
                    background: linear-gradient(135deg, rgba(239,68,68,0.14) 0%, rgba(239,68,68,0.07) 100%);
                    color: #dc2626; 
                    font-size: 0.75rem; 
                    font-weight: 700;
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 1px 4px rgba(239,68,68,0.1);
                }
                .btn-retry:hover {
                    transform: scale(1.1);
                    box-shadow: 0 5px 14px rgba(239,68,68,0.22);
                    border-color: rgba(239,68,68,0.3);
                }
                .btn-retry.sent { 
                    background: linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.1) 100%);
                    color: #059669;
                    border-color: rgba(16,185,129,0.22);
                    box-shadow: 0 1px 4px rgba(16,185,129,0.12);
                }
                .status-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
                
                .feed-list::-webkit-scrollbar { width: 4px; }
                .feed-list::-webkit-scrollbar-track { background: transparent; }
                .feed-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
                .feed-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
            `}</style>
        </div>
    );
};

export default RecoveryFeed;