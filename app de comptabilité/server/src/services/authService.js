const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const masterDb = require('../db/masterDb');

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
  if (password.length < 6) {
    throw Object.assign(new Error('Mot de passe trop court (6 caractères min)'), { status: 400 });
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

module.exports = { register, login, verifyToken };
