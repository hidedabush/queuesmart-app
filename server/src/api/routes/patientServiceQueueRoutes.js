import { Router } from 'express';
import * as queue from '../controllers/queueController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';

export const patientServiceQueueRoutes = Router()
  .post(
    '/:id/queue',
    requireAuth,
    validate(schemas.joinQueue),
    queue.join
  );