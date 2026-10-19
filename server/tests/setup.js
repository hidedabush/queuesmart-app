import { afterEach, beforeEach, vi } from 'vitest';
import * as db from '../src/database/db.js';
import { outbox, smsGateway } from '../src/notifications/index.js';

// Every test starts from the same seed data, an empty outbox and no SMS.
beforeEach(() => {
  db.reset();
  outbox.clear();
  smsGateway.clear();
});

afterEach(() => {
  vi.useRealTimers();
});
