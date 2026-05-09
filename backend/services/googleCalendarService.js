/**
 * Google Calendar Service
 * Pushes ClinicFlow appointments to the clinic's Google Calendar.
 * Uses OAuth2 with offline access (refresh token stored encrypted in DB).
 */
const { google } = require('googleapis');
const { encrypt, decrypt } = require('./encryptionService');
const prisma = require('./prisma');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${process.env.BACKEND_API_URL}/clinic/google-calendar/callback`
    );
}

/**
 * Generate the OAuth2 authorization URL for a clinic.
 */
async function getAuthUrl(clinicId) {
    const oauth2Client = getOAuth2Client();
    const state = require('crypto').randomBytes(32).toString('hex');
    
    // Save state to clinic to verify upon callback
    await prisma.clinic.update({
        where: { id: clinicId },
        data: { googleOAuthState: state }
    });

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // force refresh token on every auth
        state,             // pass random state through OAuth flow
    });
}

/**
 * Exchange authorization code for tokens and save to clinic.
 */
async function handleCallback(code, clinicId, state) {
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { googleOAuthState: true }
    });

    if (!clinic || !clinic.googleOAuthState || clinic.googleOAuthState !== state) {
        console.error('[GoogleCalendar] Invalid state or clinic:', { clinicId, stateMatch: clinic?.googleOAuthState === state });
        throw new Error('Invalid OAuth state. Potential CSRF attempt detected.');
    }

    const oauth2Client = getOAuth2Client();
    console.log('[GoogleCalendar] Using redirect URI:', oauth2Client._redirectUri);
    console.log('[GoogleCalendar] Client ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING');
    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('[GoogleCalendar] Token exchange successful, has refresh:', !!tokens.refresh_token);

        if (!tokens.refresh_token) {
            throw new Error('No refresh token received. User may need to revoke access and reconnect.');
        }

        await prisma.clinic.update({
            where: { id: clinicId },
            data: {
                googleCalendarRefreshToken: encrypt(tokens.refresh_token),
                googleCalendarEnabled: true,
                googleCalendarId: 'primary',
            }
        });

        return { success: true };
    } catch (err) {
        console.error('[GoogleCalendar] Token exchange error details:', err.response?.data || err.message);
        throw err;
    }
}

/**
 * Get an authenticated Google Calendar client for a clinic.
 */
async function getCalendarClient(clinic) {
    if (!clinic.googleCalendarRefreshToken || !clinic.googleCalendarEnabled) {
        return null;
    }

    const oauth2Client = getOAuth2Client();
    const refreshToken = decrypt(clinic.googleCalendarRefreshToken);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Push a new appointment to Google Calendar.
 * Returns the Google Calendar event ID.
 */
async function createCalendarEvent({ clinic, appointment, patient }) {
    try {
        console.log('[GoogleCalendar] createCalendarEvent called', { 
            clinicId: clinic?.id, 
            googleCalendarEnabled: clinic?.googleCalendarEnabled,
            hasRefreshToken: !!clinic?.googleCalendarRefreshToken,
            appointmentId: appointment?.id 
        });
        
        const calendar = await getCalendarClient(clinic);
        console.log('[GoogleCalendar] calendar client:', calendar ? 'created' : 'null');
        if (!calendar) return null;

        const calendarId = clinic.googleCalendarId || 'primary';
        const timezone = clinic.timezone || 'Europe/Athens';

        const event = {
            summary: `Ραντεβού: ${patient?.name || 'Ασθενής'}`,
            description: [
                appointment.reason ? `Αιτία: ${appointment.reason}` : null,
                patient?.phone ? `Τηλέφωνο: ${patient.phone}` : null,
                `Κατάσταση: ${appointment.status}`,
                `ClinicFlow ID: ${appointment.id}`,
            ].filter(Boolean).join('\n'),
            start: {
                dateTime: new Date(appointment.startTime).toISOString(),
                timeZone: timezone,
            },
            end: {
                dateTime: new Date(appointment.endTime).toISOString(),
                timeZone: timezone,
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 60 },
                    { method: 'popup', minutes: 15 },
                ],
            },
            colorId: appointment.priority === 'URGENT' ? '11' : '1', // red for urgent, blue for normal
        };

        console.log('[GoogleCalendar] Event payload:', JSON.stringify(event, null, 2));
        const response = await calendar.events.insert({
            calendarId,
            resource: event,
        });

        console.info(`[GoogleCalendar] Event created: ${response.data.id} for appointment ${appointment.id}`);
        return response.data.id;
    } catch (err) {
        console.warn(`[GoogleCalendar] Failed to create event: ${err.message}`);
        return null;
    }
}

/**
 * Delete an appointment from Google Calendar.
 */
async function deleteCalendarEvent({ clinic, googleCalendarEventId }) {
    if (!googleCalendarEventId) return;
    try {
        const calendar = await getCalendarClient(clinic);
        if (!calendar) return;

        const calendarId = clinic.googleCalendarId || 'primary';
        await calendar.events.delete({ calendarId, eventId: googleCalendarEventId });
        console.info(`[GoogleCalendar] Event deleted: ${googleCalendarEventId}`);
    } catch (err) {
        // 410 Gone = already deleted, ignore
        if (err.code !== 410) {
            console.warn(`[GoogleCalendar] Failed to delete event: ${err.message}`);
        }
    }
}

/**
 * Update an existing calendar event (e.g. status change).
 */
async function updateCalendarEvent({ clinic, googleCalendarEventId, appointment, patient }) {
    if (!googleCalendarEventId) return;
    try {
        const calendar = await getCalendarClient(clinic);
        if (!calendar) return;

        const calendarId = clinic.googleCalendarId || 'primary';
        const timezone = clinic.timezone || 'Europe/Athens';

        const statusLabel = {
            CONFIRMED: '✅ Επιβεβαιωμένο',
            CANCELLED: '❌ Ακυρώθηκε',
            COMPLETED: '✓ Ολοκληρώθηκε',
            NO_SHOW: '⚠️ Δεν εμφανίστηκε',
            PENDING: '⏳ Εκκρεμεί',
        }[appointment.status] || appointment.status;

        await calendar.events.patch({
            calendarId,
            eventId: googleCalendarEventId,
            resource: {
                summary: `${statusLabel} — ${patient?.name || 'Ασθενής'}`,
                description: [
                    appointment.reason ? `Αιτία: ${appointment.reason}` : null,
                    patient?.phone ? `Τηλέφωνο: ${patient.phone}` : null,
                    `Κατάσταση: ${appointment.status}`,
                    `ClinicFlow ID: ${appointment.id}`,
                ].filter(Boolean).join('\n'),
            },
        });
    } catch (err) {
        console.warn(`[GoogleCalendar] Failed to update event: ${err.message}`);
    }
}

/**
 * Disconnect Google Calendar for a clinic.
 */
async function disconnect(clinicId) {
    await prisma.clinic.update({
        where: { id: clinicId },
        data: {
            googleCalendarRefreshToken: null,
            googleCalendarEnabled: false,
        }
    });
}

module.exports = {
    getAuthUrl,
    handleCallback,
    createCalendarEvent,
    deleteCalendarEvent,
    updateCalendarEvent,
    disconnect,
};
