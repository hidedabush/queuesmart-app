import { Router } from 'express';

import * as auth from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as schemas from '../validation/schemas.js';

export const authRoutes = Router()
  // Public endpoints
  .post('/register', validate(schemas.register), auth.register)
  .post('/login', validate(schemas.login), auth.login)

  // Authenticated endpoints
  .get('/me', requireAuth, auth.getMe)
  .patch(
    '/me/password',
    requireAuth,
    validate(schemas.changePassword),
    auth.changePassword
);