/**
 * Integration tests for /api/workspace routes.
 */
process.env.JWT_SECRET = 'test-secret-for-jest';
process.env.NODE_ENV   = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');
const app     = require('../index');

let ownerToken;
let ownerUserId;
let workspaceId;

beforeAll(async () => {
  const masterDb = require('../db/masterDb');

  // Use workspace 1 (seeded on startup in test env)
  const ws = masterDb.prepare('SELECT id FROM workspaces WHERE id = 1').get();
  workspaceId = ws.id;

  // Create a dedicated owner for these tests
  const hash = await bcrypt.hash('owner5678', 10);
  const email = `ws-owner-${Date.now()}@test.com`;
  masterDb.run(
    'INSERT OR IGNORE INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [workspaceId, email, hash, 'owner']
  );

  const user = masterDb.prepare('SELECT * FROM users WHERE email = ?').get(email);
  ownerUserId = user.id;

  ownerToken = jwt.sign(
    { userId: ownerUserId, workspaceId, workspaceName: 'Démo', email, role: 'owner' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

// ── GET /api/workspace ────────────────────────────────────────────────────────

describe('GET /api/workspace', () => {
  it('returns the workspace with its users', async () => {
    const res = await request(app)
      .get('/api/workspace')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', workspaceId);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('slug');
    expect(res.body).toHaveProperty('created_at');
    expect(Array.isArray(res.body.users)).toBe(true);
    res.body.users.forEach(u => {
      expect(u).not.toHaveProperty('password_hash');
      expect(u).toHaveProperty('email');
      expect(u).toHaveProperty('role');
    });
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/workspace');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/workspace/name ─────────────────────────────────────────────────

describe('PATCH /api/workspace/name', () => {
  it('updates the workspace name', async () => {
    const res = await request(app)
      .patch('/api/workspace/name')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Nouveau Nom' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'Nouveau Nom');
    expect(res.body).toHaveProperty('id', workspaceId);
    expect(res.body).toHaveProperty('slug');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .patch('/api/workspace/name')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is empty string', async () => {
    const res = await request(app)
      .patch('/api/workspace/name')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .patch('/api/workspace/name')
      .send({ name: 'Test' });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/workspace/users/:id ──────────────────────────────────────────

describe('DELETE /api/workspace/users/:id', () => {
  let deletableUserId;

  beforeAll(async () => {
    const masterDb = require('../db/masterDb');
    const hash = await bcrypt.hash('del5678', 10);
    const email = `ws-del-user-${Date.now()}@test.com`;
    masterDb.run(
      'INSERT OR IGNORE INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [workspaceId, email, hash, 'owner']
    );
    const u = masterDb.prepare('SELECT id FROM users WHERE email = ?').get(email);
    deletableUserId = u.id;
  });

  it('deletes a user from the workspace', async () => {
    const res = await request(app)
      .delete(`/api/workspace/users/${deletableUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when trying to delete self', async () => {
    const res = await request(app)
      .delete(`/api/workspace/users/${ownerUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for a user not in this workspace', async () => {
    const res = await request(app)
      .delete('/api/workspace/users/999999')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .delete(`/api/workspace/users/${deletableUserId}`);
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/workspace ─────────────────────────────────────────────────────

describe('DELETE /api/workspace', () => {
  it('returns 403 when trying to delete workspace 1', async () => {
    const res = await request(app)
      .delete('/api/workspace')
      .set('Authorization', `Bearer ${ownerToken}`);
    // ownerToken uses workspaceId 1
    expect(res.status).toBe(403);
  });

  it('deletes a non-system workspace', async () => {
    const masterDb = require('../db/masterDb');
    const jwt2     = require('jsonwebtoken');
    const bcrypt2  = require('bcrypt');

    // Create a throwaway workspace + user
    masterDb.run(
      "INSERT INTO workspaces (name, slug) VALUES (?, ?)",
      ['Throwaway Corp', `throwaway-${Date.now()}`]
    );
    const ws = masterDb.prepare("SELECT id FROM workspaces WHERE name = 'Throwaway Corp'").get();
    const hash = await bcrypt2.hash('bye1234', 10);
    masterDb.run(
      'INSERT INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [ws.id, `throwaway-${Date.now()}@test.com`, hash, 'owner']
    );

    const throwawayToken = jwt2.sign(
      { userId: 9999, workspaceId: ws.id, workspaceName: 'Throwaway Corp', email: 'x@x.com', role: 'owner' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .delete('/api/workspace')
      .set('Authorization', `Bearer ${throwawayToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify workspace is truly gone (node-sqlite3-wasm returns null for no row)
    const gone = masterDb.prepare('SELECT id FROM workspaces WHERE id = ?').get(ws.id);
    expect(gone).toBeFalsy();
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).delete('/api/workspace');
    expect(res.status).toBe(401);
  });
});
