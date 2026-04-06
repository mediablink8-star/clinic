import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Save, Globe, Zap, BarChart2, Activity,
    Shield, CheckCircle, XCircle, Loader, Check,
    Users, UserPlus, Trash2, ChevronDown, Copy, ExternalLink
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

/* ─────────────────────────────────────────────────────────
   Layout primitives
 ───────────────────────────────────────────────────────── */
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
        scrollMarginTop: '80px'
    }}>
        {/* Card header */}
        <div style={{
            padding: '1.1rem 1.75rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'var(--bg-subtle)'
        }}>
            <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'white',
                fontSize: '0.72rem',
                fontWeight: '900',
                letterSpacing: '0'
            }}>
                {number}
            </div>
            <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: iconBg || 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                {icon}
            </div>
            <div>
                <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text)', margin: 0 }}>{title}</h2>
                {subtitle && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', margin: '2px 0 0', fontWeight: '400' }}>
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
        <div style={{ padding: '1.75rem 2rem' }}>{children}</div>
    </div>
);

const FormRow = ({ children }) => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>{children}</div>
);

const FormGroup = ({ label, flex, children }) => (
    <div style={{ marginBottom: '1.25rem', flex: flex || '1 1 200px' }}>
        <label style={{
            display: 'block',
            marginBottom: '0.45rem',
            fontWeight: '600',
            fontSize: '0.82rem',
            color: 'var(--text)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em'
        }}>
            {label}
        </label>
        {children}
    </div>
);

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

const SECTIONS = [
    { id: 's1', number: '1', label: 'Γενικά', icon: <Globe size={14} color="var(--primary)" />, iconBg: 'var(--primary-light)', title: 'Γενικές Πληροφορίες Ιατρείου', subtitle: 'Όνομα, στοιχεία επικοινωνίας και τοποθεσία' },
    { id: 's2', number: '2', label: 'Ομάδα', icon: <Users size={14} color="#0891b2" />, iconBg: '#ecfeff', title: 'Διαχείριση Ομάδας', subtitle: 'Χρήστες, ρόλοι και δικαιώματα' },
    { id: 's4', number: '3', label: 'Ασφάλεια', icon: <Shield size={14} color="#dc2626" />, iconBg: '#fff5f5', title: 'Ασφάλεια & Πρόσβαση', subtitle: 'Ταυτοποίηση δύο παραγόντων' },
    { id: 's5', number: '4', label: 'Αυτοματισμοί', icon: <Zap size={14} color="#d97706" />, iconBg: '#fffbeb', title: 'Αυτοματισμοί / Webhooks', subtitle: 'Σύνδεση με εξωτερικές υπηρεσίες' },
    { id: 's6', number: '5', label: 'Χρήση', icon: <BarChart2 size={14} color="#6366f1" />, iconBg: '#e0e7ff', title: 'Χρήση & Όρια', subtitle: 'Χρήση σε πραγματικό χρόνο και όρια' },
    { id: 's8', number: '6', label: 'Αρχείο', icon: <Activity size={14} color="#64748b" />, iconBg: '#f1f5f9', title: 'Αρχείο Ενεργειών', subtitle: 'Καταγραφή διοικητικών ενεργειών' },
];

