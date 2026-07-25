import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createExportRepository } from '../../server/src/services/export.repository.mjs';

test('export repository grava atomicamente e recupera jobs', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bcm-export-jobs-'));
  try {
    const repository = createExportRepository({ root });
    const job = { id: 'job_test', status: 'running', progress: 40 };
    await repository.saveJobAtomic(job);
    assert.deepEqual(await repository.loadJob(job.id), job);
    assert.deepEqual(await repository.listRecoverableJobs(), [job]);
    await repository.deleteJobAfterRetention(job.id);
    assert.equal(await repository.loadJob(job.id), null);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
