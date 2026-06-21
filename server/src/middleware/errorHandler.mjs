import { env } from '../config/env.mjs';

export function errorHandler(error, _request, response, _next) {
  if (error.code === 'LIMIT_FILE_SIZE') {
    response.status(400).json({ error: true, message: 'Arquivo excede o limite de 8 MB.' });
    return;
  }

  if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
    response.status(400).json({ error: true, message: 'Envie no máximo 5 arquivos por mensagem.' });
    return;
  }

  if (error.name === 'MulterError') {
    response.status(400).json({ error: true, message: 'Nao foi possivel processar o upload.' });
    return;
  }

  const status = error.status || error.statusCode || 500;
  const payload = {
    error: true,
    message: error.message || 'Erro interno do servidor.',
  };

  if (!env.IS_PRODUCTION && error.stack) {
    payload.stack = error.stack;
  }

  response.status(status).json(payload);
}
