import { Router } from 'express';
import { requireAuth } from '../middleware/auth.mjs';
import { uploadKnowledgeDocument } from '../services/files.service.mjs';
import { knowledgeService } from '../services/knowledge.service.mjs';

export const knowledgeRouter = Router();

knowledgeRouter.post(
  '/api/knowledge/documents',
  requireAuth,
  uploadKnowledgeDocument.single('file'),
  async (request, response, next) => {
    try {
      const document = await knowledgeService.createDocument({
        title: request.body?.title,
        type: request.body?.type,
        file: request.file,
      });
      response.status(202).json({ document });
    } catch (error) {
      next(error);
    }
  },
);

knowledgeRouter.get('/api/knowledge/documents', requireAuth, async (_request, response, next) => {
  try {
    response.json({ documents: await knowledgeService.listDocuments() });
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.get('/api/knowledge/documents/:id', requireAuth, async (request, response, next) => {
  try {
    response.json({ document: await knowledgeService.getDocument(request.params.id) });
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.post('/api/knowledge/documents/:id/reprocess', requireAuth, async (request, response, next) => {
  try {
    response.status(202).json({
      document: await knowledgeService.reprocessDocument(request.params.id),
    });
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.delete('/api/knowledge/documents/:id', requireAuth, async (request, response, next) => {
  try {
    response.json(await knowledgeService.deleteDocument(request.params.id));
  } catch (error) {
    next(error);
  }
});
