import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Globe, BarChart2, Activity, Shield, Check, Users, UserPlus, Trash2 } from 'lucide-react';

const inputStyle = {
    width: '100%', padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid var(--border)',
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-subtle)', color: 'var(--text)'
};

const ClinicSettings = ({ clinic, onUpdate }) => {
    const [formData, setFormData] = useState({ ...clinic });
    const [usageData, setUsageData] = useState(null);
    const [logs, setLogs] = useState([]);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [savingInfo, setSavingInfo] = useState(false);
    const isOwner = ['OWNER', 'ADMIN'].includes(clinic?.role);

    const [teamMembers, setTeamMembers] = useState([]);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'RECEPTIONIST', password: '' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    useEffect(() => {
        api.get('/clinic/usage').then(res => setUsageData(res.data)).catch(() => {});
        api.get('/audit-logs').then(res => setLogs(res.data)).catch(() => {});
        api.get('/team').then(res => setTeamMembers(res.data)).catch(() => {});
    }, []);

    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

    const handleSaveClinicInfo = async () => {
        setSavingInfo(true);
        try {
            await api.put('/clinic/settings', {
                name: formData.name, phone: formData.phone, email: formData.email, location: formData.location, timezone: formData.timezone
            });
            showToast('Clinic information updated!');
            if (onUpdate) onUpdate(formData);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save clinic info.', 'error');
        } finally {
            setSavingInfo(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        try {
            await api.post('/team', inviteForm);
            setShowInvite(false);
            setInviteForm({ name: '', email: '', role: 'RECEPTIONIST', password: '' });
            const res = await api.get('/team');
            setTeamMembers(res.data);
            showToast('Μέλος προστέθηκε!');
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα κατά την προσθήκη.', 'error');
        }
    };

    const handleRemoveMember = async (id) => {
        try {
            await api.delete(`/team/${id}`);
            const res = await api.get('/team');
            setTeamMembers(res.data);
            showToast('Μέλος αφαιρέθηκε.');
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα.', 'error');
        }
    };

    return (
        <div className="animate-fade" style={{ maxWidth: '860px', paddingBottom: '3rem' }}>
            <header style={{ marginBottom: '1.75rem', padding: '1.75rem 2rem', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #1e1b4b 100%)', borderRadius: '24px', color: 'white' }}>
                <h1 style={{ fontSize: '1.9rem', fontWeight: '900', marginBottom: '4px', color: 'white' }}>Ρυθμίσεις</h1>
                <p style={{ fontSize: '0.95rem', opacity: 0.7, margin: 0 }}>Managed SaaS: APIs και webhooks διαχειρίζονται αποκλειστικά από το backend.</p>
            </header>

            <div style={{ marginBottom: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '0.85rem 1rem' }}>
                <strong>Platform-managed integrations</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-light)' }}>Δεν χρειάζονται API keys ή connector ρυθμίσεις από το ιατρείο.</p>
            </div>

            <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem', marginBottom: '1rem' }}>
                <h3><Globe size={16} /> Γενικές Πληροφορίες</h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <input style={inputStyle} value={formData.name || ''} onChange={e => set('name', e.target.value)} placeholder="Όνομα ιατρείου" />
                    <input style={inputStyle} value={formData.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="Τηλέφωνο" />
                    <input style={inputStyle} value={formData.email || ''} onChange={e => set('email', e.target.value)} placeholder="Email" />
                    <button className="btn btn-primary" onClick={handleSaveClinicInfo} disabled={savingInfo}>{savingInfo ? 'Αποθήκευση...' : 'Αποθήκευση'} {<Check size={14} />}</button>
                </div>
            </section>

            <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem', marginBottom: '1rem' }}>
                <h3><Users size={16} /> Ομάδα</h3>
                {teamMembers.map(member => (
                    <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span>{member.email} ({member.role})</span>
                        {isOwner && <button className="btn btn-outline btn-sm" onClick={() => handleRemoveMember(member.id)}><Trash2 size={12} /></button>}
                    </div>
                ))}
                {isOwner && !showInvite && <button className="btn btn-outline btn-sm" onClick={() => setShowInvite(true)}><UserPlus size={14} /> Προσθήκη Μέλους</button>}
                {showInvite && (
                    <form onSubmit={handleInvite} style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <input style={inputStyle} value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
                        <input style={inputStyle} type="password" value={inviteForm.password} onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))} placeholder="Κωδικός" />
                        <button className="btn btn-primary btn-sm" type="submit">Αποθήκευση</button>
                    </form>
                )}
            </section>

            <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem', marginBottom: '1rem' }}>
                <h3><BarChart2 size={16} /> Χρήση & Όρια</h3>
                {!usageData ? <p>Loading...</p> : (
                    <div style={{ fontSize: '0.86rem' }}>
                        <p>SMS: {usageData.smsCount} / {usageData.smsMonthlyLimit}</p>
                        <p>AI Requests: {usageData.aiRequestCount} / {usageData.aiMonthlyLimit}</p>
                    </div>
                )}
            </section>

            <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem', marginBottom: '1rem' }}>
                <h3><Shield size={16} /> Ασφάλεια</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-light)' }}>Η πρόσβαση σε εξωτερικές υπηρεσίες γίνεται μόνο server-side από την πλατφόρμα.</p>
            </section>

            <section style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1rem' }}>
                <h3><Activity size={16} /> Αρχείο Ενεργειών</h3>
                {logs.slice(0, 20).map(log => <div key={log.id} style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>{log.action} - {new Date(log.createdAt).toLocaleDateString()}</div>)}
            </section>

            {toast.show && <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: toast.type === 'success' ? '#10b981' : '#ef4444', color: 'white', padding: '0.75rem 1rem', borderRadius: '12px' }}>{toast.message}</div>}
        </div>
    );
};

export default ClinicSettings;
