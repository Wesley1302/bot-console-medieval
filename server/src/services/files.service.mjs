import multer from 'multer';

export const uploadMessageFiles = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 5,
  },
});

export const filesService = {
  uploadMessageFiles,
};
