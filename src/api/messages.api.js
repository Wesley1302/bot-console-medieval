import { apiFetch } from './client.js';

export function getMessages(channelId, options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.before) params.set('before', String(options.before));
  if (options.after) params.set('after', String(options.after));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/channels/${channelId}/messages${query}`, { signal: options.signal });
}

export function sendMessage({ channelId, content = '', files = [] }) {
  const form = new FormData();
  form.set('channelId', channelId);
  form.set('content', content || '');
  files.forEach((file) => form.append('files', file));
  return apiFetch('/api/messages', { method: 'POST', body: form });
}

export function editMessage({ channelId, messageId, content }) {
  return apiFetch(`/api/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function deleteMessage({ channelId, messageId }) {
  return apiFetch(`/api/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' });
}

export const messagesApi = {
  list: getMessages,
  send: sendMessage,
  edit: editMessage,
  delete: deleteMessage,
};
