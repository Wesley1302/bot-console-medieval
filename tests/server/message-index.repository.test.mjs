import assert from 'node:assert/strict';
import test from 'node:test';
import { createMessageIndexRepository } from '../../server/src/repositories/message-index.repository.mjs';

test('busca semantica ignora vetores legados com dimensao diferente', async () => {
  let statement;
  const repository = createMessageIndexRepository({
    query: async (sql) => {
      statement = sql;
      return { rows: [] };
    },
  });

  const result = await repository.searchSemantic({
    guildId: 'guild',
    channelIds: ['channel'],
    embedding: [0.1, 0.2, 0.3],
    limit: 10,
  });

  assert.deepEqual(result, []);
  assert.match(statement, /compatible_messages AS MATERIALIZED/);
  assert.match(statement, /vector_dims\(embedding\) = vector_dims\(\$3::vector\)/);
});
