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
            from: process.env.SMTP_FROM || '"ClinicFlow" <no-reply@clinicflow.app>',
            to,
            subject: `⚠️ Αποτυχία SMS — ${clinicName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #ef4444;">⚠️ Αποτυχία Αποστολής SMS</h2>
                    <p>Το σύστημα δεν μπόρεσε να στείλει SMS στον αριθμό <strong>${phone}</strong>.</p>
                    <p><strong>Σφάλμα:</strong> ${error}</p>
                    <p>Παρακαλώ ελέγξτε τα credentials Vonage και τα webhook URLs στις ρυθμίσεις.</p>
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

module.exports = {
    sendPasswordResetEmail,
    sendSmsFailureAlert,
    isEmailConfigured,
};

