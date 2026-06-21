const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  const payload = raw && contentType.includes('application/json') ? JSON.parse(raw) : raw;

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.message ? payload.message : 'Falha ao consultar a API.';
    throw new Error(message);
  }

  return payload;
}

export async function apiDownload(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: options.headers || {},
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    let message = 'Falha ao baixar arquivo.';
    if (raw && contentType.includes('application/json')) {
      try {
        const payload = JSON.parse(raw);
        message = payload?.message || message;
      } catch {
        message = 'Falha ao interpretar erro da API.';
      }
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] || 'download',
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function getHealth() {
  return apiFetch('/api/health');
}
