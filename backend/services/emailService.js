const nodemailer = require('nodemailer');

// Initialize the transporter using either standard SMTP or falling back to a testing account if not in production
const getTransporter = async () => {
    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    // Development auto-fallback for easy local testing without credentials
    if (process.env.NODE_ENV !== 'production') {
        console.log('[EmailService] SMTP credentials missing. Using Ethereal fallback for development.');
        const testAccount = await nodemailer.createTestAccount();
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: testAccount.user, // generated ethereal user
                pass: testAccount.pass, // generated ethereal password
            },
        });
    }
    
    throw new Error('Email infrastructure is not configured. Missing SMTP_HOST.');
};

/**
 * Sends a password reset email
 * @param {string} to - Destination email address
 * @param {string} resetLink - Full URL for the password reset front-end route
 * @returns {Promise<boolean>}
 */
const sendPasswordResetEmail = async (to, resetLink) => {
    try {
        const transporter = await getTransporter();
        
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

module.exports = {
    sendPasswordResetEmail,
};
