import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './api/middleware/errors.js';
import {
  patientQueueRoutes,
  patientServiceQueueRoutes,
  servicesRoutes,
  staffQueueRoutes,
  staffServiceQueueRoutes,
  statsRoutes,
} from './api/routes/index.js';

// The queue controllers read req.user.id. Until the auth module's
// requireAuth sets it from the token, every patient request acts as the
// seeded demo patient. TODO(auth): replace this with requireAuth.
function demoPatient(req, res, next) {
  req.user ??= { id: 'u-patient', role: 'user' };
  next();
}

/**
 * The "Back-end / API [Application]" box. Built by a function so the tests
 * can load it with supertest without opening a port.
 */
export function createApp() {
  const app = express();

  // The Expo web build runs on a different port, so it needs CORS.
  app.use(cors());
  app.use(express.json({ limit: '20kb' }));

  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use('/services', servicesRoutes);
  app.use('/services', demoPatient, patientServiceQueueRoutes);
  app.use('/stats', statsRoutes);
  app.use('/queue', demoPatient, patientQueueRoutes);
  // Staff routes come after the patient ones so /queue/me is never read as
  // an entry id.
  app.use('/services', staffServiceQueueRoutes);
  app.use('/queue', staffQueueRoutes);
  // Teammates mount /auth, /notifications and /history here.

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
