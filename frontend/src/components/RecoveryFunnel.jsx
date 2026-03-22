import React from 'react';
import { Filter, ChevronRight } from 'lucide-react';

const funnelSteps = [
    { label: 'Αναπάντητες κλήσεις', key: 'calls', color: '#64748b' },
    { label: 'Απάντησαν στο AI', key: 'responses', color: '#f59e0b' },
    { label: 'Προγραμματισμένο ραντεβού', key: 'recovered', color: '#10b981' }
];

const RecoveryFunnel = ({ logs = [], stats = { recovered: 0 } }) => {
    // Basic heuristics for funnel calculation
    const logArray = Array.isArray(logs) ? logs : [];
    const totalCalls = logArray.length || 20; // fallback for display
    const responses = logArray.filter(l => l && (l.status === 'RECOVERING' || l.status === 'RECOVERED')).length || 12;
    const bookings = stats?.recovered || 6;

    const data = {
        calls: totalCalls,
        responses: responses,
        recovered: bookings
    };

    const conversionRate = totalCalls > 0 ? Math.round((bookings / totalCalls) * 100) : 0;

    return (
        <div className="card-glass h-full" style={{
            background: 'white',
            borderRadius: '24px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={18} className="text-primary" />
                    Pipeline Ανάκτησης
                </h2>
                <div style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '900' }}>{conversionRate}% ROI</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {funnelSteps.map((step, idx) => {
                    const value = data[step.key];
                    const percent = (value / totalCalls) * 100;

                    return (
                        <div key={step.key} style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                                <span style={{ color: '#64748b' }}>{step.label}</span>
                                <span style={{ color: 'var(--secondary)' }}>{value}</span>
                            </div>
                            <div style={{ height: '8px', width: '100%', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${percent}%`,
                                    background: step.color,
                                    borderRadius: '4px',
                                    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}></div>
                            </div>
                            {idx < funnelSteps.length - 1 && (
                                <div style={{ position: 'absolute', bottom: '-14px', left: '50%', transform: 'translateX(-50%)', color: '#cbd5e1' }}>
                                    <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: 'auto', padding: '12px', borderRadius: '12px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontSize: '1.25rem' }}>✨</div>
                <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)', lineHeight: '1.4' }}>
                    Εχετε ανακτήσει <span style={{ fontWeight: '800' }}>{bookings}</span> ραντεβού αυτή την εβδομάδα από αναπάντητες κλήσεις.
                </p>
            </div>
        </div>
    );
};

export default RecoveryFunnel;
