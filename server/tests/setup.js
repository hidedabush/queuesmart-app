import { afterEach, beforeEach, vi } from 'vitest';
import * as db from './fakes/db.js';

// Every test starts from the same seed data.
beforeEach(() => {
  db.reset();
});

afterEach(() => {
  vi.useRealTimers();
});
