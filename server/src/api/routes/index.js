import { Router } from 'express';
import * as services from '../controllers/servicesController.js';
import * as stats from '../controllers/statsController.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';

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
export const servicesRoutes = Router()
  .get('/', services.list)
  .post('/', validate(schemas.serviceCreate), services.create) // admin
  .get('/:id', services.get)
  .patch('/:id', validate(schemas.serviceUpdate), services.update) // admin
  .patch('/:id/open', validate(schemas.serviceOpen), services.setOpen) // admin
  .delete('/:id', services.remove); // admin

// Admin dashboard: today's statistics
export const statsRoutes = Router().get('/', stats.stats); // admin
