require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');

// Initialise the master DB (workspaces + users) on startup
require('./db/masterDb');

// Initialise the workspace DB (creates tables + seed data) on startup
require('./db/database');

const authRouter           = require('./routes/auth');
const { loginRouter: adminLoginRouter, adminRouter } = require('./routes/admin');
const { requireAuth }      = require('./middleware/authMiddleware');
const { requireAdminToken } = require('./middleware/adminMiddleware');

const facturesRouter  = require('./routes/factures');
const depensesRouter  = require('./routes/depenses');
const tvaRouter       = require('./routes/tva');
const pnlRouter       = require('./routes/pnl');
const bilanRouter     = require('./routes/bilan');
const dashboardRouter = require('./routes/dashboard');
const qontoRouter        = require('./routes/qonto');
const shineRouter        = require('./routes/shine');
const transactionsRouter = require('./routes/transactions');
const aiRouter           = require('./routes/ai');
const workspaceRouter    = require('./routes/workspace');
const inviteRouter       = require('./routes/invite');
const errorHandler    = require('./middleware/errorHandler');
const { scheduleAutoSync: qontoAutoSync } = require('./services/qontoService');
const { scheduleAutoSync: shineAutoSync } = require('./services/shineService');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// ── Rate limiting ──────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
});

// ── Health check (public) ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Auth routes (public — no requireAuth) ─────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);

// ── Protected routes (requireAuth applied to every router) ────────────────────
app.use('/api/factures',     requireAuth, facturesRouter);
app.use('/api/depenses',     requireAuth, depensesRouter);
app.use('/api/tva',          requireAuth, tvaRouter);
app.use('/api/pnl',          requireAuth, pnlRouter);
app.use('/api/bilan',        requireAuth, bilanRouter);
app.use('/api/dashboard',    requireAuth, dashboardRouter);
app.use('/api/qonto',        requireAuth, qontoRouter);
app.use('/api/shine',        requireAuth, shineRouter);
app.use('/api/transactions', requireAuth, transactionsRouter);
app.use('/api/ai',           requireAuth, aiRouter);
app.use('/api/workspace',    requireAuth, workspaceRouter);
app.use('/api/invite',       inviteRouter);  // accept invite (public)

// ── Back-office admin — deux routers distincts ────────────────────────────────
app.use('/api/admin/auth', adminLimiter, adminLoginRouter);   // login public uniquement
app.use('/api/admin',      requireAdminToken, adminRouter);   // toutes les routes protégées

// ── 404 catch-all ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// ── Error handler (must be last) ───────────────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[server] Serveur démarré sur http://localhost:${PORT}`);
    console.log(`[server] Health : http://localhost:${PORT}/api/health`);
    qontoAutoSync();
    shineAutoSync();
  });
}

module.exports = app;
