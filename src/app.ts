import express, { type Express, type Request, type Response } from 'express';
import { createAdminRouter } from './routes/admin.js';

/** Assemble the Express application. */
export function createApp(): Express {
  const app = express();

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.use('/admin', createAdminRouter());

  return app;
}
