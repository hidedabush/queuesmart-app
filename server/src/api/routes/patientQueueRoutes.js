import { Router } from 'express';
import * as queue from '../controllers/queueController.js';
import { requireAuth } from '../middleware/auth.js';

export const patientQueueRoutes = Router()
  .get('/me', requireAuth, queue.getMine)
  .delete('/me', requireAuth, queue.cancelMine);