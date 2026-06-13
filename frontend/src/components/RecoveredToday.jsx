import React from 'react';
import { UserCheck, Phone, Euro, Sparkles } from 'lucide-react';

const RecoveredToday = ({ logs = [] }) => {
    const today = new Date();
    const recoveredToday = (Array.isArray(logs) ? logs : [])
        .filter(l => {
            if (!l || l.status !== 'RECOVERED' || !l.recoveredAt) return false;
            const d = new Date(l.recoveredAt);
            return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        })
        .sort((a, b) => new Date(b.recoveredAt) - new Date(a.recoveredAt))
        .slice(0, 6);

    // Mask phone for display: +306912345678 → 691***5678
    const maskPhone = (num) => {
        if (!num) return 'Ασθενής';
        const clean = num.replace(/\D/g, '');
        if (clean.length < 6) return num;
        const last4 = clean.slice(-4);
        const prefix = clean.startsWith('30') ? clean.slice(2, 5) : clean.slice(0, 3);
        return `${prefix}***${last4}`;
    };

    const formatTime = (dateStr) => {
        try {
            return new Date(dateStr).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    };

    return (
        <div className="card-glass" style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '24px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserCheck size={18} color="#10b981" />
                    Ανακτήθηκαν Σήμερα
                </h2>
                {recoveredToday.length > 0 && (
                    <span style={{
                        background: '#f0fdf4',
                        color: '#15803d',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        padding: '3px 10px',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0'
                    }}>
                        {recoveredToday.length} {recoveredToday.length === 1 ? 'ασθενής' : 'ασθενείς'}
                    </span>
                )}
            </div>

            {recoveredToday.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '2rem 1rem',
                    borderRadius: '16px',
                    background: 'linear-gradient(180deg, #f8fafc, #f1f5f9)',
                    border: '1px dashed #e2e8f0'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎯</div>
                    <p style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        Δεν υπάρχουν ανακτήσεις ακόμα σήμερα
                    </p>
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '500' }}>
                        Το AI εργάζεται για να φέρει πίσω ασθενείς.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {recoveredToday.map((log, idx) => (
                        <div key={log.id || idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            borderRadius: '14px',
                            background: '#fafbfc',
                            border: '1px solid var(--border)',
                            transition: 'all 0.2s ease'
                        }}>
                            {/* Avatar */}
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <UserCheck size={16} color="#15803d" />
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <Phone size={11} color="#94a3b8" />
                                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)' }}>
                                        {maskPhone(log.fromNumber)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Sparkles size={10} color="#10b981" />
                                    <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#64748b' }}>
                                        Κράτησε ραντεβού • {formatTime(log.recoveredAt)}
                                    </span>
                                </div>
                            </div>

                            {/* Revenue */}
                            {log.estimatedRevenue > 0 && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: '800',
                                    flexShrink: 0
                                }}>
                                    <Euro size={12} />
                                    {log.estimatedRevenue}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RecoveredToday;
