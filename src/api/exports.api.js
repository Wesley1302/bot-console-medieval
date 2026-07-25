import { apiDownload, apiFetch, downloadBlob } from './client.js';

export function listExports() {
  return apiFetch('/api/exports');
}

export function createExport(target) {
  return apiFetch('/api/exports', {
    method: 'POST',
    body: JSON.stringify({ target }),
  });
}

export function getExportJob(jobId, options = {}) {
  return apiFetch(`/api/exports/jobs/${jobId}`, { signal: options.signal });
}

export function getExportDownloadUrl(exportId, format = 'json') {
  return `/api/exports/${exportId}/download?format=${encodeURIComponent(format)}`;
}

export async function downloadExport(exportId, format = 'json') {
  const file = await apiDownload(getExportDownloadUrl(exportId, format));
  downloadBlob(file.blob, file.filename);
  return file;
}

export async function bulkDownloadExports({ ids, format = 'json', mode = 'combined' }) {
  const file = await apiDownload('/api/exports/bulk-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, format, mode }),
  });
  downloadBlob(file.blob, file.filename);
  return file;
}

export function deleteExport(exportId) {
  return apiFetch(`/api/exports/${exportId}`, { method: 'DELETE' });
}

export const exportsApi = {
  list: listExports,
  create: createExport,
  job: getExportJob,
  download: downloadExport,
  bulkDownload: bulkDownloadExports,
  delete: deleteExport,
};
