const { Router } = require('express');
const { register, login, forgotPassword, resetPassword } = require('../services/authService');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

// POST /api/auth/register — create a new workspace + owner account
router.post('/register', async (req, res, next) => {
  try {
    const result = await register(req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/login — authenticate and receive a JWT
router.post('/login', async (req, res, next) => {
  try {
    const result = await login(req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/me — return the authenticated user's claims (requires token)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/forgot-password — request a reset link (always 200 to avoid email enumeration)
router.post('/forgot-password', async (req, res, next) => {
  try {
    await forgotPassword(req.body);
    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/reset-password — set a new password via reset token
router.post('/reset-password', async (req, res, next) => {
  try {
    await resetPassword(req.body);
    res.json({ message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