const ClinicSettings = ({ clinic, token, onUpdate }) => {
    const [formData, setFormData] = useState({
        ...clinic,
        aiConfig: typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig || '{}') : (clinic.aiConfig || {})
    });
    const [savingInfo, setSavingInfo] = useState(false);
    const [infoSaved, setInfoSaved] = useState(false);
    const [infoErrors, setInfoErrors] = useState({});

    const [aiConfigSaving, setAiConfigSaving] = useState(false);
    const [activeSection, setActiveSection] = useState('s1');
    const [logs, setLogs] = useState([]);
    const [mfaSetup, setMfaSetup] = useState({ step: '', secret: '', qrImageUrl: '', code: '' });

    const [testState, setTestState] = useState({
        webhook: { status: 'idle', lastTested: null, responseTime: null, error: '', httpStatus: null }
    });
    const [webhookSaving, setWebhookSaving] = useState(false);
    const [showAdvancedWebhooks, setShowAdvancedWebhooks] = useState(false);
    const [usageData, setUsageData] = useState(null);
    const [loadingUsage, setLoadingUsage] = useState(true);
    const [webhookErrors, setWebhookErrors] = useState({});
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Team management state
    const isOwner = ['OWNER', 'ADMIN'].includes(clinic?.role);
    const [teamMembers, setTeamMembers] = useState([]);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'RECEPTIONIST', password: '' });
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    const handleTestWebhook = async (specificUrl = null, fieldName = 'Global') => {
        const urlToTest = specificUrl || formData.webhookUrl;
        if (!urlToTest) {
            showToast(`Παρακαλώ εισάγετε ένα URL για δοκιμή (${fieldName}).`, 'error');
            return;
        }

        const testKey = specificUrl ? fieldName : 'webhook';
        setTestState(prev => ({ ...prev, [testKey]: { status: 'loading', error: '', httpStatus: null } }));

        try {
            const res = await axios.post(`${API_BASE}/integrations/test-webhook`, {
                url: urlToTest,
                // Never send masked secret — let backend use stored one
                secret: (formData.webhookSecret && !formData.webhookSecret.startsWith('****'))
                    ? formData.webhookSecret
                    : undefined
            }, {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 12000 // 12s — backend takes up to 8s
            });

            if (res.data.success) {
                setTestState(prev => ({
                    ...prev,
                    [testKey]: {
                        status: 'success',
                        lastTested: new Date(),
                        responseTime: res.data.latency,
                        httpStatus: res.data.status,
                        error: ''
                    }
                }));
                showToast(`Webhook (${fieldName}) — HTTP ${res.data.status} σε ${res.data.latency}ms`);
            } else {
                setTestState(prev => ({
                    ...prev,
                    [testKey]: {
                        status: 'error',
                        lastTested: new Date(),
                        responseTime: res.data.latency,
                        error: res.data.error,
                        httpStatus: res.data.status
                    }
                }));
                showToast(res.data.error || `Η δοκιμή του Webhook (${fieldName}) απέτυχε.`, 'error');
            }
        } catch (err) {
            const msg = err.code === 'ECONNABORTED'
                ? 'Timeout — το αίτημα έληξε (>12s)'
                : err.response?.data?.error || err.message || 'Σφάλμα δικτύου';
            setTestState(prev => ({
                ...prev,
                [testKey]: {
                    status: 'error',
                    lastTested: new Date(),
                    error: msg,
                    httpStatus: err.response?.status
                }
            }));
            showToast(`${fieldName}: ${msg}`, 'error');
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchUsage();
        fetchTeam();
    }, []);

    useEffect(() => {
        const targets = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean);
        const obs = new IntersectionObserver(
            entries => {
                entries.forEach(e => {
                    if (e.isIntersecting) setActiveSection(e.target.id);
                });
            },
            { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
        );
        targets.forEach(t => obs.observe(t));
        return () => obs.disconnect();
    }, []);

    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));
    const setKey = (key, val) => setFormData(prev => ({ ...prev, apiKeys: { ...prev.apiKeys, [key]: val } }));

    const handleSaveWebhook = async () => {
        const errors = {};
        if (!formData.webhookUrl && !showAdvancedWebhooks) {
            errors.url = 'Το Webhook URL είναι υποχρεωτικό.';
        }
        
        if (formData.webhookUrl) {
            try { new URL(formData.webhookUrl); } catch { errors.url = 'Μη έγκυρη μορφή URL.'; }
        }
        
        // Basic validation for overrides if shown
        if (showAdvancedWebhooks) {
            ['webhookMissedCall', 'webhookAppointment', 'webhookReminders', 'webhookDirectSms', 'webhookInboundSms'].forEach(key => {
                if (formData[key]) {
                    try { new URL(formData[key]); } catch { errors[key] = 'Μη έγκυρη μορφή URL.'; }
                }
            });
        }

        setWebhookErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setWebhookSaving(true);
        try {
            const payload = {
                url: formData.webhookUrl,
                secret: formData.webhookSecret,
                webhookMissedCall: formData.webhookMissedCall,
                webhookAppointment: formData.webhookAppointment,
                webhookReminders: formData.webhookReminders,
                webhookDirectSms: formData.webhookDirectSms,
                webhookInboundSms: formData.webhookInboundSms
            };
            await axios.post(`${API_BASE}/integrations/save-webhook`, payload, { headers: { 'Authorization': `Bearer ${token}` } });
            showToast('Webhook settings saved!');
            if (onUpdate) onUpdate(payload);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save webhook settings', 'error');
        } finally {
            setWebhookSaving(false);
        }
    };

    const handleSaveClinicInfo = async () => {
        const errors = {};
        if (!formData.name?.trim()) errors.name = 'Το όνομα του ιατρείου είναι υποχρεωτικό.';
        if (!formData.phone?.trim()) errors.phone = 'Το τηλέφωνο είναι υποχρεωτικό.';
        if (!formData.email?.trim()) {
            errors.email = 'Το email είναι υποχρεωτικό.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            errors.email = 'Εισάγετε μια έγκυρη διεύθυνση email.';
        }
        setInfoErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setSavingInfo(true);
        setInfoSaved(false);
        try {
            await axios.put(`${API_BASE}/clinic/settings`, {
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                location: formData.location,
                timezone: formData.timezone
            }, { headers: { 'Authorization': `Bearer ${token}` } });
            setInfoSaved(true);
            showToast('Clinic information updated!');
            if (onUpdate) onUpdate(formData);
            setTimeout(() => setInfoSaved(false), 3000);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save clinic info.', 'error');
        } finally {
            setSavingInfo(false);
        }
    };

    const fetchTeam = async () => {
        try {
            const res = await axios.get(`${API_BASE}/team`, { headers: { Authorization: `Bearer ${token}` } });
            setTeamMembers(res.data);
        } catch { /* silently fail */ }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        setInviteError('');
        if (!inviteForm.email || !inviteForm.password) {
            setInviteError('Email και κωδικός είναι υποχρεωτικά.');
            return;
        }
        setInviteLoading(true);
        try {
            await axios.post(`${API_BASE}/team`, inviteForm, { headers: { Authorization: `Bearer ${token}` } });
            showToast('Μέλος προστέθηκε!');
            setShowInvite(false);
            setInviteForm({ name: '', email: '', role: 'RECEPTIONIST', password: '' });
            fetchTeam();
        } catch (err) {
            setInviteError(err.response?.data?.error || 'Σφάλμα κατά την προσθήκη.');
        } finally {
            setInviteLoading(false);
        }
    };

    const handleRemoveMember = async (id, email) => {
        if (!window.confirm(`Αφαίρεση ${email};`)) return;
        try {
            await axios.delete(`${API_BASE}/team/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            showToast('Μέλος αφαιρέθηκε.');
            fetchTeam();
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα.', 'error');
        }
    };

    const handleChangeRole = async (id, role) => {
        try {
            await axios.put(`${API_BASE}/team/${id}`, { role }, { headers: { Authorization: `Bearer ${token}` } });
            showToast('Ρόλος ενημερώθηκε.');
            fetchTeam();
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα.', 'error');
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await axios.get(`${API_BASE}/audit-logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setLogs(res.data);
        } catch (err) {
            console.error('Failed to fetch audit logs:', err);
        }
    };

    const fetchUsage = async () => {
        try {
            const res = await axios.get(`${API_BASE}/clinic/usage`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setUsageData(res.data);
        } catch (err) {
            console.error('Failed to fetch usage data:', err);
        } finally {
            setLoadingUsage(false);
        }
    };

    const StatusBadge = ({ status, latency, error }) => {
        let config = { bg: '#fefce8', color: '#854d0e', text: 'Δεν δοκιμάστηκε', dot: '#eab308' };
        if (status === 'connected') config = { bg: '#f0fdf4', color: '#166534', text: 'Συνδέθηκε', dot: '#22c55e' };
        if (status === 'failed') config = { bg: '#fef2f2', color: '#991b1b', text: 'Απέτυχε', dot: '#ef4444' };
        if (status === 'loading') config = { bg: '#f8fafc', color: '#475569', text: 'Δοκιμή...', dot: '#94a3b8' };

        return (
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: '99px',
                background: config.bg,
                color: config.color,
                fontSize: '0.75rem',
                fontWeight: '700'
            }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.dot }} />
                {config.text}
                {latency && <span style={{ opacity: 0.6 }}>({latency}ms)</span>}
                {error && <span title={error} style={{ cursor: 'help' }}>ⓘ</span>}
            </div>
        );
    };

    const handleStartMfaSetup = async () => {
        try {
            const res = await axios.post(`${API_BASE}/auth/mfa/setup`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setMfaSetup({ ...mfaSetup, step: 'QR', secret: res.data.secret, qrImageUrl: res.data.qrImageUrl });
        } catch {
            showToast('Failed to start MFA setup.', 'error');
        }
    };

    const handleVerifyMfa = async () => {
        try {
            await axios.post(`${API_BASE}/auth/mfa/verify`, {
                secret: mfaSetup.secret,
                code: mfaSetup.code
            }, { headers: { 'Authorization': `Bearer ${token}` } });
            showToast('MFA enabled successfully!');
            setMfaSetup({ step: '', secret: '', qrImageUrl: '', code: '' });
            if (onUpdate) onUpdate({ mfaEnabled: true });
        } catch {
            showToast('Invalid code. Try again.', 'error');
        }
    };

    const handleDisableMfa = async () => {
        if (!window.confirm('Are you sure you want to disable MFA?')) return;
        try {
            await axios.post(`${API_BASE}/auth/mfa/disable`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            showToast('MFA disabled.');
            if (onUpdate) onUpdate({ mfaEnabled: false });
        } catch {
            showToast('Failed to disable MFA.', 'error');
        }
    };

    const ErrorText = ({ message }) => message ? <p style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '4px', fontWeight: '600' }}>{message}</p> : null;

    return (
        <div className="animate-fade" style={{ maxWidth: '860px', paddingBottom: '3rem' }}>

            <header style={{
                marginBottom: '1.75rem',
                padding: '1.75rem 2rem',
                background: 'linear-gradient(135deg, var(--secondary) 0%, #1a253a 100%)',
                borderRadius: '24px',
                color: 'white',
                boxShadow: 'var(--shadow-lg)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1 style={{ fontSize: '1.9rem', fontWeight: '900', letterSpacing: '-1px', marginBottom: '4px', color: 'white' }}>
                        Ρυθμίσεις
                    </h1>
                    <p style={{ fontSize: '0.95rem', opacity: 0.65, margin: 0 }}>
                        Διαμορφώστε το AI, το προφίλ του ιατρείου και τις συνδέσεις σας.
                    </p>
                </div>
            </header>

            <nav style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                marginBottom: '1.75rem',
                padding: '0.6rem',
                background: 'var(--card-bg)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
                position: 'sticky',
                top: '20px',
                zIndex: 10
            }}>
                {SECTIONS.map(s => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => scrollTo(s.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '0.5rem 1rem',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            transition: 'all 0.2s',
                            background: activeSection === s.id ? 'var(--primary)' : 'transparent',
                            color: activeSection === s.id ? 'white' : 'var(--text-light)',
                        }}
                    >
                        {s.label}
                    </button>
                ))}
            </nav>

            {/* 1 · General Info */}
            <SectionCard id="s1" number="1" icon={<Globe size={15} color="var(--primary)" />} iconBg="var(--primary-light)"
                title="Γενικές Πληροφορίες Ιατρείου" subtitle="Βασική ταυτότητα και στοιχεία επικοινωνίας">
                <FormGroup label="Όνομα Ιατρείου *" flex="1 1 100%">
                    <input
                        style={{ ...inputStyle, borderColor: infoErrors.name ? '#dc2626' : undefined }}
                        type="text"
                        value={formData.name || ''}
                        onChange={e => set('name', e.target.value)}
                        placeholder="e.g. Athena Dental"
                    />
                    <ErrorText message={infoErrors.name} />
                </FormGroup>
                <FormRow>
                    <FormGroup label="Τηλέφωνο *">
                        <input
                            style={{ ...inputStyle, borderColor: infoErrors.phone ? '#dc2626' : undefined }}
                            type="text"
                            value={formData.phone || ''}
                            onChange={e => set('phone', e.target.value)}
                        />
                        <ErrorText message={infoErrors.phone} />
                    </FormGroup>
                    <FormGroup label="Email *">
                        <input
                            style={{ ...inputStyle, borderColor: infoErrors.email ? '#dc2626' : undefined }}
                            type="email"
                            value={formData.email || ''}
                            onChange={e => set('email', e.target.value)}
                        />
                        <ErrorText message={infoErrors.email} />
                    </FormGroup>
                </FormRow>
                <FormRow>
                    <FormGroup label="Διεύθυνση" flex="2 1 200px">
                        <input
                            style={inputStyle}
                            type="text"
                            value={formData.location || ''}
                            onChange={e => set('location', e.target.value)}
                        />
                    </FormGroup>
                    <FormGroup label="Ζώνη Ώρας" flex="1 1 180px">
                        <select
                            style={inputStyle}
                            value={formData.timezone || 'Europe/Athens'}
                            onChange={e => set('timezone', e.target.value)}
                        >
                            {['Europe/Athens', 'Europe/London', 'UTC'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                        </select>
                    </FormGroup>
                </FormRow>

                <div style={{ 
                    marginTop: '0.5rem', marginBottom: '1.5rem', padding: '1.25rem', 
                    borderRadius: '16px', background: 'rgba(99,102,241,0.04)', 
                    border: '1px solid rgba(99,102,241,0.1)' 
                }}>
                    <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '800', fontSize: '0.72rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Δημόσιος Σύνδεσμος Κρατήσεων
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Globe size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input 
                                readOnly 
                                style={{ ...inputStyle, paddingLeft: '34px', background: '#fff', color: '#64748b', cursor: 'default', fontSize: '0.8rem', border: '1px solid rgba(99,102,241,0.2)' }} 
                                value={`${window.location.origin}/book?clinicId=${clinic?.id}`} 
                            />
                        </div>
                        <button 
                            type="button" 
                            title="Αντιγραφή Συνδέσμου"
                            style={{ padding: '0 12px', background: 'white', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/book?clinicId=${clinic?.id}`);
                                showToast('Ο σύνδεσμος αντιγράφηκε!');
                            }}
                        >
                            <Copy size={16} color="var(--primary)" />
                        </button>
                        <a 
                            href={`/book?clinicId=${clinic?.id}`} 
                            target="_blank" 
                            rel="noreferrer"
                            title="Άνοιγμα Σελίδας"
                            style={{ padding: '0 12px', background: 'white', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <ExternalLink size={16} color="var(--secondary)" />
                        </a>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '8px', fontWeight: '500' }}>
                        Μοιραστείτε αυτόν τον σύνδεσμο με τους ασθενείς σας ή τοποθετήστε τον στα social media για online κρατήσεις.
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="button" className="btn btn-primary" onClick={handleSaveClinicInfo} disabled={savingInfo}>
                        {savingInfo ? 'Αποθήκευση...' : 'Αποθήκευση Στοιχείων'}
                        {infoSaved && <Check size={14} />}
                    </button>
                </div>
            </SectionCard>

            {/* 2 · Team Management */}
            <SectionCard id="s2" number="2" icon={<Users size={15} color="#0891b2" />} iconBg="#ecfeff"
                title="Διαχείριση Ομάδας" subtitle="Χρήστες, ρόλοι και δικαιώματα πρόσβασης">

                {/* Role legend */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    {[
                        { role: 'OWNER', label: 'Ιδιοκτήτης', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', desc: 'Πλήρης πρόσβαση' },
                        { role: 'RECEPTIONIST', label: 'Γραμματέας', color: '#0891b2', bg: 'rgba(8,145,178,0.08)', desc: 'Ραντεβού & ασθενείς' },
                        { role: 'ASSISTANT', label: 'Βοηθός', color: '#059669', bg: 'rgba(5,150,105,0.08)', desc: 'Μόνο ανάγνωση' },
                    ].map(r => (
                        <div key={r.role} style={{ padding: '6px 12px', borderRadius: '10px', background: r.bg, border: `1px solid ${r.color}22` }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: r.color }}>{r.label}</span>
                            <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: '6px' }}>{r.desc}</span>
                        </div>
                    ))}
                </div>

                {/* Member list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                    {teamMembers.map(member => {
                        const roleColors = { OWNER: '#7c3aed', ADMIN: '#7c3aed', RECEPTIONIST: '#0891b2', ASSISTANT: '#059669' };
                        const roleLabels = { OWNER: 'Ιδιοκτήτης', ADMIN: 'Admin', RECEPTIONIST: 'Γραμματέας', ASSISTANT: 'Βοηθός' };
                        const color = roleColors[member.role] || '#64748b';
                        const isSelf = member.id === clinic?.userId;
                        return (
                            <div key={member.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', borderRadius: '14px',
                                background: 'rgba(248,250,252,0.8)', border: '1px solid var(--border)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color }}>{(member.name || member.email)[0].toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text)' }}>
                                            {member.name || member.email}
                                            {isSelf && <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>(εσείς)</span>}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{member.email}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isOwner && !isSelf ? (
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={member.role}
                                                onChange={e => handleChangeRole(member.id, e.target.value)}
                                                style={{
                                                    padding: '4px 28px 4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800',
                                                    border: `1px solid ${color}33`, background: `${color}10`, color,
                                                    cursor: 'pointer', appearance: 'none', outline: 'none'
                                                }}
                                            >
                                                <option value="OWNER">Ιδιοκτήτης</option>
                                                <option value="RECEPTIONIST">Γραμματέας</option>
                                                <option value="ASSISTANT">Βοηθός</option>
                                            </select>
                                            <ChevronDown size={10} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color, pointerEvents: 'none' }} />
                                        </div>
                                    ) : (
                                        <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800', background: `${color}10`, color, border: `1px solid ${color}22` }}>
                                            {roleLabels[member.role] || member.role}
                                        </span>
                                    )}
                                    {isOwner && !isSelf && (
                                        <button onClick={() => handleRemoveMember(member.id, member.email)} style={{ padding: '6px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {teamMembers.length === 0 && (
                        <p style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>Δεν βρέθηκαν μέλη.</p>
                    )}
                </div>

                {/* Invite form */}
                {isOwner && (
                    showInvite ? (
                        <form onSubmit={handleInvite} style={{ padding: '1.25rem', borderRadius: '14px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Όνομα</label>
                                    <input style={{ ...inputStyle, padding: '0.5rem 0.75rem' }} placeholder="π.χ. Μαρία" value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Email *</label>
                                    <input style={{ ...inputStyle, padding: '0.5rem 0.75rem' }} type="email" placeholder="email@example.com" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Κωδικός *</label>
                                    <input style={{ ...inputStyle, padding: '0.5rem 0.75rem' }} type="password" placeholder="Προσωρινός κωδικός" value={inviteForm.password} onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Ρόλος</label>
                                    <select style={{ ...inputStyle, padding: '0.5rem 0.75rem' }} value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                                        <option value="OWNER">Ιδιοκτήτης</option>
                                        <option value="RECEPTIONIST">Γραμματέας</option>
                                        <option value="ASSISTANT">Βοηθός</option>
                                    </select>
                                </div>
                            </div>
                            {inviteError && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '0.75rem', fontWeight: '600' }}>{inviteError}</p>}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="submit" className="btn btn-primary btn-sm" disabled={inviteLoading}>{inviteLoading ? 'Αποθήκευση...' : 'Προσθήκη Μέλους'}</button>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setShowInvite(false); setInviteError(''); }}>Ακύρωση</button>
                            </div>
                        </form>
                    ) : (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <UserPlus size={14} /> Προσθήκη Μέλους
                        </button>
                    )
                )}

                {/* Permission matrix */}
                <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '12px', background: 'rgba(248,250,252,0.8)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Δικαιώματα ανά ρόλο</p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '4px 8px', color: '#64748b', fontWeight: '700' }}>Λειτουργία</th>
                                    {['Ιδιοκτήτης', 'Γραμματέας', 'Βοηθός'].map(r => (
                                        <th key={r} style={{ textAlign: 'center', padding: '4px 8px', color: '#64748b', fontWeight: '700' }}>{r}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ['Ραντεβού (προβολή/δημιουργία)', true, true, true],
                                    ['Ασθενείς (προβολή/δημιουργία)', true, true, true],
                                    ['Αποστολή SMS', true, true, false],
                                    ['Αναφορές', true, true, false],
                                    ['Ρυθμίσεις AI & API keys', true, false, false],
                                    ['Webhook & Αυτοματισμοί', true, false, false],
                                    ['Διαχείριση ομάδας', true, false, false],
                                ].map(([label, ...perms]) => (
                                    <tr key={label}>
                                        <td style={{ padding: '5px 8px', color: 'var(--text)', fontWeight: '500' }}>{label}</td>
                                        {perms.map((allowed, i) => (
                                            <td key={i} style={{ textAlign: 'center', padding: '5px 8px' }}>
                                                {allowed
                                                    ? <span style={{ color: '#10b981', fontWeight: '800' }}>✓</span>
                                                    : <span style={{ color: '#cbd5e1', fontWeight: '800' }}>—</span>
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </SectionCard>

            {/* 3 · Ασφάλεια */}
            <SectionCard id="s4" number="3" icon={<Shield size={15} color="#dc2626" />} iconBg="#fff5f5"
                title="Ασφάλεια" subtitle="Έλεγχος πρόσβασης και προστασία δεδομένων">
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem',
                    borderRadius: '16px', border: '1px solid var(--border)', background: clinic.mfaEnabled ? '#f0fdf4' : '#fafbfc'
                }}>
                    <div>
                        <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>Ταυτοποίηση Δύο Παραγόντων (MFA)</span>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: '4px 0 0' }}>
                            Προστατέψτε τον λογαριασμό σας χρησιμοποιώντας μια εφαρμογή ελέγχου ταυτότητας (TOTP).
                        </p>
                    </div>
                    <button type="button" className={`btn ${clinic.mfaEnabled ? 'btn-outline' : 'btn-primary'} btn-sm`} onClick={clinic.mfaEnabled ? handleDisableMfa : handleStartMfaSetup}>
                        {clinic.mfaEnabled ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}
                    </button>
                </div>
            </SectionCard>

            {/* 4 · Αυτοματισμοί */}
            <SectionCard id="s5" number="4" icon={<Zap size={15} color="#d97706" />} iconBg="#fffbeb"
                title="Αυτοματισμοί" subtitle="Webhooks και εξωτερικοί κανόνες (Make / n8n)">
                <FormRow>
                    <FormGroup label="Webhook URL" flex="2 1 300px">
                        <input
                            style={{ ...inputStyle, fontFamily: 'monospace', borderColor: webhookErrors.url ? '#dc2626' : undefined }}
                            placeholder="https://hook.make.com/..."
                            value={formData.webhookUrl || ''}
                            onChange={e => set('webhookUrl', e.target.value)}
                        />
                        <ErrorText message={webhookErrors.url} />
                    </FormGroup>
                    <FormGroup label="Webhook Secret" flex="1 1 200px">
                        <input
                            style={{ ...inputStyle, fontFamily: 'monospace' }}
                            type="password"
                            placeholder="Secret for signing..."
                            value={formData.webhookSecret || ''}
                            onChange={e => set('webhookSecret', e.target.value)}
                        />
                    </FormGroup>
                </FormRow>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
                    Τα εισερχόμενα αιτήματα θα υπογράφονται με HMAC-SHA256 στην κεφαλίδα <code>X-Webhook-Signature</code>.
                </p>

                {/* Advanced Webhooks Toggle */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <button 
                        type="button" 
                        onClick={() => setShowAdvancedWebhooks(!showAdvancedWebhooks)}
                        style={{ 
                            display: 'flex', alignItems: 'center', gap: '6px', 
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '700',
                            padding: 0
                        }}
                    >
                        <ChevronDown size={14} style={{ transform: showAdvancedWebhooks ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        {showAdvancedWebhooks ? 'Απόκρυψη Προχωρημένων Ρυθμίσεων' : 'Εξειδικευμένα Webhooks ανά Ενέργεια'}
                    </button>
                    
                    {showAdvancedWebhooks && (
                        <div style={{ 
                            marginTop: '1rem', padding: '1.25rem', borderRadius: '16px', 
                            background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.08)',
                            display: 'flex', flexDirection: 'column', gap: '1rem'
                        }}>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                Εάν οριστούν, αυτά τα URL θα υπερισχύουν του καθολικού Webhook URL για τις συγκεκριμένες ενέργειες.
                            </p>
                            
                            <FormGroup label={
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <span>Missed Call Detection (Workflow 3)</span>
                                    {formData.webhookMissedCall && (
                                        <button type="button" onClick={() => handleTestWebhook(formData.webhookMissedCall, 'Missed Call')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', padding: '2px 5px' }}>
                                            ΔΟΚΙΜΗ
                                        </button>
                                    )}
                                </div>
                            }>
                                <input 
                                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}
                                    placeholder="https://.../missed-call-event"
                                    value={formData.webhookMissedCall || ''}
                                    onChange={e => set('webhookMissedCall', e.target.value)}
                                />
                                <ErrorText message={webhookErrors.webhookMissedCall} />
                            </FormGroup>
                            
                            <FormRow>
                                <FormGroup label={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <span>Appointment Created (Workflow 1)</span>
                                        {formData.webhookAppointment && (
                                            <button type="button" onClick={() => handleTestWebhook(formData.webhookAppointment, 'Appointment')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', padding: '2px 5px' }}>
                                                ΔΟΚΙΜΗ
                                            </button>
                                        )}
                                    </div>
                                }>
                                    <input 
                                        style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}
                                        placeholder="https://.../appointment-created"
                                        value={formData.webhookAppointment || ''}
                                        onChange={e => set('webhookAppointment', e.target.value)}
                                    />
                                    <ErrorText message={webhookErrors.webhookAppointment} />
                                </FormGroup>
                                <FormGroup label={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <span>Reminders / Notifications (Workflow 4)</span>
                                        {formData.webhookReminders && (
                                            <button type="button" onClick={() => handleTestWebhook(formData.webhookReminders, 'Reminders')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', padding: '2px 5px' }}>
                                                ΔΟΚΙΜΗ
                                            </button>
                                        )}
                                    </div>
                                }>
                                    <input 
                                        style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}
                                        placeholder="https://... (Cron Processor)"
                                        value={formData.webhookReminders || ''}
                                        onChange={e => set('webhookReminders', e.target.value)}
                                    />
                                    <ErrorText message={webhookErrors.webhookReminders} />
                                </FormGroup>
                            </FormRow>
                            
                            <FormRow>
                                <FormGroup label={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <span>Direct Dashboard SMS (Workflow 2)</span>
                                        {formData.webhookDirectSms && (
                                            <button type="button" onClick={() => handleTestWebhook(formData.webhookDirectSms, 'Direct SMS')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', padding: '2px 5px' }}>
                                                ΔΟΚΙΜΗ
                                            </button>
                                        )}
                                    </div>
                                }>
                                    <input 
                                        style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}
                                        placeholder="https://.../send-sms"
                                        value={formData.webhookDirectSms || ''}
                                        onChange={e => set('webhookDirectSms', e.target.value)}
                                    />
                                    <ErrorText message={webhookErrors.webhookDirectSms} />
                                </FormGroup>
                                <FormGroup label={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <span>Inbound SMS / Replies (Workflow 5)</span>
                                        {formData.webhookInboundSms && (
                                            <button type="button" onClick={() => handleTestWebhook(formData.webhookInboundSms, 'Inbound SMS')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', padding: '2px 5px' }}>
                                                ΔΟΚΙΜΗ
                                            </button>
                                        )}
                                    </div>
                                }>
                                    <input 
                                        style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}
                                        placeholder="https://.../inbound-sms"
                                        value={formData.webhookInboundSms || ''}
                                        onChange={e => set('webhookInboundSms', e.target.value)}
                                    />
                                    <ErrorText message={webhookErrors.webhookInboundSms} />
                                </FormGroup>
                            </FormRow>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={handleTestWebhook}
                            disabled={testState.webhook.status === 'loading'}
                        >
                            {testState.webhook.status === 'loading' ? 'Δοκιμή...' : 'Δοκιμή Webhook'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleSaveWebhook}
                            disabled={webhookSaving}
                            style={{ minWidth: '80px' }}
                        >
                            {webhookSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                        </button>
                    </div>

                    {testState.webhook.status !== 'idle' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: testState.webhook.status === 'success' ? '#22c55e' : '#ef4444'
                            }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: testState.webhook.status === 'success' ? '#166534' : '#991b1b' }}>
                                {testState.webhook.status === 'success'
                                    ? `Success (${testState.webhook.httpStatus}) • ${testState.webhook.responseTime}ms`
                                    : testState.webhook.error || `Failed (${testState.webhook.httpStatus})`}
                            </span>
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* 5 · Usage & Limits */}
            <SectionCard id="s6" number="5" icon={<BarChart2 size={15} color="#4f46e5" />} iconBg="#eef2ff"
                title="Χρήση & Όρια" subtitle="Παρακολούθηση μηνυμάτων και AI σε πραγματικό χρόνο">
                {!usageData ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '8px' }}>
                        <Loader size={16} className="animate-spin" />
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>Φόρτωση δεδομένων χρήσης...</span>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', padding: '0.5rem 0' }}>
                        {/* Monthly Credits */}
                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Πιστώσεις Μηνυμάτων</span>
                                <span style={{ fontSize: '0.85rem' }}>{usageData.creditsRemaining} / {usageData.monthlyLimit}</span>
                            </div>
                            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, (usageData.creditsRemaining / (usageData.monthlyLimit || 1)) * 100)}%`,
                                    background: 'linear-gradient(90deg, #6366f1, #4f46e5)',
                                    borderRadius: '4px'
                                }} />
                            </div>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '8px' }}>Ανανεώνεται κάθε μήνα. Διαθέσιμο για SMS/WhatsApp.</p>
                        </div>

                        {/* Daily Usage */}
                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Σημερινή Χρήση</span>
                                <span style={{ fontSize: '0.85rem' }}>{usageData.dailyUsed} / {usageData.dailyLimit}</span>
                            </div>
                            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, (usageData.dailyUsed / (usageData.dailyLimit || 1)) * 100)}%`,
                                    background: usageData.dailyUsed > usageData.dailyLimit * 0.9 ? '#ef4444' : '#10b981',
                                    borderRadius: '4px'
                                }} />
                            </div>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '8px' }}>Ημερήσιο όριο ασφαλείας για αποστολές μηνυμάτων.</p>
                        </div>

                        {/* AI Requests */}
                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Αιτήματα AI Σήμερα</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#6366f1' }}>{usageData.aiRequestsToday}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${Math.min(100, (usageData.aiRequestsToday / 100) * 100)}%`,
                                        background: '#8b5cf6',
                                        borderRadius: '4px'
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>όριο 100</span>
                            </div>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '8px' }}>Περιλαμβάνει ανάλυση διαλογής και πρόθεσης φωνής.</p>
                        </div>
                    </div>
                )}

                <div style={{ 
                    marginTop: '1.5rem', padding: '1.25rem', borderRadius: '16px', 
                    background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '4px' }}>Χρειάζεστε περισσότερες πιστώσεις;</h4>
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Αναβαθμίστε το πακέτο σας ή αγοράστε πακέτα SMS για να συνεχίσετε την αυτοματοποίηση.</p>
                    </div>
                    <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={() => showToast('Η αναβάθμιση θα είναι διαθέσιμη σύντομα!', 'info')}>
                        Αναβάθμιση Τώρα
                    </button>
                </div>
            </SectionCard>

            {/* 6 · Audit */}
            <SectionCard id="s8" number="6" icon={<Activity size={15} color="#64748b" />} iconBg="#f1f5f9"
                title="Αρχείο Ενεργειών" subtitle="Ιστορικό διοικητικών ενεργειών">
                {logs.length === 0 ? <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Δεν βρέθηκε δραστηριότητα.</p> : (
                    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead style={{ background: '#fafbfc' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Ημερομηνία</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Ενέργεια</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Οντότητα</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id}>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-light)' }}>{new Date(log.createdAt).toLocaleDateString()}</td>
                                        <td style={{ padding: '0.75rem', fontWeight: '700' }}>{log.action}</td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-light)' }}>{log.entity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            {/* MFA Modal */}
            {mfaSetup.step === 'QR' && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '2.5rem', borderRadius: '24px', width: '350px', boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 1rem', fontWeight: '900' }}>Ρύθμιση MFA</h3>
                        <img src={mfaSetup.qrImageUrl} style={{ width: '180px', borderRadius: '12px', margin: '1rem 0' }} alt="QR" />
                        <input style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.4em' }} maxLength="6" placeholder="000000" value={mfaSetup.code} onChange={e => setMfaSetup({ ...mfaSetup, code: e.target.value })} />
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleVerifyMfa}>Επαλήθευση</button>
                            <button className="btn btn-outline" onClick={() => setMfaSetup({ step: '' })}>Ακύρωση</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: 8px; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-fade { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
            {/* Toast Notification */}
            {toast.show && (
                <div style={{
                    position: 'fixed', bottom: '2.5rem', right: '2.5rem',
                    padding: '1.25rem 2.5rem', borderRadius: '14px',
                    backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
                    color: 'white', fontWeight: '700', fontSize: '0.95rem',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                    zIndex: 1000, animation: 'slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    {toast.type === 'success' ? <Check size={18} /> : <Activity size={18} />}
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default ClinicSettings;
