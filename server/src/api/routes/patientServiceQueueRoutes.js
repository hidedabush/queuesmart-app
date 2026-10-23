import { Router } from 'express';
import * as queue from '../controllers/queueController.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';

export const patientServiceQueueRoutes = Router()
  .post('/:id/queue', validate(schemas.joinQueue), queue.join);
