import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './client.js';

afterEach(() => vi.restoreAllMocks());

function response(body, init = {}) {
  return new Response(body, { headers: { 'content-type': 'application/json' }, ...init });
}

describe('apiFetch', () => {
  it('retorna JSON e preserva resposta vazia', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response('{"ok":true}')).mockResolvedValueOnce(new Response(null, { status: 204 })));
    await expect(apiFetch('/api/test')).resolves.toEqual({ ok: true });
    await expect(apiFetch('/api/test')).resolves.toBeNull();
  });

  it('expõe status e payload em erros JSON e texto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response('{"message":"Negado"}', { status: 403 })).mockResolvedValueOnce(new Response('falhou', { status: 500 })));
    await expect(apiFetch('/api/test')).rejects.toMatchObject({ name: 'ApiError', status: 403, message: 'Negado' });
    await expect(apiFetch('/api/test')).rejects.toMatchObject({ status: 500, message: 'Falha ao consultar a API.' });
  });

  it('trata JSON inválido sem vazar SyntaxError e emite evento para 401', async () => {
    const expired = vi.fn();
    window.addEventListener('bcm:session-expired', expired);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{invalido', { status: 401, headers: { 'content-type': 'application/json' } })));
    await expect(apiFetch('/api/channels')).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener('bcm:session-expired', expired);
  });
});
