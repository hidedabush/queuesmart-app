import { Router } from 'express';
import * as queue from '../controllers/queueController.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';

// Front desk: work one visit type's line. All admin.
export const staffServiceQueueRoutes = Router()
  .get('/:id/queue', queue.line)
  .post('/:id/queue/call', queue.callNext)
  .post('/:id/queue/called', validate(schemas.resolveCalled), queue.resolveCalled);

export const staffQueueRoutes = Router()
  .patch('/:entryId', validate(schemas.entryUpdate), queue.updateEntry)
  .delete('/:entryId', queue.removeEntry);
