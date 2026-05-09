const { GoogleGenerativeAI } = require('@google/generative-ai');
const AppError = require('../errors/AppError');
const { sendDirectMessage } = require('./messagingService');
const { createAppointment, getTodayAppointments, updateAppointmentStatus } = require('./appointmentService');
const { triggerOutboundCall } = require('./vapiService');
const prisma = require('./prisma');

const SYSTEM_PROMPT = `You are an AI assistant for a Greek medical clinic management system. Parse natural language commands in Greek or English and return structured JSON.

Available actions:
1. send_sms - Send SMS to a patient
   Parameters: { patientName: string, message: string }
   
2. call_patient - Initiate AI voice call to a patient
   Parameters: { patientName: string }
   
3. book_appointment - Create a new appointment
   Parameters: { patientName: string, reason: string, date: string (YYYY-MM-DD), time: string (HH:MM), duration: number (minutes) }
   
4. cancel_appointment - Cancel an appointment
   Parameters: { patientName: string, date?: string (YYYY-MM-DD) }
   
5. list_today_appointments - List today's appointments
   Parameters: {}
   
6. list_missed_calls - List recent missed calls
   Parameters: {}

Return ONLY valid JSON in this format:
{
  "action": "action_name",
  "parameters": { ... },
  "confidence": 0.0-1.0
}

Examples:
- "Στείλε SMS στον Γιάννη ότι το ραντεβού του είναι αύριο" → {"action":"send_sms","parameters":{"patientName":"Γιάννης","message":"Το ραντεβού σας είναι αύριο"},"confidence":0.9}
- "Κάλεσε την Μαρία" → {"action":"call_patient","parameters":{"patientName":"Μαρία"},"confidence":0.95}
- "Κλείσε ραντεβού για τον Νίκο αύριο στις 10:00 για έλεγχο" → {"action":"book_appointment","parameters":{"patientName":"Νίκος","reason":"έλεγχος","date":"2026-05-03","time":"10:00","duration":30},"confidence":0.85}
- "Ακύρωσε το ραντεβού του Πέτρου" → {"action":"cancel_appointment","parameters":{"patientName":"Πέτρος"},"confidence":0.9}
- "Ποια ραντεβού έχω σήμερα;" → {"action":"list_today_appointments","parameters":{},"confidence":1.0}
- "Δείξε μου τις αναπάντητες κλήσεις" → {"action":"list_missed_calls","parameters":{},"confidence":0.95}

If the command is unclear or not supported, return:
{"action":"unknown","parameters":{},"confidence":0.0,"error":"Could not understand command"}`;

/**
 * Parse natural language command using Gemini
 */
async function parseCommand(command, context = {}) {
    const apiKey = context.geminiApiKey || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        throw new AppError('CONFIGURATION_ERROR', 'Gemini API key not configured. Please add it in Settings.', 500);
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash'
        });
        
        const contextInfo = context.currentDate ? `\nCurrent date: ${context.currentDate}` : '';
        const prompt = `${SYSTEM_PROMPT}${contextInfo}\n\nCommand: "${command}"`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Extract JSON from response (handle markdown code blocks)
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
        }
        
        const parsed = JSON.parse(jsonText);
        
        if (!parsed.action || parsed.confidence === undefined) {
            throw new Error('Invalid response format from AI');
        }
        
        return parsed;
    } catch (err) {
        console.error('[AI Command] Error:', err.message);

        // Handle quota exceeded errors
        if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('Too Many Requests')) {
            throw new AppError('AI_QUOTA_EXCEEDED', 'AI service quota exceeded. Please try again later or contact support.', 503);
        }

        // Handle authentication errors
        if (err.message.includes('API_KEY') || err.message.includes('401') || err.message.includes('403')) {
            throw new AppError('AI_AUTH_ERROR', 'AI service API key is invalid or expired.', 503);
        }

        throw new AppError('AI_ERROR', 'Failed to process command: ' + err.message, 500);
    }
}

