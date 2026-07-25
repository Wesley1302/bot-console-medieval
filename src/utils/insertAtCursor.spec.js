import { describe, expect, it } from 'vitest';
import { insertAtCursor } from './insertAtCursor.js';

describe('insertAtCursor', () => {
  it('insere no inicio e no meio', () => {
    expect(insertAtCursor('mundo', '@', 0, 0)).toEqual({ value: '@ mundo', cursor: 2 });
    expect(insertAtCursor('ola mundo', ' belo', 3, 3)).toEqual({ value: 'ola belo mundo', cursor: 8 });
  });

  it('substitui a selecao e posiciona o cursor ao fim da insercao', () => {
    expect(insertAtCursor('ola mundo', 'Discord', 4, 9)).toEqual({ value: 'ola Discord ', cursor: 12 });
  });
});
