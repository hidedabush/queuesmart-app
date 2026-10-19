import { describe, expect, it } from 'vitest';
import {
  checkInBlocker,
  displayName,
  patientStatus,
} from '../../src/api/services/officeRules.js';
import { estimateWait, waitRange } from '../../src/api/services/waitEstimate.js';

const open = { isOpen: true, capacity: 2, expectedDuration: 15 };

describe('checkInBlocker', () => {
  it('names the first rule that blocks a check-in', () => {
    expect(checkInBlocker(null, 0, false)).toBe('missing');
    expect(checkInBlocker(open, 0, true)).toBe('already-checked-in');
    expect(checkInBlocker({ ...open, isOpen: false }, 0, false)).toBe('closed');
    expect(checkInBlocker(open, 2, false)).toBe('full');
    expect(checkInBlocker(open, 1, false)).toBeNull();
  });
});

describe('displayName (privacy)', () => {
  it('shows first name and last initial only', () => {
    expect(displayName('Maria Gonzalez')).toBe('Maria G.');
    expect(displayName('  ana  de la  torres ')).toBe('ana T.');
    expect(displayName('Cher')).toBe('Cher');
    expect(displayName('')).toBe('Patient');
    expect(displayName(undefined)).toBe('Patient');
  });
});

describe('patientStatus', () => {
  it('follows the place in line', () => {
    expect(patientStatus({ status: 'called' }, 5)).toBe('called');
    expect(patientStatus({ status: 'waiting' }, 2)).toBe('head-in');
    expect(patientStatus({ status: 'waiting' }, 3)).toBe('waiting');
  });
});

describe('wait-time estimation', () => {
  it('is people ahead x duration, as a range up to 30% longer', () => {
    expect(waitRange(0, 15)).toEqual({ low: 0, high: 0 });
    expect(waitRange(3, 15)).toEqual({ low: 45, high: 59 });
  });

  it('is null when the line is closed or empty', () => {
    expect(estimateWait({ ...open, isOpen: false }, 3)).toBeNull();
    expect(estimateWait(open, 0)).toBeNull();
    expect(estimateWait(open, 2)).toEqual({ low: 30, high: 39 });
  });
});
