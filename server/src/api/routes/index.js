import { Router } from 'express';
import * as services from '../controllers/servicesController.js';
import * as stats from '../controllers/statsController.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';
import { patientQueueRoutes } from './patientQueueRoutes.js';
import { patientServiceQueueRoutes } from './patientServiceQueueRoutes.js';
import { staffQueueRoutes, staffServiceQueueRoutes } from './staffQueueRoutes.js';

/**
 * Routes built so far: Service Management, the Admin Dashboard's
 * statistics, and Queue Management (patient and front desk). The full
 * contract for every module, including the ones teammates are building
 * (auth, notifications, history), is in docs/A3-api-spec.txt.
 *
 * TODO(auth): once the auth module exists, put requireAuth on every route
 * here, and requireRole('admin') on the ones marked "admin".
 */

// 2. Service management
export const servicesRoutes = Router()
  .get('/', services.list)
  .post('/', validate(schemas.serviceCreate), services.create) // admin
  .get('/:id', services.get)
  .patch('/:id', validate(schemas.serviceUpdate), services.update) // admin
  .patch('/:id/open', validate(schemas.serviceOpen), services.setOpen) // admin
  .delete('/:id', services.remove); // admin

// Admin dashboard: today's statistics
export const statsRoutes = Router().get('/', stats.stats); // admin

// Patient queue: current check-in and cancellation.
export { patientQueueRoutes, patientServiceQueueRoutes };

// Staff queue: view, call, resolve, reorder and remove (admin).
export { staffQueueRoutes, staffServiceQueueRoutes };
