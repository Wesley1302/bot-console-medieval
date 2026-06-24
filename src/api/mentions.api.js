import { apiFetch } from './client.js';

export function listMentions(query = '') {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/mentions${suffix}`);
}
