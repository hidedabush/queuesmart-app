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
