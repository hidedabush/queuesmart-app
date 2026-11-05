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

  it('turns a MySQL duplicate key into a 409', () => {
    const res = fakeResponse();
    errorHandler(Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'conflict' }));
  });

  it('turns a trigger refusal into a 409 with the rule’s own code', () => {
    const res = fakeResponse();
    const message = 'capacity-below-waiting|6 patients are already in line. Capacity cannot be lower than that.';
    const error = Object.assign(new Error(message), { code: 'ER_SIGNAL_EXCEPTION', sqlMessage: message });
    errorHandler(error, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'capacity-below-waiting',
      message: '6 patients are already in line. Capacity cannot be lower than that.',
    });
  });

  it('turns a MySQL rule violation into a 400', () => {
    const res = fakeResponse();
    const error = Object.assign(new Error('Check constraint'), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
    errorHandler(error, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'validation', fields: { body: 'The database rejected one of the values.' } })
    );
  });

  it('hides unexpected errors behind a generic 500', () => {
    const res = fakeResponse();
    errorHandler(new Error('database exploded'), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'server', message: 'Something went wrong.' });
  });
});
