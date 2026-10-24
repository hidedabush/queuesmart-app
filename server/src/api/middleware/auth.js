import jwt from 'jsonwebtoken';
import { forbidden, unauthenticated } from '../errors.js';

function getTokenSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET must be configured.');
  }

  return secret;
}

/**
 * Verify the bearer token and attach the authenticated user identity.
 *
 * On success:
 *   req.user = { id, role }
 */
export function requireAuth(req, res, next) {
  const authorization = req.get('authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return next(unauthenticated());
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    return next(unauthenticated());
  }

  try {
    const payload = jwt.verify(token, getTokenSecret());

    if (
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      !['user', 'admin'].includes(payload.role)
    ) {
      return next(unauthenticated());
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    return next();
  } catch (error) {
    // A missing server secret is a configuration problem, not a bad token.
    if (error instanceof Error && error.message === 'JWT_SECRET must be configured.') {
      return next(error);
    }

    return next(unauthenticated());
  }
}

/**
 * Must be used after requireAuth.
 * Only accounts whose token role is admin can continue.
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return next(unauthenticated());
    }

    if (req.user.role !== role) {
      return next(forbidden());
    }

    return next();
  };
}