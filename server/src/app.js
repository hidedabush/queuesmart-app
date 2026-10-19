import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './api/middleware/errors.js';
import {
  authRoutes,
  historyRoutes,
  notificationRoutes,
  queueRoutes,
  servicesRoutes,
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
  app.use('/queue', queueRoutes);
  app.use('/notifications', notificationRoutes);
  app.use('/history', historyRoutes);
  app.use('/stats', statsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
