/**
 * Integration tests for /api/workspace/invitations and /api/invite routes.
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

// Unique suffix per test run to avoid cross-test collisions
const SUFFIX = Date.now();
const uniqueEmail = (label = '') =>
  `inv-${label}-${SUFFIX}-${Math.random().toString(36).slice(2)}@test.com`;

beforeAll(async () => {
  const masterDb = require('../db/masterDb');

  // Use workspace 1 (seeded on startup in test env)
  workspaceId = 1;

  const hash  = await bcrypt.hash('owner5678', 10);
  const email = `inv-owner-${SUFFIX}@test.com`;

  masterDb
    .prepare('INSERT OR IGNORE INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(workspaceId, email, hash, 'owner');

  const user = masterDb.prepare('SELECT * FROM users WHERE email = ?').get(email);
  ownerUserId = user.id;

  ownerToken = jwt.sign(
    { userId: ownerUserId, workspaceId, workspaceName: 'Démo', email, role: 'owner' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

// ── POST /api/workspace/invitations ──────────────────────────────────────────

describe('POST /api/workspace/invitations', () => {
  it('happy path — returns inviteUrl and token', async () => {
    const email = uniqueEmail('post');
    const res = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email', email);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('expires_at');
    expect(res.body).toHaveProperty('inviteUrl');
    expect(res.body.inviteUrl).toContain(res.body.token);
  });

  it('returns 400 for an invalid email', async () => {
    const res = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 409 when email already belongs to a user', async () => {
    // ownerToken's own email is already a user
    const masterDb = require('../db/masterDb');
    const existingUser = masterDb.prepare('SELECT email FROM users WHERE id = ?').get(ownerUserId);

    const res = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: existingUser.email });

    expect(res.status).toBe(409);
  });

  it('returns 409 when an active invitation already exists', async () => {
    const email = uniqueEmail('dup');

    // First invitation
    await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });

    // Duplicate while still active
    const res = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });

    expect(res.status).toBe(409);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/workspace/invitations')
      .send({ email: uniqueEmail('noauth') });

    expect(res.status).toBe(401);
  });
});

// ── GET /api/workspace/invitations ───────────────────────────────────────────

describe('GET /api/workspace/invitations', () => {
  beforeAll(async () => {
    // Create at least one invitation so the list is non-empty
    await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: uniqueEmail('list') });
  });

  it('lists invitations for the workspace', async () => {
    const res = await request(app)
      .get('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    res.body.forEach(inv => {
      expect(inv).toHaveProperty('id');
      expect(inv).toHaveProperty('email');
      expect(inv).toHaveProperty('role');
      expect(inv).toHaveProperty('expires_at');
      expect(inv).toHaveProperty('created_at');
      // Token must never be returned
      expect(inv).not.toHaveProperty('token');
    });
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/workspace/invitations');
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/workspace/invitations/:id ─────────────────────────────────────

describe('DELETE /api/workspace/invitations/:id', () => {
  let invitationId;
  let invitationToken;

  beforeAll(async () => {
    const email = uniqueEmail('del');
    const res = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });

    invitationId    = res.body.id;
    invitationToken = res.body.token;
  });

  it('happy path — deletes a pending invitation', async () => {
    const res = await request(app)
      .delete(`/api/workspace/invitations/${invitationId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  it('returns 400 when the invitation is already used', async () => {
    const masterDb = require('../db/masterDb');

    // Create a fresh invitation then mark it as used
    const email = uniqueEmail('used');
    const createRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });

    const usedId = createRes.body.id;
    masterDb.prepare("UPDATE invitations SET used_at = datetime('now') WHERE id = ?").run(usedId);

    const res = await request(app)
      .delete(`/api/workspace/invitations/${usedId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for an invitation belonging to another workspace', async () => {
    const masterDb = require('../db/masterDb');
    const jwt2     = require('jsonwebtoken');

    // Create a second workspace
    masterDb
      .prepare("INSERT INTO workspaces (name, slug) VALUES (?, ?)")
      .run('Other Corp', `other-${SUFFIX}`);
    const ws2 = masterDb.prepare("SELECT id FROM workspaces WHERE slug = ?").get(`other-${SUFFIX}`);

    // Create a user in workspace 2 and get a token for it
    const hash = await bcrypt.hash('pass1234', 10);
    const ws2Email = `ws2-owner-${SUFFIX}@test.com`;
    masterDb
      .prepare('INSERT OR IGNORE INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(ws2.id, ws2Email, hash, 'owner');
    const ws2User  = masterDb.prepare('SELECT id FROM users WHERE email = ?').get(ws2Email);
    const ws2Token = jwt2.sign(
      { userId: ws2User.id, workspaceId: ws2.id, workspaceName: 'Other Corp', email: ws2Email, role: 'owner' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create an invitation in workspace 1 (ownerToken's workspace)
    const email = uniqueEmail('xws');
    const invRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });

    const ws1InvId = invRes.body.id;

    // Try to delete it from workspace 2 — should 404
    const res = await request(app)
      .delete(`/api/workspace/invitations/${ws1InvId}`)
      .set('Authorization', `Bearer ${ws2Token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).delete(`/api/workspace/invitations/${invitationId}`);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/invite/:token ────────────────────────────────────────────────────

describe('GET /api/invite/:token', () => {
  let validToken;

  beforeAll(async () => {
    const email = uniqueEmail('pubget');
    const res = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });
    validToken = res.body.token;
  });

  it('returns public invitation info without the token', async () => {
    const res = await request(app).get(`/api/invite/${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('workspace_name');
    expect(res.body).toHaveProperty('expires_at');
    expect(res.body).not.toHaveProperty('token');
  });

  it('returns 404 for an unknown token', async () => {
    const res = await request(app).get('/api/invite/deadbeefdeadbeefdeadbeef');
    expect(res.status).toBe(404);
  });

  it('returns 410 for an expired invitation', async () => {
    const masterDb = require('../db/masterDb');
    const email = uniqueEmail('expired');

    const createRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });

    const expiredToken = createRes.body.id;
    // Force expiry
    masterDb
      .prepare("UPDATE invitations SET expires_at = datetime('now', '-1 hour') WHERE id = ?")
      .run(expiredToken);

    // Fetch the actual token string from db
    const inv = masterDb.prepare('SELECT token FROM invitations WHERE id = ?').get(expiredToken);
    const res = await request(app).get(`/api/invite/${inv.token}`);
    expect(res.status).toBe(410);
  });

  it('returns 410 for an already used invitation', async () => {
    const masterDb = require('../db/masterDb');
    const email = uniqueEmail('usedget');

    const createRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });

    const usedId = createRes.body.id;
    masterDb.prepare("UPDATE invitations SET used_at = datetime('now') WHERE id = ?").run(usedId);

    const inv = masterDb.prepare('SELECT token FROM invitations WHERE id = ?').get(usedId);
    const res = await request(app).get(`/api/invite/${inv.token}`);
    expect(res.status).toBe(410);
  });
});

// ── POST /api/invite/:token ───────────────────────────────────────────────────

describe('POST /api/invite/:token', () => {
  let validToken;
  let invitedEmail;

  beforeAll(async () => {
    invitedEmail = uniqueEmail('accept');
    const res = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: invitedEmail });
    validToken = res.body.token;
  });

  it('happy path — accepts an invitation and creates the user', async () => {
    const res = await request(app)
      .post(`/api/invite/${validToken}`)
      .send({ password: 'newpass99' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('email', invitedEmail);
  });

  it('returns 410 after an invitation has been used', async () => {
    // validToken was consumed by the previous test
    const res = await request(app)
      .post(`/api/invite/${validToken}`)
      .send({ password: 'newpass99' });

    expect(res.status).toBe(410);
  });

  it('returns 400 when password is too short', async () => {
    const email = uniqueEmail('shortpw');
    const createRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });

    const res = await request(app)
      .post(`/api/invite/${createRes.body.token}`)
      .send({ password: 'abc' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown token', async () => {
    const res = await request(app)
      .post('/api/invite/unknowntoken00000000000000000')
      .send({ password: 'secure123' });
    expect(res.status).toBe(404);
  });

  it('returns 409 when the email is already taken (race-condition guard)', async () => {
    const masterDb = require('../db/masterDb');
    const email = uniqueEmail('race');

    const createRes = await request(app)
      .post('/api/workspace/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email });

    // Manually insert the user before accepting the invite
    const hash = await bcrypt.hash('hijack1234', 10);
    masterDb
      .prepare('INSERT INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(workspaceId, email, hash, 'owner');

    const res = await request(app)
      .post(`/api/invite/${createRes.body.token}`)
      .send({ password: 'secure123' });

    expect(res.status).toBe(409);
  });
});
