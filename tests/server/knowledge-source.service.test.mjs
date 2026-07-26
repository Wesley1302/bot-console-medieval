import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  classifyKnowledgeSource,
  createKnowledgeSourceService,
  titleFromKnowledgeSource,
} from '../../server/src/services/knowledge-source.service.mjs';

test('classifica e extrai titulo dos arquivos de conhecimento', () => {
  assert.equal(classifyKnowledgeSource('knowledge-02-leis-justica.md'), 'law');
  assert.equal(classifyKnowledgeSource('knowledge-08-norte-stark.md'), 'house');
  assert.equal(classifyKnowledgeSource('knowledge-04-familia-casamento.md'), 'lore');
  assert.equal(classifyKnowledgeSource('system-prompt.md'), 'reference');
  assert.equal(titleFromKnowledgeSource('# Leis do reino\nTexto', 'leis.md'), 'Leis do reino');
});

test('sincronizacao de diretorio e idempotente e reprocessa alteracoes', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bcm-knowledge-'));
  const source = path.join(root, 'source');
  const storage = path.join(root, 'storage');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'lore.md'), '# Lore\nConteudo inicial.');
  await fs.writeFile(path.join(source, 'leis.txt'), 'Leis do reino.');
  context.after(() => fs.rm(root, { recursive: true, force: true }));

  const documents = new Map();
  const repository = {
    getDocumentBySourceKey: async (sourceKey) => documents.get(sourceKey) || null,
    upsertSourceDocument: async (input) => {
      const document = { ...input, status: 'processing' };
      documents.set(input.sourceKey, document);
      return document;
    },
  };
  let sequence = 0;
  const service = createKnowledgeSourceService({
    repository,
    storagePath: storage,
    randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  });

  const first = await service.syncDirectory({ sourcePath: source });
  const second = await service.syncDirectory({ sourcePath: source });
  await fs.writeFile(path.join(source, 'lore.md'), '# Lore\nConteudo alterado.');
  const third = await service.syncDirectory({ sourcePath: source });

  assert.deepEqual(
    { created: first.created, updated: first.updated, unchanged: first.unchanged },
    { created: 2, updated: 0, unchanged: 0 },
  );
  assert.equal(second.unchanged, 2);
  assert.equal(third.updated, 1);
  assert.equal(third.unchanged, 1);
  assert.equal(documents.size, 2);
});
