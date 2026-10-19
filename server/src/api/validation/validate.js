import { checkType } from './rules.js';

const isBlank = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/**
 * Checks `body` against a schema (see schemas.js). Order per field:
 * required -> type -> rules. Every failing field is reported at once, with
 * the first message for that field.
 *
 * Returns { value, errors }: `value` holds only the schema's fields, trimmed
 * and transformed; `errors` is {} when everything passed.
 */
export function validateBody(schema, body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};
  const value = {};

  for (const [field, spec] of Object.entries(schema.fields)) {
    let raw = input[field];
    if (typeof raw === 'string') raw = raw.trim();

    if (isBlank(raw)) {
      if (schema.partial) continue;
      if (spec.required) errors[field] = spec.message;
      else if ('default' in spec) value[field] = spec.default;
      continue;
    }

    const typeError = checkType(spec.type, raw);
    if (typeError) {
      errors[field] = typeError;
      continue;
    }

    const ruleError = spec.rules.map((rule) => rule(raw)).find(Boolean);
    if (ruleError) {
      errors[field] = ruleError;
      continue;
    }

    value[field] = spec.transform ? spec.transform(raw) : raw;
  }

  if (schema.partial && Object.keys(value).length === 0 && Object.keys(errors).length === 0) {
    errors.body = 'Send at least one field to change.';
  }

  if (Object.keys(errors).length === 0 && schema.refine) {
    Object.assign(errors, schema.refine(value) ?? {});
  }

  return { value, errors };
}
