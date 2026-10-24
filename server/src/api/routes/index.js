import { Router } from 'express';
import * as services from '../controllers/servicesController.js';
import * as stats from '../controllers/statsController.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';
import { patientQueueRoutes } from './patientQueueRoutes.js';
import { patientServiceQueueRoutes } from './patientServiceQueueRoutes.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/**
 * Routes built so far: Service Management and the Admin Dashboard's
 * statistics. The full contract for every module, including the ones
 * teammates are building (auth, queue, notifications, history), is in
 * docs/A3-api-spec.txt.
 *
 * TODO(auth): once the auth module exists, put requireAuth on every route
 * here, and requireRole('admin') on the ones marked "admin".
 */

// 2. Service management

// Service management
export const servicesRoutes = Router()
  .get('/', requireAuth, services.list)
  .post(
    '/',
    requireAuth,
    requireRole('admin'),
    validate(schemas.serviceCreate),
    services.create
  )
  .get('/:id', requireAuth, services.get)
  .patch(
    '/:id',
    requireAuth,
    requireRole('admin'),
    validate(schemas.serviceUpdate),
    services.update
  )
  .patch(
    '/:id/open',
    requireAuth,
    requireRole('admin'),
    validate(schemas.serviceOpen),
    services.setOpen
  )
  .delete(
    '/:id',
    requireAuth,
    requireRole('admin'),
    services.remove
  );

// Admin dashboard statistics
export const statsRoutes = Router().get(
  '/',
  requireAuth,
  requireRole('admin'),
  stats.stats
);

// Patient queue: current check-in and cancellation.
export { patientQueueRoutes, patientServiceQueueRoutes };
