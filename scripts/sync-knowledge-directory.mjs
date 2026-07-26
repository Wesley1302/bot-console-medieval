import 'dotenv/config';
import { database } from '../server/src/db/database.mjs';
import { knowledgeSourceService } from '../server/src/services/knowledge-source.service.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const sourcePath = argument('--source') || process.env.KNOWLEDGE_SOURCE_PATH;
const dryRun = process.argv.includes('--dry-run');

if (!sourcePath) {
  throw new Error('Informe --source ou configure KNOWLEDGE_SOURCE_PATH.');
}
if (!dryRun && !database.isConfigured()) {
  throw new Error('DATABASE_URL deve estar configurada para sincronizar documentos.');
}

try {
  const result = await knowledgeSourceService.syncDirectory({ sourcePath, dryRun });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await database.close();
}
