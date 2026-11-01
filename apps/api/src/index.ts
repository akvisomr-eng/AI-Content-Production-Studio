import { attachDatabasePool } from '@neon/functions';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ProjectCreateSchema } from '@studio/contracts';
import { z } from 'zod';

const requiredEnv = ['DATABASE_URL', 'NEON_AUTH_BASE_URL', 'NEON_AUTH_JWKS_URL'] as const;
for (const key of requiredEnv) {
  if (!process.env[key]) throw new Error(`Missing required runtime variable: ${key}`);
}

const database = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 });
attachDatabasePool(database);
const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL!).origin;
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'https://akvisomr-eng.github.io,http://localhost:3000')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

type Variables = { userId: string };
const app = new Hono<{ Variables: Variables }>();
app.use('/api/*', cors({
  origin: (origin) => allowedOrigins.includes(origin) ? origin : '',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

app.use('/api/v1/*', async (c, next) => {
  const authorization = c.req.header('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return c.json({ error: 'UNAUTHORIZED' }, 401);
  }
  try {
    const { payload } = await jwtVerify(authorization.slice(7), jwks, { issuer });
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return c.json({ error: 'UNAUTHORIZED' }, 401);
    }
    c.set('userId', payload.sub);
  } catch {
    return c.json({ error: 'UNAUTHORIZED' }, 401);
  }
  await next();
});

const WorkspaceCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
});
const slugify = (value: string) => value.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'workspace';

app.get('/health', async (c) => {
  try {
    await database.query('SELECT 1');
    return c.json({ ok: true, service: 'studio-api', database: 'reachable', version: '0.2.0' });
  } catch {
    return c.json({ ok: false, service: 'studio-api', database: 'unavailable' }, 503);
  }
});

app.get('/api/v1/me', (c) => c.json({ userId: c.get('userId') }));

app.get('/api/v1/workspaces', async (c) => {
  const { rows } = await database.query(
    'SELECT w.id, w.name, w.slug, wm.role, w.created_at FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = $1 ORDER BY w.created_at DESC',
    [c.get('userId')],
  );
  return c.json({ data: rows });
});

app.post('/api/v1/workspaces', async (c) => {
  const parsed = WorkspaceCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT', issues: parsed.error.issues }, 400);
  const userId = c.get('userId');
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const slug = `${slugify(parsed.data.name)}-${randomUUID().slice(0, 8)}`;
    const { rows } = await client.query(
      'INSERT INTO workspaces (owner_user_id, name, slug) VALUES ($1, $2, $3) RETURNING id, name, slug, created_at',
      [userId, parsed.data.name, slug],
    );
    const workspace = rows[0];
    await client.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [workspace.id, userId, 'owner'],
    );
    await client.query(
      'INSERT INTO audit_logs (workspace_id, actor_user_id, action, resource_type, resource_id) VALUES ($1, $2, $3, $4, $5)',
      [workspace.id, userId, 'workspace.created', 'workspace', workspace.id],
    );
    await client.query('COMMIT');
    return c.json({ data: { ...workspace, role: 'owner' } }, 201);
  } catch {
    await client.query('ROLLBACK');
    return c.json({ error: 'WORKSPACE_CREATE_FAILED' }, 500);
  } finally {
    client.release();
  }
});

app.get('/api/v1/projects', async (c) => {
  const workspaceId = c.req.query('workspaceId');
  const params: unknown[] = [c.get('userId')];
  let where = 'wm.user_id = $1';
  if (workspaceId) {
    params.push(workspaceId);
    where += ' AND p.workspace_id = $2';
  }
  const { rows } = await database.query(
    `SELECT p.id, p.workspace_id, p.title, p.description, p.status, p.default_language, p.target_platforms, p.created_at, p.updated_at FROM projects p JOIN workspace_members wm ON wm.workspace_id = p.workspace_id WHERE ${where} ORDER BY p.updated_at DESC`,
    params,
  );
  return c.json({ data: rows });
});

app.post('/api/v1/projects', async (c) => {
  const parsed = ProjectCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT', issues: parsed.error.issues }, 400);
  const userId = c.get('userId');
  const { workspaceId, title, description, language, platforms } = parsed.data;
  const membership = await database.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId],
  );
  if (!membership.rowCount) return c.json({ error: 'WORKSPACE_NOT_FOUND' }, 404);
  if (!['owner', 'admin', 'editor'].includes(membership.rows[0].role)) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }
  const { rows } = await database.query(
    'INSERT INTO projects (workspace_id, owner_user_id, title, description, default_language, target_platforms) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, workspace_id, title, description, status, default_language, target_platforms, created_at, updated_at',
    [workspaceId, userId, title, description ?? null, language, platforms],
  );
  await database.query(
    'INSERT INTO audit_logs (workspace_id, actor_user_id, action, resource_type, resource_id) VALUES ($1, $2, $3, $4, $5)',
    [workspaceId, userId, 'project.created', 'project', rows[0].id],
  );
  return c.json({ data: rows[0] }, 201);
});

export default app;
