import { apiFetch } from './client.js';

export function listAutomations() {
  return apiFetch('/api/automations');
}

export function createAutomation(payload) {
  return apiFetch('/api/automations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAutomationAction(automationId, action) {
  return apiFetch(`/api/automations/${automationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}

export function deleteAutomation(automationId) {
  return apiFetch(`/api/automations/${automationId}`, { method: 'DELETE' });
}

export const automationsApi = {
  list: listAutomations,
  create: createAutomation,
  update: updateAutomationAction,
  delete: deleteAutomation,
};
