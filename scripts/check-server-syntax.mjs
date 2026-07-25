import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve('server');

function findModuleFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findModuleFiles(filePath));
    else if (entry.isFile() && filePath.endsWith('.mjs')) files.push(filePath);
  }
  return files;
}

const files = [path.resolve('server.mjs'), ...findModuleFiles(root)];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Sintaxe aprovada: ${files.length} arquivos.`);
