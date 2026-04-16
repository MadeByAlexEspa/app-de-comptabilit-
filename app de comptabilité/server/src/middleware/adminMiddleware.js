/**
 * Admin middleware — restricts access to superadmin users only.
 */

function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

module.exports = { requireSuperAdmin };
