import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import {
    Globe, BarChart2, Activity, Zap, Phone, Sparkles,
    Shield, Loader, Check,
    Users, UserPlus, Trash2, ChevronDown, Copy, ExternalLink, Calendar,
    MessageSquare
} from 'lucide-react';

const ErrorText = ({ message }) => message ? <p style={{ color: 'var(--urgent)', fontSize: '0.72rem', marginTop: '4px', fontWeight: '600' }}>{message}</p> : null;

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const StatusBadge = ({ status, latency, error }) => {
    let config = { bg: 'var(--warning-light)', color: 'var(--warning)', text: 'Δεν δοκιμάστηκε', dot: 'var(--warning)' };
    if (status === 'connected') config = { bg: 'var(--success-light)', color: 'var(--accent)', text: 'Συνδέθηκε', dot: 'var(--accent)' };
    if (status === 'failed') config = { bg: 'var(--error-light)', color: 'var(--urgent)', text: 'Απέτυχε', dot: 'var(--urgent)' };
    if (status === 'loading') config = { bg: 'var(--bg-subtle)', color: 'var(--text-light)', text: 'Δοκιμή...', dot: 'var(--text-muted)' };
    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '99px', background: config.bg, color: config.color, fontSize: '0.75rem', fontWeight: '700' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.dot }} />
            {config.text}
            {latency && <span style={{ opacity: 0.6 }}>({latency}ms)</span>}
            {error && <span title={error} style={{ cursor: 'help' }}>ⓘ</span>}
        </div>
    );
};

/* ─────────────────────────────────────────────────────────
   Layout primitives
 ───────────────────────────────────────────────────────── */
