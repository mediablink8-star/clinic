import React from 'react';
import { Sparkles, MessageSquare, PhoneMissed, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

const RecoveryFeed = ({ logs = [], muted = false }) => {
    const getStatusInfo = (status) => {
        switch (status) {
            case 'RECOVERED':
                return { icon: CheckCircle2, color: '#10b981', bg: '#f0fdf4', label: 'Recovered' };
            case 'RECOVERING':
                return { icon: MessageSquare, color: '#f59e0b', bg: '#fffbeb', label: 'In progress' };
            case 'LOST':
                return { icon: AlertCircle, color: '#ef4444', bg: '#fef2f2', label: 'Lost' };
            case 'DETECTED':
                return { icon: PhoneMissed, color: 'var(--primary)', bg: 'var(--primary-light)', label: 'Detected' };
            default:
                return { icon: Clock, color: '#64748b', bg: '#f1f5f9', label: status };
        }
    };

    const sortedLogs = Array.isArray(logs)
        ? [...logs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20)
        : [];

    return (
        <div className="card-glass" style={{
            background: muted ? 'rgba(248,250,252,0.65)' : 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.5)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.07)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={15} className="text-primary" />
                    Ζωντανή Ροή Ανάκτησης
                </h2>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>Ζωντανά</span>
            </div>

            <div style={{
                padding: '0.5rem',
                overflowY: 'auto',
                flex: 1
            }}>
                {sortedLogs.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem 2rem',
                        borderRadius: '16px',
                        background: 'linear-gradient(180deg, #f8fafc, #f1f5f9)',
                        border: '1px dashed #e2e8f0'
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📞</div>
                        <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                            Δεν καταγράφηκαν αναπάντητες κλήσεις σήμερα
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500', lineHeight: '1.5' }}>
                            Το AI σας παρακολουθεί κλήσεις.<br />
                            Όλα λειτουργούν κανονικά.
                        </p>
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
                                    border: '1px solid rgba(226,232,240,0.25)',
                                    background: 'rgba(255,255,255,0.4)',
                                    gap: '8px'
                                }}>
                                    {/* phone number */}
                                    <span style={{ fontWeight: '600', fontSize: '0.75rem', color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                        {log.fromNumber}
                                    </span>
                                    {/* dot + label */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                                        <span style={{ fontSize: '0.62rem', fontWeight: '500', color: '#64748b' }}>{label}</span>
                                    </div>
                                    {/* time */}
                                    <span style={{ fontSize: '0.58rem', color: '#b0bec5', fontWeight: '400', flexShrink: 0 }}>{time}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecoveryFeed;
