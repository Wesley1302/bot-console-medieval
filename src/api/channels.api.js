import { apiFetch } from './client.js';

export function getChannels() {
  return apiFetch('/api/channels');
}

export function getForumThreads(forumId, options = {}) {
  return apiFetch(`/api/forums/${forumId}/threads`, { signal: options.signal });
}

export const channelsApi = {
  list: getChannels,
  listForumThreads: getForumThreads,
};
