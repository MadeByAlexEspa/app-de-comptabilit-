const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const masterDb = require('../db/masterDb');
const { sendPasswordResetEmail } = require('./emailService');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('[auth] JWT_SECRET environment variable is required. Add it to your .env file.');
}
const JWT_EXPIRES = '7d';

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function register({ companyName, email, password }) {
  if (!companyName || !email || !password) {
    throw Object.assign(new Error('Champs manquants'), { status: 400 });
  }
  if (password.length < 8) {
    throw Object.assign(new Error('Mot de passe trop court (8 caractères min)'), { status: 400 });
  }

  // Email must be globally unique across all workspaces
  const existing = masterDb.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw Object.assign(new Error('Cet email est déjà utilisé'), { status: 409 });
  }

  // Create workspace with unique slug
  let slug = slugify(companyName) || 'workspace';
  const slugExists = masterDb.prepare('SELECT id FROM workspaces WHERE slug = ?').get(slug);
  if (slugExists) slug = slug + '-' + Date.now();

  masterDb.run('INSERT INTO workspaces (name, slug) VALUES (?, ?)', [companyName, slug]);
  const workspace = masterDb.prepare('SELECT * FROM workspaces WHERE slug = ?').get(slug);

  const password_hash = await bcrypt.hash(password, 10);
  masterDb.run(
    'INSERT INTO users (workspace_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [workspace.id, email, password_hash, 'owner']
  );
  const user = masterDb
    .prepare('SELECT * FROM users WHERE email = ? AND workspace_id = ?')
    .get(email, workspace.id);

  return signToken(user, workspace);
}

async function login({ email, password }) {
  if (!email || !password) {
    throw Object.assign(new Error('Email et mot de passe requis'), { status: 400 });
  }

  const user = masterDb.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    throw Object.assign(new Error('Identifiants incorrects'), { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw Object.assign(new Error('Identifiants incorrects'), { status: 401 });
  }

  const workspace = masterDb
    .prepare('SELECT * FROM workspaces WHERE id = ?')
    .get(user.workspace_id);

  masterDb.run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", [user.id]);
  // Re-fetch user to get updated data
  const updatedUser = masterDb.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return signToken(updatedUser, workspace);
}

function signToken(user, workspace) {
  const payload = {
    userId:        user.id,
    workspaceId:   workspace.id,
    workspaceName: workspace.name,
    email:         user.email,
    role:          user.role,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { token, user: payload };
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function forgotPassword({ email }) {
  if (!email) throw Object.assign(new Error('Email requis'), { status: 400 });

  // Purge expired tokens for this email
  masterDb.run(
    'DELETE FROM password_reset_tokens WHERE email = ? OR expires_at < ?',
    [email, Date.now()]
  );

  // Don't reveal whether the email exists — always respond 200
  const user = masterDb.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return; // silent

  const rawToken  = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

  masterDb.run(
    'INSERT INTO password_reset_tokens (email, token_hash, expires_at) VALUES (?, ?, ?)',
    [email, tokenHash, expiresAt]
  );

  const appUrl   = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
  // Fire-and-forget — ne bloque pas la réponse HTTP
  sendPasswordResetEmail(email, resetUrl).catch(err =>
    console.error('[email] Background send failed:', err.message)
  );
}

async function resetPassword({ token, password }) {
  if (!token || !password) {
    throw Object.assign(new Error('Token et mot de passe requis'), { status: 400 });
  }
  if (password.length < 8) {
    throw Object.assign(new Error('Mot de passe trop court (8 caractères min)'), { status: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = masterDb
    .prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used = 0')
    .get(tokenHash);

  if (!record) {
    throw Object.assign(new Error('Lien invalide ou déjà utilisé'), { status: 400 });
  }
  if (record.expires_at < Date.now()) {
    throw Object.assign(new Error('Ce lien a expiré. Faites une nouvelle demande.'), { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  masterDb.run('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, record.email]);
  masterDb.run('UPDATE password_reset_tokens SET used = 1 WHERE token_hash = ?', [tokenHash]);
}

module.exports = { register, login, verifyToken, signToken, forgotPassword, resetPassword };
