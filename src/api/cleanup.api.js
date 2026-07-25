import { apiFetch } from './client.js';

export function previewCleanup(target) {
  return apiFetch('/api/cleanup/preview', {
    method: 'POST',
    body: JSON.stringify({
      targetType: target.type,
      targetId: target.id,
      targetName: target.name,
    }),
  });
}

export function startCleanup(input) {
  return apiFetch('/api/cleanup/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getCleanupJob(jobId) {
  return apiFetch(`/api/cleanup/jobs/${encodeURIComponent(jobId)}`);
}

export function updateCleanupJob(jobId, action) {
  return apiFetch(`/api/cleanup/jobs/${encodeURIComponent(jobId)}/${action}`, {
    method: 'POST',
  });
}
