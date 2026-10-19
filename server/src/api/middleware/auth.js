import * as usersRepo from '../../database/repositories/usersRepo.js';
import { forbidden, unauthenticated } from '../errors.js';
import { publicUser, verifyToken } from '../services/authService.js';

// Reads "Authorization: Bearer <token>" and puts the signed-in user on req.user.
export function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthenticated();

  const payload = verifyToken(token);
  if (!payload) throw unauthenticated('Your session has expired. Sign in again.');

  const user = usersRepo.findById(payload.sub);
  if (!user) throw unauthenticated();

  req.user = publicUser(user);
  next();
}

// Use after requireAuth. Patients get 403 on staff routes.
export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) throw forbidden();
    next();
  };
}
