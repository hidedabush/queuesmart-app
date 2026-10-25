import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './api/middleware/errors.js';
import { authRoutes } from './api/routes/authRoutes.js';
import { historyRoutes } from './api/routes/historyRoutes.js';
import {
  patientQueueRoutes,
  patientServiceQueueRoutes,
  servicesRoutes,
  staffQueueRoutes,
  staffServiceQueueRoutes,
  statsRoutes,
} from './api/routes/index.js';

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
  app.use('/auth', authRoutes);
  app.use('/services', servicesRoutes);
  app.use('/services', patientServiceQueueRoutes);
  app.use('/services', staffServiceQueueRoutes);
  app.use('/stats', statsRoutes);
  // Staff routes come after the patient ones so /queue/me is never read as
  // an entry id.
  app.use('/queue', patientQueueRoutes);
  app.use('/queue', staffQueueRoutes);
  app.use('/history', historyRoutes);
  // Teammates mount /notifications here.

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
