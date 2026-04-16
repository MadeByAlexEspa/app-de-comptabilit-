require('dotenv').config();

const express = require('express');
const cors    = require('cors');

// Initialise the master DB (workspaces + users) on startup
require('./db/masterDb');

// Initialise the workspace DB (creates tables + seed data) on startup
require('./db/database');

const authRouter           = require('./routes/auth');
const adminRouter          = require('./routes/admin');
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
const errorHandler    = require('./middleware/errorHandler');
const { scheduleAutoSync: qontoAutoSync } = require('./services/qontoService');
const { scheduleAutoSync: shineAutoSync } = require('./services/shineService');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// ── Health check (public) ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Auth routes (public — no requireAuth) ─────────────────────────────────────
app.use('/api/auth', authRouter);

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

// ── Back-office admin (login public, reste protégé par token admin) ───────────
app.use('/api/admin/auth', adminRouter);          // POST /auth/login — public
app.use('/api/admin', requireAdminToken, adminRouter); // toutes les autres routes admin

// ── 404 catch-all ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// ── Error handler (must be last) ───────────────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
// Skip listen() when the module is imported by Jest — supertest binds its own port
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[server] Serveur démarré sur http://localhost:${PORT}`);
    console.log(`[server] Health : http://localhost:${PORT}/api/health`);
    qontoAutoSync();
    shineAutoSync();
  });
}

module.exports = app;
