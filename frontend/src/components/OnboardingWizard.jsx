import React, { useState } from 'react';
import { API_BASE } from '../lib/constants';
import api from '../lib/api';
import {
    Building2, Phone, Zap, CheckCircle2, ArrowRight,
    ArrowLeft, X, Loader, Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';


const STEPS = [
    { key: 'welcome',  title: 'Καλώς ήρθατε!',           subtitle: 'Ας ρυθμίσουμε το ιατρείο σας σε 4 βήματα' },
    { key: 'info',     title: 'Στοιχεία Ιατρείου',        subtitle: 'Βασικές πληροφορίες για το ιατρείο σας' },
    { key: 'ai',       title: 'Ρυθμίσεις AI',             subtitle: 'Υπηρεσίες, ωράριο και SMS πρότυπα για τη Σοφία' },
    { key: 'voice',    title: 'Voice AI',          subtitle: 'Αυτόματη επανάκληση αναπάντητων κλήσεων' },
    { key: 'webhooks', title: 'Webhooks & SMS',            subtitle: 'Σύνδεση με n8n για αποστολή SMS' },
    { key: 'done',     title: 'Έτοιμοι! 🎉',              subtitle: 'Το ιατρείο σας είναι έτοιμο' },
];


const labelStyle = {
    display: 'block', marginBottom: '6px', fontSize: '0.75rem',
    fontWeight: '700', color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
};

const OnboardingWizard = ({ clinic, token, onComplete, onUpdate }) => {
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showKey, setShowKey] = useState(false);

    // Step 1 — clinic info
    const [info, setInfo] = useState({
        name: clinic?.name || '',
        phone: clinic?.phone || '',
        email: clinic?.email || '',
        location: clinic?.location || '',
    });

    // Step 2 — AI config
    const [aiConfig, setAiConfig] = useState({
        services: '',
        avgAppointmentValue: 80,
        tone: 'Friendly',
        workingHours: { 'Δευτέρα': '09:00-17:00', 'Τρίτη': '09:00-17:00', 'Τετάρτη': '09:00-17:00', 'Πέμπτη': '09:00-17:00', 'Παρασκευή': '09:00-17:00', 'Σάββατο': 'Closed', 'Κυριακή': 'Closed' },
        smsInitial: '',
        languages: ['Ελληνικά'],
    });

    // Step 3 — Voice AI (Vapi)
    const [voiceData, setVoiceData] = useState({
        vapiApiKey: '',
        vapiAssistantId: '',
        vapiPhoneNumberId: '',
        voiceEnabled: true,
    });

    const [webhooks, setWebhooks] = useState({
        webhookMissedCall: clinic?.webhookUrl || '',
        webhookDirectSms: clinic?.directSmsUrl || '', // Assuming these exist or just keep as placeholders
    });

    const [registrationSecret] = useState(clinic?.webhookSecret || '');

    const isLast = step === STEPS.length - 1;
    const current = STEPS[step];

const saveInfo = async () => {
         if (!info.name?.trim() || !info.phone?.trim() || !info.email?.trim()) {
             setError('Όνομα, email και τηλέφωνο είναι υποχρεωτικά.');
             return false;
         }
         try {
             await api.put('/clinic/settings', info);
             if (onUpdate) onUpdate(info);
             toast.success('Οι πληροφορίες αποθηκεύτηκαν');
             return true;
         } catch (err) {
             const msg = err.response?.data?.error || err.response?.data?.message || 'Σφάλμα αποθήκευσης.';
             setError(msg);
             return false;
         }
     };

    const saveAiConfig = async () => {
        try {
            await api.put('/clinic/ai-config', aiConfig);
            if (onUpdate) onUpdate({ aiConfig: JSON.stringify(aiConfig) });
            return true;
        } catch (err) {
            setError(err.response?.data?.error || 'Σφάλμα αποθήκευσης AI config.');
            return false;
        }
    };

    const saveVoice = async () => {
        // Voice is optional — skip if no key provided
        const hasVapi = voiceData.vapiApiKey || voiceData.vapiAssistantId;
        if (!hasVapi) return true;
        
        // Validate required fields
        if (!voiceData.vapiAssistantId?.trim()) {
            setError('Το Assistant ID είναι υποχρεωτικό');
            return false;
        }
        if (!voiceData.vapiPhoneNumberId?.trim()) {
            setError('Το Phone Number ID είναι υποχρεωτικό');
            return false;
        }

        try {
            await api.put('/clinic/vapi', voiceData);
            if (onUpdate) onUpdate({ voiceEnabled: voiceData.voiceEnabled });
            return true;
        } catch (err) {
            setError(err.response?.data?.error || 'Σφάλμα αποθήκευσης Voice AI.');
            return false;
        }
    };

    const saveWebhooks = async () => {
        // Webhooks are optional — skip if empty
        if (!webhooks.webhookMissedCall && !webhooks.webhookDirectSms) return true;
        try {
            await api.put('/clinic/webhooks', webhooks);
            if (onUpdate) onUpdate(webhooks);
            return true;
        } catch (err) {
            setError(err.response?.data?.error || 'Σφάλμα αποθήκευσης webhooks.');
            return false;
        }
    };

    const handleNext = async () => {
        setError('');
        setSaving(true);
        let ok = true;

        if (current.key === 'info') ok = await saveInfo();
        if (current.key === 'ai') ok = await saveAiConfig();
        if (current.key === 'voice') ok = await saveVoice();
        if (current.key === 'webhooks') ok = await saveWebhooks();

        setSaving(false);
        if (ok) setStep(s => s + 1);
    };

    const handleSkip = () => {
        setError('');
        setStep(s => s + 1);
    };

    const handleFinish = async () => {
        setSaving(true);
        try {
            await api.post('/clinic/onboarding-complete');
            localStorage.setItem('onboarding_complete:v1', 'true');
            if (onUpdate) onUpdate({ onboardingCompleted: true });
            onComplete();
        } catch (err) {
            setError(err.response?.data?.error || 'Σφάλμα ολοκλήρωσης onboarding.');
        } finally {
            setSaving(false);
        }
    };

    const skippable = ['ai', 'voice', 'webhooks'].includes(current.key);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 52,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
            overflowY: 'auto'
        }}>
            <style>{`
                .wizard-container {
                    width: 100%;
                    max-width: 520px;
                    position: relative;
                    z-index: 1;
                    background: rgba(255,255,255,0.05);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border-radius: 28px;
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 2.5rem;
                    box-shadow: 0 32px 64px rgba(0,0,0,0.4);
                    margin: auto;
                }
                @media (max-width: 640px) {
                    .wizard-container {
                        padding: 1.5rem;
                        border-radius: 20px;
                    }
                    .wizard-title {
                        font-size: 1.4rem !important;
                    }
                    .wizard-step-content {
                        gap: 0.75rem !important;
                    }
                }
            `}</style>
            {/* Background glows */}
            <div style={{ position: 'absolute', top: '-150px', left: '-150px', width: '500px', height: '500px', background: 'rgba(99,102,241,0.12)', filter: 'blur(10px)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-150px', right: '-150px', width: '400px', height: '400px', background: 'rgba(16,185,129,0.08)', filter: 'blur(10px)', borderRadius: '50%', pointerEvents: 'none' }} />

            <div className="wizard-container">
                {/* Progress dots */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '2rem', justifyContent: 'center' }}>
                    {STEPS.map((s, i) => (
                        <div key={s.key} style={{
                            height: '4px', borderRadius: '2px', transition: 'all 0.3s',
                            width: i === step ? '24px' : '8px',
                            background: i <= step ? 'var(--primary)' : 'rgba(255,255,255,0.15)',
                        }} />
                    ))}
                </div>

                {/* Step content */}
                {current.key === 'welcome' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '72px', height: '72px', background: 'rgba(99,102,241,0.2)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <Building2 size={36} color="#6366f1" />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', marginBottom: '0.75rem', letterSpacing: '-0.5px' }}>
                            Καλώς ήρθατε στο ClinicFlow!
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '2rem', fontSize: '0.95rem' }}>
                            Θα σας βοηθήσουμε να ρυθμίσετε το ιατρείο σας σε λίγα λεπτά. Μπορείτε να παραλείψετε οποιοδήποτε βήμα και να το ολοκληρώσετε αργότερα από τις Ρυθμίσεις.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
                            {[['1', 'Στοιχεία Ιατρείου'], ['2', 'Ρυθμίσεις AI'], ['3', 'Voice AI'], ['4', 'Webhooks SMS']].map(([n, l]) => (
                                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '900', color: 'white', flexShrink: 0 }}>{n}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>{l}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {current.key === 'info' && (
                    <div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white', marginBottom: '4px' }}>{current.title}</h2>
                            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>{current.subtitle}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label htmlFor="wizard-clinic-name" style={labelStyle}>Όνομα Ιατρείου *</label>
                                <input id="wizard-clinic-name" className="input-glass" value={info.name} onChange={e => setInfo(p => ({ ...p, name: e.target.value }))} placeholder="π.χ. Οδοντιατρείο Παπαδόπουλος" />
                            </div>
                            <div>
                                <label htmlFor="wizard-email" style={labelStyle}>Email *</label>
                                <input id="wizard-email" className="input-glass" type="email" value={info.email} onChange={e => setInfo(p => ({ ...p, email: e.target.value }))} placeholder="info@clinic.gr" />
                            </div>
                            <div>
                                <label htmlFor="wizard-phone" style={labelStyle}>Τηλέφωνο *</label>
                                <input id="wizard-phone" className="input-glass" value={info.phone} onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))} placeholder="6912345678" />
                            </div>
                            <div>
                                <label htmlFor="wizard-location" style={labelStyle}>Διεύθυνση</label>
                                <input id="wizard-location" className="input-glass" value={info.location} onChange={e => setInfo(p => ({ ...p, location: e.target.value }))} placeholder="Αθήνα, Ελλάδα" />
                            </div>
                        </div>
                    </div>
                )}

                {current.key === 'ai' && (
                    <div>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white', marginBottom: '4px' }}>{current.title}</h2>
                            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>{current.subtitle}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label htmlFor="wizard-services" style={labelStyle}>Υπηρεσίες Ιατρείου</label>
                                <textarea
                                    id="wizard-services"
                                    className="input-glass"
                                    style={{ minHeight: '80px', resize: 'vertical' }}
                                    value={aiConfig.services}
                                    onChange={e => setAiConfig(p => ({ ...p, services: e.target.value }))}
                                    placeholder={'Οδοντιατρική, Λεύκανση, Εμφυτεύματα...'}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label htmlFor="wizard-appt-value" style={labelStyle}>Μέση Αξία Ραντεβού (€)</label>
                                    <input id="wizard-appt-value" className="input-glass" type="number" value={aiConfig.avgAppointmentValue}
                                        onChange={e => setAiConfig(p => ({ ...p, avgAppointmentValue: parseFloat(e.target.value) || 80 }))} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label htmlFor="wizard-tone" style={labelStyle}>Ύφος AI</label>
                                    <select id="wizard-tone" className="input-glass" style={{ cursor: 'pointer' }} value={aiConfig.tone}
                                        onChange={e => setAiConfig(p => ({ ...p, tone: e.target.value }))}>
                                        <option value="Friendly">Φιλικό</option>
                                        <option value="Professional">Επαγγελματικό</option>
                                        <option value="Formal">Τυπικό</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="wizard-working-hours" style={labelStyle}>Ωράριο (Καθημερινές)</label>
                                <input id="wizard-working-hours" className="input-glass" value={aiConfig.workingHours['Δευτέρα'] || ''}
                                    onChange={e => setAiConfig(p => ({
                                        ...p, workingHours: {
                                            ...p.workingHours,
                                            'Δευτέρα': e.target.value, 'Τρίτη': e.target.value,
                                            'Τετάρτη': e.target.value, 'Πέμπτη': e.target.value, 'Παρασκευή': e.target.value
                                        }
                                    }))}
                                    placeholder="09:00-17:00" />
                                <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>Εφαρμόζεται σε Δευτέρα–Παρασκευή. Μπορείτε να το αλλάξετε ανά ημέρα από τις Ρυθμίσεις AI.</p>
                            </div>
                            <div>
                                <label htmlFor="wizard-sms-initial" style={labelStyle}>Αρχικό SMS (προαιρετικό)</label>
                                <textarea
                                    id="wizard-sms-initial"
                                    className="input-glass"
                                    style={{ minHeight: '70px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                                    value={aiConfig.smsInitial}
                                    onChange={e => setAiConfig(p => ({ ...p, smsInitial: e.target.value }))}
                                    placeholder={'Γεια 👋 χάσαμε την κλήση σας στο {clinic_name}.\n1️⃣ Ραντεβού  2️⃣ Ερώτηση  3️⃣ Επανάκληση'}
                                />
                                <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>Χρησιμοποιήστε {'{clinic_name}'} για το όνομα του ιατρείου.</p>
                            </div>
                            <div>
                                <label htmlFor="wizard-languages" style={labelStyle}>Γλώσσες</label>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    {['Ελληνικά', 'Αγγλικά'].map(lang => (
                                        <label key={lang} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', border: aiConfig.languages?.includes(lang) ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.15)', background: aiConfig.languages?.includes(lang) ? 'rgba(99,102,241,0.2)' : 'transparent' }}>
                                            <input type="checkbox" checked={aiConfig.languages?.includes(lang)} onChange={e => {
                                                const cur = aiConfig.languages || [];
                                                const upd = e.target.checked ? [...cur, lang] : cur.filter(l => l !== lang);
                                                setAiConfig(p => ({ ...p, languages: upd.length ? upd : ['Ελληνικά'] }));
                                            }} />
                                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>{lang}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

{current.key === 'voice' && (
                    <div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white', marginBottom: '4px' }}>{current.title}</h2>
                            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>{current.subtitle}</p>
                        </div>

                        <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', marginBottom: '1.25rem' }}>
                            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>
                                Χρησιμοποιεί τον αριθμό σας για ελληνικό caller ID.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label htmlFor="wizard-vapi-key" style={labelStyle}>Vapi API Key (προαιρετικό)</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="wizard-vapi-key"
                                        className="input-glass"
                                        style={{ paddingRight: '40px' }}
                                        type={showKey ? 'text' : 'password'}
                                        value={voiceData.vapiApiKey}
                                        onChange={e => setVoiceData(p => ({ ...p, vapiApiKey: e.target.value }))}
                                        placeholder="sk-..."
                                    />
                                    <button type="button" onClick={() => setShowKey(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
                                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="wizard-assistant-id" style={labelStyle}>Assistant ID *</label>
                                <input id="wizard-assistant-id" className="input-glass" value={voiceData.vapiAssistantId} onChange={e => setVoiceData(p => ({ ...p, vapiAssistantId: e.target.value }))} placeholder="assistant_xxxxx" />
                            </div>
                            <div>
                                <label htmlFor="wizard-phone-number-id" style={labelStyle}>Phone Number ID *</label>
                                <input id="wizard-phone-number-id" className="input-glass" value={voiceData.vapiPhoneNumberId} onChange={e => setVoiceData(p => ({ ...p, vapiPhoneNumberId: e.target.value }))} placeholder="phone_xxxxx" />
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '0.5rem' }}>
                                <input type="checkbox" checked={voiceData.voiceEnabled} onChange={e => setVoiceData(p => ({ ...p, voiceEnabled: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>Ενεργοποίηση Voice AI</span>
                            </label>
                        </div>
                    </div>
                )}

                {current.key === 'webhooks' && (
                    <div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white', marginBottom: '4px' }}>{current.title}</h2>
                            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>{current.subtitle}</p>
                        </div>
                        <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '1.25rem' }}>
                            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>
                                Τα webhooks συνδέουν το ClinicFlow με το <strong style={{ color: 'white' }}>n8n</strong> για αποστολή SMS. Μπορείτε να τα ρυθμίσετε αργότερα από τις Ρυθμίσεις → Webhooks.
                            </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label htmlFor="wizard-webhook-missed" style={labelStyle}>Webhook Αναπάντητων Κλήσεων</label>
                                <input id="wizard-webhook-missed" className="input-glass" value={webhooks.webhookMissedCall} onChange={e => setWebhooks(p => ({ ...p, webhookMissedCall: e.target.value }))} placeholder="https://your-n8n.app/webhook/missed-call" />
                            </div>
                            <div>
                                <label htmlFor="wizard-webhook-sms" style={labelStyle}>Webhook Άμεσου SMS</label>
                                <input id="wizard-webhook-sms" className="input-glass" value={webhooks.webhookDirectSms} onChange={e => setWebhooks(p => ({ ...p, webhookDirectSms: e.target.value }))} placeholder="https://your-n8n.app/webhook/direct-sms" />
                            </div>

                            {registrationSecret && (
                                <div style={{ 
                                    marginTop: '1rem', 
                                    padding: '1.5rem', 
                                    borderRadius: '16px', 
                                    background: 'rgba(99,102,241,0.1)', 
                                    border: '1px solid rgba(99,102,241,0.2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                }}>
                                    <div>
                                        <h4 style={{ color: 'white', fontSize: '0.85rem', fontWeight: '800', marginBottom: '4px' }}>Το μοναδικό σας Webhook Secret</h4>
                                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                                            Αντιγράψτε αυτό το μυστικό. Θα το χρειαστείτε στο n8n για την επαλήθευση των αιτημάτων. <strong style={{ color: 'var(--urgent)' }}>Δεν θα ξαναεμφανιστεί!</strong>
                                        </p>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            readOnly 
                                            className="input-glass" 
                                            style={{ 
                                                fontFamily: 'monospace', 
                                                fontSize: '0.8rem', 
                                                paddingRight: '60px',
                                                background: 'rgba(0,0,0,0.2)' 
                                            }} 
                                            value={registrationSecret} 
                                        />
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(registrationSecret);
                                                toast.success('Αντιγράφηκε!');
                                            }}
                                            style={{ 
                                                position: 'absolute', 
                                                right: '8px', 
                                                top: '50%', 
                                                transform: 'translateY(-50%)',
                                                background: 'var(--primary)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: 'white',
                                                padding: '4px 8px',
                                                fontSize: '0.7rem',
                                                fontWeight: '700',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            COPY
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {current.key === 'done' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '72px', height: '72px', background: 'rgba(16,185,129,0.2)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <CheckCircle2 size={36} color="#10b981" />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', marginBottom: '0.75rem' }}>Όλα έτοιμα!</h2>
                        <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '2rem', fontSize: '0.95rem' }}>
                            Το ιατρείο σας είναι ρυθμισμένο. Μπορείτε να αλλάξετε οποιαδήποτε ρύθμιση από τις <strong style={{ color: 'white' }}>Ρυθμίσεις</strong> ανά πάσα στιγμή.
                        </p>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{ marginTop: '1rem', padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: '0.82rem', fontWeight: '600' }}>
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '2rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    {step > 0 && !isLast ? (
                        <button onClick={() => { setError(''); setStep(s => s - 1); }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '700' }}>
                            <ArrowLeft size={15} /> Πίσω
                        </button>
                    ) : <div />}

                    <div style={{ display: 'flex', gap: '8px' }}>
                        {skippable && (
                            <button onClick={handleSkip} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}>
                                Παράλειψη
                            </button>
                        )}
                        {isLast ? (
                            <button onClick={handleFinish} style={{ padding: '11px 24px', borderRadius: '14px', border: 'none', background: '#10b981', color: 'white', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 20px -4px rgba(16,185,129,0.4)' }}>
                                Πάμε στο Dashboard <ArrowRight size={16} />
                            </button>
                        ) : (
                            <button onClick={handleNext} disabled={saving} style={{ padding: '11px 24px', borderRadius: '14px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '800', fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 20px -4px rgba(99,102,241,0.4)' }}>
                                {saving ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Αποθήκευση...</> : <>Επόμενο <ArrowRight size={15} /></>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizard;
