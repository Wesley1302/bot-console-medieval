import { Router } from 'express';
import { requireAuth } from '../middleware/auth.mjs';
import { uploadMessageFiles } from '../services/files.service.mjs';
import { messagesService } from '../services/messages.service.mjs';

export const messagesRouter = Router();

messagesRouter.get('/api/channels/:channelId/messages', requireAuth, async (request, response, next) => {
  try {
    const channelId = String(request.params.channelId || '').trim();
    if (!channelId) {
      response.status(400).json({ error: true, message: 'Canal obrigatorio.' });
      return;
    }

    response.json(await messagesService.listMessages(channelId, {
      limit: request.query.limit,
      before: request.query.before ? String(request.query.before) : '',
      after: request.query.after ? String(request.query.after) : '',
    }));
  } catch (error) {
    next(error);
  }
});
messagesRouter.post('/api/messages', requireAuth, uploadMessageFiles.array('files', 5), async (request, response, next) => {
  try {
    response.json(await messagesService.sendMessage({
      channelId: request.body?.channelId,
      content: request.body?.content,
      files: request.files || [],
    }));
  } catch (error) {
    next(error);
  }
});
messagesRouter.patch('/api/channels/:channelId/messages/:messageId', requireAuth, async (request, response, next) => {
  try {
    response.json(await messagesService.editMessage({
      channelId: request.params.channelId,
      messageId: request.params.messageId,
      content: request.body?.content,
    }));
  } catch (error) {
    next(error);
  }
});
messagesRouter.delete('/api/channels/:channelId/messages/:messageId', requireAuth, async (request, response, next) => {
  try {
    response.json(await messagesService.deleteMessage({
      channelId: request.params.channelId,
      messageId: request.params.messageId,
    }));
  } catch (error) {
    next(error);
  }
});
