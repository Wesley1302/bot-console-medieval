import { apiFetch } from './client.js';

export function createAiQuery(input) {
  return apiFetch('/api/ai/queries', { method: 'POST', body: JSON.stringify(input) });
}

export function getAiQueries() {
  return apiFetch('/api/ai/queries');
}

export function getAiQuery(queryId) {
  return apiFetch(`/api/ai/queries/${encodeURIComponent(queryId)}`);
}

export function cancelAiQuery(queryId) {
  return apiFetch(`/api/ai/queries/${encodeURIComponent(queryId)}/cancel`, { method: 'POST' });
}
