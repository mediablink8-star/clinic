import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Send, Loader, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../lib/constants';

const AiAssistant = ({ token, isMobile = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Γεια σου! Είμαι η Σοφία, η AI βοηθός σου. Μπορώ να σε βοηθήσω με:\n\n• Αποστολή SMS σε ασθενείς\n• Κλήσεις ασθενών\n• Κλείσιμο ραντεβού\n• Ακύρωση ραντεβού\n• Προβολή σημερινών ραντεβού\n• Προβολή αναπάντητων κλήσεων\n\nΤι θα ήθελες να κάνω;',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            inputRef.current?.focus();
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/ai/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ command: userMessage.content })
            });

            const data = await res.json();

            let assistantMessage = {
                role: 'assistant',
                timestamp: new Date()
            };

            if (data.success) {
                assistantMessage.content = formatSuccessResponse(data);
                assistantMessage.data = data;
                assistantMessage.success = true;
            } else {
                assistantMessage.content = data.error || 'Δεν κατάλαβα την εντολή. Μπορείς να το ξαναπείς;';
                assistantMessage.success = false;
                if (data.suggestions) {
                    assistantMessage.suggestions = data.suggestions;
                }
            }

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            const errorMessage = {
                role: 'assistant',
                content: 'Συγγνώμη, κάτι πήγε στραβά. Δοκίμασε ξανά.',
                timestamp: new Date(),
                success: false
            };
            setMessages(prev => [...prev, errorMessage]);
            toast.error('Σφάλμα σύνδεσης');
        } finally {
            setLoading(false);
        }
    };

    const formatSuccessResponse = (data) => {
        const { action, result } = data;

        switch (action) {
            case 'send_sms':
                return `✅ SMS εστάλη στον/στην ${result.patient}!\n📱 ${result.phone}\n💬 "${result.message}"`;
            
            case 'call_patient':
                return `📞 Κλήση ξεκίνησε προς ${result.patient}!\n📱 ${result.phone}\n🆔 Call ID: ${result.callId}`;
            
            case 'book_appointment':
                return `✅ Ραντεβού κλείστηκε!\n👤 ${result.patient}\n📅 ${result.date} στις ${result.time}\n⏱️ Διάρκεια: ${result.duration} λεπτά\n📝 ${result.reason}`;
            
            case 'cancel_appointment':
                return `❌ Ραντεβού ακυρώθηκε!\n👤 ${result.patient}\n📅 ${result.date} στις ${result.time}`;
            
            case 'list_today_appointments':
                if (result.count === 0) {
                    return '📅 Δεν υπάρχουν ραντεβού σήμερα.';
                }
                const aptList = result.appointments.map(apt => 
                    `• ${apt.time} - ${apt.patient} (${apt.status})\n  ${apt.reason}`
                ).join('\n\n');
                return `📅 Σημερινά Ραντεβού (${result.count}):\n\n${aptList}`;
            
            case 'list_missed_calls':
                if (result.count === 0) {
                    return '📞 Δεν υπάρχουν αναπάντητες κλήσεις.';
                }
                const callList = result.calls.map(call => 
                    `• ${call.patient} - ${call.phone}\n  ${call.time} (${call.status})`
                ).join('\n\n');
                return `📞 Αναπάντητες Κλήσεις (${result.count}):\n\n${callList}`;
            
            default:
                return '✅ Εντολή εκτελέστηκε επιτυχώς!';
        }
    };

    const quickCommands = [
        { label: 'Σημερινά ραντεβού', command: 'Δείξε μου τα σημερινά ραντεβού' },
        { label: 'Αναπάντητες κλήσεις', command: 'Ποιες είναι οι αναπάντητες κλήσεις;' },
    ];

    return createPortal(
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="ai-fab"
                style={{
                    position: 'fixed',
                    bottom: isMobile ? '16px' : '24px',
                    right: isMobile ? '16px' : '24px',
                    width: isMobile ? '56px' : '60px',
                    height: isMobile ? '56px' : '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                    border: 'none',
                    boxShadow: 'var(--shadow-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2147483646,
                    transition: 'all 0.3s ease',
                    animation: isOpen ? 'none' : 'fab-pulse 2s infinite'
                }}
                onMouseEnter={e => {
                    if (!isMobile) {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.boxShadow = '0 16px 40px -8px var(--primary-glow)';
                    }
                }}
                onMouseLeave={e => {
                    if (!isMobile) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-primary)';
                    }
                }}
            >
                {isOpen ? <X size={isMobile ? 22 : 24} color="white" /> : <Sparkles size={isMobile ? 22 : 24} color="white" />}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div
                    className="ai-chat"
                    style={{
                        position: 'fixed',
                        bottom: '80px',
                        right: isMobile ? '16px' : '24px',
                        left: isMobile ? '16px' : 'auto',
                        width: isMobile ? 'auto' : '400px',
                        height: isMobile ? 'auto' : '520px',
                        maxHeight: 'calc(100vh - 120px)',
                        maxWidth: isMobile ? 'none' : '400px',
                        background: 'var(--glass-surface)',
                        backdropFilter: 'var(--glass-strong)',
                        WebkitBackdropFilter: 'var(--glass-strong)',
                        borderRadius: '20px',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-xl)',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 2147483647,
                        overflow: 'hidden',
                        animation: 'slideUp 0.3s ease'
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '1.25rem 1.5rem',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexShrink: 0,
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'var(--glass-sheen)',
                            pointerEvents: 'none'
                        }} />
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            <Sparkles size={20} color="white" />
                        </div>
                        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'white', margin: 0 }}>Σοφία AI</h3>
                            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)', margin: '2px 0 0' }}>Η προσωπική σου βοηθός</p>
                        </div>
                        {!isMobile && (
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                boxShadow: '0 0 8px var(--accent-glow)',
                                position: 'relative',
                                zIndex: 1
                            }} />
                        )}
                        <button
                            onClick={() => setIsOpen(false)}
                            aria-label="Κλείσιμο"
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: 'rgba(255,255,255,0.2)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'background 0.15s',
                                position: 'relative',
                                zIndex: 1
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        >
                            <X size={18} color="white" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        background: 'var(--glass-control-soft)'
                    }}>
                        {messages.map((msg, idx) => (
                            <div
                                key={`msg-${idx}`}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    animation: 'fadeIn 0.3s ease'
                                }}
                            >
                                <div style={{
                                    maxWidth: '85%',
                                    padding: '10px 14px',
                                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: msg.role === 'user'
                                        ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)'
                                        : msg.success === false
                                        ? 'var(--error-light)'
                                        : 'var(--bg-subtle)',
                                    border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                                    color: msg.role === 'user' ? 'white' : 'var(--text)',
                                    fontSize: '0.85rem',
                                    lineHeight: '1.5',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}>
                                    {msg.success === true && (
                                        <CheckCircle2 size={14} color="var(--accent)" style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
                                    )}
                                    {msg.success === false && (
                                        <AlertCircle size={14} color="var(--urgent)" style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
                                    )}
                                    {msg.content}
                                </div>
                                {msg.suggestions && (
                                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                        {msg.suggestions.map((sug, i) => (
                                            <div key={`sug-${i}`} style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                                                💡 {sug}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: '4px' }}>
                                    {msg.timestamp.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', alignSelf: 'flex-start', animation: 'fadeIn 0.3s ease' }}>
                                <div style={{
                                    maxWidth: '85%',
                                    padding: '12px 18px',
                                    borderRadius: '16px 16px 16px 4px',
                                    background: 'var(--bg-subtle)',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <span style={{ width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%', display: 'inline-block', animation: 'bounce-dot 1.4s infinite ease-in-out both' }} />
                                    <span style={{ width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%', display: 'inline-block', animation: 'bounce-dot 1.4s infinite ease-in-out both', animationDelay: '0.2s' }} />
                                    <span style={{ width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%', display: 'inline-block', animation: 'bounce-dot 1.4s infinite ease-in-out both', animationDelay: '0.4s' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Commands */}
                    {messages.length <= 1 && (
                        <div style={{
                            padding: '0 1rem 0.5rem',
                            display: 'flex',
                            gap: '6px',
                            flexWrap: 'wrap',
                            background: 'var(--glass-control-soft)'
                        }}>
                            {quickCommands.map((cmd, idx) => (
                                <button
                                    key={`cmd-${cmd.command}`}
                                    onClick={() => setInput(cmd.command)}
                                    className="ai-chip"
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--glass-control)',
                                        color: 'var(--text)',
                                        fontSize: '0.72rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'var(--primary-light)';
                                        e.currentTarget.style.borderColor = 'var(--primary)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'var(--glass-control)';
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                    }}
                                >
                                    {cmd.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div style={{
                        padding: '1rem',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        gap: '8px',
                        flexShrink: 0,
                        background: 'var(--glass-surface)'
                    }}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Γράψε την εντολή σου..."
                            disabled={loading}
                            style={{
                                flex: 1,
                                padding: '10px 14px',
                                borderRadius: '12px',
                                border: '1px solid var(--input-border)',
                                background: 'var(--input-bg)',
                                color: 'var(--text)',
                                fontSize: '0.85rem',
                                outline: '2px solid transparent'
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="ai-send-btn"
                            style={{
                                padding: '10px 16px',
                                borderRadius: '12px',
                                border: 'none',
                                background: input.trim() && !loading
                                    ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-vibrant) 100%)'
                                    : 'var(--border)',
                                color: 'white',
                                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s',
                                boxShadow: input.trim() && !loading ? 'var(--shadow-primary)' : 'none'
                            }}
                        >
                            {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes bounce-dot {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1.0); }
                }
                @keyframes fab-pulse {
                    0%, 100% { box-shadow: var(--shadow-primary); }
                    50% { box-shadow: 0 8px 32px var(--primary-glow), 0 0 0 8px var(--primary-glow); }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .ai-fab { outline: 1px solid rgba(255,255,255,0.15); outline-offset: -1px; }
                .ai-fab:hover { outline-color: rgba(255,255,255,0.3); }
                .ai-chat { outline: 1px solid var(--border-glass); outline-offset: -1px; }
                .ai-send-btn:active:not(:disabled) { transform: scale(0.95); }
                .ai-chip:active { transform: scale(0.96); }
            `}</style>
        </>,
        document.body
    );
};

export default AiAssistant;
