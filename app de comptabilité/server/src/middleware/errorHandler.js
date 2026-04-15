/**
 * Centralised error-handling middleware.
 * Must be registered LAST in Express (after all routes).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error('[ErrorHandler]', err);
  }

  const isProd  = process.env.NODE_ENV === 'production';
  const message = (status < 500 || !isProd)
    ? (err.message || 'Erreur interne du serveur')
    : 'Erreur interne du serveur';

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
