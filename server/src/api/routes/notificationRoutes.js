import { Router } from 'express';
import * as notifications from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

// The signed-in patient's own notifications. '/me/viewed' comes first so
// 'me' is never read as a notification id.
export const notificationRoutes = Router()
  .get('/me', requireAuth, notifications.listMine)
  .patch('/me/viewed', requireAuth, notifications.markAllViewed)
  .patch('/:id/viewed', requireAuth, notifications.markViewed);
