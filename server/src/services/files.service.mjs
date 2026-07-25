import multer from 'multer';

export const uploadMessageFiles = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 5,
  },
});

export const uploadKnowledgeDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
});

export const filesService = {
  uploadMessageFiles,
  uploadKnowledgeDocument,
};
