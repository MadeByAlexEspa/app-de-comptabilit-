/**
 * Integration tests for /api/admin routes.
 * Uses supertest against the real Express app with an in-memory-equivalent test DB.
 */
process.env.JWT_SECRET = 'test-secret-for-jest';
process.env.NODE_ENV   = 'test';

const request = require('supertest');
const app     = require('../index');

// Helper: obtain a superadmin token by patching masterDb directly
let superadminToken;
let ownerToken;

beforeAll(async () => {
  const masterDb = require('../db/masterDb');
  const bcrypt   = require('bcrypt');
  const jwt      = require('jsonwebtoken');

  // Ensure workspace 1 superadmin exists (seed + migration run at module load)
  const su = masterDb.prepare('SELECT * FROM users WHERE workspace_id = 1').get();
  if (su) {
    // Force superadmin role for test isolation
    masterDb.run("UPDATE users SET role = 'superadmin' WHERE id = ?", [su.id]);
    superadminToken = jwt.sign(
      { userId: su.id, workspaceId: 1, workspaceName: 'Démo', email: su.email, role: 'superadmin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  // Create a regular owner user in workspace 1 for auth failure tests
  const hash = await bcrypt.hash('owner1234', 10);
  try {
    masterDb.run(
      'INSERT INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [1, 'owner-test@compta.app', hash, 'owner']
    );
  } catch (_) { /* already exists from a previous run */ }

  const owner = masterDb
    .prepare('SELECT * FROM users WHERE email = ?')
    .get('owner-test@compta.app');
  ownerToken = jwt.sign(
    { userId: owner.id, workspaceId: 1, workspaceName: 'Démo', email: owner.email, role: 'owner' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

// ── Analytics ─────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics', () => {
  it('returns analytics for superadmin', async () => {
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_workspaces');
    expect(res.body).toHaveProperty('total_users');
    expect(res.body).toHaveProperty('active_users_30d');
    expect(res.body).toHaveProperty('new_workspaces_30d');
    expect(res.body).toHaveProperty('workspaces_by_month');
    expect(Array.isArray(res.body.workspaces_by_month)).toBe(true);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/admin/analytics');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-superadmin', async () => {
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });
});

// ── GET workspaces ────────────────────────────────────────────────────────────

describe('GET /api/admin/workspaces', () => {
  it('returns workspaces with users (no password_hash)', async () => {
    const res = await request(app)
      .get('/api/admin/workspaces')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach(ws => {
      expect(ws).toHaveProperty('users');
      ws.users.forEach(u => {
        expect(u).not.toHaveProperty('password_hash');
      });
    });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/workspaces');
    expect(res.status).toBe(401);
  });

  it('returns 403 for owner role', async () => {
    const res = await request(app)
      .get('/api/admin/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });
});

// ── GET users ─────────────────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  it('returns users with workspace_name (no password_hash)', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach(u => {
      expect(u).not.toHaveProperty('password_hash');
      expect(u).toHaveProperty('workspace_name');
    });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/admin/users ─────────────────────────────────────────────────────

describe('POST /api/admin/users', () => {
  const uniqueEmail = () => `new-user-${Date.now()}@test.com`;

  it('creates a user successfully', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ workspace_id: 1, email, password: 'secure123', role: 'owner' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('returns 400 when workspace_id is missing', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ email: uniqueEmail(), password: 'secure123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ workspace_id: 1, email: uniqueEmail(), password: '123' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when email already exists', async () => {
    const email = uniqueEmail();
    // First creation
    await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ workspace_id: 1, email, password: 'secure123' });
    // Duplicate
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ workspace_id: 1, email, password: 'secure123' });
    expect(res.status).toBe(409);
  });

  it('returns 404 when workspace does not exist', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ workspace_id: 99999, email: uniqueEmail(), password: 'secure123' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .send({ workspace_id: 1, email: uniqueEmail(), password: 'secure123' });
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/admin/users/:id ──────────────────────────────────────────────────

describe('PUT /api/admin/users/:id', () => {
  let testUserId;

  beforeAll(async () => {
    const masterDb = require('../db/masterDb');
    const bcrypt   = require('bcrypt');
    const hash     = await bcrypt.hash('pass1234', 10);
    masterDb.run(
      'INSERT OR IGNORE INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [1, 'put-target@test.com', hash, 'owner']
    );
    const u = masterDb.prepare('SELECT id FROM users WHERE email = ?').get('put-target@test.com');
    testUserId = u.id;
  });

  it('updates role successfully', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${testUserId}`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ role: 'superadmin' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('superadmin');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('returns 400 for invalid role', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${testUserId}`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ role: 'hacker' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app)
      .put('/api/admin/users/999999')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ role: 'owner' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${testUserId}`)
      .send({ role: 'owner' });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────

describe('DELETE /api/admin/users/:id', () => {
  let deletableUserId;

  beforeAll(async () => {
    // Create a second workspace so its sole user can't be deleted (last user check)
    // and create an extra user in workspace 1 that CAN be deleted
    const masterDb = require('../db/masterDb');
    const bcrypt   = require('bcrypt');
    const hash     = await bcrypt.hash('del1234', 10);
    masterDb.run(
      'INSERT OR IGNORE INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [1, 'deletable@test.com', hash, 'owner']
    );
    const u = masterDb.prepare('SELECT id FROM users WHERE email = ?').get('deletable@test.com');
    deletableUserId = u.id;
  });

  it('deletes a user successfully', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${deletableUserId}`)
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when trying to delete self', async () => {
    const masterDb = require('../db/masterDb');
    const su = masterDb.prepare('SELECT * FROM users WHERE role = ?').get('superadmin');
    const res = await request(app)
      .delete(`/api/admin/users/${su.id}`)
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app)
      .delete('/api/admin/users/999999')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${deletableUserId}`)
    expect(res.status).toBe(401);
  });
});

// ── POST /api/admin/workspaces ────────────────────────────────────────────────

describe('POST /api/admin/workspaces', () => {
  it('creates a workspace and owner user', async () => {
    const email = `ws-${Date.now()}@test.com`;
    const res = await request(app)
      .post('/api/admin/workspaces')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'Test Corp', email, password: 'secure123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('workspace');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.body.user.email).toBe(email);
    // No token should be returned
    expect(res.body).not.toHaveProperty('token');
  });

  it('returns 409 when email already used', async () => {
    const email = `ws-dup-${Date.now()}@test.com`;
    await request(app)
      .post('/api/admin/workspaces')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'Corp A', email, password: 'secure123' });

    const res = await request(app)
      .post('/api/admin/workspaces')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'Corp B', email, password: 'secure123' });
    expect(res.status).toBe(409);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/admin/workspaces')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/admin/workspaces')
      .send({ name: 'X', email: 'x@x.com', password: 'secure123' });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/admin/workspaces/:id ─────────────────────────────────────────

describe('DELETE /api/admin/workspaces/:id', () => {
  let deletableWsId;

  beforeAll(async () => {
    const masterDb = require('../db/masterDb');
    const email = `ws-del-${Date.now()}@test.com`;
    await request(app)
      .post('/api/admin/workspaces')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'To Delete Corp', email, password: 'secure123' });

    const ws = masterDb.prepare('SELECT id FROM workspaces WHERE name = ?').get('To Delete Corp');
    deletableWsId = ws?.id;
  });

  it('deletes a workspace and its users', async () => {
    const res = await request(app)
      .delete(`/api/admin/workspaces/${deletableWsId}`)
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when trying to delete workspace 1', async () => {
    const res = await request(app)
      .delete('/api/admin/workspaces/1')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent workspace', async () => {
    const res = await request(app)
      .delete('/api/admin/workspaces/999999')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .delete('/api/admin/workspaces/2');
    expect(res.status).toBe(401);
  });
});
