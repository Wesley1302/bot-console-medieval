import { apiFetch } from './client.js';

export function getChannels() {
  return apiFetch('/api/channels');
}

export function getForumThreads(forumId) {
  return apiFetch(`/api/forums/${forumId}/threads`);
}

export function searchMentions(query = '') {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/mentions${suffix}`);
}

export const channelsApi = {
  list: getChannels,
  listForumThreads: getForumThreads,
  searchMentions,
};
