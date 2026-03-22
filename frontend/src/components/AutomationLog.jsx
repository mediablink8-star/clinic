import React from 'react';
import { MessageSquare, PhoneMissed, CheckCircle2, Send, Reply, Zap } from 'lucide-react';

const EVENT_META = {
    SMS_SENT:            { icon: Send,         color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  label: 'SMS εστάλη' },
    MISSED_CALL:         { icon: PhoneMissed,  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Αναπάντητη κλήση' },
    RECOVERY_SENT:       { icon: MessageSquare,color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Μήνυμα ανάκτησης' },
    APPOINTMENT_CONFIRMED:{ icon: CheckCircle2,color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Ραντεβού επιβεβαιώθηκε' },
    PATIENT_REPLIED:     { icon: Reply,        color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Ασθενής απάντησε' },
    RECOVERING:          { icon: Zap,          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Σε ανάκτηση' },
};

const fmtTime = (dateStr) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return '--';
        const diff = Math.floor((Date.now() - d) / 1000);
        if (diff < 60) return `${diff}δ`;
        if (diff < 3600) return `${Math.floor(diff / 60)}λ`;
        return d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    } catch { return '--'; }
};

const maskPhone = (phone) => {
    if (!phone) return '—';
    const s = phone.replace(/\s/g, '');
    if (s.length < 6) return s;
    return s.slice(0, 4) + 'XXXX' + s.slice(-2);
};

// Build entries from real recovery log only — no fake demo data
const buildEntries = (logs) => {
    if (!Array.isArray(logs) || logs.length === 0) return [];
    return logs.slice(0, 6).flatMap((l) => {
        const entries = [];
        if (l.status === 'RECOVERING' || l.status === 'RECOVERED') {
            entries.push({ id: `${l.id}-miss`, type: 'MISSED_CALL', phone: l.fromNumber, time: l.createdAt });
            entries.push({ id: `${l.id}-sms`, type: 'RECOVERY_SENT', phone: l.fromNumber, time: l.updatedAt || l.createdAt });
        }
        if (l.status === 'RECOVERED') {
            entries.push({ id: `${l.id}-conf`, type: 'APPOINTMENT_CONFIRMED', phone: l.fromNumber, time: l.updatedAt || l.createdAt });
        }
        if (l.status === 'DETECTED') {
            entries.push({ id: `${l.id}-miss`, type: 'MISSED_CALL', phone: l.fromNumber, time: l.createdAt });
        }
        return entries;
    }).slice(0, 7);
};


const AutomationLog = ({ logs = [] }) => {
    const entries = buildEntries(logs);

    return (
        <div className="grid-cell-glass" style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.5)',
            padding: '1.1rem 1.25rem',
            boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Automation Activity
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                    LIVE
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, overflowY: 'auto' }}>
                {entries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.78rem', fontWeight: '600' }}>
                        Δεν υπάρχει δραστηριότητα ακόμα.
                    </div>
                ) : entries.map((entry) => {
                    const meta = EVENT_META[entry.type] || EVENT_META['SMS_SENT'];
                    const Icon = meta.icon;
                    return (
                        <div key={entry.id} className="animate-fade" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '7px 10px',
                            borderRadius: '10px',
                            background: meta.bg,
                            border: `1px solid ${meta.bg.replace('0.1', '0.2')}`,
                        }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                                <Icon size={12} color={meta.color} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {meta.label}
                                </p>
                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0, fontWeight: '600' }}>
                                    {maskPhone(entry.phone)}
                                </p>
                            </div>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '700', flexShrink: 0 }}>
                                {fmtTime(entry.time)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AutomationLog;
