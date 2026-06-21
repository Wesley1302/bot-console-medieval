import { apiFetch } from './client.js';

export const authApi = {
  login(password) {
    return apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
  },
  logout() {
    return apiFetch('/api/auth/logout', { method: 'POST' });
  },
  getCurrentOperator() {
    return apiFetch('/api/auth/me');
  },
};

export const { login, logout, getCurrentOperator } = authApi;