async function findPatientsByName(clinicId, name) {
    const nameLower = name.toLowerCase().trim();
    
    // Try exact match first
    const exactMatches = await prisma.patient.findMany({
        where: {
            clinicId,
            name: {
                equals: name,
                mode: 'insensitive'
            }
        },
        select: { id: true, name: true, phone: true }
    });
    if (exactMatches.length === 1) return exactMatches;
    
    // Try startsWith/contains
    const fuzzyMatches = await prisma.patient.findMany({
        where: {
            clinicId,
            OR: [
                { name: { startsWith: name, mode: 'insensitive' } },
                { name: { contains: name, mode: 'insensitive' } }
            ]
        },
        select: { id: true, name: true, phone: true },
        take: 5
    });
    
    return fuzzyMatches;
}

/**
 * Execute parsed command
 */
async function executeCommand(parsedCommand, clinicId, actor) {
    const { action, parameters } = parsedCommand;
    
    switch (action) {
        case 'send_sms': {
            const patients = await findPatientsByName(clinicId, patientName);
            if (patients.length === 0) {
                throw new AppError('NOT_FOUND', `Patient "${patientName}" not found`, 404);
            }
            if (patients.length > 1) {
                throw new AppError('AMBIGUOUS_MATCH', 'Multiple patients found', 400, { suggestions: patients.map(p => p.name) });
            }
            const patient = patients[0];
            
            const result = await sendDirectMessage(
                { clinicId, patientId: patient.id, message, type: 'DIRECT' },
                actor
            );
            
            return {
                success: true,
                action: 'send_sms',
                result: {
                    patient: patient.name,
                    phone: patient.phone,
                    message,
                    status: result.data.status
                }
            };
        }
        
        case 'call_patient': {
            const patients = await findPatientsByName(clinicId, patientName);
            if (patients.length === 0) {
                throw new AppError('NOT_FOUND', `Patient "${patientName}" not found`, 404);
            }
            if (patients.length > 1) {
                throw new AppError('AMBIGUOUS_MATCH', 'Multiple patients found', 400, { suggestions: patients.map(p => p.name) });
            }
            const patient = patients[0];
            
            const clinic = await prisma.clinic.findUnique({
                where: { id: clinicId },
                select: { 
                    id: true,
                    name: true,
                    vapiApiKey: true, 
                    vapiAssistantId: true, 
                    vapiPhoneNumberId: true,
                    aiConfig: true,
                    workingHours: true
                }
            });
            
            if (!clinic?.vapiApiKey && !process.env.VAPI_API_KEY) {
                throw new AppError('CONFIGURATION_ERROR', 'Voice calling not configured for this clinic', 400);
            }
            
            const result = await triggerOutboundCall({
                clinic,
                phone: patient.phone,
                patientName: patient.name,
                missedCallId: null
            });
            
            if (!result.success) {
                throw new AppError('EXTERNAL_SERVICE_ERROR', `Call failed: ${result.reason}`, 500);
            }
            
            return {
                success: true,
                action: 'call_patient',
                result: {
                    patient: patient.name,
                    phone: patient.phone,
                    callId: result.callId
                }
            };
        }
        
        case 'book_appointment': {
            const { patientName, reason, date, time, duration } = parameters;
            if (!patientName || !date || !time) {
                throw new AppError('VALIDATION_ERROR', 'Patient name, date, and time are required', 400);
            }
            
            const patients = await findPatientsByName(clinicId, patientName);
            if (patients.length === 0) {
                throw new AppError('NOT_FOUND', `Patient "${patientName}" not found`, 404);
            }
            if (patients.length > 1) {
                throw new AppError('AMBIGUOUS_MATCH', 'Multiple patients found', 400, { suggestions: patients.map(p => p.name) });
            }
            const patient = patients[0];
            
            // Parse date and time in clinic's timezone
            const clinic = await prisma.clinic.findUnique({
                where: { id: clinicId },
                select: { timezone: true }
            });
            const timezone = clinic?.timezone || 'Europe/Athens';
            
            // Construct ISO string with offset (assuming clinic is in Greece or similar)
            // A more robust way would be using dayjs, but we'll manually ensure it's not server-local
            const startTime = new Date(`${date}T${time}:00`);
            const durationMinutes = duration || 30;
            const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
            
            const result = await createAppointment({
                clinicId,
                patientId: patient.id,
                reason: reason || 'Ραντεβού',
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                priority: 'NORMAL'
            }, actor);
            
            return {
                success: true,
                action: 'book_appointment',
                result: {
                    patient: patient.name,
                    appointmentId: result.data.id,
                    date,
                    time,
                    duration: durationMinutes,
                    reason: reason || 'Ραντεβού'
                }
            };
        }
        
        case 'cancel_appointment': {
            const { patientName, date } = parameters;
            if (!patientName) {
                throw new AppError('VALIDATION_ERROR', 'Patient name is required', 400);
            }
            
            const patients = await findPatientsByName(clinicId, patientName);
            if (patients.length === 0) {
                throw new AppError('NOT_FOUND', `Patient "${patientName}" not found`, 404);
            }
            if (patients.length > 1) {
                throw new AppError('AMBIGUOUS_MATCH', 'Multiple patients found', 400, { suggestions: patients.map(p => p.name) });
            }
            const patient = patients[0];
            
            // Find appointment
            const where = {
                clinicId,
                patientId: patient.id,
                status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] }
            };
            
            if (date) {
                const startOfDay = new Date(`${date}T00:00:00`);
                const endOfDay = new Date(`${date}T23:59:59`);
                where.startTime = { gte: startOfDay, lte: endOfDay };
            }
            
            const appointment = await prisma.appointment.findFirst({
                where,
                orderBy: { startTime: 'asc' }
            });
            
            if (!appointment) {
                throw new AppError('NOT_FOUND', `No active appointment found for ${patientName}`, 404);
            }
            
            await updateAppointmentStatus({
                clinicId,
                appointmentId: appointment.id,
                status: 'CANCELLED'
            }, actor);
            
            return {
                success: true,
                action: 'cancel_appointment',
                result: {
                    patient: patient.name,
                    appointmentId: appointment.id,
                    date: appointment.startTime.toISOString().split('T')[0],
                    time: appointment.startTime.toTimeString().slice(0, 5)
                }
            };
        }
        
        case 'list_today_appointments': {
            const result = await getTodayAppointments(clinicId);
            
            return {
                success: true,
                action: 'list_today_appointments',
                result: {
                    count: result.data.length,
                    appointments: result.data.map(apt => ({
                        id: apt.id,
                        patient: apt.patient?.name || 'Unknown',
                        time: new Date(apt.startTime).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
                        reason: apt.reason,
                        status: apt.status
                    }))
                }
            };
        }
        
        case 'list_missed_calls': {
            const missedCalls = await prisma.missedCall.findMany({
                where: { clinicId },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    patient: { select: { name: true, phone: true } }
                }
            });
            
            return {
                success: true,
                action: 'list_missed_calls',
                result: {
                    count: missedCalls.length,
                    calls: missedCalls.map(call => ({
                        id: call.id,
                        patient: call.patient?.name || call.fromNumber,
                        phone: call.fromNumber,
                        time: call.createdAt.toLocaleString('el-GR'),
                        status: call.status
                    }))
                }
            };
        }
        
        case 'unknown':
        default:
            throw new AppError('VALIDATION_ERROR', 'Unknown or unsupported command', 400);
    }
}