const SectionCard = ({ id, number, icon, iconBg, title, subtitle, children }) => (
    <div id={id} style={{
        background: 'var(--card-bg)',
        backdropFilter: 'blur(10px) saturate(180%)',
        WebkitBackdropFilter: 'blur(10px) saturate(180%)',
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

const FormGroup = ({ label, htmlFor, flex, children }) => (
    <div style={{ marginBottom: '1.25rem', flex: flex || '1 1 200px' }}>
        <label htmlFor={htmlFor} style={{
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
    outline: '2px solid transparent',
    boxSizing: 'border-box',
    background: 'var(--bg-subtle)',
    color: 'var(--text)'
};

const SECTIONS = [
    { id: 's1', number: '1', label: 'Γενικά', icon: <Globe size={14} color="var(--primary)" />, iconBg: 'var(--primary-light)', title: 'Γενικές Πληροφορίες Ιατρείου', subtitle: 'Όνομα, στοιχεία επικοινωνίας και τοποθεσία' },
    { id: 's-doctors', number: '1.5', label: 'Γιατροί', icon: <UserPlus size={14} color="var(--warning)" />, iconBg: 'var(--warning-light)', title: 'Διαχείριση Γιατρών', subtitle: 'Γιατροί, ειδικότητες και ωράρια' },
    { id: 's2', number: '2', label: 'Ομάδα', icon: <Users size={14} color="var(--ai-blue)" />, iconBg: 'var(--info-light)', title: 'Διαχείριση Ομάδας', subtitle: 'Χρήστες, ρόλοι και δικαιώματα' },
    { id: 's4', number: '3', label: 'Ασφάλεια', icon: <Shield size={14} color="var(--urgent)" />, iconBg: 'var(--error-light)', title: 'Ασφάλεια & Πρόσβαση', subtitle: 'Ταυτοποίηση δύο παραγόντων' },
    { id: 's6', number: '4', label: 'Χρήση', icon: <BarChart2 size={14} color="var(--primary-deep)" />, iconBg: 'var(--primary-light)', title: 'Χρήση & Όρια', subtitle: 'Χρήση σε πραγματικό χρόνο και όρια' },
    { id: 's-voice', number: '5', label: 'Voice AI', icon: <Phone size={14} color="var(--primary-vibrant)" />, iconBg: 'rgba(124,58,237,0.1)', title: 'Voice AI', subtitle: 'AI φωνητική ανάκτηση κλήσεων' },
    { id: 's7', number: '6', label: 'Webhooks', icon: <Zap size={14} color="var(--warning)" />, iconBg: 'var(--warning-light)', title: 'Webhooks & Αυτοματισμοί', subtitle: 'Σύνδεση με n8n workflows' },
    { id: 's-gcal', number: '7', label: 'Google Cal', icon: <Calendar size={14} color="var(--accent)" />, iconBg: 'var(--success-light)', title: 'Google Calendar', subtitle: 'Συγχρονισμός ραντεβού με Google Calendar' },
    { id: 's8', number: '8', label: 'Αρχείο', icon: <Activity size={14} color="var(--text-muted)" />, iconBg: 'var(--bg-subtle)', title: 'Αρχείο Ενεργειών', subtitle: 'Καταγραφή διοικητικών ενεργειών' },
    { id: 's-danger', number: '9', label: 'Επαναφορά', icon: <Trash2 size={14} color="var(--urgent)" />, iconBg: 'var(--error-light)', title: 'Επικίνδυνη Ζώνη', subtitle: 'Επαναφορά και διαγραφή' },
];

const ClinicSettings = ({ clinic, token, onUpdate }) => {
    const [formData, setFormData] = useState({
        ...clinic,
        aiConfig: typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig || '{}') : (clinic.aiConfig || {})
    });
    const [savingInfo, setSavingInfo] = useState(false);
    const [infoSaved, setInfoSaved] = useState(false);
    const [infoErrors, setInfoErrors] = useState({});

    // Success states for sections
    const [sectionSaved, setSectionSaved] = useState({});

    // Re-sync form when clinic prop updates (e.g. after fresh API fetch on page load)
    React.useEffect(() => {
        if (!clinic) return;
        setFormData(prev => ({
            ...prev,
            ...clinic,
            aiConfig: typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig || '{}') : (clinic.aiConfig || {})
        }));
        setWebhookData(prev => ({
            ...prev,
            webhookUrl: clinic.webhookUrl || '',
            webhookMissedCall: clinic.webhookMissedCall || '',
            webhookAppointment: clinic.webhookAppointment || '',
            webhookReminders: clinic.webhookReminders || '',
            webhookDirectSms: clinic.webhookDirectSms || '',
            webhookInboundSms: clinic.webhookInboundSms || '',
        }));
        setVapiData(prev => ({
            ...prev,
            vapiAssistantId: clinic.vapiAssistantId || '',
            vapiPhoneNumberId: clinic.vapiPhoneNumberId || '',
            voiceEnabled: clinic.voiceEnabled || false,
        }));
    }, [clinic?.id, clinic?.updatedAt]);

    // Fetch available upgrade plans
    React.useEffect(() => {
        api.get('/clinic/plans')
            .then(res => {
                setCurrentPlan(res.data.currentPlan);
                setUpgradePlans(res.data.plans);
            })
            .catch((err) => console.error('Failed to fetch clinic plans:', err));
    }, []);

    const handleUpgrade = async (planKey) => {
        setUpgrading(true);
        try {
            await api.post('/clinic/upgrade-plan', { plan: planKey });
            setShowUpgradeModal(false);
            showToast('Το πακέτο αναβαθμίστηκε επιτυχώς!', 'success');
            // Refresh usage data
            api.get('/clinic/usage').then(res => setUsageData(res.data)).catch((err) => console.error('Failed to refresh usage data:', err));
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα αναβάθμισης.', 'error');
        } finally {
            setUpgrading(false);
        }
    };

    const openUpgradeModal = () => {
        api.get('/clinic/plans')
            .then(res => {
                setCurrentPlan(res.data.currentPlan);
                setUpgradePlans(res.data.plans);
                setShowUpgradeModal(true);
            })
            .catch(() => showToast('Αδυναμία φόρτωσης πακέτων.', 'error'));
    };

    const planLabel = (key) => {
        const labels = { trial: 'Trial', solo: 'Solo', team: 'Team', multi: 'Multi', enterprise: 'Enterprise' };
        return labels[key] || key;
    };

    const [aiConfigSaving, setAiConfigSaving] = useState(false);
    const [activeSection, setActiveSection] = useState('s1');
    const [logs, setLogs] = useState([]);
    const [mfaSetup, setMfaSetup] = useState({ step: '', secret: '', qrImageUrl: '', code: '' });
    const [usageData, setUsageData] = useState(null);
    const [loadingUsage, setLoadingUsage] = useState(true);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Upgrade plan state
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [upgradePlans, setUpgradePlans] = useState([]);
    const [currentPlan, setCurrentPlan] = useState('trial');
    const [upgrading, setUpgrading] = useState(false);

    // Team management state
    const isOwner = ['OWNER', 'ADMIN'].includes(clinic?.role);
    const [teamMembers, setTeamMembers] = useState([]);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'RECEPTIONIST', password: '' });
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');

    // Doctors state
    const [doctors, setDoctors] = useState([]);
    const [showDoctorModal, setShowDoctorModal] = useState(false);
    const [doctorForm, setDoctorForm] = useState({ id: null, name: '', specialty: '', phone: '', email: '', avatarUrl: '', workingHours: '{}' });
    const [doctorSaving, setDoctorSaving] = useState(false);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    useEffect(() => {
        fetchLogs();
        fetchUsage();
        fetchTeam();
        fetchDoctors();
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
            await api.put(`/clinic/settings`, {
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                location: formData.location,
                timezone: formData.timezone
            }, { headers: { 'Authorization': `Bearer ${token}` } });
            setInfoSaved(true);
            showToast('Τα στοιχεία του ιατρείου ενημερώθηκαν!');
            if (onUpdate) onUpdate(formData);
            setTimeout(() => setInfoSaved(false), 3000);
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα αποθήκευσης στοιχείων.', 'error');
        } finally {
            setSavingInfo(false);
        }
    };

    const fetchTeam = async () => {
        try {
            const res = await api.get(`/team`);
            setTeamMembers(res.data);
        } catch (err) {
            console.error('Failed to fetch team members:', err);
        }
    };

    const fetchDoctors = async () => {
        try {
            const res = await api.get('/doctors');
            setDoctors(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch doctors:', err);
        }
    };

    const handleSaveDoctor = async (e) => {
        e.preventDefault();
        if (!doctorForm.name) {
            showToast('Το όνομα είναι υποχρεωτικό', 'error');
            return;
        }
        try {
            JSON.parse(doctorForm.workingHours || '{}');
        } catch {
            showToast('Το ωράριο πρέπει να είναι έγκυρο JSON', 'error');
            return;
        }
        setDoctorSaving(true);
        try {
            if (doctorForm.id) {
                await api.put(`/doctors/${doctorForm.id}`, doctorForm);
                showToast('Ο γιατρός ενημερώθηκε επιτυχώς!');
            } else {
                await api.post('/doctors', doctorForm);
                showToast('Ο γιατρός δημιουργήθηκε επιτυχώς!');
            }
            setShowDoctorModal(false);
            fetchDoctors();
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα κατά την αποθήκευση.', 'error');
        } finally {
            setDoctorSaving(false);
        }
    };

    const handleDeactivateDoctor = async (doctorId) => {
        if (!window.confirm('Είστε σίγουροι ότι θέλετε να απενεργοποιήσετε αυτόν τον γιατρό;')) return;
        try {
            await api.delete(`/doctors/${doctorId}`);
            showToast('Ο γιατρός απενεργοποιήθηκε.');
            fetchDoctors();
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα κατά την απενεργοποίηση.', 'error');
        }
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
            await api.post(`/team`, inviteForm);
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
            await api.delete(`/team/${id}`);
            showToast('Μέλος αφαιρέθηκε.');
            fetchTeam();
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα.', 'error');
        }
    };

    const handleChangeRole = async (id, role) => {
        try {
            await api.put(`/team/${id}`, { role });
            showToast('Ρόλος ενημερώθηκε.');
            fetchTeam();
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα.', 'error');
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await api.get('/audit-logs');
            setLogs(res.data);
        } catch (err) {
            console.error('Failed to fetch audit logs:', err);
        }
    };

    const fetchUsage = async () => {
        try {
            const res = await api.get('/clinic/usage');
            setUsageData(res.data);
        } catch (err) {
            console.error('Failed to fetch usage data:', err);
        } finally {
            setLoadingUsage(false);
        }
    };

    const handleStartMfaSetup = async () => {
        try {
            const res = await api.post('/auth/mfa/setup', {});
            setMfaSetup(prev => ({ ...prev, step: 'QR', secret: res.data.secret, qrImageUrl: res.data.qrImageUrl }));
        } catch {
            showToast('Failed to start MFA setup.', 'error');
        }
    };

    const handleVerifyMfa = async () => {
        try {
            await api.post('/auth/mfa/verify', {
                code: mfaSetup.code
            });
            showToast('Το MFA ενεργοποιήθηκε επιτυχώς!');
            setMfaSetup({ step: '', secret: '', qrImageUrl: '', code: '' });
            if (onUpdate) onUpdate({ mfaEnabled: true });
        } catch {
            showToast('Μη έγκυρος κωδικός. Δοκιμάστε ξανά.', 'error');
        }
    };

    const handleDisableMfa = async () => {
        if (!window.confirm('Είστε σίγουροι ότι θέλετε να απενεργοποιήσετε το MFA;')) return;
        const password = window.prompt('Εισάγετε τον κωδικό σας για επιβεβαίωση:');
        if (!password) return;
        try {
            await api.post('/auth/mfa/disable', { password });
            showToast('Το MFA απενεργοποιήθηκε.');
            if (onUpdate) onUpdate({ mfaEnabled: false });
        } catch (err) {
            showToast(err.response?.data?.error || 'Αποτυχία απενεργοποίησης MFA.', 'error');
        }
    };

    const [webhookData, setWebhookData] = React.useState({
        webhookUrl: clinic?.webhookUrl || '',
        webhookMissedCall: clinic?.webhookMissedCall || '',
        webhookAppointment: clinic?.webhookAppointment || '',
        webhookReminders: clinic?.webhookReminders || '',
        webhookDirectSms: clinic?.webhookDirectSms || '',
        webhookInboundSms: clinic?.webhookInboundSms || '',
    });
    const [savingWebhooks, setSavingWebhooks] = React.useState(false);
    const [webhookSaved, setWebhookSaved] = React.useState(false);
    const [testingWebhooks, setTestingWebhooks] = React.useState({});

    const handleTestWebhook = async (field, url) => {
        if (!url) return;
        setTestingWebhooks(prev => ({ ...prev, [field]: 'loading' }));
        try {
            const res = await api.post('/clinic/webhooks/test', { url });
            setTestingWebhooks(prev => ({ ...prev, [field]: res.data.success ? 'connected' : 'failed', [`${field}_latency`]: res.data.latency, [`${field}_error`]: res.data.error }));
        } catch {
            setTestingWebhooks(prev => ({ ...prev, [field]: 'failed' }));
        }
    };

    const handleSaveWebhooks = async () => {
        setSavingWebhooks(true);
        setWebhookSaved(false);
        try {
            await api.put('/clinic/webhooks', webhookData);
            setWebhookSaved(true);
            showToast('Webhooks αποθηκεύτηκαν!', 'success');
            if (onUpdate) onUpdate(webhookData);
            setTimeout(() => setWebhookSaved(false), 2000);
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα αποθήκευσης.', 'error');
        } finally {
            setSavingWebhooks(false);
        }
    };

    // Vapi + Zadarma state
    const [vapiData, setVapiData] = React.useState({
        vapiAssistantId: clinic?.vapiAssistantId || '',
        vapiPhoneNumberId: clinic?.vapiPhoneNumberId || '',
        vapiCredentialId: clinic?.vapiCredentialId || '',
        zadarmaApiKey: '',
        zadarmaApiSecret: '',
        zadarmaPhoneNumber: clinic?.zadarmaPhoneNumber || '',
        voiceEnabled: clinic?.voiceEnabled || false,
    });
    const [savingVapi, setSavingVapi] = React.useState(false);
    const [testingVapi, setTestingVapi] = React.useState(false);
    const [vapiStatus, setVapiStatus] = React.useState(null);

    // Gemini AI Assistant state
    const [geminiData, setGeminiData] = React.useState({
        geminiApiKey: '',
    });
    const [savingGemini, setSavingGemini] = React.useState(false);
    const [geminiStatus, setGeminiStatus] = React.useState(null);

    React.useEffect(() => {
        // Check if Gemini is configured
        api.get('/clinic/gemini-config')
            .then(r => setGeminiStatus(r.data.configured ? 'configured' : 'not_configured'))
            .catch(() => setGeminiStatus('not_configured'));
    }, []);

    const vapiConfigured = !!(vapiData.vapiAssistantId && vapiData.vapiPhoneNumberId);

    // Google Calendar state
    const [gcalStatus, setGcalStatus] = React.useState(null); // null | { connected, calendarId }
    const [gcalLoading, setGcalLoading] = React.useState(false);
    const [resetting, setResetting] = React.useState(false);
    const [sendingTestSms, setSendingTestSms] = React.useState(false);
    const [testSmsPhone, setTestSmsPhone] = React.useState(clinic?.phone || '');

    const handleSendTestSms = async () => {
        if (!testSmsPhone) {
            showToast('Εισάγετε αριθμό τηλεφώνου για το τεστ.', 'error');
            return;
        }
        setSendingTestSms(true);
        try {
            const res = await api.post('/clinic/test-sms', { phone: testSmsPhone });
            if (res.data.success) {
                showToast('Το δοκιμαστικό SMS εστάλη!');
            }
        } catch (err) {
            showToast(err.response?.data?.error || 'Αποτυχία αποστολής δοκιμαστικού SMS.', 'error');
        } finally {
            setSendingTestSms(false);
        }
    };

    const handleResetDefaults = async () => {
        if (!window.confirm('ΠΡΟΣΟΧΗ: Αυτή η ενέργεια θα επαναφέρει όλες τις ρυθμίσεις AI, τις υπηρεσίες και το ωράριο στις αρχικές προεπιλογές. Θέλετε να συνεχίσετε;')) return;
        
        setResetting(true);
        try {
            const res = await api.post('/clinic/reset-defaults');
            if (res.data.success) {
                showToast('Οι ρυθμίσεις επαναφέρθηκαν επιτυχώς!');
                if (onUpdate) onUpdate(res.data.clinic);
                // Force reload local form data
                setFormData(prev => ({
                    ...prev,
                    ...res.data.clinic,
                    aiConfig: typeof res.data.clinic.aiConfig === 'string' ? JSON.parse(res.data.clinic.aiConfig || '{}') : (res.data.clinic.aiConfig || {})
                }));
            }
        } catch (err) {
            showToast('Σφάλμα κατά την επαναφορά.', 'error');
        } finally {
            setResetting(false);
        }
    };

    React.useEffect(() => {
        if (!token) return;

        api.get('/clinic/google-calendar/status')
            .then(r => setGcalStatus(r.data))
            .catch(() => setGcalStatus({ connected: false }));

        // Handle OAuth callback result from URL params
        const params = new URLSearchParams(window.location.search);
        const gcal = params.get('gcal');
        if (gcal === 'connected') {
            showToast('Google Calendar συνδέθηκε επιτυχώς!', 'success');
            setGcalStatus({ connected: true });
            window.history.replaceState({}, '', window.location.pathname);
        } else if (gcal === 'error') {
            const reason = new URLSearchParams(window.location.search).get('reason');
            showToast(`Σφάλμα σύνδεσης: ${reason || 'Άγνωστο σφάλμα'}`, 'error');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [token]);

    const handleConnectGoogleCalendar = async () => {
        setGcalLoading(true);
        try {
            const res = await api.get('/clinic/google-calendar/auth');
            window.location.href = res.data.url;
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα σύνδεσης.', 'error');
            setGcalLoading(false);
        }
    };

    const handleDisconnectGoogleCalendar = async () => {
        if (!window.confirm('Αποσύνδεση Google Calendar;')) return;
        try {
            await api.delete('/clinic/google-calendar/disconnect');
            setGcalStatus({ connected: false });
            showToast('Google Calendar αποσυνδέθηκε.', 'success');
        } catch (err) {
            showToast('Σφάλμα αποσύνδεσης.', 'error');
        }
    };
    const handleSaveGemini = async () => {
        if (!geminiData.geminiApiKey?.trim()) {
            showToast('Το Gemini API Key είναι υποχρεωτικό', 'error');
            return;
        }
        setSavingGemini(true);
        try {
            await api.put('/clinic/gemini', geminiData);
            setGeminiStatus('configured');
            setGeminiData({ geminiApiKey: '' }); // Clear after save
            showToast('Gemini API Key αποθηκεύτηκε!', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα αποθήκευσης.', 'error');
        } finally { setSavingGemini(false); }
    };

    const handleSaveVapi = async () => {
        // Validate required fields
        if (!vapiData.vapiAssistantId?.trim()) {
            showToast('Το Assistant ID είναι υποχρεωτικό', 'error');
            return;
        }
        if (!vapiData.vapiPhoneNumberId?.trim()) {
            showToast('Το Phone Number ID είναι υποχρεωτικό', 'error');
            return;
        }
        setSavingVapi(true);
        setVapiStatus(null);
        try {
            await api.put('/clinic/vapi', vapiData);
            showToast('Voice AI (Vapi + Zadarma) settings αποθηκεύτηκαν!', 'success');
            if (onUpdate) onUpdate({ voiceEnabled: vapiData.voiceEnabled, vapiAssistantId: vapiData.vapiAssistantId });
        } catch (err) {
            showToast(err.response?.data?.error || 'Σφάλμα αποθήκευσης.', 'error');
        } finally { setSavingVapi(false); }
    };

    const handleTestVapi = async () => {
        if (!vapiConfigured) {
            showToast('Συμπληρώστε Assistant ID και Phone Number ID πρώτα', 'error');
            return;
        }
        setTestingVapi(true);
        setVapiStatus(null);
        try {
            const res = await api.get('/system/status');
            setVapiStatus(res.data?.voiceEnabled ? 'connected' : 'not_configured');
            showToast('Voice AI connected!', 'success');
        } catch (err) {
            setVapiStatus('error');
            showToast('Σφάλμα σύνδεσης', 'error');
        } finally { setTestingVapi(false); }
    };

    return (
        <div className="animate-fade" style={{ maxWidth: '860px', paddingBottom: '3rem' }}>

            <header style={{
                marginBottom: '1.75rem',
                padding: '1.75rem 2rem',
                background: 'linear-gradient(135deg, var(--secondary) 0%, var(--text) 100%)',
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
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
                position: 'sticky',
                top: '20px',
zIndex: 30
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
                <FormGroup label="Όνομα Ιατρείου *" htmlFor="clinic-name" flex="1 1 100%">
                    <input
                        id="clinic-name"
                        style={{ ...inputStyle, borderColor: infoErrors.name ? 'var(--urgent)' : undefined }}
                        type="text"
                        value={formData.name || ''}
                        onChange={e => set('name', e.target.value)}
                        placeholder="e.g. Athena Dental"
                    />
                    <ErrorText message={infoErrors.name} />
                </FormGroup>
                <FormRow>
                    <FormGroup label="Τηλέφωνο *" htmlFor="clinic-phone">
                        <input
                            id="clinic-phone"
                            style={{ ...inputStyle, borderColor: infoErrors.phone ? 'var(--urgent)' : undefined }}
                            type="text"
                            value={formData.phone || ''}
                            onChange={e => set('phone', e.target.value)}
                        />
                        <ErrorText message={infoErrors.phone} />
                    </FormGroup>
                    <FormGroup label="Email *" htmlFor="clinic-email">
                        <input
                            id="clinic-email"
                            style={{ ...inputStyle, borderColor: infoErrors.email ? 'var(--urgent)' : undefined }}
                            type="email"
                            value={formData.email || ''}
                            onChange={e => set('email', e.target.value)}
                        />
                        <ErrorText message={infoErrors.email} />
                    </FormGroup>
                </FormRow>
                <FormRow>
                    <FormGroup label="Διεύθυνση" htmlFor="clinic-location" flex="2 1 200px">
                        <input
                            id="clinic-location"
                            style={inputStyle}
                            type="text"
                            value={formData.location || ''}
                            onChange={e => set('location', e.target.value)}
                        />
                    </FormGroup>
                    <FormGroup label="Ζώνη Ώρας" htmlFor="clinic-timezone" flex="1 1 180px">
                        <select
                            id="clinic-timezone"
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
                            <Globe size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                readOnly 
                                style={{ ...inputStyle, paddingLeft: '34px', background: 'var(--card-bg)', color: 'var(--text-light)', cursor: 'default', fontSize: '0.8rem', border: '1px solid rgba(99,102,241,0.2)' }} 
                                value={`${window.location.origin}/book?clinicId=${clinic?.id}`} 
                            />
                        </div>
                        <button 
                            type="button" 
                            title="Αντιγραφή Συνδέσμου"
                            style={{ padding: '0 12px', background: 'var(--card-bg)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                            rel="noopener noreferrer"
                            title="Άνοιγμα Σελίδας"
                            style={{ padding: '0 12px', background: 'var(--card-bg)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <ExternalLink size={16} color="var(--secondary)" />
                        </a>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', fontWeight: '500' }}>
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

            {/* 1.5 · Doctors Management */}
            <SectionCard id="s-doctors" number="1.5" icon={<UserPlus size={15} color="var(--warning)" />} iconBg="var(--warning-light)"
                title="Διαχείριση Γιατρών" subtitle="Γιατροί, ειδικότητες και ωράρια">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                            setDoctorForm({ id: null, name: '', specialty: '', phone: '', email: '', avatarUrl: '', workingHours: '{}' });
                            setShowDoctorModal(true);
                        }}
                    >
                        <UserPlus size={14} /> Προσθήκη Γιατρού
                    </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {doctors.map(doc => (
                        <div key={doc.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', borderRadius: '14px',
                            background: 'var(--bg-subtle)', border: '1px solid var(--border)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {doc.avatarUrl ? (
                                    <img src={doc.avatarUrl} alt={doc.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--warning-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--warning)' }}>{doc.name[0].toUpperCase()}</span>
                                    </div>
                                )}
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text)' }}>
                                        {doc.name}
                                        {!doc.isActive && <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: 'var(--urgent)', fontWeight: '600', padding: '2px 6px', background: 'var(--error-light)', borderRadius: '4px' }}>Ανενεργός</span>}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{doc.specialty || 'Χωρίς ειδικότητα'}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => {
                                    setDoctorForm({ ...doc, workingHours: typeof doc.workingHours === 'string' ? doc.workingHours : JSON.stringify(doc.workingHours, null, 2) });
                                    setShowDoctorModal(true);
                                }} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>Επεξεργασία</button>
                                {doc.isActive && (
                                    <button onClick={() => handleDeactivateDoctor(doc.id)} style={{ padding: '6px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', background: 'var(--error-light)', color: 'var(--urgent)', cursor: 'pointer' }}><Trash2 size={13} /></button>
                                )}
                            </div>
                        </div>
                    ))}
                    {doctors.length === 0 && <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Δεν βρέθηκαν ενεργοί γιατροί.</p>}
                </div>
            </SectionCard>

            {/* 2 · Team Management */}
            <SectionCard id="s2" number="2" icon={<Users size={15} color="var(--ai-blue)" />} iconBg="var(--info-light)"
                title="Διαχείριση Ομάδας" subtitle="Χρήστες, ρόλοι και δικαιώματα πρόσβασης">

                {/* Role legend */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    {[
                        { role: 'OWNER', label: 'Ιδιοκτήτης', color: 'var(--primary-vibrant)', bg: 'rgba(124,58,237,0.08)', desc: 'Πλήρης πρόσβαση' },
                        { role: 'RECEPTIONIST', label: 'Γραμματέας', color: 'var(--ai-blue)', bg: 'rgba(8,145,178,0.08)', desc: 'Ραντεβού & ασθενείς' },
                        { role: 'ASSISTANT', label: 'Βοηθός', color: 'var(--accent)', bg: 'var(--success-light)', desc: 'Μόνο ανάγνωση' },
                    ].map(r => (
                        <div key={r.role} style={{ padding: '6px 12px', borderRadius: '10px', background: r.bg, border: `1px solid ${r.color}22` }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: r.color }}>{r.label}</span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '6px' }}>{r.desc}</span>
                        </div>
                    ))}
                </div>

                {/* Member list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                    {teamMembers.map(member => {
                        const roleColors = { OWNER: 'var(--primary-vibrant)', ADMIN: 'var(--primary-vibrant)', RECEPTIONIST: 'var(--ai-blue)', ASSISTANT: 'var(--accent)' };
                        const roleLabels = { OWNER: 'Ιδιοκτήτης', ADMIN: 'Admin', RECEPTIONIST: 'Γραμματέας', ASSISTANT: 'Βοηθός' };
                        const color = roleColors[member.role] || 'var(--text-muted)';
                        const isSelf = member.id === clinic?.userId;
                        return (
                            <div key={member.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', borderRadius: '14px',
                                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color }}>{(member.name || member.email)[0].toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text)' }}>
                                            {member.name || member.email}
                                            {isSelf && <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>(εσείς)</span>}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{member.email}</div>
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
                                                    cursor: 'pointer', appearance: 'none', outline: '2px solid transparent'
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
                                    <label htmlFor="invite-name" style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Όνομα</label>
                                    <input id="invite-name" style={{ ...inputStyle, padding: '0.5rem 0.75rem' }} placeholder="π.χ. Μαρία" value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} />
                                </div>
                                <div>
                                    <label htmlFor="invite-email" style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Email *</label>
                                    <input id="invite-email" style={{ ...inputStyle, padding: '0.5rem 0.75rem' }} type="email" placeholder="email@example.com" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                                </div>
                                <div>
                                    <label htmlFor="invite-password" style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Κωδικός *</label>
                                    <input id="invite-password" style={{ ...inputStyle, padding: '0.5rem 0.75rem' }} type="password" placeholder="Προσωρινός κωδικός" value={inviteForm.password} onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))} />
                                </div>
                                <div>
                                    <label htmlFor="invite-role" style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-light)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Ρόλος</label>
                                    <select id="invite-role" style={{ ...inputStyle, padding: '0.5rem 0.75rem' }} value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
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
                                            <td key={`perm-${i}`} style={{ textAlign: 'center', padding: '5px 8px' }}>
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

            {/* 4 · Usage & Limits */}
            <SectionCard id="s6" number="4" icon={<BarChart2 size={15} color="var(--primary-deep)" />} iconBg="var(--primary-light)"
                title="Χρήση & Όρια" subtitle="Παρακολούθηση μηνυμάτων και AI σε πραγματικό χρόνο">
                {!usageData ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '8px' }}>
                        <Loader size={16} className="animate-spin" />
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>Φόρτωση δεδομένων χρήσης...</span>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', padding: '0.5rem 0' }}>
                        {/* Monthly Credits */}
                        <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Πιστώσεις Μηνυμάτων</span>
                                <span style={{ fontSize: '0.85rem' }}>{usageData.creditsRemaining} / {usageData.monthlyLimit}</span>
                            </div>
                            <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, (usageData.creditsRemaining / (usageData.monthlyLimit || 1)) * 100)}%`,
                                    background: 'linear-gradient(90deg, var(--primary-deep), var(--primary))',
                                    borderRadius: '4px'
                                }} />
                            </div>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '8px' }}>Ανανεώνεται κάθε μήνα. Διαθέσιμο για SMS/WhatsApp.</p>
                        </div>

                        {/* Daily Usage */}
                        <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Σημερινή Χρήση</span>
                                <span style={{ fontSize: '0.85rem' }}>{usageData.dailyUsed} / {usageData.dailyLimit}</span>
                            </div>
                            <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, (usageData.dailyUsed / (usageData.dailyLimit || 1)) * 100)}%`,
                                    background: usageData.dailyUsed > usageData.dailyLimit * 0.9 ? 'var(--urgent)' : 'var(--accent)',
                                    borderRadius: '4px'
                                }} />
                            </div>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '8px' }}>Ημερήσιο όριο ασφαλείας για αποστολές μηνυμάτων.</p>
                        </div>

                        {/* AI Requests */}
                        <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Αιτήματα AI Σήμερα</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary-deep)' }}>{usageData.aiRequestsToday}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${Math.min(100, (usageData.aiRequestsToday / 100) * 100)}%`,
                                        background: 'var(--primary-vibrant)',
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
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Αναβαθμίστε το πακέτο σας ή αγοράστε πακέτα SMS για να συνεχίσετε την αυτοματοποίηση.</p>
                    </div>
                    <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={openUpgradeModal}>
                        Αναβάθμιση Τώρα
                    </button>
                </div>
            </SectionCard>



            {/* Voice AI — Vapi */}
            <SectionCard id="s-voice" number="5" icon={<Phone size={15} color="var(--primary-vibrant)" />} iconBg="rgba(124,58,237,0.1)"
                title="Voice AI" subtitle="AI φωνητική ανάκτηση κλήσεων">

                <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--primary-deep)', fontWeight: '600', margin: 0 }}>
                        Vapi + Zadarma: Χρησιμοποιεί τον αριθμό σας από το Zadarma για ελληνικό caller ID.
                    </p>
                </div>

                {/* Status indicator */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderRadius: '12px', background: vapiConfigured ? 'var(--success-light)' : 'var(--warning-light)', border: `1px solid ${vapiConfigured ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: vapiConfigured ? 'var(--accent)' : 'var(--warning)' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: '800', color: vapiConfigured ? 'var(--accent)' : 'var(--warning)' }}>
                            {vapiConfigured ? 'Ρυθμισμένο ✓' : 'Δεν έχει ρυθμιστεί'}
                        </span>
                    </div>
                    <button type="button" onClick={handleTestVapi} disabled={testingVapi || !vapiConfigured} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: vapiConfigured ? 'var(--primary)' : 'var(--border)', color: vapiConfigured ? 'white' : 'var(--text-light)', fontWeight: '700', fontSize: '0.75rem', cursor: vapiConfigured ? 'pointer' : 'not-allowed' }}>
                        {testingVapi ? 'Ελέγχω...' : 'Δοκιμή'}
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderRadius: '12px', background: vapiData.voiceEnabled ? 'var(--success-light)' : 'var(--bg-subtle)', border: '1px solid var(--border)', marginBottom: '1rem' }}>
                    <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary)' }}>Φωνητική Ανάκτηση</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '2px' }}>AI κλήσεις για αναπάντητες</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setVapiData(d => ({ ...d, voiceEnabled: !d.voiceEnabled }))}
                        style={{ padding: '6px 16px', borderRadius: '99px', border: 'none', background: vapiData.voiceEnabled ? 'var(--accent)' : 'var(--border)', color: vapiData.voiceEnabled ? 'white' : 'var(--text-light)', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                        {vapiData.voiceEnabled ? 'ΕΝΕΡΓΟ' : 'ΑΝΕΝΕΡΓΟ'}
                    </button>
                </div>

                <FormGroup label="Assistant ID *" flex="1 1 100%">
                    <input style={inputStyle} type="text" placeholder="assistant_xxxxx" value={vapiData.vapiAssistantId} onChange={e => setVapiData(d => ({ ...d, vapiAssistantId: e.target.value }))} />
                </FormGroup>
                
                <FormRow>
                    <FormGroup label="Phone Number ID (Vapi) *">
                        <input style={inputStyle} type="text" placeholder="phone_xxxxx" value={vapiData.vapiPhoneNumberId} onChange={e => setVapiData(d => ({ ...d, vapiPhoneNumberId: e.target.value }))} />
                    </FormGroup>
                    <FormGroup label="Zadarma Phone Number">
                        <input style={inputStyle} type="text" placeholder="+30..." value={vapiData.zadarmaPhoneNumber} onChange={e => setVapiData(d => ({ ...d, zadarmaPhoneNumber: e.target.value }))} />
                    </FormGroup>
                </FormRow>

                <FormRow>
                    <FormGroup label="Zadarma API Key">
                        <input style={inputStyle} type="password" placeholder="zadarma api key" value={vapiData.zadarmaApiKey} onChange={e => setVapiData(d => ({ ...d, zadarmaApiKey: e.target.value }))} />
                    </FormGroup>
                    <FormGroup label="Zadarma API Secret">
                        <input style={inputStyle} type="password" placeholder="zadarma api secret" value={vapiData.zadarmaApiSecret} onChange={e => setVapiData(d => ({ ...d, zadarmaApiSecret: e.target.value }))} />
                    </FormGroup>
                </FormRow>
                        <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.1)', marginBottom: '0.75rem' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary-deep)', margin: '0 0 4px' }}>Ελληνικοί Αριθμοί</p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', margin: 0 }}>
                                Αγοράστε αριθμό από Zadarma και συνδέστε τον στο Vapi ως SIP trunk. Ο αριθμός θα εμφανίζεται τοπικά στον ασθενή.
                            </p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
<button type="button" className="btn btn-primary" onClick={handleSaveVapi} disabled={savingVapi}>
                        {savingVapi ? 'Αποθήκευση...' : 'Αποθήκευση Voice AI'}
                    </button>
                </div>
            </SectionCard>

            {/* 5.5 · Gemini AI Assistant */}
            <SectionCard id="s-gemini" number="5.5" icon={<Sparkles size={15} color="var(--primary-deep)" />} iconBg="rgba(99,102,241,0.1)"
                title="AI Assistant (Σοφία)" subtitle="Gemini AI για φυσική γλώσσα εντολών">

                <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--primary-deep)', fontWeight: '600', margin: 0 }}>
                        Η Σοφία είναι ο AI βοηθός που εμφανίζεται στο dashboard. Χρησιμοποιεί το Gemini για να καταλαβαίνει εντολές σε φυσική γλώσσα.
                    </p>
                </div>

                {/* Status indicator */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderRadius: '12px', background: geminiStatus === 'configured' ? 'var(--success-light)' : 'var(--warning-light)', border: `1px solid ${geminiStatus === 'configured' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: geminiStatus === 'configured' ? 'var(--accent)' : 'var(--warning)' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: '800', color: geminiStatus === 'configured' ? 'var(--accent)' : 'var(--warning)' }}>
                            {geminiStatus === 'configured' ? 'Ρυθμισμένο ✓' : 'Δεν έχει ρυθμιστεί'}
                        </span>
                    </div>
                </div>

                <FormGroup label="Gemini API Key *" flex="1 1 100%">
                    <input 
                        style={inputStyle} 
                        type="password" 
                        placeholder={geminiStatus === 'configured' ? '***configured***' : 'AIzaSy...'} 
                        value={geminiData.geminiApiKey} 
                        onChange={e => setGeminiData(d => ({ ...d, geminiApiKey: e.target.value }))} 
                    />
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: '4px' }}>
                        Πάρτε το API key από: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: '700' }}>Google AI Studio</a>
                    </p>
                </FormGroup>

                <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)', marginBottom: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary-deep)', margin: '0 0 4px' }}>Τι μπορεί να κάνει η Σοφία;</p>
                    <ul style={{ fontSize: '0.72rem', color: 'var(--text-light)', margin: '4px 0 0', paddingLeft: '1.2rem' }}>
                        <li>Αποστολή SMS σε ασθενείς</li>
                        <li>Κλήσεις ασθενών με AI</li>
                        <li>Κλείσιμο & ακύρωση ραντεβού</li>
                        <li>Προβολή σημερινών ραντεβού</li>
                        <li>Προβολή αναπάντητων κλήσεων</li>
                    </ul>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-primary" onClick={handleSaveGemini} disabled={savingGemini}>
                        {savingGemini ? 'Αποθήκευση...' : 'Αποθήκευση Gemini AI'}
                    </button>
                </div>
            </SectionCard>

            {/* 6 · Webhooks */}
            <SectionCard id="s7" number="6" icon={<Zap size={15} color="#f59e0b" />} iconBg="#fffbeb"
                title="Webhooks & Αυτοματισμοί" subtitle="Σύνδεση με n8n workflows για SMS και ειδοποιήσεις">

                <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '0.5rem' }}>
                    <p style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: '600', margin: 0 }}>
                        Ορίστε τα URLs των n8n webhooks. Το Global URL χρησιμοποιείται ως fallback αν δεν οριστεί ειδικό.
                    </p>
                </div>


                <div style={{ padding: '1rem', borderRadius: '14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#065f46' }}>
                            Twilio SMS — Αυτόματη αποστολή
                        </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#065f46', margin: 0, lineHeight: 1.5 }}>
                        Τα SMS αποστέλλονται αυτόματα μέσω Twilio μετά από αναπάντητες κλήσεις. 
                        Η ρύθμιση γίνεται κεντρικά μέσω των μεταβλητών περιβάλλοντος 
                        (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER).
                    </p>
                </div>

                {[
                    { key: 'webhookMissedCall',   label: 'Workflow 3 — Missed Call Recovery',         hint: 'https://clinicflows.app.n8n.cloud/webhook/missed-call' },
                    { key: 'webhookAppointment',  label: 'Workflow 1 — Appointment Confirmation SMS',  hint: 'https://clinicflows.app.n8n.cloud/webhook/appointment-created' },
                    { key: 'webhookReminders',    label: 'Workflow 2 — Direct SMS (Notifications)',    hint: 'https://clinicflows.app.n8n.cloud/webhook/send-sms' },
                    { key: 'webhookDirectSms',    label: 'Workflow 2 — Direct SMS (Manual)',           hint: 'https://clinicflows.app.n8n.cloud/webhook/send-sms' },
                    { key: 'webhookInboundSms',   label: 'Workflow 5 — Inbound SMS Reply',             hint: 'https://clinicflows.app.n8n.cloud/webhook/inbound-sms' },
                    { key: 'webhookUrl',          label: 'Global Fallback Webhook URL',                hint: 'Χρησιμοποιείται αν δεν οριστεί ειδικό webhook' },
                ].map(({ key, label, hint }) => (
                    <FormGroup key={key} label={label} flex="1 1 100%">
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                style={inputStyle}
                                type="url"
                                value={webhookData[key] || ''}
                                onChange={e => setWebhookData(d => ({ ...d, [key]: e.target.value }))}
                                placeholder={hint}
                            />
                            <button 
                                type="button" 
                                className="btn btn-outline" 
                                style={{ flexShrink: 0, padding: '0 12px' }}
                                disabled={!webhookData[key] || testingWebhooks[key] === 'loading'}
                                onClick={() => handleTestWebhook(key, webhookData[key])}
                            >
                                {testingWebhooks[key] === 'loading' ? <Loader size={14} className="animate-spin" /> : 'Test'}
                            </button>
                        </div>
                        {testingWebhooks[key] && testingWebhooks[key] !== 'loading' && (
                            <div style={{ marginTop: '4px' }}>
                                <StatusBadge 
                                    status={testingWebhooks[key]} 
                                    latency={testingWebhooks[`${key}_latency`]} 
                                    error={testingWebhooks[`${key}_error`]} 
                                />
                            </div>
                        )}
                    </FormGroup>
                ))}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="button" className="btn btn-primary" onClick={handleSaveWebhooks} disabled={savingWebhooks}>
                        {savingWebhooks ? 'Αποθήκευση...' : 'Αποθήκευση Webhooks'}
                        {webhookSaved && <Check size={14} />}
                    </button>
                </div>

                <div style={{ 
                    marginTop: '2rem', padding: '1.5rem', borderRadius: '16px', 
                    background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)'
                }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={16} className="text-primary" /> Δοκιμή Αποστολής SMS
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                        Βεβαιωθείτε ότι τα webhooks και το Twilio λειτουργούν σωστά στέλνοντας ένα δοκιμαστικό SMS.
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                            style={{ ...inputStyle, flex: 1 }} 
                            placeholder="Αριθμός τηλεφώνου (π.χ. 6912345678)"
                            value={testSmsPhone}
                            onChange={e => setTestSmsPhone(e.target.value)}
                        />
                        <button 
                            type="button" 
                            className="btn btn-outline" 
                            disabled={sendingTestSms}
                            onClick={handleSendTestSms}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {sendingTestSms ? <Loader size={14} className="animate-spin" /> : 'Αποστολή Τεστ'}
                        </button>
                    </div>
                </div>
            </SectionCard>

            {/* 7 · Google Calendar */}
            <SectionCard id="s-gcal" number="7" icon={<Calendar size={15} color="var(--accent)" />} iconBg="var(--success-light)"
                title="Google Calendar" subtitle="Αυτόματος συγχρονισμός ραντεβού με Google Calendar">

                <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'var(--success-light)', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: '600', margin: 0 }}>
                        Κάθε νέο ραντεβού εμφανίζεται αυτόματα στο Google Calendar σας. Ακυρώσεις αφαιρούνται αυτόματα.
                    </p>
                </div>

                {gcalStatus === null ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-light)' }}>Φόρτωση...</div>
                ) : gcalStatus.connected ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderRadius: '12px', background: 'var(--success-light)', border: '1px solid rgba(16,185,129,0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--accent)' }}>Συνδεδεμένο</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Τα ραντεβού συγχρονίζονται αυτόματα</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleDisconnectGoogleCalendar}
                            style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', background: 'var(--error-light)', color: 'var(--urgent)', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                        >
                            Αποσύνδεση
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '1rem', borderRadius: '12px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: '600' }}>Μη συνδεδεμένο</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleConnectGoogleCalendar}
                            disabled={gcalLoading}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                        >
                            <Calendar size={16} />
                            {gcalLoading ? 'Ανακατεύθυνση...' : 'Σύνδεση με Google Calendar'}
                        </button>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', margin: 0 }}>
                            Θα ανακατευθυνθείτε στο Google για να δώσετε άδεια πρόσβασης στο ημερολόγιό σας.
                        </p>
                    </div>
                )}
            </SectionCard>

            {/* 8 · Audit */}
            <SectionCard id="s8" number="8" icon={<Activity size={15} color="var(--text-muted)" />} iconBg="var(--bg-subtle)"
                title="Αρχείο Ενεργειών" subtitle="Ιστορικό διοικητικών ενεργειών">
                {logs.length === 0 ? <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Δεν βρέθηκε δραστηριότητα.</p> : (
                    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead style={{ background: 'var(--bg-subtle)' }}>
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
            
            {/* 9 · Danger Zone */}
            <SectionCard id="s-danger" number="9" icon={<Trash2 size={15} color="var(--urgent)" />} iconBg="var(--error-light)"
                title="Επικίνδυνη Ζώνη" subtitle="Επαναφορά και διαγραφή">
                <div style={{
                    padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(239,68,68,0.2)', background: 'var(--error-light)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--urgent)' }}>Επαναφορά στις Προεπιλογές</span>
                            <p style={{ fontSize: '0.8rem', color: 'var(--urgent)', margin: '4px 0 0', opacity: 0.8 }}>
                                Επαναφέρετε όλες τις ρυθμίσεις AI, τις υπηρεσίες και το ωράριο στις αρχικές εργοστασιακές ρυθμίσεις.
                            </p>
                        </div>
                        <button 
                            type="button" 
                            className="btn btn-outline" 
                            disabled={resetting}
                            onClick={handleResetDefaults}
                            style={{ borderColor: 'rgba(239,68,68,0.3)', color: 'var(--urgent)', background: 'var(--card-bg)' }}
                        >
                            {resetting ? <Loader size={14} className="animate-spin" /> : 'Επαναφορά Όλων'}
                        </button>
                    </div>
                </div>
            </SectionCard>

            {/* MFA Modal */}
            {mfaSetup.step === 'QR' && (
                <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 51 }}>
                    <div style={{ background: 'var(--card-bg)', padding: '2.5rem', borderRadius: '24px', width: '350px', boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 1rem', fontWeight: '900' }}>Ρύθμιση MFA</h3>
                        <img src={mfaSetup.qrImageUrl} style={{ width: '180px', borderRadius: '12px', margin: '1rem 0' }} alt="QR" />
                        <input style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.4em' }} maxLength="6" placeholder="000000" value={mfaSetup.code} onChange={e => setMfaSetup(prev => ({ ...prev, code: e.target.value }))} />
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
                    backgroundColor: toast.type === 'success' ? 'var(--accent)' : 'var(--urgent)',
                    color: 'white', fontWeight: '700', fontSize: '0.95rem',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 45, animation: 'slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    {toast.type === 'success' ? <Check size={18} /> : <Activity size={18} />}
                    {toast.message}
                </div>
            )}

            {showDoctorModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 52 }}>
                    <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem' }}>{doctorForm.id ? 'Επεξεργασία Γιατρού' : 'Προσθήκη Γιατρού'}</h3>
                        <form onSubmit={handleSaveDoctor}>
                            <FormGroup label="Όνομα *">
                                <input style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'var(--bg-subtle)', color: 'var(--text)' }} value={doctorForm.name} onChange={e => setDoctorForm(prev => ({...prev, name: e.target.value}))} required />
                            </FormGroup>
                            <FormGroup label="Ειδικότητα">
                                <input style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'var(--bg-subtle)', color: 'var(--text)' }} value={doctorForm.specialty || ''} onChange={e => setDoctorForm(prev => ({...prev, specialty: e.target.value}))} />
                            </FormGroup>
                            <FormRow>
                                <FormGroup label="Τηλέφωνο">
                                    <input style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'var(--bg-subtle)', color: 'var(--text)' }} value={doctorForm.phone || ''} onChange={e => setDoctorForm(prev => ({...prev, phone: e.target.value}))} />
                                </FormGroup>
                                <FormGroup label="Email">
                                    <input type="email" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'var(--bg-subtle)', color: 'var(--text)' }} value={doctorForm.email || ''} onChange={e => setDoctorForm(prev => ({...prev, email: e.target.value}))} />
                                </FormGroup>
                            </FormRow>
                            <FormGroup label="Avatar URL">
                                <input style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.875rem', background: 'var(--bg-subtle)', color: 'var(--text)' }} value={doctorForm.avatarUrl || ''} onChange={e => setDoctorForm(prev => ({...prev, avatarUrl: e.target.value}))} placeholder="https://..." />
                            </FormGroup>
                            <FormGroup label="Ωράριο (JSON)">
                                <textarea style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', minHeight: '120px', fontFamily: 'monospace', fontSize: '0.8rem', background: 'var(--bg-subtle)', color: 'var(--text)'}} value={doctorForm.workingHours || '{}'} onChange={e => setDoctorForm(prev => ({...prev, workingHours: e.target.value}))} />
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>JSON μορφή (π.χ. {"{"} "weekdays": "09:00 - 17:00" {"}"})</p>
                            </FormGroup>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" onClick={() => setShowDoctorModal(false)} style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontWeight: '600' }}>Ακύρωση</button>
                                <button type="submit" disabled={doctorSaving} className="btn btn-primary">{doctorSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showUpgradeModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 52 }} onClick={() => setShowUpgradeModal(false)}>
                    <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '20px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-2xl)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800' }}>Αναβάθμιση Πακέτου</h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Τρέχον πακέτο: <strong>{planLabel(currentPlan)}</strong></p>
                            </div>
                            <button onClick={() => setShowUpgradeModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px' }}>×</button>
                        </div>

                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem', textAlign: 'center' }}>Η τιμολόγηση βασίζεται στον αριθμό γιατρών του ιατρείου σας.</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                            {upgradePlans.map(plan => {
                                const isTeam = plan.key === 'team';
                                const isMulti = plan.key === 'multi';
                                const isEnterprise = plan.key === 'enterprise';
                                const cardBg = isEnterprise ? 'linear-gradient(135deg, #1e1b4b, #312e81)' : isMulti ? 'linear-gradient(135deg, #1e3a5f, #2563eb)' : isTeam ? 'linear-gradient(135deg, #0f766e, #0d9488)' : 'linear-gradient(135deg, #f8fafc, #f1f5f9)';
                                const textColor = (isEnterprise || isMulti || isTeam) ? 'white' : '#0f172a';
                                const borderColor = isEnterprise ? '#8b5cf6' : isMulti ? '#3b82f6' : isTeam ? '#14b8a6' : '#e2e8f0';
                                const btnBg = isEnterprise ? '#8b5cf6' : isMulti ? '#3b82f6' : isTeam ? '#0d9488' : '#0f172a';
                                const badge = isTeam ? 'Δημοφιλές' : isMulti ? 'Professional' : isEnterprise ? 'Premium' : null;
                                const badgeColor = isTeam ? '#f59e0b' : isMulti ? '#3b82f6' : isEnterprise ? '#8b5cf6' : null;

                                return (
                                    <div key={plan.key} style={{
                                        background: cardBg, borderRadius: '16px', padding: '1.5rem',
                                        border: `2px solid ${borderColor}`, position: 'relative',
                                        display: 'flex', flexDirection: 'column'
                                    }}>
                                        {badge && (
                                            <div style={{
                                                position: 'absolute', top: '-10px', right: '12px',
                                                background: badgeColor, color: 'white', fontSize: '0.65rem',
                                                fontWeight: '800', padding: '3px 10px', borderRadius: '20px',
                                                textTransform: 'uppercase', letterSpacing: '0.05em'
                                            }}>{badge}</div>
                                        )}

                                        <h4 style={{ margin: '0 0 2px', fontSize: '1.1rem', fontWeight: '800', color: textColor }}>{plan.nameEl || plan.name}</h4>
                                        <div style={{ fontSize: '0.75rem', color: textColor, opacity: 0.8, marginBottom: '8px', fontWeight: '600' }}>
                                            {plan.doctorRange}
                                        </div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: '900', color: textColor, marginBottom: '1rem' }}>
                                            {plan.price}<span style={{ fontSize: '0.85rem', fontWeight: '600', opacity: 0.8 }}>{plan.priceNote}</span>
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.8rem', color: textColor, opacity: 0.9, marginBottom: '6px', fontWeight: '600' }}>
                                                📨 {plan.smsMonthlyLimit >= 99999 ? 'Απεριόριστα' : plan.smsMonthlyLimit.toLocaleString()} SMS/μήνα
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: textColor, opacity: 0.9, marginBottom: '6px', fontWeight: '600' }}>
                                                🤖 {plan.aiMonthlyLimit >= 99999 ? 'Απεριόριστα' : plan.aiMonthlyLimit.toLocaleString()} AI requests/μήνα
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: textColor, opacity: 0.9, marginBottom: '1rem', fontWeight: '600' }}>
                                                📅 {plan.dailyMessageCap >= 9999 ? 'Απεριόριστο' : plan.dailyMessageCap.toLocaleString()} ημερήσιο όριο
                                            </div>
                                            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '0.75rem', color: textColor, opacity: 0.85 }}>
                                                {plan.features.map((f, i) => <li key={`feat-${plan.key}-${i}`} style={{ marginBottom: '4px' }}>{f}</li>)}
                                            </ul>
                                        </div>

                                        <button
                                            onClick={() => handleUpgrade(plan.key)}
                                            disabled={upgrading}
                                            style={{
                                                marginTop: '1.25rem', padding: '0.7rem', borderRadius: '12px',
                                                border: 'none', background: btnBg, color: 'white',
                                                fontWeight: '700', fontSize: '0.85rem', cursor: upgrading ? 'not-allowed' : 'pointer',
                                                opacity: upgrading ? 0.7 : 1, transition: 'all 0.2s'
                                            }}
                                        >
                                            {upgrading ? 'Επεξεργασία...' : 'Επιλογή'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {upgradePlans.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                <p style={{ fontSize: '1rem', fontWeight: '600' }}>Είστε ήδη στο μέγιστο πακέτο!</p>
                                <p style={{ fontSize: '0.85rem' }}>Επικοινωνήστε μαζί μας για custom λύση.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClinicSettings;
