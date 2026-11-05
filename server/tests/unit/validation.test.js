import { describe, expect, it } from 'vitest';
import { checkType, isIsoDate, matches, minLength } from '../../src/api/validation/rules.js';
import * as schemas from '../../src/api/validation/schemas.js';
import { validateBody } from '../../src/api/validation/validate.js';

const chars = (n) => 'a'.repeat(n);
const fieldsOf = (schema, body) => validateBody(schema, body).errors;

const goodService = {
  name: 'Allergy Shots',
  description: 'Scheduled allergy injections.',
  expectedDuration: 10,
  priority: 'low',
};

describe('type checks', () => {
  it('accepts only real integers', () => {
    expect(checkType('integer', 20)).toBeNull();
    expect(checkType('integer', '20')).toBe('Must be a whole number.');
    expect(checkType('integer', 20.5)).toBe('Must be a whole number.');
    expect(checkType('integer', true)).toBe('Must be a whole number.');
  });

  it('accepts only real booleans and strings', () => {
    expect(checkType('boolean', false)).toBeNull();
    expect(checkType('boolean', 'true')).toBe('Must be true or false.');
    expect(checkType('string', 42)).toBe('Must be text.');
  });

  it('reports a type error through a schema', () => {
    expect(fieldsOf(schemas.serviceCreate, { ...goodService, name: 42 }).name).toBe('Must be text.');
    expect(fieldsOf(schemas.serviceOpen, { isOpen: 'no' }).isOpen).toBe('Must be true or false.');
  });
});

describe('required fields', () => {
  it('reports every missing field at once', () => {
    const errors = fieldsOf(schemas.serviceCreate, {});
    expect(Object.keys(errors).sort()).toEqual(
      ['description', 'expectedDuration', 'name', 'priority'].sort()
    );
  });

  it('treats null, empty and whitespace-only strings as missing', () => {
    for (const blank of [null, '', '   ']) {
      expect(fieldsOf(schemas.serviceCreate, { ...goodService, name: blank }).name).toBe(
        'Enter a visit type name.'
      );
    }
  });

  it('capacity is optional', () => {
    const { value, errors } = validateBody(schemas.serviceCreate, goodService);
    expect(errors).toEqual({});
    expect(value).not.toHaveProperty('capacity');
  });

  it('ignores a body that is not an object', () => {
    expect(Object.keys(fieldsOf(schemas.serviceOpen, ['x']))).toEqual(['isOpen']);
    expect(Object.keys(fieldsOf(schemas.serviceOpen, undefined))).toEqual(['isOpen']);
  });
});

describe('length limits', () => {
  it.each([
    [2, false],
    [3, true],
    [100, true],
    [101, false],
  ])('service name of %i chars valid: %s', (n, ok) => {
    const errors = fieldsOf(schemas.serviceCreate, { ...goodService, name: chars(n) });
    expect(Boolean(errors.name)).toBe(!ok);
  });

  it.each([
    [300, true],
    [301, false],
  ])('description of %i chars valid: %s', (n, ok) => {
    const errors = fieldsOf(schemas.serviceCreate, { ...goodService, description: chars(n) });
    expect(Boolean(errors.description)).toBe(!ok);
  });

  it('trims text before measuring it', () => {
    const { value, errors } = validateBody(schemas.serviceCreate, { ...goodService, name: '  ab  ' });
    expect(errors.name).toBe('Use 3-100 characters.');
    expect(validateBody(schemas.serviceCreate, { ...goodService, name: ' Lab ' }).value.name).toBe('Lab');
    expect(value).not.toHaveProperty('name');
  });
});

