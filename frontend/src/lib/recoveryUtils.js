import { MessageSquare, PhoneMissed, CheckCircle2, AlertCircle, Clock, RefreshCw, Reply, Phone, PhoneCall } from 'lucide-react';

export const EVENT_TYPES = {
    RECOVERED:  { label: 'Ραντεβού κλείστηκε', icon: CheckCircle2, dot: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
    RECOVERING: { label: 'Ασθενής απάντησε',   icon: Reply,        dot: '#635BFF', bg: 'rgba(99,91,255,0.08)',  border: 'rgba(99,91,255,0.2)' },
    DETECTED:   { label: 'Νέα αναπάντητη',     icon: PhoneMissed,  dot: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'  },
    LOST:       { label: 'Δεν απάντησε',        icon: AlertCircle,  dot: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
    SMS_SENT:   { label: 'SMS εστάλη',          icon: MessageSquare,dot: '#635BFF', bg: 'rgba(99,91,255,0.08)',  border: 'rgba(99,91,255,0.2)' },
    SMS_FAILED: { label: 'Αποτυχία SMS',        icon: AlertCircle,  dot: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'   },
    PENDING:    { label: 'SMS εκκρεμεί',        icon: Clock,        dot: '#635BFF', bg: 'rgba(99,91,255,0.08)',  border: 'rgba(99,91,255,0.2)' },
    VOICE_CALL: { label: 'AI Κλήση εστάλη',     icon: Phone,        dot: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
    VOICE_ANSWERED: { label: 'Κλήση απαντήθηκε', icon: PhoneCall,   dot: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
};

export const getEvent = (log) => {
    if (log.status === 'RECOVERED') return EVENT_TYPES.RECOVERED;
    if (log.status === 'LOST') return EVENT_TYPES.LOST;

    if (log.smsStatus === 'failed') return EVENT_TYPES.SMS_FAILED;
    
    if (log.smsStatus === 'pending') {
        try {
            const conv = log.aiConversation ? JSON.parse(log.aiConversation) : null;
            const hasVoice = Array.isArray(conv) && conv.some(m => 
                m.role === 'system' && String(m.content || '').startsWith('vapi_call_id:')
            );
            if (hasVoice) return EVENT_TYPES.VOICE_CALL;
        } catch {}
        return EVENT_TYPES.VOICE_CALL;
    }
    
    if (log.smsStatus === 'scheduled') return EVENT_TYPES.PENDING;
    
    if (log.status === 'RECOVERING') {
        try {
            const conv = log.aiConversation ? JSON.parse(log.aiConversation) : null;
            const hasReply = Array.isArray(conv) && conv.some(m => m.role === 'user' || m.direction === 'inbound' || m.from === 'patient');
            if (hasReply) return EVENT_TYPES.RECOVERING;
        } catch {}
        if (log.smsStatus === 'sent' || log.smsStatus === 'simulated') return EVENT_TYPES.SMS_SENT;
    }
    
    return EVENT_TYPES[log.status] || EVENT_TYPES.DETECTED;
};

export const getPatientLabel = (log) => {
    const name = log.patientName || log.patient?.name;
    if (name) {
        const parts = name.trim().split(' ');
        return parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
    }
    const num = log.fromNumber || '';
    const clean = num.replace(/\D/g, '');
    if (clean.length < 6) return 'Άγνωστος';
    const local = clean.startsWith('30') ? clean.slice(2) : clean;
    return local.length >= 7 ? `+30 ${local.slice(0, 3)} *** ${local.slice(-4)}` : `+30 ${local.slice(0, 3)}***`;
};

export const formatTime = (dateStr) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return '';
        const diff = Math.floor((Date.now() - d) / 1000);
        if (diff < 60) return 'τώρα';
        if (diff < 3600) return `${Math.floor(diff / 60)}λ`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}ω`;
        return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
    } catch { return ''; }
};

export const getReplyPreview = (log) => {
    try {
        const conv = typeof log.aiConversation === 'string' ? JSON.parse(log.aiConversation) : (log.aiConversation || []);
        const inbound = Array.isArray(conv) && [...conv].reverse().find(m => m.role === 'user' || m.direction === 'inbound' || m.from === 'patient');
        if (inbound && (inbound.content || inbound.body || inbound.text)) {
            const text = String(inbound.content || inbound.body || inbound.text);
            return text.length > 55 ? text.slice(0, 55) + '...' : text;
        }
    } catch {}
    return null;
};

export const getRevenue = (log) => {
    // Use estimatedRevenue if available, otherwise default to 80€ for recovered cases
    return log.estimatedRevenue || (log.status === 'RECOVERED' || log.status === 'RECOVERING' ? 80 : null);
};

export const getInitials = (log) => {
    return (log.patientName || log.patient?.name || '?')[0].toUpperCase();
};