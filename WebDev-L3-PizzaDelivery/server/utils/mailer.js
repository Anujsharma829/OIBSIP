// Sending emails with nodemailer.
const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

// If SMTP_HOST is set in .env we send real emails (for example through Gmail).
// If not, "jsonTransport" is used: nothing is sent, the email is just printed in the terminal.
const transporter = nodemailer.createTransport(
  SMTP_HOST
    ? { host: SMTP_HOST, port: Number(SMTP_PORT) || 587, auth: { user: SMTP_USER, pass: SMTP_PASS } }
    : { jsonTransport: true }
);

async function sendMail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"Slice Society" <${SMTP_USER || 'no-reply@slice.local'}>`,
      to,
      subject,
      html,
    });

    if (!SMTP_HOST) {
      // Development mode: show the email text (and links) in the terminal.
      console.log(`\n[MAIL to ${to}] ${subject}\n${html.replace(/<[^>]+>/g, ' ')}\n`);
    }
  } catch (err) {
    console.error('Mail failed:', err.message);
  }
}

module.exports = { sendMail };
