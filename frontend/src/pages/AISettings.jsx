import React, { useState } from 'react';
import api from '../lib/api';
import { Brain, Save, Check } from 'lucide-react';

const inputStyle = {
    width: '100%',
    padding: '0.7rem 1rem',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    background: 'var(--bg-subtle)',
    color: 'var(--text)'
};

const AISettings = ({ clinic, onUpdate }) => {
    const isOwner = ['OWNER', 'ADMIN'].includes(clinic?.role);
    const [aiConfig, setAiConfig] = useState(
        typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig || '{}') : (clinic.aiConfig || {})
    );
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
    };

    const handleSaveAiConfig = async () => {
        setSaving(true);
        try {
            await api.put('/clinic/ai-config', aiConfig);
            showToast('Οι ρυθμίσεις AI ενημερώθηκαν.');
            if (onUpdate) onUpdate({ aiConfig: JSON.stringify(aiConfig) });
        } catch (err) {
            showToast(err.response?.data?.error || 'Αποτυχία αποθήκευσης.', 'error');
        } finally { setSaving(false); }
    };

    return (
        <div className="animate-fade" style={{ maxWidth: '860px', paddingBottom: '3rem' }}>
            <header style={{
                marginBottom: '1.75rem', padding: '1.75rem 2rem',
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #1e1b4b 100%)',
                borderRadius: '24px', color: 'white',
                boxShadow: '0 16px 40px -12px rgba(99,102,241,0.4)'
            }}>
                <h1 style={{ fontSize: '1.9rem', fontWeight: '900', letterSpacing: '-1px', marginBottom: '4px', color: 'white' }}>
                    Ρυθμίσεις AI
                </h1>
                <p style={{ fontSize: '0.95rem', opacity: 0.65, margin: 0 }}>
                    Η πλατφόρμα διαχειρίζεται αυτόματα τις AI συνδέσεις. Εσείς ορίζετε μόνο τη συμπεριφορά του βοηθού.
                </p>
            </header>

            {/* Reassurance banner */}
            {!isOwner && (
                <div style={{
                    marginBottom: '1.25rem',
                    padding: '0.85rem 1.25rem',
                    borderRadius: '14px',
                    background: 'rgba(245,158,11,0.07)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    color: '#92400e',
                }}>
                    <span style={{ fontSize: '1rem' }}>🔒</span>
                    Μόνο ανάγνωση — μόνο ο ιδιοκτήτης μπορεί να αλλάξει ρυθμίσεις AI.
                </div>
            )}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                <strong style={{ color: 'var(--secondary)' }}>Managed SaaS ενεργό</strong>
                <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-light)' }}>
                    Δεν απαιτούνται API keys, webhooks ή εξωτερικές συνδέσεις από το ιατρείο.
                </p>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Brain size={16} /> Ρυθμίσεις Γνώσης AI
                </h2>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.82rem' }}>Υπηρεσίες Ιατρείου</label>
                    <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                        value={aiConfig?.services || ''}
                        placeholder="Λίστα υπηρεσιών (μία ανά γραμμή)..."
                        onChange={e => setAiConfig({ ...aiConfig, services: e.target.value })} />
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text)' }}>ΩΡΑΡΙΟ ΛΕΙΤΟΥΡΓΙΑΣ</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                        {['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'].map(day => (
                            <div key={day}>
                                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', marginBottom: '4px' }}>{day.toUpperCase()}</div>
                                <input style={{ ...inputStyle, padding: '0.5rem' }} placeholder="09:00-17:00"
                                    value={aiConfig?.workingHours?.[day] || ''}
                                    onChange={e => setAiConfig({ ...aiConfig, workingHours: { ...aiConfig?.workingHours, [day]: e.target.value } })} />
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 220px' }}>
                        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.82rem' }}>Μέση Αξία Ραντεβού (€)</label>
                        <input style={inputStyle} type="number" value={aiConfig?.avgAppointmentValue || ''}
                            onChange={e => setAiConfig({ ...aiConfig, avgAppointmentValue: parseFloat(e.target.value) })} />
                    </div>
                    <div style={{ flex: '1 1 220px' }}>
                        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.82rem' }}>Ύφος AI</label>
                        <select style={inputStyle} value={aiConfig?.tone || 'Professional'}
                            onChange={e => setAiConfig({ ...aiConfig, tone: e.target.value })}>
                            <option value="Professional">Επαγγελματικό</option>
                            <option value="Friendly">Φιλικό</option>
                            <option value="Sales">Πωλήσεις</option>
                            <option value="Formal">Τυπικό</option>
                        </select>
                    </div>
                </div>
                <label style={{ display: 'block', marginBottom: 6, marginTop: 12, fontWeight: 600, fontSize: '0.82rem' }}>Ειδικές Πολιτικές</label>
                    <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                        value={aiConfig?.policies || ''}
                        placeholder="π.χ. Απαιτείται ακύρωση 24 ώρες πριν..."
                        onChange={e => setAiConfig({ ...aiConfig, policies: e.target.value })} />
                <label style={{ display: 'block', marginBottom: 6, marginTop: 12, fontWeight: 600, fontSize: '0.82rem' }}>Γλώσσες</label>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                        {['Ελληνικά','Αγγλικά'].map(lang => (
                            <label key={lang} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input type="checkbox" checked={aiConfig?.languages?.includes(lang)}
                                    onChange={e => {
                                        const cur = aiConfig?.languages || [];
                                        const upd = e.target.checked ? [...cur, lang] : cur.filter(l => l !== lang);
                                        setAiConfig({ ...aiConfig, languages: upd });
                                    }} /> {lang}
                            </label>
                        ))}
                    </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="button" className="btn btn-primary" onClick={handleSaveAiConfig} disabled={saving || !isOwner}>
                        {saving ? 'Αποθήκευση...' : 'Αποθήκευση Ρυθμίσεων AI'}
                    </button>
                </div>
            </div>

            <style>{`.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: 8px; }`}</style>

            {toast.show && (
                <div style={{
                    position: 'fixed', bottom: '2.5rem', right: '2.5rem',
                    padding: '1.25rem 2.5rem', borderRadius: '14px',
                    backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
                    color: 'white', fontWeight: '700', fontSize: '0.95rem',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <Check size={18} />
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default AISettings;
