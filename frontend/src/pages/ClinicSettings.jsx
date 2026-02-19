import React, { useState } from 'react';
import axios from 'axios';
import { Save, Link, Globe, MessageSquare } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const ClinicSettings = ({ clinic, token, onUpdate }) => {
    const [formData, setFormData] = useState({ ...clinic });
    const [saving, setSaving] = useState(false);

    // Parse JSON fields safely if they are strings
    const safeJsonParse = (str) => {
        try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return []; }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        console.log('[Frontend] Saving Clinic:', clinic.id, formData);
        setSaving(true);
        try {
            await axios.post(`${API_BASE}/clinic`, formData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            alert('Οι αλλάγες αποθηκεύτηκαν!');
            if (onUpdate) onUpdate(formData);
        } catch (err) {
            console.error(err);
            alert('Σφάλμα αποθήκευσης.');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async (type) => {
        const endpoint = type === 'vapi' ? '/test/simulate-vapi' : '/test/ping-make';
        try {
            const res = await axios.post(`${API_BASE}${endpoint}`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            alert(`✅ Επιτυχία! \n${res.data.message}`);
        } catch (err) {
            alert(`❌ Σφάλμα: ${err.response?.data?.error || err.message}`);
        }
    };

    return (
        <div className="animate-fade">
            <header style={{ marginBottom: '2rem' }}>
                <h1>Ρυθμίσεις Ιατρείου</h1>
                <p className="text-light">Διαχειριστείτε το προφίλ και τις διασυνδέσεις του ιατρείου σας.</p>
            </header>

            <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>

                {/* Main Settings */}
                <div className="card">
                    <h3 className="card-title"><Globe size={20} /> Γενικές Πληροφορίες</h3>
                    <form onSubmit={handleSave}>
                        <div className="form-group">
                            <label>Όνομα Ιατρείου</label>
                            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                            <div className="form-group flex-1">
                                <label>Τηλέφωνο</label>
                                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div className="form-group flex-1">
                                <label>Email</label>
                                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Διεύθυνση / Τοποθεσία</label>
                            <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <h3 className="card-title"><Link size={20} /> Εξωτερικές Συνδέσεις (Integrations)</h3>
                            <p className="text-sm text-light" style={{ marginBottom: '1rem' }}>
                                Συνδέστε το Make.com ή το n8n για να συγχρονίζετε ραντεβού με το Google Calendar και να στέλνετε SMS.
                            </p>
                            <div className="form-group">
                                <label>Webhook URL (n8n / Make)</label>
                                <input
                                    type="url"
                                    placeholder="https://hook.make.com/..."
                                    value={formData.webhookUrl || ''}
                                    onChange={e => setFormData({ ...formData, webhookUrl: e.target.value })}
                                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                />
                            </div>

                            <div className="test-actions" style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px dashed #4ade80' }}>
                                <h4 style={{ fontSize: '0.9rem', color: '#166534', marginBottom: '0.5rem' }}>🔧 Εργαλεία Δοκιμής (System Check)</h4>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => handleTest('vapi')}>
                                        📞 Προσομοίωση Vapi Call
                                    </button>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => handleTest('make')}>
                                        🔗 Test Make Webhook
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem' }} disabled={saving}>
                            <Save size={18} /> {saving ? 'Αποθήκευση...' : 'Αποθήκευση Αλλαγών'}
                        </button>
                    </form>
                </div>

                {/* AI Preview Side Panel */}
                <div className="card bg-subtle">
                    <h3 className="card-title"><MessageSquare size={20} /> Προεπισκόπηση AI</h3>
                    <p className="text-sm text-light" style={{ marginBottom: '1rem' }}>
                        Έτσι θα συστήνεται η ψηφιακή γραμματεία στους ασθενείς σας:
                    </p>

                    <div className="chat-bubble">
                        <p>
                            "Γεια σας! Είμαι η ψηφιακή βοηθός του <strong>{formData.name || 'Ιατρείου'}</strong> στην περιοχή <strong>{formData.location || '...'}</strong>."
                        </p>
                        <p style={{ marginTop: '8px' }}>
                            "Μπορώ να κλείσω ραντεβού στο <strong>{formData.phone || '...'}</strong> ή να απαντήσω σε ερωτήσεις."
                        </p>
                    </div>

                    <div style={{ marginTop: '2rem' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Χρήσιμοι Σύνδεσμοι</h4>
                        <ul className="link-list">
                            <li><a href="#">Οδηγός Σύνδεσης Make.com</a></li>
                            <li><a href="#">Ρυθμίσεις Vapi Voice</a></li>
                        </ul>
                    </div>
                </div>
            </div>

            <style>{`
        .card { background: white; padding: 2rem; border-radius: 16px; border: 1px solid var(--border); }
        .bg-subtle { background: #f8fafc; border: none; }
        .card-title { display: flex; align-items: center; gap: 10px; font-size: 1.1rem; margin-bottom: 1.5rem; color: var(--text); }
        .chat-bubble {
            background: white;
            padding: 1.5rem;
            border-radius: 0 16px 16px 16px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            border: 1px solid var(--border);
            font-size: 0.95rem;
            line-height: 1.5;
            color: var(--text);
        }
        .text-light { color: #64748b; }
        .text-sm { fontSize: 0.875rem; }
        .flex-1 { flex: 1; }
        .link-list { list-style: none; padding: 0; }
        .link-list li { margin-bottom: 8px; }
        .link-list a { color: var(--primary); text-decoration: none; font-size: 0.9rem; }
        .link-list a:hover { text-decoration: underline; }
      `}</style>
        </div>
    );
};

export default ClinicSettings;
