import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Brain, Key, Activity, Save, Check } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const SectionCard = ({ id, number, icon, iconBg, title, subtitle, children }) => (
    <div id={id} style={{
        background: 'var(--card-bg)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '1.5rem',
        overflow: 'hidden',
    }}>
        <div style={{
            padding: '1.1rem 1.75rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'var(--bg-subtle)'
        }}>
            <div style={{
                width: '26px', height: '26px', borderRadius: '8px',
                background: 'var(--primary)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, color: 'white',
                fontSize: '0.72rem', fontWeight: '900'
            }}>{number}</div>
            <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                background: iconBg || 'var(--primary-light)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>{icon}</div>
            <div>
                <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text)', margin: 0 }}>{title}</h2>
                {subtitle && <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', margin: '2px 0 0' }}>{subtitle}</p>}
            </div>
        </div>
        <div style={{ padding: '1.75rem 2rem' }}>{children}</div>
    </div>
);

const FormRow = ({ children }) => <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>{children}</div>;

const FormGroup = ({ label, flex, children }) => (
    <div style={{ marginBottom: '1.25rem', flex: flex || '1 1 200px' }}>
        <label style={{
            display: 'block', marginBottom: '0.45rem', fontWeight: '600',
            fontSize: '0.82rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.03em'
        }}>{label}</label>
        {children}
    </div>
);

const inputStyle = {
    width: '100%', padding: '0.7rem 1rem', borderRadius: '12px',
    border: '1px solid var(--border)', fontSize: '0.9rem', outline: 'none',
    boxSizing: 'border-box', background: 'var(--bg-subtle)', color: 'var(--text)'
};

const StatusBadge = ({ status, latency }) => {
    let cfg = { bg: '#fefce8', color: '#854d0e', text: 'Δεν δοκιμάστηκε', dot: '#eab308' };
    if (status === 'connected') cfg = { bg: '#f0fdf4', color: '#166534', text: 'Συνδέθηκε', dot: '#22c55e' };
    if (status === 'failed')    cfg = { bg: '#fef2f2', color: '#991b1b', text: 'Απέτυχε',   dot: '#ef4444' };
    if (status === 'loading')   cfg = { bg: '#f8fafc', color: '#475569', text: 'Δοκιμή...', dot: '#94a3b8' };
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '4px 12px', borderRadius: '99px',
            background: cfg.bg, color: cfg.color, fontSize: '0.75rem', fontWeight: '700'
        }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.dot }} />
            {cfg.text}
            {latency && <span style={{ opacity: 0.6 }}>({latency}ms)</span>}
        </div>
    );
};

