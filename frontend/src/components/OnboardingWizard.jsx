import React, { useState } from 'react';
import axios from 'axios';
import {
    Building2, Phone, Zap, CheckCircle2, ArrowRight,
    ArrowLeft, X, Loader, Eye, EyeOff
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const STEPS = [
    { key: 'welcome',  title: 'Καλώς ήρθατε!',           subtitle: 'Ας ρυθμίσουμε το ιατρείο σας σε 4 βήματα' },
    { key: 'info',     title: 'Στοιχεία Ιατρείου',        subtitle: 'Βασικές πληροφορίες για το ιατρείο σας' },
    { key: 'ai',       title: 'Ρυθμίσεις AI',             subtitle: 'Υπηρεσίες, ωράριο και SMS πρότυπα για τη Σοφία' },
    { key: 'voice',    title: 'Voice AI',          subtitle: 'Αυτόματη επανάκληση αναπάντητων κλήσεων' },
    { key: 'webhooks', title: 'Webhooks & SMS',            subtitle: 'Σύνδεση με n8n για αποστολή SMS' },
    { key: 'done',     title: 'Έτοιμοι! 🎉',              subtitle: 'Το ιατρείο σας είναι έτοιμο' },
];

const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)',
    color: 'white', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
};

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
    });

    // Step 3 — Voice AI (Vapi)
    const [voiceData, setVoiceData] = useState({
        vapiApiKey: '',
        vapiAssistantId: '',
        vapiPhoneNumberId: '',
        voiceEnabled: true,
    });

    // Step 3 — webhooks
    const [webhooks, setWebhooks] = useState({
        webhookMissedCall: '',
        webhookDirectSms: '',
    });

    const isLast = step === STEPS.length - 1;
    const current = STEPS[step];

    const saveInfo = async () => {
        if (!info.name?.trim() || !info.phone?.trim() || !info.email?.trim()) {
            setError('Όνομα, email και τηλέφωνο είναι υποχρεωτικά.');
            return false;
        }
        try {
            await axios.put(`${API_BASE}/clinic/settings`, info, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (onUpdate) onUpdate(info);
            return true;
        } catch (err) {
            setError(err.response?.data?.error || 'Σφάλμα αποθήκευσης.');
            return false;
        }
    };

    const saveAiConfig = async () => {
        try {
            await axios.put(`${API_BASE}/clinic/ai-config`, aiConfig, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
        
        try {
            await axios.put(`${API_BASE}/clinic/vapi`, voiceData, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
            await axios.put(`${API_BASE}/clinic/webhooks`, webhooks, {
                headers: { Authorization: `Bearer ${token}` }
            });
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

    const handleFinish = () => {
        localStorage.setItem('onboarding_complete', 'true');
        onComplete();
    };

    const skippable = ['ai', 'voice', 'webhooks'].includes(current.key);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
        }}>
            {/* Background glows */}
            <div style={{ position: 'absolute', top: '-150px', left: '-150px', width: '500px', height: '500px', background: 'rgba(99,102,241,0.12)', filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-150px', right: '-150px', width: '400px', height: '400px', background: 'rgba(16,185,129,0.08)', filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }} />

            <div style={{
                width: '100%', maxWidth: '520px', position: 'relative', zIndex: 1,
                background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(24px)',
                borderRadius: '28px', border: '1px solid rgba(255,255,255,0.1)',
                padding: '2.5rem', boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
            }}>
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
                                <label style={labelStyle}>Όνομα Ιατρείου *</label>
                                <input style={inputStyle} value={info.name} onChange={e => setInfo(p => ({ ...p, name: e.target.value }))} placeholder="π.χ. Οδοντιατρείο Παπαδόπουλος" />
                            </div>
                            <div>
                                <label style={labelStyle}>Email *</label>
                                <input style={inputStyle} type="email" value={info.email} onChange={e => setInfo(p => ({ ...p, email: e.target.value }))} placeholder="info@clinic.gr" />
                            </div>
                            <div>
                                <label style={labelStyle}>Τηλέφωνο *</label>
                                <input style={inputStyle} value={info.phone} onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))} placeholder="6912345678" />
                            </div>
                            <div>
                                <label style={labelStyle}>Διεύθυνση</label>
                                <input style={inputStyle} value={info.location} onChange={e => setInfo(p => ({ ...p, location: e.target.value }))} placeholder="Αθήνα, Ελλάδα" />
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
                                <label style={labelStyle}>Υπηρεσίες Ιατρείου</label>
                                <textarea
                                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                                    value={aiConfig.services}
                                    onChange={e => setAiConfig(p => ({ ...p, services: e.target.value }))}
                                    placeholder={'Οδοντιατρική, Λεύκανση, Εμφυτεύματα...'}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Μέση Αξία Ραντεβού (€)</label>
                                    <input style={inputStyle} type="number" value={aiConfig.avgAppointmentValue}
                                        onChange={e => setAiConfig(p => ({ ...p, avgAppointmentValue: parseFloat(e.target.value) || 80 }))} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Ύφος AI</label>
                                    <select style={{ ...inputStyle, cursor: 'pointer' }} value={aiConfig.tone}
                                        onChange={e => setAiConfig(p => ({ ...p, tone: e.target.value }))}>
                                        <option value="Friendly">Φιλικό</option>
                                        <option value="Professional">Επαγγελματικό</option>
                                        <option value="Formal">Τυπικό</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Ωράριο (Καθημερινές)</label>
                                <input style={inputStyle} value={aiConfig.workingHours['Δευτέρα'] || ''}
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
                                <label style={labelStyle}>Αρχικό SMS (προαιρετικό)</label>
                                <textarea
                                    style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                                    value={aiConfig.smsInitial}
                                    onChange={e => setAiConfig(p => ({ ...p, smsInitial: e.target.value }))}
                                    placeholder={'Γεια 👋 χάσαμε την κλήση σας στο {clinic_name}.\n1️⃣ Ραντεβού  2️⃣ Ερώτηση  3️⃣ Επανάκληση'}
                                />
                                <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>Χρησιμοποιήστε {'{clinic_name}'} για το όνομα του ιατρείου.</p>
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
                                Χρησιμοποιεί τον αριθμό σας από το Vonage για ελληνικό caller ID.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Vapi API Key</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        style={{ ...inputStyle, paddingRight: '40px' }}
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
                                <label style={labelStyle}>Assistant ID</label>
                                <input style={inputStyle} value={voiceData.vapiAssistantId} onChange={e => setVoiceData(p => ({ ...p, vapiAssistantId: e.target.value }))} placeholder="assistant_xxxxx" />
                            </div>
                            <div>
                                <label style={labelStyle}>Phone Number ID</label>
                                <input style={inputStyle} value={voiceData.vapiPhoneNumberId} onChange={e => setVoiceData(p => ({ ...p, vapiPhoneNumberId: e.target.value }))} placeholder="phone_xxxxx" />
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '0.5rem' }}>
                                <input type="checkbox" checked={voiceData.voiceEnabled} onChange={e => setVoiceData(p => ({ ...p, voiceEnabled: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>Ενεργοποίηση Voice AI</span>
                            </label>
                        </div>
                    </div>
                )}

                        {voiceData.voiceProviderType === 'vapi' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Vapi API Key</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            style={{ ...inputStyle, paddingRight: '40px' }}
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
                                    <label style={labelStyle}>Assistant ID</label>
                                    <input style={inputStyle} value={voiceData.vapiAssistantId} onChange={e => setVoiceData(p => ({ ...p, vapiAssistantId: e.target.value }))} placeholder="assistant_xxxxx" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Phone Number ID</label>
                                    <input style={inputStyle} value={voiceData.vapiPhoneNumberId} onChange={e => setVoiceData(p => ({ ...p, vapiPhoneNumberId: e.target.value }))} placeholder="phone_xxxxx" />
                                </div>
                            </div>
                        )}

                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '1rem' }}>
                            <input type="checkbox" checked={voiceData.voiceEnabled} onChange={e => setVoiceData(p => ({ ...p, voiceEnabled: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>Ενεργοποίηση Voice AI</span>
                        </label>
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
                                <label style={labelStyle}>Webhook Αναπάντητων Κλήσεων</label>
                                <input style={inputStyle} value={webhooks.webhookMissedCall} onChange={e => setWebhooks(p => ({ ...p, webhookMissedCall: e.target.value }))} placeholder="https://your-n8n.app/webhook/missed-call" />
                            </div>
                            <div>
                                <label style={labelStyle}>Webhook Άμεσου SMS</label>
                                <input style={inputStyle} value={webhooks.webhookDirectSms} onChange={e => setWebhooks(p => ({ ...p, webhookDirectSms: e.target.value }))} placeholder="https://your-n8n.app/webhook/direct-sms" />
                            </div>
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
