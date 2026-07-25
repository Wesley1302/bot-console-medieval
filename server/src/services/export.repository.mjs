import fs from 'node:fs/promises';
import path from 'node:path';

export function createExportRepository({ root, fsModule = fs } = {}) {
  async function saveJobAtomic(job) {
    await fsModule.mkdir(root, { recursive: true });
    const target = path.join(root, `${job.id}.json`);
    const temp = `${target}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await fsModule.writeFile(temp, JSON.stringify(job, null, 2));
    await fsModule.rename(temp, target);
  }
  async function loadJob(id) {
    try { return JSON.parse(await fsModule.readFile(path.join(root, `${id}.json`), 'utf8')); } catch { return null; }
  }
  async function listRecoverableJobs() {
    await fsModule.mkdir(root, { recursive: true });
    const entries = await fsModule.readdir(root, { withFileTypes: true });
    const jobs = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const job = await loadJob(entry.name.slice(0, -5));
      if (job) jobs.push(job);
    }
    return jobs;
  }
  async function deleteJobAfterRetention(id) { await fsModule.rm(path.join(root, `${id}.json`), { force: true }); }
  return { saveJobAtomic, loadJob, listRecoverableJobs, deleteJobAfterRetention };
}
