import { MAX_CAPACITY, REASON_MAX, REASON_MIN } from '../services/officeRules.js';
import {
  EMAIL_PATTERN,
  dob,
  intRange,
  length,
  matches,
  maxLength,
  minLength,
  normalizePhone,
  oneOf,
  parseDob,
  personName,
  phone,
  strongPassword,
} from './rules.js';

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
 */

export const SERVICE_NAME = { min: 3, max: 100 };
export const DESCRIPTION_MAX = 300;
export const DURATION = { min: 1, max: 120 };

const email = {
  type: 'string',
  required: true,
  message: 'Email is required.',
  rules: [
    maxLength(254, 'Keep the email to 254 characters or fewer.'),
    matches(EMAIL_PATTERN, 'Enter a valid email address.'),
  ],
  transform: (v) => v.toLowerCase(),
};

const password = {
  type: 'string',
  required: true,
  message: 'Password is required.',
  rules: [strongPassword('Password does not meet all requirements.')],
};

export const register = {
  fields: {
    name: {
      type: 'string',
      required: true,
      message: 'Enter your full legal name.',
      rules: [
        length(3, 80, 'Use 3-80 characters.'),
        personName('Enter your first and last name.'),
      ],
      transform: (v) => v.replace(/\s+/g, ' '),
    },
    dob: {
      type: 'string',
      required: true,
      message: 'Date of birth is required.',
      rules: [dob('Enter a real date as MM/DD/YYYY.')],
      transform: (v) => parseDob(v),
    },
    email,
    password,
    phone: {
      type: 'string',
      required: false,
      rules: [phone('Enter a 10-digit phone number.')],
      transform: normalizePhone,
      default: null,
    },
  },
};

export const login = {
  fields: {
    email: { ...email, rules: [matches(EMAIL_PATTERN, 'Enter a valid email address.')] },
    // Only "present" here: the login itself says whether it is right.
    password: { type: 'string', required: true, message: 'Password is required.', rules: [] },
  },
};

export const changePassword = { fields: { password } };

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
      message: 'Tell us briefly why you are coming in.',
      rules: [
        minLength(REASON_MIN, `Use at least ${REASON_MIN} characters.`),
        maxLength(REASON_MAX, `Keep it to ${REASON_MAX} characters or fewer.`),
      ],
    },
  },
};

export const resolveCalled = {
  fields: {
    outcome: {
      type: 'string',
      required: true,
      message: 'Outcome is required.',
      rules: [oneOf(['seen', 'no-show'], 'Choose seen or no-show.')],
    },
  },
};

export const updateEntry = {
  fields: {
    direction: {
      type: 'integer',
      required: false,
      rules: [oneOf([-1, 1], 'Direction must be -1 or 1.')],
    },
    priority: {
      type: 'string',
      required: false,
      rules: [oneOf(['normal', 'urgent'], 'Choose normal or urgent.')],
    },
  },
  // Exactly one change per request keeps the result easy to reason about.
  refine(value) {
    const sent = ['direction', 'priority'].filter((key) => value[key] !== undefined);
    if (sent.length === 1) return null;
    return { body: 'Send either direction or priority, not both.' };
  },
};
