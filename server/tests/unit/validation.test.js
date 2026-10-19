import { describe, expect, it } from 'vitest';
import {
  checkType,
  isIsoDate,
  normalizePhone,
  parseDob,
} from '../../src/api/validation/rules.js';
import * as schemas from '../../src/api/validation/schemas.js';
import { validateBody } from '../../src/api/validation/validate.js';

const chars = (n) => 'a'.repeat(n);
const fieldsOf = (schema, body) => validateBody(schema, body).errors;

const goodRegister = {
  name: 'Ana Torres',
  dob: '03/14/1995',
  email: 'Ana@Example.com',
  password: 'Queue#2026',
};

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
      expect(fieldsOf(schemas.joinQueue, { reason: blank }).reason).toBe(
        'Tell us briefly why you are coming in.'
      );
    }
  });

  it('uses the default for a missing optional field', () => {
    const { value, errors } = validateBody(schemas.register, goodRegister);
    expect(errors).toEqual({});
    expect(value.phone).toBeNull();
  });

  it('ignores a body that is not an object', () => {
    expect(Object.keys(fieldsOf(schemas.joinQueue, ['x']))).toEqual(['reason']);
    expect(Object.keys(fieldsOf(schemas.joinQueue, undefined))).toEqual(['reason']);
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

  it.each([
    [2, 'Use at least 3 characters.'],
    [3, undefined],
    [120, undefined],
    [121, 'Keep it to 120 characters or fewer.'],
  ])('reason of %i chars -> %s', (n, message) => {
    expect(fieldsOf(schemas.joinQueue, { reason: chars(n) }).reason).toBe(message);
  });

  it('trims the reason before measuring it', () => {
    expect(validateBody(schemas.joinQueue, { reason: '  ab  ' }).errors.reason).toBe(
      'Use at least 3 characters.'
    );
  });

  it('limits email to 254 characters', () => {
    const long = `${chars(250)}@a.co`;
    expect(fieldsOf(schemas.register, { ...goodRegister, email: long }).email).toMatch(/254/);
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

  it('only allows low, medium or high for service priority', () => {
    expect(fieldsOf(schemas.serviceCreate, { ...goodService, priority: 'urgent' }).priority).toBe(
      'Choose low, medium or high.'
    );
    expect(fieldsOf(schemas.serviceCreate, { ...goodService, priority: 'HIGH' }).priority).toBeDefined();
  });

  it('only allows seen or no-show as an outcome', () => {
    expect(fieldsOf(schemas.resolveCalled, { outcome: 'done' }).outcome).toBe('Choose seen or no-show.');
    expect(fieldsOf(schemas.resolveCalled, { outcome: 'no-show' })).toEqual({});
  });
});

describe('formats', () => {
  it('checks email format and stores it lower-case', () => {
    for (const bad of ['a@b', 'a b@c.com', '@c.com']) {
      expect(fieldsOf(schemas.register, { ...goodRegister, email: bad }).email).toBe(
        'Enter a valid email address.'
      );
    }
    expect(validateBody(schemas.register, goodRegister).value.email).toBe('ana@example.com');
  });

  it('needs a first and last name', () => {
    expect(fieldsOf(schemas.register, { ...goodRegister, name: 'Cher' }).name).toBe(
      'Enter your first and last name.'
    );
  });

  it('parses a real date of birth', () => {
    expect(parseDob('02/29/2024')).toBe('2024-02-29');
    expect(parseDob('02/29/2025')).toBeNull();
    expect(parseDob('13/01/2000')).toBeNull();
    expect(parseDob('1990-01-01')).toBeNull();
    expect(parseDob('01/01/2999')).toBeNull();
    expect(parseDob('01/01/1880')).toBeNull();
  });

  it('stores the date of birth as YYYY-MM-DD', () => {
    expect(validateBody(schemas.register, goodRegister).value.dob).toBe('1995-03-14');
  });

  it('accepts common phone formats and rejects the wrong length', () => {
    expect(normalizePhone('(713) 555-0101')).toBe('7135550101');
    expect(fieldsOf(schemas.register, { ...goodRegister, phone: '713-555-0101' })).toEqual({});
    expect(fieldsOf(schemas.register, { ...goodRegister, phone: '713555010' }).phone).toBeDefined();
    expect(fieldsOf(schemas.register, { ...goodRegister, phone: '71355501011' }).phone).toBeDefined();
  });

  it.each([
    ['queue#2026', 'no uppercase'],
    ['QUEUE#2026', 'no lowercase'],
    ['Queue#Smart', 'no digit'],
    ['Queue2026', 'no symbol'],
    ['Qu#1', 'too short'],
    [`Q#1${chars(62)}`, 'too long'],
  ])('rejects password %s (%s)', (password) => {
    expect(fieldsOf(schemas.register, { ...goodRegister, password }).password).toBe(
      'Password does not meet all requirements.'
    );
  });

  it('recognises real ISO dates only', () => {
    expect(isIsoDate('2026-10-19')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('10/19/2026')).toBe(false);
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

  it('an entry update needs exactly one of direction or priority', () => {
    expect(fieldsOf(schemas.updateEntry, {}).body).toBeDefined();
    expect(fieldsOf(schemas.updateEntry, { direction: 1, priority: 'urgent' }).body).toBeDefined();
    expect(fieldsOf(schemas.updateEntry, { direction: 1 })).toEqual({});
    expect(fieldsOf(schemas.updateEntry, { direction: 2 }).direction).toBe('Direction must be -1 or 1.');
    expect(fieldsOf(schemas.updateEntry, { priority: 'high' }).priority).toBe('Choose normal or urgent.');
  });

  it('drops fields the schema does not know about', () => {
    const { value } = validateBody(schemas.joinQueue, { reason: 'Flu shot', isAdmin: true });
    expect(value).toEqual({ reason: 'Flu shot' });
  });
});
