/**
 * Google Calendar Service
 * Pushes ClinicFlow appointments to the clinic's Google Calendar.
 * Uses OAuth2 with offline access (refresh token stored encrypted in DB).
 */
const { google } = require('googleapis');
const { DEFAULT_TIMEZONE } = require('../utils/dateConstants');
const { encrypt, decrypt } = require('./encryptionService');
const prisma = require('./prisma');
const logger = require('../utils/logger');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${process.env.BACKEND_API_URL}/api/clinic/google-calendar/callback`
    );
}

/**
 * Generate the OAuth2 authorization URL for a clinic.
 */
async function getAuthUrl(clinicId) {
    const oauth2Client = getOAuth2Client();
    const nonce = require('crypto').randomBytes(16).toString('hex');
    const state = Buffer.from(JSON.stringify({ nonce, clinicId })).toString('base64url');

    // Save nonce to clinic to verify upon callback
    await prisma.clinic.update({
        where: { id: clinicId },
        data: { googleOAuthState: nonce }
    });

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // force refresh token on every auth
        state,             // pass combined state through OAuth flow
    });
}

/**
 * Exchange authorization code for tokens and save to clinic.
 */
async function handleCallback(code, clinicId, nonce) {
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { googleOAuthState: true }
    });

    if (!clinic || !clinic.googleOAuthState || clinic.googleOAuthState !== nonce) {
        logger.error('Invalid state or clinic during Google Calendar callback', { clinicId, nonce, match: clinic?.googleOAuthState === nonce });
        throw new Error('Invalid OAuth state. Potential CSRF attempt detected.');
    }

    const oauth2Client = getOAuth2Client();
    try {
        const { tokens } = await oauth2Client.getToken(code);
        logger.info('Token exchange successful', { hasRefresh: !!tokens.refresh_token });

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
        logger.error('Token exchange error', { error: err.response?.data || err.message });
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
        const calendar = await getCalendarClient(clinic);
        if (!calendar) return null;

        const calendarId = clinic.googleCalendarId || 'primary';
        const timezone = clinic.timezone || DEFAULT_TIMEZONE;

        const event = {
            summary: `${appointment.doctor?.name ? `[${appointment.doctor.name}] ` : ''}Ραντεβού: ${patient?.name || 'Ασθενής'}`,
            description: [
                appointment.reason ? `Αιτία: ${appointment.reason}` : null,
                appointment.doctor?.name ? `Γιατρός: ${appointment.doctor.name}` : null,
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

        logger.info('GoogleCalendar Event payload', { event });
        const response = await calendar.events.insert({
            calendarId,
            resource: event,
        });

        logger.info(`Event created in Google Calendar`, { eventId: response.data.id, appointmentId: appointment.id });
        return response.data.id;
    } catch (err) {
        logger.warn(`Failed to create Google Calendar event`, { error: err.message, appointmentId: appointment.id });
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
        logger.info(`Event deleted from Google Calendar`, { eventId: googleCalendarEventId });
    } catch (err) {
        // 410 Gone = already deleted, ignore
        if (err.code !== 410) {
            logger.warn(`Failed to delete Google Calendar event`, { error: err.message, eventId: googleCalendarEventId });
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
        const timezone = clinic.timezone || DEFAULT_TIMEZONE;

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
                summary: `${statusLabel} — ${appointment.doctor?.name ? `[${appointment.doctor.name}] ` : ''}${patient?.name || 'Ασθενής'}`,
                description: [
                    appointment.reason ? `Αιτία: ${appointment.reason}` : null,
                    appointment.doctor?.name ? `Γιατρός: ${appointment.doctor.name}` : null,
                    patient?.phone ? `Τηλέφωνο: ${patient.phone}` : null,
                    `Κατάσταση: ${appointment.status}`,
                    `ClinicFlow ID: ${appointment.id}`,
                ].filter(Boolean).join('\n'),
            },
        });
    } catch (err) {
        logger.warn('GoogleCalendar Failed to update event', { error: err.message });
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
