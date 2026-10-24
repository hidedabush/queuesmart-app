import { Router } from 'express';
import * as staffQueue from '../controllers/staffQueueController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';

// Mounted at /services, next to patientServiceQueueRoutes.
export const staffServiceQueueRoutes = Router()
  .get('/:id/queue', requireAuth, requireRole('admin'), staffQueue.getLine)
  .post('/:id/queue/call', requireAuth, requireRole('admin'), staffQueue.callNext)
  .post(
    '/:id/queue/called',
    requireAuth,
    requireRole('admin'),
    validate(schemas.resolveCalled),
    staffQueue.resolveCalled
  );

// Mounted at /queue AFTER patientQueueRoutes, so '/queue/me' is matched there
// first instead of being read as an entry id.
// TODO(staff-queue): add validate(...) with a schema for the PATCH body.
export const staffQueueRoutes = Router()
  .patch('/:entryId', requireAuth, requireRole('admin'), staffQueue.moveEntry)
  .delete('/:entryId', requireAuth, requireRole('admin'), staffQueue.removeEntry);