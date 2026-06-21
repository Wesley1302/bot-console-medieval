import { Router } from 'express';
import { requireAuth } from '../middleware/auth.mjs';
import { getDiscordStatus } from '../services/discord.service.mjs';

export const healthRouter = Router();

healthRouter.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'bot-console-medieval',
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/api/status', requireAuth, async (_request, response, next) => {
  try {
    response.json(await getDiscordStatus());
  } catch (error) {
    next(error);
  }
});
