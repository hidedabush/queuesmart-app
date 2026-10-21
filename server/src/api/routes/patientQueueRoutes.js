import { Router } from 'express';
import * as queue from '../controllers/queueController.js';

export const patientQueueRoutes = Router()
  .get('/me', queue.getMine)
  .delete('/me', queue.cancelMine);
