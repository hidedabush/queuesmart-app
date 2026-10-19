import { validationError } from '../errors.js';
import { validateBody } from '../validation/validate.js';

// Runs before a controller: replaces req.body with the clean, validated
// value, or stops the request with 400 and every field that failed.
export function validate(schema) {
  return (req, res, next) => {
    const { value, errors } = validateBody(schema, req.body);
    if (Object.keys(errors).length > 0) throw validationError(errors);
    req.body = value;
    next();
  };
}
