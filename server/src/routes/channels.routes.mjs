import { Router } from 'express';
import { requireAuth } from '../middleware/auth.mjs';
import { channelsService } from '../services/channels.service.mjs';

export const channelsRouter = Router();

channelsRouter.get('/api/channels', requireAuth, async (_request, response, next) => {
  try {
    response.json(await channelsService.listChannelsTree());
  } catch (error) {
    next(error);
  }
});

channelsRouter.get('/api/forums/:forumId/threads', requireAuth, async (request, response, next) => {
  try {
    response.json(await channelsService.listForumThreads(request.params.forumId));
  } catch (error) {
    next(error);
  }
});

channelsRouter.get('/api/channels/:channelId/threads', requireAuth, async (request, response, next) => {
  try {
    response.json(await channelsService.listChannelThreads(request.params.channelId));
  } catch (error) {
    next(error);
  }
});

channelsRouter.get('/api/mentions', requireAuth, async (request, response, next) => {
  try {
    response.json(await channelsService.searchMentionTargets(request.query.query || ''));
  } catch (error) {
    next(error);
  }
});