const AISettings = ({ clinic, token, onUpdate }) => {
    const isOwner = ['OWNER', 'ADMIN'].includes(clinic?.role);
    const [formData, setFormData] = useState({
        ...clinic,
        aiConfig: typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig || '{}') : (clinic.aiConfig || {})
    });
    const [aiTest, setAiTest]         = useState({ status: 'idle', latency: null });
    const [aiSaving, setAiSaving]     = useState(false);
    const [aiConfigSaving, setAiConfigSaving] = useState(false);
    const [systemStatus, setSystemStatus] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    useEffect(() => {
        axios.get(`${API_BASE}/system/status`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => setSystemStatus(r.data))
            .catch(() => {});
    }, []);

    const set    = (key, val) => setFormData(p => ({ ...p, [key]: val }));
    const setKey = (key, val) => setFormData(p => ({ ...p, apiKeys: { ...p.apiKeys, [key]: val } }));

    const handleTestAI = async () => {        setAiTest({ status: 'loading', latency: null });
        try {
            const res = await axios.post(`${API_BASE}/integrations/test-ai`,
                { provider: formData.aiProvider || 'gemini', key: formData.apiKeys?.gemini },
                { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) { setAiTest({ status: 'connected', latency: res.data.latency }); showToast('AI Provider connected!'); }
            else { setAiTest({ status: 'failed', error: res.data.error }); showToast(res.data.error || 'Connection failed.', 'error'); }
        } catch (e) { setAiTest({ status: 'failed', error: e.message }); showToast('Connection failed.', 'error'); }
    };

    const handleSaveAIKey = async () => {
        setAiSaving(true);
        try {
            await axios.post(`${API_BASE}/integrations/save-ai-key`,
                { provider: formData.aiProvider || 'gemini', key: formData.apiKeys?.gemini },
                { headers: { Authorization: `Bearer ${token}` } });
            showToast('AI Key saved!');
        } catch (err) {
            if (err.response?.status === 401) { window.location.reload(); }
            else showToast('Failed to save AI Key', 'error');
        } finally { setAiSaving(false); }
    };

    const handleSaveAiConfig = async () => {
        setAiConfigSaving(true);
        try {
            await axios.put(`${API_BASE}/clinic/ai-config`, formData.aiConfig,
                { headers: { Authorization: `Bearer ${token}` } });
            showToast('AI Configuration updated!');
            if (onUpdate) onUpdate({ aiConfig: JSON.stringify(formData.aiConfig) });
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save AI configuration', 'error');
        } finally { setAiConfigSaving(false); }
    };

    return (
        <div className="animate-fade" style={{ maxWidth: '860px', paddingBottom: '3rem' }}>
            <header style={{
                marginBottom: '1.75rem', padding: '1.75rem 2rem',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                borderRadius: '24px', color: 'white', boxShadow: 'var(--shadow-lg)'
            }}>
                <h1 style={{ fontSize: '1.9rem', fontWeight: '900', letterSpacing: '-1px', marginBottom: '4px', color: 'white' }}>
                    Ρυθμίσεις AI
                </h1>
                <p style={{ fontSize: '0.95rem', opacity: 0.65, margin: 0 }}>
                    Διαχειριστείτε τα κλειδιά API, τον πάροχο AI και τη γνώση του βοηθού σας.
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
                    Μόνο ανάγνωση — μόνο ο ιδιοκτήτης μπορεί να αλλάξει ρυθμίσεις AI και κλειδιά API.
                </div>
            )}
            <div style={{                marginBottom: '1.75rem',
                padding: '1rem 1.5rem',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(99,102,241,0.06) 100%)',
                border: '1px solid rgba(16,185,129,0.18)',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={16} color="#10b981" />
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#065f46' }}>Ρύθμιση μία φορά. Τρέχει αυτόματα.</span>
                </div>
                <div style={{ width: '1px', height: '28px', background: 'rgba(16,185,129,0.2)', flexShrink: 0 }} className="divider-hide" />
                {[
                    { icon: '🔑', text: 'Προσθέστε τα κλειδιά API σας' },
                    { icon: '⚡', text: 'Το σύστημα ανιχνεύει αναπάντητες κλήσεις αυτόματα' },
                    { icon: '📅', text: 'Ασθενείς κλείνουν ραντεβού χωρίς χειροκίνητη παρέμβαση' },
                ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.85rem' }}>{item.icon}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151' }}>{item.text}</span>
                    </div>
                ))}
            </div>
            <SectionCard id="ai-s1" number="1" icon={<Key size={15} color="#7c3aed" />} iconBg="#f3f0ff"
                title="Συνδέσεις API" subtitle="Προσθέστε τα κλειδιά σας μία φορά — δεν χρειάζεται ξανά ρύθμιση">
                {/* AI Provider */}
                <div style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', maxWidth: '480px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: '800', margin: 0 }}>Πάροχος AI</h3>
                        <StatusBadge status={aiTest.status} latency={aiTest.latency} />
                    </div>
                    {aiTest.status === 'failed' && aiTest.error && (
                        <div style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '0.78rem', color: '#991b1b' }}>
                            {aiTest.error}
                        </div>
                    )}
                    <FormGroup label="Πάροχος">
                        <select style={inputStyle} value={formData.aiProvider || 'gemini'} onChange={e => set('aiProvider', e.target.value)}>
                            <option value="gemini">Gemini (Google)</option>
                            <option value="openai" disabled>OpenAI (Μελλοντικά)</option>
                        </select>
                    </FormGroup>
                    <FormGroup label="Κλειδί API">
                        <input style={inputStyle} type="password" value={formData.apiKeys?.gemini || ''} onChange={e => setKey('gemini', e.target.value)} placeholder="AIza..." />
                        {formData.apiKeys?.gemini && /[^\x00-\x7F]/.test(formData.apiKeys.gemini) && (
                            <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '6px 10px' }}>
                                ⚠ Το κλειδί περιέχει μη έγκυρους χαρακτήρες. Πληκτρολογήστε το χειροκίνητα.
                            </div>
                        )}
                    </FormGroup>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={handleTestAI} disabled={aiTest.status === 'loading'} style={{ flex: 1 }}>
                            {aiTest.status === 'loading' ? 'Δοκιμή...' : 'Δοκιμή'}
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveAIKey} disabled={aiSaving || !isOwner} style={{ flex: 1 }}>
                            {aiSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                        </button>
                    </div>
                </div>
            </SectionCard>

            {/* Section 2 — AI Knowledge Config */}
            <SectionCard id="ai-s2" number="2" icon={<Brain size={15} color="#0891b2" />} iconBg="#ecfeff"
                title="Ρυθμίσεις Γνώσης AI" subtitle="Ορίστε τη λογική του βοηθού — μετά τρέχει μόνος του">
                <FormGroup label="Υπηρεσίες Ιατρείου">
                    <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                        value={formData.aiConfig?.services || ''}
                        placeholder="Λίστα υπηρεσιών (μία ανά γραμμή)..."
                        onChange={e => set('aiConfig', { ...formData.aiConfig, services: e.target.value })} />
                </FormGroup>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text)' }}>ΩΡΑΡΙΟ ΛΕΙΤΟΥΡΓΙΑΣ</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                        {['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'].map(day => (
                            <div key={day}>
                                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-light)', marginBottom: '4px' }}>{day.toUpperCase()}</div>
                                <input style={{ ...inputStyle, padding: '0.5rem' }} placeholder="09:00-17:00"
                                    value={formData.aiConfig?.workingHours?.[day] || ''}
                                    onChange={e => set('aiConfig', { ...formData.aiConfig, workingHours: { ...formData.aiConfig?.workingHours, [day]: e.target.value } })} />
                            </div>
                        ))}
                    </div>
                </div>
                <FormRow>
                    <FormGroup label="Μέση Αξία Ραντεβού (€)">
                        <input style={inputStyle} type="number" value={formData.aiConfig?.avgAppointmentValue || ''}
                            onChange={e => set('aiConfig', { ...formData.aiConfig, avgAppointmentValue: parseFloat(e.target.value) })} />
                    </FormGroup>
                    <FormGroup label="Ύφος AI">
                        <select style={inputStyle} value={formData.aiConfig?.tone || 'Professional'}
                            onChange={e => set('aiConfig', { ...formData.aiConfig, tone: e.target.value })}>
                            <option value="Professional">Επαγγελματικό</option>
                            <option value="Friendly">Φιλικό</option>
                            <option value="Sales">Πωλήσεις</option>
                            <option value="Formal">Τυπικό</option>
                        </select>
                    </FormGroup>
                </FormRow>
                <FormGroup label="Ειδικές Πολιτικές">
                    <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                        value={formData.aiConfig?.policies || ''}
                        placeholder="π.χ. Απαιτείται ακύρωση 24 ώρες πριν..."
                        onChange={e => set('aiConfig', { ...formData.aiConfig, policies: e.target.value })} />
                </FormGroup>
                <FormGroup label="Γλώσσες">
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                        {['Ελληνικά','Αγγλικά'].map(lang => (
                            <label key={lang} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input type="checkbox" checked={formData.aiConfig?.languages?.includes(lang)}
                                    onChange={e => {
                                        const cur = formData.aiConfig?.languages || [];
                                        const upd = e.target.checked ? [...cur, lang] : cur.filter(l => l !== lang);
                                        set('aiConfig', { ...formData.aiConfig, languages: upd });
                                    }} /> {lang}
                            </label>
                        ))}
                    </div>
                </FormGroup>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="button" className="btn btn-primary" onClick={handleSaveAiConfig} disabled={aiConfigSaving || !isOwner}>
                        {aiConfigSaving ? 'Αποθήκευση...' : 'Αποθήκευση Ρυθμίσεων AI'}
                    </button>
                </div>

                {/* How it works strip */}
                <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem 1.25rem',
                    borderRadius: '14px',
                    background: 'rgba(99,102,241,0.05)',
                    border: '1px solid rgba(99,102,241,0.12)',
                }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                        Πώς λειτουργεί αυτόματα
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap' }}>
                        {[
                            { step: 'Αναπάντητη κλήση', color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
                            { step: 'AI στέλνει SMS', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                            { step: 'Ασθενής απαντά', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
                            { step: 'Ραντεβού κλείνει', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                        ].map((item, i, arr) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{
                                    padding: '5px 12px', borderRadius: '99px',
                                    background: item.bg, border: `1px solid ${item.color}22`,
                                    fontSize: '0.72rem', fontWeight: '700', color: item.color,
                                    whiteSpace: 'nowrap',
                                }}>
                                    {item.step}
                                </div>
                                {i < arr.length - 1 && (
                                    <span style={{ fontSize: '0.7rem', color: '#cbd5e1', margin: '0 4px', fontWeight: '700' }}>→</span>
                                )}
                            </div>
                        ))}
                        <span style={{ marginLeft: '8px', fontSize: '0.72rem', fontWeight: '700', color: '#10b981' }}>
                            — χωρίς χειροκίνητη παρέμβαση
                        </span>
                    </div>
                </div>
            </SectionCard>

            {/* Section 3 — System Status */}
            <SectionCard id="ai-s3" number="3" icon={<Activity size={15} color="#10b981" />} iconBg="#ecfdf5"
                title="Κατάσταση Συστήματος" subtitle="Παρακολούθηση σύνδεσης σε πραγματικό χρόνο">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {[
                        { label: 'Πάροχος AI',   status: systemStatus?.aiConfigured },
                        { label: 'n8n Webhook',   status: systemStatus?.webhookConfigured, altLabel: 'Ρυθμίστηκε' },
                        { label: 'Worker Ουράς', status: systemStatus?.worker, customRunning: 'Σε λειτουργία', customOffline: 'Εκτός λειτουργίας' }
                    ].map((item, idx) => (
                        <div key={idx} style={{
                            padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc'
                        }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{item.label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.status ? '#10b981' : '#ef4444' }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: item.status ? '#059669' : '#dc2626', textTransform: 'uppercase' }}>
                                    {item.status ? (item.customRunning || item.altLabel || 'Συνδέθηκε') : (item.customOffline || 'Αποσυνδέθηκε')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

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
