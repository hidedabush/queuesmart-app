import { describe, expect, it } from 'vitest';
import { estimateWait, waitRange } from '../../src/api/services/waitEstimate.js';

const open = { isOpen: true, capacity: 2, expectedDuration: 15 };

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
