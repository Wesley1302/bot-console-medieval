import { Router } from 'express';
import { requireAuth } from '../middleware/auth.mjs';
import { cleanupService } from '../services/cleanup.service.mjs';

export const cleanupRouter = Router();

cleanupRouter.post('/api/cleanup/preview', requireAuth, async (request, response, next) => {
  try {
    response.status(201).json(await cleanupService.preview(request.body));
  } catch (error) {
    next(error);
  }
});

cleanupRouter.post('/api/cleanup/jobs', requireAuth, async (request, response, next) => {
  try {
    response.status(202).json(await cleanupService.createJob(request.body));
  } catch (error) {
    next(error);
  }
});

cleanupRouter.get('/api/cleanup/jobs', requireAuth, async (_request, response, next) => {
  try {
    response.json({ jobs: await cleanupService.listJobs() });
  } catch (error) {
    next(error);
  }
});

cleanupRouter.get('/api/cleanup/jobs/:jobId', requireAuth, async (request, response, next) => {
  try {
    response.json(await cleanupService.getJob(request.params.jobId));
  } catch (error) {
    next(error);
  }
});

for (const action of ['cancel', 'pause', 'resume']) {
  cleanupRouter.post(`/api/cleanup/jobs/:jobId/${action}`, requireAuth, async (request, response, next) => {
    try {
      response.json(await cleanupService.action(request.params.jobId, action));
    } catch (error) {
      next(error);
    }
  });
}