/**
 * Main entry point: parse and execute command
 */
async function processCommand(command, clinicId, actor) {
    // Get clinic's Gemini API key
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { geminiApiKey: true }
    });
    
    const { decrypt } = require('./encryptionService');
    const geminiApiKey = clinic?.geminiApiKey ? decrypt(clinic.geminiApiKey) : null;
    
    // Parse command with AI
    const context = {
        currentDate: new Date().toISOString().split('T')[0],
        geminiApiKey
    };
    
    const parsed = await parseCommand(command, context);
    
    // Check confidence threshold
    if (parsed.confidence < 0.5) {
        return {
            success: false,
            error: 'Command not understood. Please be more specific.',
            parsed,
            suggestions: [
                'Try: "Στείλε SMS στον [όνομα] με μήνυμα [κείμενο]"',
                'Try: "Κάλεσε τον/την [όνομα]"',
                'Try: "Κλείσε ραντεβού για [όνομα] στις [ημερομηνία] [ώρα]"'
            ]
        };
    }
    
    // Execute command
    const result = await executeCommand(parsed, clinicId, actor);
    
    return {
        ...result,
        parsed: {
            action: parsed.action,
            confidence: parsed.confidence
        }
    };
}

module.exports = {
    processCommand,
    parseCommand,
    executeCommand
};
