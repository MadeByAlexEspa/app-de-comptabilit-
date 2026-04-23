/**
 * Admin routes — back-office endpoints (indépendant de l'auth utilisateur).
 * loginRouter : POST /login — public, monté sur /api/admin/auth
 * adminRouter  : toutes les autres routes — protégées par requireAdminToken
 */
const { Router } = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const masterDb = require('../db/masterDb');
const { register } = require('../services/authService');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_CODE     = process.env.ADMIN_CODE;
const JWT_SECRET     = process.env.JWT_SECRET;

if (!ADMIN_USERNAME || !ADMIN_CODE) {
  console.warn('[admin] ADMIN_USERNAME ou ADMIN_CODE manquant — back-office désactivé');
}

// ── Router public : login uniquement ─────────────────────────────────────────

const loginRouter = Router();

loginRouter.post('/login', (req, res) => {
  const { username, code } = req.body;
  console.log('[admin login] attempt — username_match:', username === ADMIN_USERNAME, '| code_match:', code === ADMIN_CODE, '| env_set:', !!ADMIN_USERNAME && !!ADMIN_CODE);
  if (!username || !code) {
    return res.status(400).json({ error: 'username et code requis' });
  }
  if (username !== ADMIN_USERNAME || code !== ADMIN_CODE) {
    return res.status(401).json({ error: 'Identifiants back-office incorrects' });
  }
  const token = jwt.sign({ adminSession: true, username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// ── Router protégé : toutes les routes admin ──────────────────────────────────

const adminRouter = Router();

// GET /api/admin/analytics
adminRouter.get('/analytics', (req, res, next) => {
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

// GET /api/admin/workspaces
adminRouter.get('/workspaces', (req, res, next) => {
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

// GET /api/admin/users
adminRouter.get('/users', (req, res, next) => {
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

// POST /api/admin/users
adminRouter.post('/users', async (req, res, next) => {
  try {
    const { workspace_id, email, password, role = 'owner' } = req.body;

    if (!workspace_id || !email || !password) {
      return res.status(400).json({ error: 'workspace_id, email et password sont requis' });
    }

    const wsId = parseInt(workspace_id, 10);
    if (!Number.isInteger(wsId) || wsId <= 0) {
      return res.status(400).json({ error: 'workspace_id doit être un entier positif' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe trop court (8 caractères min)' });
    }

    if (!['owner', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: "Le rôle doit être 'owner' ou 'superadmin'" });
    }

    const workspace = masterDb.prepare('SELECT id FROM workspaces WHERE id = ?').get(wsId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace introuvable' });
    }

    const existing = masterDb.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

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

// PUT /api/admin/users/:id
adminRouter.put('/users/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'id utilisateur invalide' });
    }

    const { email, role, password } = req.body;

    if (role !== undefined && !['owner', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: "Le rôle doit être 'owner' ou 'superadmin'" });
    }

    const existing = masterDb
      .prepare('SELECT id, email, role, workspace_id, last_login_at, created_at FROM users WHERE id = ?')
      .get(userId);
    if (!existing) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const newEmail = email !== undefined ? email : existing.email;
    if (email !== undefined && email !== existing.email) {
      const taken = masterDb.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
      if (taken) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    const newRole = role !== undefined ? role : existing.role;

    let newPasswordHash;
    if (password !== undefined) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Mot de passe trop court (8 caractères min)' });
      }
      newPasswordHash = await bcrypt.hash(password, 10);
    } else {
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

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'id utilisateur invalide' });
    }

    const user = masterDb.prepare('SELECT id, workspace_id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

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

// POST /api/admin/workspaces
adminRouter.post('/workspaces', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email et password sont requis' });
    }

    const { user } = await register({ companyName: name, email, password });

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

// DELETE /api/admin/workspaces/:id
adminRouter.delete('/workspaces/:id', (req, res, next) => {
  try {
    const wsId = parseInt(req.params.id, 10);
    if (!Number.isInteger(wsId) || wsId <= 0) {
      return res.status(400).json({ error: 'id workspace invalide' });
    }

    if (wsId === 1) {
      return res.status(403).json({ error: 'Le workspace système ne peut pas être supprimé' });
    }

    const workspace = masterDb.prepare('SELECT id FROM workspaces WHERE id = ?').get(wsId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace introuvable' });
    }

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

module.exports = { loginRouter, adminRouter };
