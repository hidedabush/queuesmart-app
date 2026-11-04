import { Router } from 'express';
import * as notifications from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationRoutes = Router()
  .get('/me', requireAuth, notifications.listMine)
  .post('/me/read-all', requireAuth, notifications.markAllRead)
  .patch('/:id/read', requireAuth, notifications.markRead);