import { MAX_CAPACITY } from '../services/officeRules.js';
import { intRange, length, maxLength, oneOf } from './rules.js';

/**
 * One schema per request body. Each field lists:
 *   type       string | integer | boolean   (checked first)
 *   required   true -> a missing/blank value is an error
 *   message    the "required" message
 *   rules      checked in order; the first failure is reported
 *   transform  turns the accepted value into what is stored
 *   default    used when an optional field is missing
 * A schema can also set `partial: true` (PATCH: only sent fields are
 * checked, but at least one is needed) or `refine(value)` for rules that
 * look at more than one field.
 *
 * Teammates add their schemas here (register, login, joinQueue, ...); see
 * docs/A3-api-spec.txt section 2 for their field rules.
 */

export const SERVICE_NAME = { min: 3, max: 100 };
export const DESCRIPTION_MAX = 300;
export const DURATION = { min: 1, max: 120 };

const serviceFields = {
  name: {
    type: 'string',
    required: true,
    message: 'Enter a visit type name.',
    rules: [
      length(
        SERVICE_NAME.min,
        SERVICE_NAME.max,
        `Use ${SERVICE_NAME.min}-${SERVICE_NAME.max} characters.`
      ),
    ],
  },
  description: {
    type: 'string',
    required: true,
    message: 'Describe what this visit type is for.',
    rules: [maxLength(DESCRIPTION_MAX, `Keep it to ${DESCRIPTION_MAX} characters or fewer.`)],
  },
  expectedDuration: {
    type: 'integer',
    required: true,
    message: 'Enter how long one visit usually takes.',
    rules: [
      intRange(
        DURATION.min,
        DURATION.max,
        `Enter a whole number from ${DURATION.min} to ${DURATION.max}.`
      ),
    ],
  },
  priority: {
    type: 'string',
    required: true,
    message: 'Choose an urgency level.',
    rules: [oneOf(['low', 'medium', 'high'], 'Choose low, medium or high.')],
  },
  capacity: {
    type: 'integer',
    required: false,
    rules: [intRange(1, MAX_CAPACITY, `Enter a whole number from 1 to ${MAX_CAPACITY}.`)],
  },
};

export const serviceCreate = { fields: serviceFields };

export const serviceUpdate = { fields: serviceFields, partial: true };

export const serviceOpen = {
  fields: {
    isOpen: { type: 'boolean', required: true, message: 'isOpen is required.', rules: [] },
  },
};

export const joinQueue = {
  fields: {
    reason: {
      type: 'string',
      required: true,
      message: 'Enter a reason for your visit.',
      rules: [
        length(3, 120, 'Use 3-120 characters for your visit reason.'),
      ],
    },
  },
};

export const resolveCalled = {
  fields: {
    outcome: {
      type: 'string',
      required: true,
      message: 'Choose seen or no-show.',
      rules: [oneOf(['seen', 'no-show'], 'Choose seen or no-show.')],
    },
  },
};

// PATCH /queue/:entryId: a move or a triage change, never both at once.
export const entryUpdate = {
  partial: true,
  fields: {
    direction: {
      type: 'integer',
      rules: [oneOf([-1, 1], 'Direction must be -1 or 1.')],
    },
    priority: {
      type: 'string',
      rules: [oneOf(['normal', 'urgent'], 'Choose normal or urgent.')],
    },
  },
  refine: (value) =>
    'direction' in value && 'priority' in value
      ? { body: 'Send either direction or priority, not both.' }
      : null,
};