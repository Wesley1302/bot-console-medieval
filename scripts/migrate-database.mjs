import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { database } from '../server/src/db/database.mjs';

const directory = path.resolve('server', 'src', 'db', 'migrations');
const files = (await fs.readdir(directory))
  .filter((file) => file.endsWith('.sql'))
  .sort();

await database.query(
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`,
);

for (const file of files) {
  const applied = await database.query(
    'SELECT 1 FROM schema_migrations WHERE filename = $1',
    [file],
  );
  if (applied.rowCount) continue;
  const sql = await fs.readFile(path.join(directory, file), 'utf8');
  await database.transaction(async (client) => {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  });
  console.log(`Migracao aplicada: ${file}`);
}

await database.close();
