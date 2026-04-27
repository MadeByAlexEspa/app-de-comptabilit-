/**
 * Email service — uses Resend HTTP API (pas de ports SMTP bloqués).
 *
 * Required env var:
 *   RESEND_API_KEY — clé API depuis resend.com (ex: re_xxxxxxxxxxxx)
 *   RESEND_FROM    — expéditeur vérifié (ex: "Compte-Pote <noreply@tondomaine.com>")
 *                    Sans domaine custom, utiliser: onboarding@resend.dev (test seulement)
 *   APP_URL        — ex: https://app-compte-pote.up.railway.app
 *
 * Si RESEND_API_KEY est absent, le lien est loggé en console (mode dev).
 */
const { Resend } = require('resend');

const RESEND_CONFIGURED = !!process.env.RESEND_API_KEY;

console.log(`[email] Resend configured: ${RESEND_CONFIGURED}`);

let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

async function sendPasswordResetEmail(email, resetUrl) {
  const from = process.env.RESEND_FROM || 'Compte-Pote <onboarding@resend.dev>';

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

  if (!RESEND_CONFIGURED) {
    console.log('[email] RESEND_API_KEY absent — email skipped (mode dev)');
    return;
  }

  try {
    const { data, error } = await getResend().emails.send({
      from,
      to: email,
      subject: 'Réinitialisation de votre mot de passe Compte-Pote',
      html,
    });
    if (error) throw new Error(error.message);
    console.log(`[email] Sent OK — id: ${data.id}`);
  } catch (err) {
    console.error(`[email] Send FAILED — ${err.message}`);
    throw err;
  }
}

module.exports = { sendPasswordResetEmail };
