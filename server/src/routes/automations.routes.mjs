import { Router } from 'express';
import { requireAuth } from '../middleware/auth.mjs';
import { automationsService } from '../services/automations.service.mjs';

export const automationsRouter = Router();

automationsRouter.get('/api/automations', requireAuth, async (_request, response, next) => {
  try {
    response.json({ automations: automationsService.listAutomations() });
  } catch (error) {
    next(error);
  }
});

automationsRouter.post('/api/automations', requireAuth, async (request, response, next) => {
  try {
    const automation = await automationsService.createAutomation(request.body);
    response.status(201).json({ ok: true, automation });
  } catch (error) {
    next(error);
  }
});

automationsRouter.patch('/api/automations/:automationId', requireAuth, async (request, response, next) => {
  try {
    const automation = await automationsService.updateAutomationAction(request.params.automationId, request.body?.action);
    response.json({ ok: true, automation });
  } catch (error) {
    next(error);
  }
});

automationsRouter.delete('/api/automations/:automationId', requireAuth, async (request, response, next) => {
  try {
    response.json(await automationsService.deleteAutomation(request.params.automationId));
  } catch (error) {
    next(error);
  }
});
