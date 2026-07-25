import 'dotenv/config';
import { env } from './server/src/config/env.mjs';
import { createApp } from './server/src/app.mjs';
import { automationsService } from './server/src/services/automations.service.mjs';
import { exportsService } from './server/src/services/exports.service.mjs';
import { logger } from './server/src/utils/logger.mjs';

try {
  await exportsService.initExports();
} catch (error) {
  logger.warn('Nao foi possivel recuperar jobs de exportacao.', { reason: error.message });
}

try {
  await automationsService.initAutomations();
} catch (error) {
  logger.warn('Nao foi possivel carregar automacoes locais.', { reason: error.message });
}

const app = createApp();
app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
});
