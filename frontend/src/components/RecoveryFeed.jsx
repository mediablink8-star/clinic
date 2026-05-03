import React from 'react';
import toast from 'react-hot-toast';
import { PhoneMissed, RefreshCw, ChevronRight } from 'lucide-react';
import ActionPanel from './ActionPanel';
import { getEvent, getPatientLabel, formatTime, getReplyPreview, getRevenue, getInitials } from '../lib/recoveryUtils';

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
        ? [...logs].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 20)
        : [];
    const sorted = allSorted.filter(l => !dismissed.has(l.id));

    if (allSorted.length === 0) {
        return (
            <div className="feed-empty">
                <div className="empty-icon">
                    <PhoneMissed size={16} />
                </div>
                <p className="empty-title">Σύστημα έτοιμο</p>
                <div className="empty-status">
                    <span className="status-dot" />
                    <span>Παρακολούθηση ενεργή</span>
                </div>
            </div>
        );
    }

    return (
        <div className="feed-container">
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

                    return (
                        <div
                            key={log.id}
                            className="feed-item"
                            style={{ background: event.bg, borderColor: event.border }}
                            onClick={() => setSelected(log)}
                        >
                            <div className="feed-avatar" style={{ background: event.dot + '22', borderColor: event.dot + '44', color: event.dot }}>
                                {getInitials(log)}
                            </div>
                            <div className="feed-content">
                                <div className="feed-title-row">
                                    <span className="feed-name">{name}</span>
                                    <span className="feed-event" style={{ color: event.dot }}>{event.label}</span>
                                </div>
                                {replyPreview ? (
                                    <div className="feed-preview">"{replyPreview}"</div>
                                ) : (
                                    <div className="feed-phone">{log.fromNumber || '—'}</div>
                                )}
                            </div>
                            <div className="feed-right">
                                <span className="feed-time">{formatTime(log.updatedAt || log.createdAt)}</span>
                                {revenue && log.status === 'RECOVERED' ? (
                                    <span className="feed-revenue recovered">+€{revenue}</span>
                                ) : revenue && log.status === 'RECOVERING' ? (
                                    <span className="feed-revenue pending">~€{revenue}</span>
                                ) : revenue ? (
                                    <span className="feed-revenue potential">~€{revenue}</span>
                                ) : isFailed ? (
                                    <button
                                        className={`retry-btn ${retrying[log.id]}`}
                                        onClick={(e) => handleRetry(log.id, e)}
                                        disabled={!!retrying[log.id]}
                                    >
                                        <RefreshCw size={8} />
                                        {retrying[log.id] === 'retrying' ? '...' : retrying[log.id] === 'sent' ? '✓' : 'Retry'}
                                    </button>
                                ) : (
                                    <ChevronRight size={13} />
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
                .feed-header { display: flex; justify-content: flex-end; margin-bottom: 4px; flex-shrink: 0; }
                .clear-btn { background: none; border: none; cursor: pointer; color: var(--text-light); font-size: 0.72rem; font-weight: 700; padding: 2px 6px; }
                .feed-list { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
                .feed-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; text-align: center; gap: 0.5rem; border-radius: 14px; background: var(--bg-subtle); border: 1px dashed var(--border); }
                .empty-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(16,185,129,0.1); display: flex; align-items: center; justify-content: center; }
                .empty-icon svg { color: #10b981; }
                .empty-title { font-size: 0.78rem; font-weight: 700; color: var(--text-light); margin: 0; }
                .empty-status { display: flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 8px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.15); }
                .status-dot { width: 5px; height: 5px; border-radius: 50%; background: #10b981; box-shadow: 0 0 4px rgba(16,185,129,0.5); }
                .empty-status span { font-size: 0.62rem; font-weight: 700; color: #059669; }
                
                .feed-item { display: flex; align-items: center; gap: 10px; padding: 0.7rem 0.85rem; border-radius: 12px; border: 1px solid; cursor: pointer; transition: opacity 0.15s; }
                .feed-item:hover { opacity: 0.75; }
                .feed-avatar { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 800; border: 1px solid; }
                .feed-content { flex: 1; min-width: 0; }
                .feed-title-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
                .feed-name { font-size: 0.85rem; font-weight: 800; color: var(--secondary); white-space: nowrap; }
                .feed-event { font-size: 0.75rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .feed-preview { font-size: 0.72rem; color: #3b82f6; font-weight: 600; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .feed-phone { font-size: 0.72rem; color: var(--text-light); font-weight: 500; }
                .feed-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
                .feed-time { font-size: 0.68rem; color: #b0bec5; font-weight: 500; }
                .feed-revenue { font-size: 0.7rem; font-weight: 800; padding: 2px 7px; border-radius: 6px; }
                .feed-revenue.recovered { color: #10b981; background: rgba(16,185,129,0.1); }
                .feed-revenue.pending { color: #3b82f6; background: rgba(59,130,246,0.1); font-weight: 700; }
                .feed-revenue.potential { color: #94a3b8; background: var(--bg-subtle); border: 1px solid var(--border); font-weight: 600; }
                .retry-btn { display: flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 5px; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); color: #dc2626; font-size: 0.62rem; font-weight: 800; cursor: pointer; }
                .retry-btn.sent { background: rgba(16,185,129,0.1); color: #059669; border-color: rgba(16,185,129,0.3); }
                .retry-btn:disabled { cursor: not-allowed; }

                .feed-list::-webkit-scrollbar { width: 6px; }
                .feed-list::-webkit-scrollbar-track { background: transparent; }
                .feed-list::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 3px; }
                .feed-list::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.5); }
            `}</style>
        </div>
    );
};

export default RecoveryFeed;