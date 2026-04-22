const { Router } = require('express');
const bcrypt   = require('bcrypt');
const masterDb = require('../db/masterDb');

const router = Router();

// ── Helper: look up and validate a token ─────────────────────────────────────

function findValidInvitation(token) {
  return masterDb
    .prepare(
      `SELECT i.*, w.name AS workspace_name
       FROM invitations i
       JOIN workspaces w ON w.id = i.workspace_id
       WHERE i.token = ?`
    )
    .get(token);
}

// ── GET /api/invite/:token ────────────────────────────────────────────────────
// Returns public info about an invitation (no token in response).
router.get('/:token', (req, res) => {
  const { token } = req.params;

  const invitation = findValidInvitation(token);

  if (!invitation) {
    return res.status(404).json({ error: 'Invitation introuvable' });
  }

  if (new Date(invitation.expires_at) <= new Date()) {
    return res.status(410).json({ error: 'Invitation expirée' });
  }

  if (invitation.used_at != null) {
    return res.status(410).json({ error: 'Invitation déjà utilisée' });
  }

  return res.json({
    email:          invitation.email,
    workspace_name: invitation.workspace_name,
    expires_at:     invitation.expires_at,
  });
});

// ── POST /api/invite/:token ───────────────────────────────────────────────────
// Accepts an invitation: creates the user account and marks the invite used.
router.post('/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const invitation = findValidInvitation(token);

  if (!invitation) {
    return res.status(404).json({ error: 'Invitation introuvable' });
  }

  if (new Date(invitation.expires_at) <= new Date()) {
    return res.status(410).json({ error: 'Invitation expirée' });
  }

  if (invitation.used_at != null) {
    return res.status(410).json({ error: 'Invitation déjà utilisée' });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  if (password.length > 128) {
    return res.status(400).json({ error: 'Le mot de passe ne peut pas dépasser 128 caractères' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Marquer le token utilisé EN PREMIER (gate atomique anti-TOCTOU).
  // Si un autre appel concurrent a déjà consommé le token, changes === 0 → on rejette.
  masterDb.run('BEGIN');
  try {
    const markResult = masterDb
      .prepare("UPDATE invitations SET used_at = datetime('now') WHERE token = ? AND used_at IS NULL")
      .run(token);

    if (markResult.changes === 0) {
      masterDb.run('ROLLBACK');
      return res.status(410).json({ error: 'Invitation déjà utilisée' });
    }

    masterDb
      .prepare(
        'INSERT INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)'
      )
      .run(invitation.workspace_id, invitation.email, passwordHash, invitation.role);

    masterDb.run('COMMIT');
  } catch (err) {
    masterDb.run('ROLLBACK');
    throw err;
  }

  return res.status(201).json({ success: true, email: invitation.email });
});

module.exports = router;
