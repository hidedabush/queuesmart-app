import { MAX_CAPACITY } from '../services/officeRules.js';
import { intRange, isIsoDate, length, matches, maxLength, oneOf } from './rules.js';

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

// Auth (docs/A3-api-spec.txt section 2).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MESSAGE = 'Password does not meet all requirements.';
const DOB_MESSAGE = 'Enter a real date as MM/DD/YYYY.';
const PHONE_MESSAGE = 'Enter a 10-digit phone number.';
const NAME_MESSAGE = 'Enter your first and last name.';

// MM/DD/YYYY -> YYYY-MM-DD, or null if not a real date aged 0-120.
function parseDob(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  if (!isIsoDate(iso)) return null;
  const age = (Date.now() - Date.parse(`${iso}T00:00:00Z`)) / (365.25 * 24 * 3600 * 1000);
  return age < 0 || age > 120 ? null : iso;
}

const stripPhone = (value) => value.replace(/[\s\-()]/g, '');

const passwordRules = [
  length(8, 64, PASSWORD_MESSAGE),
  matches(/[A-Z]/, PASSWORD_MESSAGE),
  matches(/[a-z]/, PASSWORD_MESSAGE),
  matches(/\d/, PASSWORD_MESSAGE),
  matches(/[^A-Za-z0-9]/, PASSWORD_MESSAGE),
];

const emailField = {
  type: 'string',
  required: true,
  message: 'Email is required.',
  rules: [
    maxLength(254, 'Keep it to 254 characters or fewer.'),
    matches(EMAIL_PATTERN, 'Enter a valid email address.'),
  ],
  transform: (value) => value.toLowerCase(),
};

export const register = {
  fields: {
    name: {
      type: 'string',
      required: true,
      message: NAME_MESSAGE,
      rules: [length(3, 80, NAME_MESSAGE), matches(/\S+\s+\S+/, NAME_MESSAGE)],
      transform: (value) => value.replace(/\s+/g, ' '),
    },
    dob: {
      type: 'string',
      required: true,
      message: 'Date of birth is required.',
      rules: [(value) => (parseDob(value) ? null : DOB_MESSAGE)],
      transform: parseDob,
    },
    email: emailField,
    password: { type: 'string', required: true, message: 'Password is required.', rules: passwordRules },
    phone: {
      type: 'string',
      required: false,
      rules: [(value) => (/^\d{10}$/.test(stripPhone(value)) ? null : PHONE_MESSAGE)],
      transform: stripPhone,
    },
  },
};

// Login only checks that both fields are present and the email looks right.
export const login = {
  fields: {
    email: emailField,
    password: { type: 'string', required: true, message: 'Password is required.', rules: [] },
  },
};

export const changePassword = {
  fields: {
    password: { type: 'string', required: true, message: 'Password is required.', rules: passwordRules },
  },
};

// Staff: how a called patient's visit ended.
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