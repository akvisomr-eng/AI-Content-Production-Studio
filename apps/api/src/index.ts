import { attachDatabasePool } from '@neon/functions';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
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

type Variables = { userId: string; db: PoolClient };
const app = new Hono<{ Variables: Variables }>();
app.use('/api/*', cors({
  origin: (origin) => allowedOrigins.includes(origin) ? origin : '',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

// Every authenticated request runs in one transaction with a non-owner DB role.
// The transaction-local identity is consumed by PostgreSQL RLS policies.
app.use('/api/v1/*', async (c, next) => {
  const authorization = c.req.header('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return c.json({ error: 'UNAUTHORIZED' }, 401);
  }

  let userId: string;
  try {
    const { payload } = await jwtVerify(authorization.slice(7), jwks, { issuer });
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return c.json({ error: 'UNAUTHORIZED' }, 401);
    }
    userId = payload.sub;
  } catch {
    return c.json({ error: 'UNAUTHORIZED' }, 401);
  }

  let client: PoolClient | undefined;
  try {
    client = await database.connect();
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    c.set('userId', userId);
    c.set('db', client);
    await next();
    await client.query('COMMIT');
  } catch {
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
    }
    return c.json({ error: 'INTERNAL_ERROR' }, 500);
  } finally {
    client?.release();
  }
});

const WorkspaceCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
});
const slugify = (value: string) => value.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'workspace';

app.get('/health', async (c) => {
  try {
    const { rows } = await database.query(`
      SELECT
        EXISTS (SELECT 1 FROM public.schema_migrations WHERE version = '0002_api_runtime_rls') AS migration_applied,
        NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity) AS all_tables_rls,
        COALESCE((SELECT NOT rolbypassrls FROM pg_roles WHERE rolname = 'authenticated'), false) AS authenticated_role_safe,
        pg_has_role('neondb_owner', 'authenticated', 'MEMBER') AS owner_can_set_authenticated
    `);
    const securityReady = rows[0]?.migration_applied === true
      && rows[0]?.all_tables_rls === true
      && rows[0]?.authenticated_role_safe === true
      && rows[0]?.owner_can_set_authenticated === true;
    if (!securityReady) {
      return c.json({ ok: false, service: 'studio-api', database: 'reachable', security: 'not_ready' }, 503);
    }
    return c.json({ ok: true, service: 'studio-api', database: 'reachable', security: 'ready', version: '0.3.0' });
  } catch {
    return c.json({ ok: false, service: 'studio-api', database: 'unavailable', security: 'not_ready' }, 503);
  }
});

app.get('/api/v1/me', (c) => c.json({ userId: c.get('userId') }));

app.get('/api/v1/workspaces', async (c) => {
  const { rows } = await c.get('db').query(
    'SELECT w.id, w.name, w.slug, wm.role, w.created_at FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = $1 ORDER BY w.created_at DESC',
    [c.get('userId')],
  );
  return c.json({ data: rows });
});

app.post('/api/v1/workspaces', async (c) => {
  const parsed = WorkspaceCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT', issues: parsed.error.issues }, 400);
  const userId = c.get('userId');
  const db = c.get('db');
  const slug = `${slugify(parsed.data.name)}-${randomUUID().slice(0, 8)}`;
  const { rows } = await db.query(
    'INSERT INTO workspaces (owner_user_id, name, slug) VALUES ($1, $2, $3) RETURNING id, name, slug, created_at',
    [userId, parsed.data.name, slug],
  );
  const workspace = rows[0];
  await db.query(
    'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
    [workspace.id, userId, 'owner'],
  );
  await db.query(
    'INSERT INTO audit_logs (workspace_id, actor_user_id, action, resource_type, resource_id) VALUES ($1, $2, $3, $4, $5)',
    [workspace.id, userId, 'workspace.created', 'workspace', workspace.id],
  );
  return c.json({ data: { ...workspace, role: 'owner' } }, 201);
});

app.get('/api/v1/projects', async (c) => {
  const workspaceId = c.req.query('workspaceId');
  const params: unknown[] = [c.get('userId')];
  let where = 'wm.user_id = $1';
  if (workspaceId) {
    params.push(workspaceId);
    where += ' AND p.workspace_id = $2';
  }
  const { rows } = await c.get('db').query(
    `SELECT p.id, p.workspace_id, p.title, p.description, p.status, p.default_language, p.target_platforms, p.created_at, p.updated_at FROM projects p JOIN workspace_members wm ON wm.workspace_id = p.workspace_id WHERE ${where} ORDER BY p.updated_at DESC`,
    params,
  );
  return c.json({ data: rows });
});

app.post('/api/v1/projects', async (c) => {
  const parsed = ProjectCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT', issues: parsed.error.issues }, 400);
  const userId = c.get('userId');
  const db = c.get('db');
  const { workspaceId, title, description, language, platforms } = parsed.data;
  const membership = await db.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId],
  );
  if (!membership.rowCount) return c.json({ error: 'WORKSPACE_NOT_FOUND' }, 404);
  if (!['owner', 'admin', 'editor'].includes(membership.rows[0].role)) {
    return c.json({ error: 'FORBIDDEN' }, 403);
  }
  const { rows } = await db.query(
    'INSERT INTO projects (workspace_id, owner_user_id, title, description, default_language, target_platforms) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, workspace_id, title, description, status, default_language, target_platforms, created_at, updated_at',
    [workspaceId, userId, title, description ?? null, language, platforms],
  );
  await db.query(
    'INSERT INTO audit_logs (workspace_id, actor_user_id, action, resource_type, resource_id) VALUES ($1, $2, $3, $4, $5)',
    [workspaceId, userId, 'project.created', 'project', rows[0].id],
  );
  return c.json({ data: rows[0] }, 201);
});


const ScriptCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  hook: z.string().max(5000).nullable().optional(),
  outline: z.array(z.string().max(1000)).max(50).default([]),
  body: z.string().max(100000).default(''),
  callToAction: z.string().max(2000).nullable().optional(),
  targetDurationSeconds: z.number().int().positive().max(3600).nullable().optional(),
  language: z.string().min(2).max(12).default('id'),
});
const ScriptUpdateSchema = ScriptCreateSchema.partial().extend({
  status: z.enum(['draft', 'review', 'approved', 'published']).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
const ScriptIdSchema = z.string().uuid();
const scriptColumns = 'id, project_id, created_by, title, hook, outline, body, call_to_action, target_duration_seconds, language, status, version, created_at, updated_at';

app.get('/api/v1/projects/:projectId/scripts', async (c) => {
  const parsedId = ScriptIdSchema.safeParse(c.req.param('projectId'));
  if (!parsedId.success) return c.json({ error: 'INVALID_PROJECT_ID' }, 400);
  const db = c.get('db');
  const project = await db.query('SELECT id FROM projects WHERE id = $1', [parsedId.data]);
  if (!project.rowCount) return c.json({ error: 'PROJECT_NOT_FOUND' }, 404);
  const { rows } = await db.query(
    'SELECT ' + scriptColumns + ' FROM scripts WHERE project_id = $1 ORDER BY updated_at DESC',
    [parsedId.data],
  );
  return c.json({ data: rows });
});

app.post('/api/v1/projects/:projectId/scripts', async (c) => {
  const parsedId = ScriptIdSchema.safeParse(c.req.param('projectId'));
  if (!parsedId.success) return c.json({ error: 'INVALID_PROJECT_ID' }, 400);
  const parsed = ScriptCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT', issues: parsed.error.issues }, 400);
  const userId = c.get('userId');
  const db = c.get('db');
  const membership = await db.query(
    'SELECT p.workspace_id, wm.role FROM projects p JOIN workspace_members wm ON wm.workspace_id = p.workspace_id WHERE p.id = $1 AND wm.user_id = $2',
    [parsedId.data, userId],
  );
  if (!membership.rowCount) return c.json({ error: 'PROJECT_NOT_FOUND' }, 404);
  if (!['owner', 'admin', 'editor'].includes(membership.rows[0].role)) return c.json({ error: 'FORBIDDEN' }, 403);
  const input = parsed.data;
  const { rows } = await db.query(
    'INSERT INTO scripts (project_id, created_by, title, hook, outline, body, call_to_action, target_duration_seconds, language) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9) RETURNING ' + scriptColumns,
    [parsedId.data, userId, input.title, input.hook ?? null, JSON.stringify(input.outline), input.body, input.callToAction ?? null, input.targetDurationSeconds ?? null, input.language],
  );
  await db.query(
    'INSERT INTO audit_logs (workspace_id, actor_user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4,$5)',
    [membership.rows[0].workspace_id, userId, 'script.created', 'script', rows[0].id],
  );
  return c.json({ data: rows[0] }, 201);
});

app.patch('/api/v1/scripts/:scriptId', async (c) => {
  const parsedId = ScriptIdSchema.safeParse(c.req.param('scriptId'));
  if (!parsedId.success) return c.json({ error: 'INVALID_SCRIPT_ID' }, 400);
  const parsed = ScriptUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'INVALID_INPUT', issues: parsed.error.issues }, 400);
  const userId = c.get('userId');
  const db = c.get('db');
  const membership = await db.query(
    'SELECT s.project_id, p.workspace_id, wm.role FROM scripts s JOIN projects p ON p.id = s.project_id JOIN workspace_members wm ON wm.workspace_id = p.workspace_id WHERE s.id = $1 AND wm.user_id = $2',
    [parsedId.data, userId],
  );
  if (!membership.rowCount) return c.json({ error: 'SCRIPT_NOT_FOUND' }, 404);
  if (!['owner', 'admin', 'editor'].includes(membership.rows[0].role)) return c.json({ error: 'FORBIDDEN' }, 403);

  const columnMap: Record<string, string> = {
    title: 'title', hook: 'hook', outline: 'outline', body: 'body',
    callToAction: 'call_to_action', targetDurationSeconds: 'target_duration_seconds',
    language: 'language', status: 'status',
  };
  const values: unknown[] = [parsedId.data];
  const assignments: string[] = [];
  for (const [key, column] of Object.entries(columnMap)) {
    if (!Object.prototype.hasOwnProperty.call(parsed.data, key)) continue;
    const value = parsed.data[key as keyof typeof parsed.data];
    values.push(key === 'outline' ? JSON.stringify(value) : value);
    assignments.push(column + ' = 
 + values.length + (key === 'outline' ? '::jsonb' : ''));
  }
  assignments.push('version = version + 1', 'updated_at = now()');
  const { rows } = await db.query(
    'UPDATE scripts SET ' + assignments.join(', ') + ' WHERE id = $1 RETURNING ' + scriptColumns,
    values,
  );
  await db.query(
    'INSERT INTO audit_logs (workspace_id, actor_user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4,$5)',
    [membership.rows[0].workspace_id, userId, 'script.updated', 'script', parsedId.data],
  );
  return c.json({ data: rows[0] });
});

export default app;
