/**
 * One error type for the whole API. Business code throws these; the error
 * middleware turns them into the JSON shape in docs/A3-api-spec.txt:
 *   { error: <code>, message, fields? }
 */
export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const validationError = (fields) =>
  new AppError(400, 'validation', 'Some fields need attention.', fields);

// The auth teammate adds 401 (unauthenticated) and 403 (forbidden) helpers here.

export const notFound = (message = 'Not found.') => new AppError(404, 'not-found', message);

// A business rule blocked the request. `code` names the rule, e.g. 'full'.
export const conflict = (code, message) => new AppError(409, code, message);

// Auth helpers (docs/A3-api-spec.txt section 1).
export const unauthenticated = (message = 'Sign in to continue.') =>
  new AppError(401, 'unauthenticated', message);

export const forbidden = (message = 'You do not have access to this.') =>
  new AppError(403, 'forbidden', message);

// Same message for an unknown email and a wrong password.
export const invalidCredentials = () =>
  new AppError(401, 'unauthenticated', 'Email or password is incorrect.');

export const emailTaken = () =>
  conflict('email-taken', 'An account with this email already exists.');