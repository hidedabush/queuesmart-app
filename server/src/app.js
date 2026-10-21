import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './api/middleware/errors.js';
import { patientQueueRoutes, patientServiceQueueRoutes, servicesRoutes, statsRoutes } from './api/routes/index.js';

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
  app.use('/services', patientServiceQueueRoutes);
  app.use('/stats', statsRoutes);
  app.use('/queue', patientQueueRoutes);
  // Teammates mount /auth, /queue, /notifications and /history here.

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
