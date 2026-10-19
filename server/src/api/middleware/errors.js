import { AppError, notFound } from '../errors.js';

// Any path no route matched.
export function notFoundHandler(req, res, next) {
  next(notFound(`No route for ${req.method} ${req.path}.`));
}

// Turns every error into the one JSON shape the app understands.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { error: err.code, message: err.message };
    if (err.fields) body.fields = err.fields;
    return res.status(err.status).json(body);
  }

  // express.json() could not parse the request body.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'validation',
      message: 'Some fields need attention.',
      fields: { body: 'Request body must be valid JSON.' },
    });
  }

  if (!process.env.VITEST) console.error(err);
  return res.status(500).json({ error: 'server', message: 'Something went wrong.' });
}
