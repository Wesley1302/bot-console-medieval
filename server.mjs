import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './server/src/config/env.mjs';
import { corsMiddleware } from './server/src/middleware/cors.mjs';
import { errorHandler } from './server/src/middleware/errorHandler.mjs';
import { authRouter } from './server/src/routes/auth.routes.mjs';
import { automationsRouter } from './server/src/routes/automations.routes.mjs';
import { automationsService } from './server/src/services/automations.service.mjs';
import { channelsRouter } from './server/src/routes/channels.routes.mjs';
import { exportsRouter } from './server/src/routes/exports.routes.mjs';
import { healthRouter } from './server/src/routes/health.routes.mjs';
import { messagesRouter } from './server/src/routes/messages.routes.mjs';
import { logger } from './server/src/utils/logger.mjs';

const app = express();

app.set('trust proxy', env.IS_PRODUCTION);
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

try {
  await automationsService.initAutomations();
} catch (error) {
  logger.warn('Nao foi possivel carregar automacoes locais.', { reason: error.message });
}

app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
});
