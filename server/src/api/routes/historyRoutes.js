import { Router } from 'express';
import * as history from '../controllers/historyController.js';
import { requireAuth } from '../middleware/auth.js';

export const historyRoutes = Router().get('/me', requireAuth, history.listMine);