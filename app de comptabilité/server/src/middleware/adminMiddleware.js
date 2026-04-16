/**
 * Admin middleware — vérifie le token de session back-office.
 * Indépendant du système d'auth utilisateur (JWT payload adminSession: true).
 */
const { verifyToken } = require('../services/authService');

function requireAdminToken(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Session admin requise' });
  }
  try {
    const decoded = verifyToken(header.slice(7));
    if (!decoded.adminSession) {
      return res.status(403).json({ error: 'Token invalide pour le back-office' });
    }
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Session admin expirée ou invalide' });
  }
}

module.exports = { requireAdminToken };
