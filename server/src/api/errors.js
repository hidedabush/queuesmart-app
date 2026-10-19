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

export const unauthenticated = (message = 'Sign in to continue.') =>
  new AppError(401, 'unauthenticated', message);

export const forbidden = (message = 'Only front-desk staff can do that.') =>
  new AppError(403, 'forbidden', message);

export const notFound = (message = 'Not found.') => new AppError(404, 'not-found', message);

// A business rule blocked the request. `code` names the rule, e.g. 'full'.
export const conflict = (code, message) => new AppError(409, code, message);
