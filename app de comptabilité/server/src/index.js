require('dotenv').config();

const express = require('express');
const cors    = require('cors');

// Initialise the DB (creates tables + seed data) on startup
require('./db/database');

const facturesRouter  = require('./routes/factures');
const depensesRouter  = require('./routes/depenses');
const tvaRouter       = require('./routes/tva');
const pnlRouter       = require('./routes/pnl');
const bilanRouter     = require('./routes/bilan');
const dashboardRouter = require('./routes/dashboard');
const qontoRouter     = require('./routes/qonto');
const errorHandler    = require('./middleware/errorHandler');
const { scheduleAutoSync } = require('./services/qontoService');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/factures',  facturesRouter);
app.use('/api/depenses',  depensesRouter);
app.use('/api/tva',       tvaRouter);
app.use('/api/pnl',       pnlRouter);
app.use('/api/bilan',     bilanRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/qonto',    qontoRouter);

// ── 404 catch-all ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// ── Error handler (must be last) ───────────────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Serveur démarré sur http://localhost:${PORT}`);
  console.log(`[server] Health : http://localhost:${PORT}/api/health`);
  scheduleAutoSync();
});

module.exports = app;
