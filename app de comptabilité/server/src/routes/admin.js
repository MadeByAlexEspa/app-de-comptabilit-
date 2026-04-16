/**
 * Admin routes — superadmin-only endpoints for workspace and user management.
 * All routes are mounted under /api/admin with requireAuth + requireSuperAdmin.
 */
const { Router } = require('express');
const bcrypt = require('bcrypt');
const masterDb = require('../db/masterDb');
const { register } = require('../services/authService');

const router = Router();

// ── GET /api/admin/analytics ───────────────────────────────────────────────────
router.get('/analytics', (req, res, next) => {
  try {
    const total_workspaces = masterDb.prepare('SELECT COUNT(*) AS cnt FROM workspaces').get().cnt;
    const total_users = masterDb.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
    const active_users_30d = masterDb
      .prepare("SELECT COUNT(*) AS cnt FROM users WHERE last_login_at >= datetime('now', '-30 days')")
      .get().cnt;
    const new_workspaces_30d = masterDb
      .prepare("SELECT COUNT(*) AS cnt FROM workspaces WHERE created_at >= datetime('now', '-30 days')")
      .get().cnt;
    const workspaces_by_month = masterDb
      .prepare(`
        SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
        FROM workspaces
        WHERE created_at >= datetime('now', '-6 months')
        GROUP BY month ORDER BY month ASC
      `)
      .all();

    res.json({ total_workspaces, total_users, active_users_30d, new_workspaces_30d, workspaces_by_month });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/admin/workspaces ──────────────────────────────────────────────────
router.get('/workspaces', (req, res, next) => {
  try {
    const workspaces = masterDb.prepare('SELECT * FROM workspaces ORDER BY created_at DESC').all();
    const result = workspaces.map(ws => {
      const users = masterDb
        .prepare('SELECT id, email, role, last_login_at, created_at FROM users WHERE workspace_id = ?')
        .all(ws.id);
      return { ...ws, users };
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/admin/users ───────────────────────────────────────────────────────
router.get('/users', (req, res, next) => {
  try {
    const users = masterDb
      .prepare(`
        SELECT u.id, u.email, u.role, u.workspace_id, u.last_login_at, u.created_at,
               w.name AS workspace_name
        FROM users u
        JOIN workspaces w ON w.id = u.workspace_id
        ORDER BY u.created_at DESC
      `)
      .all();
    res.json(users);
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/users ──────────────────────────────────────────────────────
router.post('/users', async (req, res, next) => {
  try {
    const { workspace_id, email, password, role = 'owner' } = req.body;

    // Validate required fields
    if (!workspace_id || !email || !password) {
      return res.status(400).json({ error: 'workspace_id, email et password sont requis' });
    }

    // Validate workspace_id is a positive integer
    const wsId = parseInt(workspace_id, 10);
    if (!Number.isInteger(wsId) || wsId <= 0) {
      return res.status(400).json({ error: 'workspace_id doit être un entier positif' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min)' });
    }

    // Validate role
    if (!['owner', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: "Le rôle doit être 'owner' ou 'superadmin'" });
    }

    // Verify workspace exists
    const workspace = masterDb.prepare('SELECT id FROM workspaces WHERE id = ?').get(wsId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace introuvable' });
    }

    // Verify email is not already taken
    const existing = masterDb.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hash password and insert user
    const password_hash = await bcrypt.hash(password, 10);
    masterDb.run(
      'INSERT INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [wsId, email, password_hash, role]
    );

    const user = masterDb
      .prepare('SELECT id, email, role, workspace_id, last_login_at, created_at FROM users WHERE email = ? AND workspace_id = ?')
      .get(email, wsId);

    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

// ── PUT /api/admin/users/:id ───────────────────────────────────────────────────
router.put('/users/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'id utilisateur invalide' });
    }

    const { email, role, password } = req.body;

    // Validate role if provided
    if (role !== undefined && !['owner', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: "Le rôle doit être 'owner' ou 'superadmin'" });
    }

    // Fetch existing user
    const existing = masterDb
      .prepare('SELECT id, email, role, workspace_id, last_login_at, created_at FROM users WHERE id = ?')
      .get(userId);
    if (!existing) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Check email uniqueness if email is being changed
    const newEmail = email !== undefined ? email : existing.email;
    if (email !== undefined && email !== existing.email) {
      const taken = masterDb.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
      if (taken) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    const newRole  = role  !== undefined ? role  : existing.role;

    let newPasswordHash;
    if (password !== undefined) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min)' });
      }
      newPasswordHash = await bcrypt.hash(password, 10);
    } else {
      // Keep existing hash — fetch it separately since we excluded it above
      const withHash = masterDb.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
      newPasswordHash = withHash.password_hash;
    }

    masterDb.run(
      'UPDATE users SET email = ?, role = ?, password_hash = ? WHERE id = ?',
      [newEmail, newRole, newPasswordHash, userId]
    );

    const updated = masterDb
      .prepare('SELECT id, email, role, workspace_id, last_login_at, created_at FROM users WHERE id = ?')
      .get(userId);

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/admin/users/:id ────────────────────────────────────────────────
router.delete('/users/:id', (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'id utilisateur invalide' });
    }

    // Refuse self-deletion
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    // Fetch user to determine workspace
    const user = masterDb.prepare('SELECT id, workspace_id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Refuse deletion of the last user in a workspace
    const workspaceUserCount = masterDb
      .prepare('SELECT COUNT(*) AS cnt FROM users WHERE workspace_id = ?')
      .get(user.workspace_id);
    if (workspaceUserCount.cnt <= 1) {
      return res.status(400).json({ error: 'Impossible de supprimer le dernier utilisateur du workspace' });
    }

    masterDb.run('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/admin/workspaces ─────────────────────────────────────────────────
router.post('/workspaces', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email et password sont requis' });
    }

    // register() creates the workspace + owner user and returns a token — we discard the token
    const { user } = await register({ companyName: name, email, password });

    // Re-fetch workspace and user records (without token, without password_hash)
    const workspace = masterDb
      .prepare('SELECT * FROM workspaces WHERE id = ?')
      .get(user.workspaceId);
    const newUser = masterDb
      .prepare('SELECT id, email, role, workspace_id, last_login_at, created_at FROM users WHERE email = ? AND workspace_id = ?')
      .get(email, user.workspaceId);

    res.status(201).json({ workspace, user: newUser });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /api/admin/workspaces/:id ──────────────────────────────────────────
router.delete('/workspaces/:id', (req, res, next) => {
  try {
    const wsId = parseInt(req.params.id, 10);
    if (!Number.isInteger(wsId) || wsId <= 0) {
      return res.status(400).json({ error: 'id workspace invalide' });
    }

    // Protect workspace 1
    if (wsId === 1) {
      return res.status(403).json({ error: 'Le workspace système ne peut pas être supprimé' });
    }

    // Verify workspace exists
    const workspace = masterDb.prepare('SELECT id FROM workspaces WHERE id = ?').get(wsId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace introuvable' });
    }

    // Delete users + workspace atomically
    masterDb.run('BEGIN');
    try {
      masterDb.run('DELETE FROM users WHERE workspace_id = ?', [wsId]);
      masterDb.run('DELETE FROM workspaces WHERE id = ?', [wsId]);
      masterDb.run('COMMIT');
    } catch (txErr) {
      masterDb.run('ROLLBACK');
      throw txErr;
    }

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
