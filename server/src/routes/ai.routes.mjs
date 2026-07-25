import { Router } from 'express';
import { requireAuth } from '../middleware/auth.mjs';
import { aiService } from '../services/ai.service.mjs';

export const aiRouter = Router();

aiRouter.post('/api/ai/queries', requireAuth, async (request, response, next) => {
  try {
    response.status(202).json(await aiService.createQuery(request.body));
  } catch (error) {
    next(error);
  }
});

aiRouter.get('/api/ai/queries', requireAuth, async (request, response, next) => {
  try {
    response.json({ queries: await aiService.listQueries(request.query.limit) });
  } catch (error) {
    next(error);
  }
});

aiRouter.get('/api/ai/queries/:queryId', requireAuth, async (request, response, next) => {
  try {
    response.json({ query: await aiService.getQuery(request.params.queryId) });
  } catch (error) {
    next(error);
  }
});

aiRouter.post('/api/ai/queries/:queryId/cancel', requireAuth, async (request, response, next) => {
  try {
    response.json({ query: await aiService.cancelQuery(request.params.queryId) });
  } catch (error) {
    next(error);
  }
});
