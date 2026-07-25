import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function findTestFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findTestFiles(filePath));
    else if (entry.isFile() && filePath.endsWith('.test.mjs')) files.push(filePath);
  }
  return files;
}

const files = findTestFiles(path.resolve('tests'));
if (!files.length) {
  console.error('Nenhum teste backend encontrado em tests/.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
