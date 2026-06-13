const nodemailer = require('nodemailer');

let transporter = null;
let emailConfigured = false;

// Initialize the transporter using either standard SMTP or falling back to a testing account if not in production
const getTransporter = async () => {
    if (transporter) return transporter;

    if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        emailConfigured = true;
        return transporter;
    }

    // Development auto-fallback for easy local testing without credentials
    if (process.env.NODE_ENV !== 'production') {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.warn('[EmailService] Using Ethereal test account (dev only). Configure SMTP_HOST for production.');
        return transporter;
    }

    // Production: log warning but don't crash
    console.error('[EmailService] WARNING: Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.');
    emailConfigured = false;
    return null;
};

const isEmailConfigured = () => emailConfigured || !!process.env.SMTP_HOST;

/**
 * Sends a password reset email
 * @param {string} to - Destination email address
 * @param {string} resetLink - Full URL for the password reset front-end route
 * @returns {Promise<boolean>}
 */
const sendPasswordResetEmail = async (to, resetLink) => {
    const transporter = await getTransporter();
    if (!transporter) {
        console.warn('[EmailService] Email not configured - password reset email skipped for:', to);
        return false;
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Clinic Automation" <no-reply@clinic.local>',
            to,
            subject: 'Επαναφορά Κωδικού Πρόσβασης',
            text: `Ζητήσατε επαναφορά κωδικού πρόσβασης. Ακολουθήστε τον παρακάτω σύνδεσμο: ${resetLink}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0d9488;">Επαναφορά Κωδικού Πρόσβασης</h2>
                    <p>Γεια σας,</p>
                    <p>Λάβαμε ένα αίτημα για επαναφορά του κωδικού πρόσβασης του λογαριασμού σας. Πατήστε το παρακάτω κουμπί για να προχωρήσετε:</p>
                    <div style="margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Αλλαγή Κωδικού</a>
                    </div>
                    <p style="font-size: 12px; color: #64748b;">Αν δεν κάνατε εσείς το αίτημα, μπορείτε να αγνοήσετε αυτό το email.</p>
                </div>
            `,
        });

        if (process.env.NODE_ENV !== 'production' && info.messageId && !process.env.SMTP_HOST) {
            console.log('[EmailService] Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return true;
    } catch (err) {
        console.error('[EmailService] Failed to send email:', err.message);
        return false;
    }
};


/**
 * Sends an SMS failure alert to the clinic owner
 */
const sendSmsFailureAlert = async (to, clinicName, phone, error) => {
    const transporter = await getTransporter();
    if (!transporter) {
        console.warn('[EmailService] Email not configured - SMS alert skipped');
        return false;
    }

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"ClinicFlow" <no-reply@clinicflows.vercel.app>',
            to,
            subject: `⚠️ Αποτυχία SMS — ${clinicName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #ef4444;">⚠️ Αποτυχία Αποστολής SMS</h2>
                    <p>Το σύστημα δεν μπόρεσε να στείλει SMS στον αριθμό <strong>${phone}</strong>.</p>
                    <p><strong>Σφάλμα:</strong> ${error}</p>
                    <p>Παρακαλώ ελέγξτε τα credentials Twilio και τα webhook URLs στις ρυθμίσεις.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #64748b;">ClinicFlow — Αυτόματη ειδοποίηση</p>
                </div>
            `,
        });
        return true;
    } catch (err) {
        console.error('[EmailService] SMS failure alert failed:', err.message);
        return false;
    }
};

/**
 * Sends a "request a demo" notification to the platform owner when a clinic
 * fills in the public demo form. We email the configured SALES_NOTIFY_EMAIL
 * (or fall back to the SMTP user in dev) so the platform owner can follow up.
 */
const sendDemoRequest = async ({ clinicName, name, email, phone, notes }) => {
    const transporter = await getTransporter();
    if (!transporter) {
        console.warn('[EmailService] Email not configured - demo request will only be logged');
        return false;
    }
    const notifyTo = process.env.SALES_NOTIFY_EMAIL || process.env.SMTP_USER;
    if (!notifyTo) {
        console.warn('[EmailService] No SALES_NOTIFY_EMAIL or SMTP_USER set - demo request will only be logged');
        return false;
    }
    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"ClinicFlow" <no-reply@clinicflows.vercel.app>',
            to: notifyTo,
            subject: `Νέο αίτημα demo — ${clinicName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0d9488;">Νέο αίτημα επίδειξης</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                        <tr><td style="padding: 6px 0; color: #64748b;">Ιατρείο:</td><td style="padding: 6px 0; font-weight: bold;">${escapeHtml(clinicName)}</td></tr>
                        <tr><td style="padding: 6px 0; color: #64748b;">Όνομα:</td><td style="padding: 6px 0; font-weight: bold;">${escapeHtml(name || '—')}</td></tr>
                        <tr><td style="padding: 6px 0; color: #64748b;">Email:</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
                        <tr><td style="padding: 6px 0; color: #64748b;">Τηλέφωνο:</td><td style="padding: 6px 0;"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone || '—')}</a></td></tr>
                    </table>
                    ${notes ? `<h3 style="margin-top: 24px; color: #0d9488;">Σημειώσεις</h3><p style="white-space: pre-wrap;">${escapeHtml(notes)}</p>` : ''}
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #64748b;">ClinicFlow — Demo request via website</p>
                </div>
            `,
        });
        return true;
    } catch (err) {
        console.error('[EmailService] Demo request email failed:', err.message);
        return false;
    }
};

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

module.exports = {
    sendPasswordResetEmail,
    sendSmsFailureAlert,
    sendDemoRequest,
    isEmailConfigured,
};

