import { describe, expect, it, vi } from 'vitest';
import { conflict } from '../../src/api/errors.js';
import { errorHandler } from '../../src/api/middleware/errors.js';

function fakeResponse() {
  const res = { status: vi.fn(() => res), json: vi.fn(() => res) };
  return res;
}

describe('errorHandler', () => {
  it('turns a business-rule error into its status and code', () => {
    const res = fakeResponse();
    errorHandler(conflict('full', 'This line is full for today.'), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'full', message: 'This line is full for today.' });
  });

  it('hides unexpected errors behind a generic 500', () => {
    const res = fakeResponse();
    errorHandler(new Error('database exploded'), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'server', message: 'Something went wrong.' });
  });
});
