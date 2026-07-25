const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, payload = null, code = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.code = code;
  }
}

function emitSessionExpired(path, status) {
  if (status !== 401 || path === '/api/auth/login' || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('bcm:session-expired'));
}

async function readPayload(response) {
  const raw = await response.text();
  if (!raw) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return raw;
  try { return JSON.parse(raw); } catch { throw new ApiError('Resposta inválida da API.', { status: response.status }); }
}

function errorMessage(payload, fallback) {
  return typeof payload === 'object' && payload?.message ? payload.message : fallback;
}

export async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, credentials: 'include', headers });
  let payload;
  try { payload = await readPayload(response); } catch (error) { emitSessionExpired(path, response.status); throw error; }
  if (!response.ok) {
    emitSessionExpired(path, response.status);
    throw new ApiError(errorMessage(payload, 'Falha ao consultar a API.'), { status: response.status, payload, code: payload?.code });
  }
  return payload;
}

export async function apiDownload(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, credentials: 'include', headers: options.headers || {} });
  if (!response.ok) {
    let payload = null;
    try { payload = await readPayload(response); } catch { /* fallback below */ }
    emitSessionExpired(path, response.status);
    throw new ApiError(errorMessage(payload, 'Falha ao baixar arquivo.'), { status: response.status, payload });
  }
  const disposition = response.headers.get('content-disposition') || '';
  return { blob: await response.blob(), filename: disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'download' };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}

export function getHealth() { return apiFetch('/api/health'); }
