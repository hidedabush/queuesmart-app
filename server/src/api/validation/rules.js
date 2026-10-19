/**
 * Validation building blocks. Each rule takes a value that is already known
 * to be the right type and returns an error message, or null if it passes.
 * schemas.js combines them per field; validate.js runs a schema.
 */

const TYPE_MESSAGES = {
  string: 'Must be text.',
  integer: 'Must be a whole number.',
  boolean: 'Must be true or false.',
};

// The type check runs before any other rule. Numbers sent as strings are
// rejected, not converted, so the client always sends real types.
export function checkType(type, value) {
  const ok =
    (type === 'string' && typeof value === 'string') ||
    (type === 'integer' && Number.isInteger(value)) ||
    (type === 'boolean' && typeof value === 'boolean');
  return ok ? null : TYPE_MESSAGES[type];
}

export const length = (min, max, message) => (value) =>
  value.length < min || value.length > max ? message : null;

export const minLength = (min, message) => (value) => (value.length < min ? message : null);

export const maxLength = (max, message) => (value) => (value.length > max ? message : null);

export const intRange = (min, max, message) => (value) =>
  value < min || value > max ? message : null;

export const oneOf = (allowed, message) => (value) => (allowed.includes(value) ? null : message);

export const matches = (pattern, message) => (value) => (pattern.test(value) ? null : message);

// YYYY-MM-DD that is a real calendar date (used for ?date= on /stats).
export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
