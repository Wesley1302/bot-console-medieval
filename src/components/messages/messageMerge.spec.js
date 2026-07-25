import { describe, expect, it } from 'vitest';
import { mergeLatestMessages, prependOlderMessages } from './messageMerge.js';

const message = (id, timestamp, content) => ({ id, timestamp, content });

describe('message merge', () => {
  it('substitui edicoes, remove itens apagados da janela e adiciona novas mensagens', () => {
    const current = [message('old', '2026-01-01T10:00:00Z', 'old'), message('same', '2026-01-01T10:01:00Z', 'old text'), message('deleted', '2026-01-01T10:02:00Z', 'gone')];
    const latest = [message('same', '2026-01-01T10:01:00Z', 'edited'), message('new', '2026-01-01T10:03:00Z', 'new')];
    expect(mergeLatestMessages(current, latest)).toEqual([message('old', '2026-01-01T10:00:00Z', 'old'), message('same', '2026-01-01T10:01:00Z', 'edited'), message('new', '2026-01-01T10:03:00Z', 'new')]);
  });

  it('preserva mensagens paginadas mais antigas e nao duplica pagina anterior', () => {
    const current = [message('old', '2026-01-01T10:00:00Z', 'old'), message('new', '2026-01-01T10:02:00Z', 'new')];
    expect(prependOlderMessages(current, [message('older', '2026-01-01T09:00:00Z', 'older'), message('old', '2026-01-01T10:00:00Z', 'duplicate')])).toEqual([message('older', '2026-01-01T09:00:00Z', 'older'), ...current]);
  });
});
