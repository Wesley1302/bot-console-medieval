import { apiFetch } from './client.js';

export function getChannels() {
  return apiFetch('/api/channels');
}

export function getForumThreads(forumId, options = {}) {
  return apiFetch(`/api/forums/${forumId}/threads`, { signal: options.signal });
}

export function getChannelThreads(channelId, options = {}) {
  return apiFetch(`/api/channels/${channelId}/threads`, { signal: options.signal });
}

export const channelsApi = {
  list: getChannels,
  listChannelThreads: getChannelThreads,
  listForumThreads: getForumThreads,
};
