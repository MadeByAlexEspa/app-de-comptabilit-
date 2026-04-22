const { Router } = require('express');
const crypto    = require('crypto');
const masterDb  = require('../db/masterDb');

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── POST /api/workspace/invitations ──────────────────────────────────────────
// Creates a new invitation for the given email address.
router.post('/', (req, res) => {
  const { workspaceId, userId: invitedBy } = req.user;
  const { email } = req.body;

  if (!email || typeof email !== 'string' || email.trim() === '') {
    return res.status(400).json({ error: 'Le champ "email" est requis' });
  }

  const trimmedEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }

  // Check if the email already belongs to an existing user
  const existingUser = masterDb
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(trimmedEmail);

  if (existingUser) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  }

  // Check if there is already an active (non-expired, non-used) invitation
  const activeInvitation = masterDb
    .prepare(
      `SELECT id FROM invitations
       WHERE email = ? AND workspace_id = ? AND used_at IS NULL AND expires_at > datetime('now')`
    )
    .get(trimmedEmail, workspaceId);

  if (activeInvitation) {
    return res.status(409).json({ error: 'Une invitation active existe déjà pour cet email' });
  }

  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  masterDb
    .prepare(
      `INSERT INTO invitations (token, email, workspace_id, role, expires_at, invited_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(token, trimmedEmail, workspaceId, 'owner', expiresAt, invitedBy);

  const created = masterDb
    .prepare('SELECT id, email, role, expires_at, created_at FROM invitations WHERE token = ?')
    .get(token);

  const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/invite/${token}`;

  // token exclu de la réponse — inviteUrl contient déjà le lien complet
  return res.status(201).json({ ...created, inviteUrl });
});

// ── GET /api/workspace/invitations ───────────────────────────────────────────
// Lists invitations for the current workspace (active + recently used).
router.get('/', (req, res) => {
  const { workspaceId } = req.user;

  const invitations = masterDb
    .prepare(
      `SELECT id, email, role, expires_at, used_at, created_at
       FROM invitations
       WHERE workspace_id = ?
         AND (
               (used_at IS NULL AND expires_at > datetime('now'))
               OR
               (used_at IS NOT NULL AND created_at >= datetime('now', '-7 days'))
             )
       ORDER BY created_at DESC`
    )
    .all(workspaceId);

  return res.json(invitations);
});

// ── DELETE /api/workspace/invitations/:id ─────────────────────────────────────
// Cancels a pending invitation.
router.delete('/:id', (req, res) => {
  const { workspaceId } = req.user;
  const id = parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identifiant invitation invalide' });
  }

  const invitation = masterDb
    .prepare('SELECT id, workspace_id, used_at FROM invitations WHERE id = ?')
    .get(id);

  if (!invitation || invitation.workspace_id !== workspaceId) {
    return res.status(404).json({ error: 'Invitation introuvable' });
  }

  if (invitation.used_at !== null && invitation.used_at !== undefined) {
    return res.status(400).json({ error: 'Impossible de supprimer une invitation déjà utilisée' });
  }

  masterDb.prepare('DELETE FROM invitations WHERE id = ?').run(id);

  return res.json({ success: true });
});

module.exports = router;
