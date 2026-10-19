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

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// At least a first and a last name.
export const personName = (message) => (value) =>
  value.split(/\s+/).filter(Boolean).length < 2 ? message : null;

// Same password rules the register screen shows as a checklist.
export const PASSWORD_RULES = [
  (v) => v.length >= 8 && v.length <= 64,
  (v) => /[A-Z]/.test(v),
  (v) => /[a-z]/.test(v),
  (v) => /\d/.test(v),
  (v) => /[^A-Za-z0-9]/.test(v),
];

export const strongPassword = (message) => (value) =>
  PASSWORD_RULES.every((rule) => rule(value)) ? null : message;

// 10 digits once spaces, dashes, dots and parentheses are removed.
export function normalizePhone(value) {
  return value.replace(/[\s\-().]/g, '');
}

export const phone = (message) => (value) => (/^\d{10}$/.test(normalizePhone(value)) ? null : message);

/**
 * Accepts MM/DD/YYYY and returns YYYY-MM-DD, or null if it is not a real,
 * plausible date of birth (not in the future, not over 120 years ago).
 */
export function parseDob(value, now = Date.now()) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const real =
    date.getFullYear() === Number(yyyy) &&
    date.getMonth() === Number(mm) - 1 &&
    date.getDate() === Number(dd);
  const age = (now - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!real || age < 0 || age > 120) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export const dob = (message) => (value) => (parseDob(value) ? null : message);

// YYYY-MM-DD that is a real calendar date (used for ?date= on /stats).
export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
