const { Router } = require('express');
const masterDb = require('../db/masterDb');
const { closeWorkspaceDb } = require('../db/database');
const { signToken } = require('../services/authService');

const router = Router();

// ── GET /api/workspace ────────────────────────────────────────────────────────
// Returns the current workspace and its users.
router.get('/', (req, res) => {
  const { workspaceId } = req.user;

  const workspace = masterDb
    .prepare('SELECT id, name, slug, activite_type, structure_type, created_at FROM workspaces WHERE id = ?')
    .get(workspaceId);

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace introuvable' });
  }

  const users = masterDb
    .prepare(
      'SELECT id, email, role, last_login_at, created_at FROM users WHERE workspace_id = ?'
    )
    .all(workspaceId);

  return res.json({ ...workspace, users });
});

// ── PATCH /api/workspace/name ─────────────────────────────────────────────────
// Updates the workspace name.
router.patch('/name', (req, res) => {
  const { workspaceId } = req.user;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Le champ "name" est requis et ne peut pas être vide' });
  }

  const trimmedName = name.trim();

  if (trimmedName.length > 100) {
    return res.status(400).json({ error: 'Le nom du workspace ne peut pas dépasser 100 caractères' });
  }

  masterDb
    .prepare('UPDATE workspaces SET name = ? WHERE id = ?')
    .run(trimmedName, workspaceId);

  const updatedWorkspace = masterDb
    .prepare('SELECT * FROM workspaces WHERE id = ?')
    .get(workspaceId);
  const currentUser = masterDb
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(req.user.userId);
  const { token } = signToken(currentUser, updatedWorkspace);

  return res.json({ id: updatedWorkspace.id, name: updatedWorkspace.name, slug: updatedWorkspace.slug, token });
});

// ── PATCH /api/workspace/profile ─────────────────────────────────────────────
// Updates the workspace activity & structure profile.
router.patch('/profile', (req, res) => {
  const { workspaceId } = req.user;
  const { activite_type, structure_type } = req.body;

  const VALID_ACTIVITES  = ['saas', 'conseil', 'evenementiel', 'commerce', 'formation', 'immobilier', 'autre'];
  const VALID_STRUCTURES = ['micro', 'ei', 'eurl', 'sarl', 'sas', 'sa', 'autre'];

  if (activite_type  != null && !VALID_ACTIVITES.includes(activite_type)) {
    return res.status(400).json({ error: 'Type d\'activité invalide' });
  }
  if (structure_type != null && !VALID_STRUCTURES.includes(structure_type)) {
    return res.status(400).json({ error: 'Type de structure invalide' });
  }

  masterDb
    .prepare('UPDATE workspaces SET activite_type = ?, structure_type = ? WHERE id = ?')
    .run(activite_type ?? null, structure_type ?? null, workspaceId);

  return res.json({ success: true });
});

// ── DELETE /api/workspace/users/:id ──────────────────────────────────────────
// Removes a user from the current workspace.
router.delete('/users/:id', (req, res) => {
  const { workspaceId, userId: currentUserId } = req.user;
  const userId = parseInt(req.params.id, 10);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Identifiant utilisateur invalide' });
  }

  if (currentUserId === userId) {
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  }

  const target = masterDb
    .prepare('SELECT id FROM users WHERE id = ? AND workspace_id = ?')
    .get(userId, workspaceId);

  if (!target) {
    return res.status(404).json({ error: 'Utilisateur introuvable dans ce workspace' });
  }

  const { cnt } = masterDb
    .prepare('SELECT COUNT(*) AS cnt FROM users WHERE workspace_id = ?')
    .get(workspaceId);

  if (cnt <= 1) {
    return res.status(400).json({ error: 'Impossible de supprimer le dernier utilisateur du workspace' });
  }

  masterDb.prepare('DELETE FROM users WHERE id = ?').run(userId);

  return res.json({ success: true });
});

// ── DELETE /api/workspace ─────────────────────────────────────────────────────
// Deletes the current workspace and all its users.
router.delete('/', (req, res) => {
  const { workspaceId } = req.user;

  if (workspaceId === 1) {
    return res.status(403).json({ error: 'Le workspace système ne peut pas être supprimé' });
  }

  masterDb.run('BEGIN');
  try {
    masterDb.prepare('DELETE FROM users WHERE workspace_id = ?').run(workspaceId);
    masterDb.prepare('DELETE FROM workspaces WHERE id = ?').run(workspaceId);
    masterDb.run('COMMIT');
  } catch (err) {
    masterDb.run('ROLLBACK');
    throw err;
  }

  // Close and delete the workspace DB file (data/{workspaceId}.db)
  // workspace 1 uses compta.db — protected above, but guard anyway
  if (workspaceId !== 1) closeWorkspaceDb(workspaceId);

  return res.json({ success: true });
});

// ── Sous-router : /invitations (monté ici pour éviter le shadow Express) ─────
router.use('/invitations', require('./invitations'));

module.exports = router;
