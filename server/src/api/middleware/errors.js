import { AppError, notFound } from '../errors.js';

// Any path no route matched.
export function notFoundHandler(req, res, next) {
  next(notFound(`No route for ${req.method} ${req.path}.`));
}

// MySQL rejected a row that breaks a UNIQUE key: two requests raced past
// the service's own check (e.g. two check-ins at once for one patient).
const DUPLICATE = 'ER_DUP_ENTRY';

// MySQL rejected a value that breaks a column rule (CHECK, length, NOT NULL,
// type). Validation normally stops these first; this is the backstop.
const BAD_VALUE = new Set([
  'ER_CHECK_CONSTRAINT_VIOLATED',
  'ER_DATA_TOO_LONG',
  'ER_BAD_NULL_ERROR',
  'ER_TRUNCATED_WRONG_VALUE',
  'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD',
  'WARN_DATA_TRUNCATED',
]);

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

  if (err.code === DUPLICATE) {
    return res.status(409).json({
      error: 'conflict',
      message: 'That conflicts with something saved a moment ago. Refresh and try again.',
    });
  }

  if (BAD_VALUE.has(err.code)) {
    return res.status(400).json({
      error: 'validation',
      message: 'Some fields need attention.',
      fields: { body: 'The database rejected one of the values.' },
    });
  }

  if (!process.env.VITEST) console.error(err);
  return res.status(500).json({ error: 'server', message: 'Something went wrong.' });
}
