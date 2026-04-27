/**
 * Email service — wraps nodemailer with SMTP env-var config.
 *
 * Required env vars (in server/.env) :
 *   SMTP_HOST   — ex: smtp.gmail.com
 *   SMTP_PORT   — ex: 587
 *   SMTP_USER   — ex: vous@gmail.com
 *   SMTP_PASS   — ex: mot-de-passe-app (pas votre MDP normal)
 *   SMTP_FROM   — ex: "Compte-Pote <noreply@compte-pote.fr>"
 *   APP_URL     — ex: https://compte-pote.fr  (frontend origin)
 *
 * Si SMTP_HOST est absent, le lien est loggé en console (mode dev).
 */
const nodemailer = require('nodemailer');

const SMTP_CONFIGURED = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

console.log(`[email] SMTP configured: ${SMTP_CONFIGURED} | host=${process.env.SMTP_HOST || 'N/A'} | user=${process.env.SMTP_USER || 'N/A'}`);

let _transporter = null;

function getTransporter() {
  if (!_transporter && SMTP_CONFIGURED) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

async function sendPasswordResetEmail(email, resetUrl) {
  const from = process.env.SMTP_FROM || '"Compte-Pote" <noreply@compte-pote.fr>';

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1a1a1a">Réinitialisation de mot de passe</h2>
      <p>Vous avez demandé à réinitialiser le mot de passe de votre compte <strong>Compte-Pote</strong>.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}"
           style="background:#1a1a1a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:2px;font-weight:bold;display:inline-block">
          Réinitialiser mon mot de passe →
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">
        Ce lien expire dans <strong>1 heure</strong>.<br>
        Si vous n'avez pas fait cette demande, ignorez cet email — votre mot de passe reste inchangé.
      </p>
      <hr style="border:none;border-top:1px solid #e8e8e4;margin:24px 0">
      <p style="color:#9ca3af;font-size:11px">Compte-Pote · comptabilité pour indépendants français</p>
    </div>
  `;

  console.log(`[email] Sending reset link to ${email}: ${resetUrl}`);

  if (!SMTP_CONFIGURED) {
    console.log('[email] SMTP not configured — email skipped (set SMTP_HOST, SMTP_USER, SMTP_PASS)');
    return;
  }

  try {
    const info = await getTransporter().sendMail({
      from,
      to: email,
      subject: 'Réinitialisation de votre mot de passe Compte-Pote',
      html,
    });
    console.log(`[email] Sent OK — messageId: ${info.messageId}`);
  } catch (err) {
    console.error(`[email] Send FAILED — ${err.message}`, err);
    throw err;
  }
}

module.exports = { sendPasswordResetEmail };