describe('ranges and enums', () => {
  it.each([
    [0, false],
    [1, true],
    [120, true],
    [121, false],
  ])('expectedDuration %i valid: %s', (n, ok) => {
    const errors = fieldsOf(schemas.serviceCreate, { ...goodService, expectedDuration: n });
    expect(Boolean(errors.expectedDuration)).toBe(!ok);
  });

  it.each([
    [0, false],
    [1, true],
    [50, true],
    [51, false],
  ])('capacity %i valid: %s', (n, ok) => {
    const errors = fieldsOf(schemas.serviceCreate, { ...goodService, capacity: n });
    expect(Boolean(errors.capacity)).toBe(!ok);
  });

  it('only allows low, medium or high for priority', () => {
    expect(fieldsOf(schemas.serviceCreate, { ...goodService, priority: 'urgent' }).priority).toBe(
      'Choose low, medium or high.'
    );
    expect(fieldsOf(schemas.serviceCreate, { ...goodService, priority: 'HIGH' }).priority).toBeDefined();
  });
});

describe('partial updates and combined rules', () => {
  it('a PATCH needs at least one field', () => {
    expect(fieldsOf(schemas.serviceUpdate, {})).toEqual({ body: 'Send at least one field to change.' });
  });

  it('a PATCH checks only the fields that were sent', () => {
    expect(fieldsOf(schemas.serviceUpdate, { expectedDuration: 30 })).toEqual({});
    expect(fieldsOf(schemas.serviceUpdate, { expectedDuration: 0 }).expectedDuration).toBeDefined();
  });

  it('drops fields the schema does not know about', () => {
    const { value } = validateBody(schemas.serviceOpen, { isOpen: true, isAdmin: true });
    expect(value).toEqual({ isOpen: true });
  });

  it('runs transforms, defaults and cross-field checks', () => {
    const schema = {
      fields: {
        code: { type: 'string', required: true, message: 'Code?', rules: [], transform: (v) => v.toUpperCase() },
        note: { type: 'string', required: false, rules: [], default: null },
      },
      refine: (value) => (value.code === 'BAD' ? { code: 'Not allowed.' } : null),
    };
    expect(validateBody(schema, { code: 'ok' })).toEqual({ value: { code: 'OK', note: null }, errors: {} });
    expect(validateBody(schema, { code: 'bad' }).errors).toEqual({ code: 'Not allowed.' });
  });
});

describe('other rules', () => {
  it('minLength and matches', () => {
    expect(minLength(3, 'short')('ab')).toBe('short');
    expect(minLength(3, 'short')('abc')).toBeNull();
    expect(matches(/^\d+$/, 'digits')('12a')).toBe('digits');
    expect(matches(/^\d+$/, 'digits')('12')).toBeNull();
  });

  it('recognises real ISO dates only', () => {
    expect(isIsoDate('2026-10-19')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('10/19/2026')).toBe(false);
  });
});

