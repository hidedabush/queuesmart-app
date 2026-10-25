import { Router } from 'express';
import * as services from '../controllers/servicesController.js';
import * as stats from '../controllers/statsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';
import { patientQueueRoutes } from './patientQueueRoutes.js';
import { patientServiceQueueRoutes } from './patientServiceQueueRoutes.js';
import { staffQueueRoutes, staffServiceQueueRoutes } from './staffQueueRoutes.js';

/**
 * Service Management, the Admin Dashboard's statistics, and Queue
 * Management (patient and front desk). Every route needs a signed-in user;
 * the admin ones also need requireRole('admin'). Auth and history have their
 * own route files. The full contract for every module is in
 * docs/A3-api-spec.txt.
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

// Staff queue: view, call, resolve, reorder and remove (admin).
export { staffQueueRoutes, staffServiceQueueRoutes };
