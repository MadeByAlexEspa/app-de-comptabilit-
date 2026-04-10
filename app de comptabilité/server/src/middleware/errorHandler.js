/**
 * Centralised error-handling middleware.
 * Must be registered LAST in Express (after all routes).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[ErrorHandler]', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Erreur interne du serveur';

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