describe('register', () => {
  const goodSignUp = {
    name: 'Taylor Morgan',
    dob: '03/14/1995',
    email: 'taylor@example.com',
    password: 'Queue#2026',
  };
  const NAME = 'Enter your first and last name.';
  const DOB = 'Enter a real date as MM/DD/YYYY.';
  const PASSWORD = 'Password does not meet all requirements.';

  it('accepts a good sign-up and cleans the values it stores', () => {
    const { value, errors } = validateBody(schemas.register, {
      ...goodSignUp,
      name: '  Taylor   Morgan ',
      email: 'Taylor@Example.COM',
      phone: '(713) 555-0101',
    });

    expect(errors).toEqual({});
    expect(value).toEqual({
      name: 'Taylor Morgan',
      dob: '1995-03-14',
      email: 'taylor@example.com',
      password: 'Queue#2026',
      phone: '7135550101',
    });
  });

  it('reports every missing required field', () => {
    expect(Object.keys(fieldsOf(schemas.register, {})).sort()).toEqual(
      ['dob', 'email', 'name', 'password'].sort()
    );
  });

  it('needs a first and last name of 3-80 characters', () => {
    expect(fieldsOf(schemas.register, { ...goodSignUp, name: 'Taylor' }).name).toBe(NAME);
    expect(fieldsOf(schemas.register, { ...goodSignUp, name: 'A B' }).name).toBeUndefined();
    expect(fieldsOf(schemas.register, { ...goodSignUp, name: `${chars(40)} ${chars(40)}` }).name).toBe(NAME);
  });

  it.each([
    ['ISO format', '1995-03-14'],
    ['a day that does not exist', '02/30/1995'],
    ['a future date', '01/01/2999'],
    ['an age over 120', '01/01/1800'],
  ])('rejects a date of birth in %s', (_, dob) => {
    expect(fieldsOf(schemas.register, { ...goodSignUp, dob }).dob).toBe(DOB);
  });

  it.each([
    ['too short', 'Ab#1'],
    ['too long', `Aa#1${chars(61)}`],
    ['no capital letter', 'queue#2026'],
    ['no lower-case letter', 'QUEUE#2026'],
    ['no digit', 'Queue#queue'],
    ['no symbol', 'Queue2026'],
  ])('rejects a password with %s', (_, password) => {
    expect(fieldsOf(schemas.register, { ...goodSignUp, password }).password).toBe(PASSWORD);
  });

  it('checks the email shape and length', () => {
    expect(fieldsOf(schemas.register, { ...goodSignUp, email: 'taylor@example' }).email).toBe(
      'Enter a valid email address.'
    );
    expect(fieldsOf(schemas.register, { ...goodSignUp, email: `${chars(250)}@x.com` }).email).toBe(
      'Keep it to 254 characters or fewer.'
    );
  });

  it('phone is optional, but must be 10 digits when sent', () => {
    expect(validateBody(schemas.register, goodSignUp).value).not.toHaveProperty('phone');
    expect(fieldsOf(schemas.register, { ...goodSignUp, phone: '555-0101' }).phone).toBe(
      'Enter a 10-digit phone number.'
    );
  });
});

describe('login and change password', () => {
  it('login only checks presence and the email shape, not password strength', () => {
    expect(fieldsOf(schemas.login, { email: 'a@b.co', password: 'x' })).toEqual({});
    expect(fieldsOf(schemas.login, { email: 'nope', password: '' })).toEqual({
      email: 'Enter a valid email address.',
      password: 'Password is required.',
    });
  });

  it('a new password follows the sign-up rules', () => {
    expect(fieldsOf(schemas.changePassword, { password: 'weak' }).password).toBe(
      'Password does not meet all requirements.'
    );
    expect(fieldsOf(schemas.changePassword, { password: 'Stronger#2026' })).toEqual({});
  });
});

describe('queue bodies', () => {
  it('a visit reason is 3-120 characters', () => {
    const reasonError = (reason) => fieldsOf(schemas.joinQueue, { reason }).reason;

    expect(reasonError('')).toBe('Enter a reason for your visit.');
    expect(reasonError('ab')).toBe('Use 3-120 characters for your visit reason.');
    expect(reasonError(chars(121))).toBe('Use 3-120 characters for your visit reason.');
    expect(reasonError('New cough')).toBeUndefined();
  });

  it('a called patient is resolved as seen or no-show only', () => {
    expect(fieldsOf(schemas.resolveCalled, { outcome: 'seen' })).toEqual({});
    expect(fieldsOf(schemas.resolveCalled, { outcome: 'done' }).outcome).toBe('Choose seen or no-show.');
  });

  it('an entry update is a move or a triage change, never both', () => {
    expect(fieldsOf(schemas.entryUpdate, { direction: -1 })).toEqual({});
    expect(fieldsOf(schemas.entryUpdate, { priority: 'urgent' })).toEqual({});
    expect(fieldsOf(schemas.entryUpdate, { direction: '1' }).direction).toBe('Must be a whole number.');
    expect(fieldsOf(schemas.entryUpdate, { direction: 1, priority: 'urgent' })).toEqual({
      body: 'Send either direction or priority, not both.',
    });
  });
});
