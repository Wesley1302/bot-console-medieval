import { Router } from 'express';
import { requireAuth } from '../middleware/auth.mjs';
import { exportsService } from '../services/exports.service.mjs';

export const exportsRouter = Router();

exportsRouter.get('/api/exports', requireAuth, async (_request, response, next) => {
  try {
    response.json({ exports: await exportsService.listExportPackages() });
  } catch (error) {
    next(error);
  }
});

exportsRouter.post('/api/exports', requireAuth, async (request, response, next) => {
  try {
    response.status(202).json(exportsService.createExportJob(request.body?.target));
  } catch (error) {
    next(error);
  }
});

exportsRouter.get('/api/exports/jobs/:jobId', requireAuth, async (request, response, next) => {
  try {
    response.json(exportsService.getExportJob(request.params.jobId));
  } catch (error) {
    next(error);
  }
});

exportsRouter.get('/api/exports/:exportId/download', requireAuth, async (request, response, next) => {
  try {
    const file = await exportsService.downloadExportFile(request.params.exportId, String(request.query.format || 'json'));
    response.setHeader('Content-Type', file.contentType);
    response.download(file.filePath, file.filename);
  } catch (error) {
    next(error);
  }
});

exportsRouter.post('/api/exports/bulk-download', requireAuth, async (request, response, next) => {
  try {
    const file = await exportsService.bulkDownloadExports({
      ids: request.body?.ids,
      format: request.body?.format,
      mode: request.body?.mode,
    });
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.send(file.buffer);
  } catch (error) {
    next(error);
  }
});

exportsRouter.delete('/api/exports/:exportId', requireAuth, async (request, response, next) => {
  try {
    response.json(await exportsService.deleteExportPackage(request.params.exportId));
  } catch (error) {
    next(error);
  }
});
