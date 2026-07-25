import pg from 'pg';
import { env } from '../config/env.mjs';

const { Pool } = pg;
let pool = null;

function httpError(message, status = 503) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function isDatabaseConfigured() {
  return Boolean(env.DATABASE_URL);
}

export function getPool() {
  if (!isDatabaseConfigured()) {
    throw httpError('DATABASE_URL nao configurada. Limpeza e IA estao indisponiveis.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_SIZE,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    });
    pool.on('error', () => {});
  }
  return pool;
}

export function query(text, params = []) {
  return getPool().query(text, params);
}

export async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (!pool) return;
  const activePool = pool;
  pool = null;
  await activePool.end();
}

export const database = {
  isConfigured: isDatabaseConfigured,
  getPool,
  query,
  transaction,
  close: closeDatabase,
};
