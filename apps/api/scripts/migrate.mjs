import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';

function parseEnv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const root = resolve(process.cwd(), '../..');
const envPath = resolve(root, '.env.development');
const migrationsPath = resolve(root, 'database/migrations');
const env = parseEnv(await readFile(envPath, 'utf8'));

if (env.NEON_BRANCH !== 'development') {
  throw new Error('Refusing to apply migrations: NEON_BRANCH must equal development.');
}
const connectionString = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
if (!connectionString) throw new Error('Development DATABASE_URL is missing from .env.development.');

const client = new Client({ connectionString, connectionTimeoutMillis: 15_000 });
await client.connect();

try {
  const files = (await readdir(migrationsPath))
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/i, '');
    const table = await client.query("SELECT to_regclass('public.schema_migrations') AS table_name");
    if (table.rows[0]?.table_name) {
      const applied = await client.query('SELECT 1 FROM public.schema_migrations WHERE version = $1', [version]);
      if (applied.rowCount) {
        process.stdout.write('Already applied: ' + version + '\n');
        continue;
      }
    }

    const sql = await readFile(resolve(migrationsPath, file), 'utf8');
    process.stdout.write('Applying: ' + version + '\n');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      process.stdout.write('Applied: ' + version + '\n');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error('Migration failed: ' + version + ' (' + (error instanceof Error ? error.message : 'unknown error') + ')');
    }
  }
} finally {
  await client.end();
}
