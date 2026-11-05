import { Router } from 'express';
import * as services from '../controllers/servicesController.js';
import * as stats from '../controllers/statsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';

/**
 * Service Management and the Admin Dashboard's statistics. Every route needs
 * a signed-in user (a bearer token); the admin ones also need
 * requireRole('admin'). The full contract is in docs/A3-api-spec.txt.
 */

// Service management
export const servicesRoutes = Router()
  .get('/', requireAuth, services.list)
  .post('/', requireAuth, requireRole('admin'), validate(schemas.serviceCreate), services.create)
  .get('/:id', requireAuth, services.get)
  .patch('/:id', requireAuth, requireRole('admin'), validate(schemas.serviceUpdate), services.update)
  .patch('/:id/open', requireAuth, requireRole('admin'), validate(schemas.serviceOpen), services.setOpen)
  .delete('/:id', requireAuth, requireRole('admin'), services.remove);

// Admin dashboard statistics
export const statsRoutes = Router().get('/', requireAuth, requireRole('admin'), stats.stats);
