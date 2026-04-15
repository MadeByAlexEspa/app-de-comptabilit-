const { Router } = require('express');
const { register, login } = require('../services/authService');
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

module.exports = router;
