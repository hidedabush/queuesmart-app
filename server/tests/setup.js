import { afterEach, beforeEach, vi } from 'vitest';
import * as db from '../src/database/db.js';

// Every test starts from the same seed data.
beforeEach(() => {
  db.reset();
});

afterEach(() => {
  vi.useRealTimers();
});
