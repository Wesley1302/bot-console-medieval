import { apiFetch } from './client.js';

export function getDiscordStatus() {
  return apiFetch('/api/status');
}
