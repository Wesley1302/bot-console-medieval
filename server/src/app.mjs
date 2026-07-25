import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env.mjs';
import { corsMiddleware } from './middleware/cors.mjs';
import { errorHandler } from './middleware/errorHandler.mjs';
import { authRouter } from './routes/auth.routes.mjs';
import { automationsRouter } from './routes/automations.routes.mjs';
import { channelsRouter } from './routes/channels.routes.mjs';
import { exportsRouter } from './routes/exports.routes.mjs';
import { healthRouter } from './routes/health.routes.mjs';
import { messagesRouter } from './routes/messages.routes.mjs';

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '10mb' }));

  app.use(healthRouter);
  app.use(authRouter);
  app.use(channelsRouter);
  app.use(messagesRouter);
  app.use(exportsRouter);
  app.use(automationsRouter);

  const distDir = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
      response.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
