import { apiFetch } from './client.js';

export function getKnowledgeDocuments() {
  return apiFetch('/api/knowledge/documents');
}

export function uploadKnowledgeDocument({ title, type, file }) {
  const form = new FormData();
  form.set('title', title || '');
  form.set('type', type);
  form.set('file', file);
  return apiFetch('/api/knowledge/documents', { method: 'POST', body: form });
}

export function reprocessKnowledgeDocument(id) {
  return apiFetch(`/api/knowledge/documents/${encodeURIComponent(id)}/reprocess`, {
    method: 'POST',
  });
}

export function deleteKnowledgeDocument(id) {
  return apiFetch(`/api/knowledge/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
