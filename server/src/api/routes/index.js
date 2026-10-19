import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import * as history from '../controllers/historyController.js';
import * as notifications from '../controllers/notificationsController.js';
import * as queue from '../controllers/queueController.js';
import * as services from '../controllers/servicesController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';

/**
 * Every route in the API, grouped by A3 module. The full contract (bodies,
 * responses, error codes) is in docs/A3-api-spec.txt.
 */
const admin = [requireAuth, requireRole('admin')];

// 1. Authentication
export const authRoutes = Router()
  .post('/register', validate(schemas.register), auth.register)
  .post('/login', validate(schemas.login), auth.login)
  .get('/me', requireAuth, auth.me)
  .patch('/me/password', requireAuth, validate(schemas.changePassword), auth.changePassword);

// 2. Service management, plus 3. queue management for one visit type
export const servicesRoutes = Router()
  .get('/', requireAuth, services.list)
  .post('/', admin, validate(schemas.serviceCreate), services.create)
  .get('/:id', requireAuth, services.get)
  .patch('/:id', admin, validate(schemas.serviceUpdate), services.update)
  .patch('/:id/open', admin, validate(schemas.serviceOpen), services.setOpen)
  .delete('/:id', admin, services.remove)
  .post('/:id/queue', requireAuth, validate(schemas.joinQueue), queue.join)
  .get('/:id/queue', admin, queue.line)
  .post('/:id/queue/call', admin, queue.callNext)
  .post('/:id/queue/called', admin, validate(schemas.resolveCalled), queue.resolveCalled);

// 3. Queue management: the patient's own check-in, and staff edits by entry
export const queueRoutes = Router()
  .get('/me', requireAuth, queue.mine)
  .delete('/me', requireAuth, queue.leave)
  .patch('/:entryId', admin, validate(schemas.updateEntry), queue.updateEntry)
  .delete('/:entryId', admin, queue.removeEntry);

// 5. Notifications
export const notificationRoutes = Router()
  .get('/me', requireAuth, notifications.list)
  .post('/me/read-all', requireAuth, notifications.markAllRead)
  .patch('/:id/read', requireAuth, notifications.markRead);

// 6. History, and the admin's statistics
export const historyRoutes = Router().get('/me', requireAuth, history.mine);
export const statsRoutes = Router().get('/', admin, history.stats);
