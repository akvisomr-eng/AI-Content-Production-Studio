import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectCreateSchema, ScriptCreateSchema, ScriptUpdateSchema } from './index.js';

describe('ProjectCreateSchema', () => {
  it('accepts a valid project and applies defaults', () => {
    const result = ProjectCreateSchema.safeParse({
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Video campaign',
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.language, 'id');
      assert.deepEqual(result.data.platforms, []);
    }
  });

  it('rejects empty titles and malformed workspace identifiers', () => {
    assert.equal(ProjectCreateSchema.safeParse({
      workspaceId: 'not-a-uuid',
      title: ' ',
    }).success, false);
  });

  it('rejects unsupported publishing platforms', () => {
    assert.equal(ProjectCreateSchema.safeParse({
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Test',
      platforms: ['unsupported'],
    }).success, false);
  });
});


describe('ScriptCreateSchema', () => {
  it('accepts a script and applies language/outline defaults', () => {
    const result = ScriptCreateSchema.safeParse({ title: 'Launch video script' });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.language, 'id');
      assert.deepEqual(result.data.outline, []);
      assert.equal(result.data.body, '');
    }
  });

  it('rejects empty titles and invalid target durations', () => {
    assert.equal(ScriptCreateSchema.safeParse({ title: ' ' }).success, false);
    assert.equal(ScriptCreateSchema.safeParse({ title: 'Valid title', targetDurationSeconds: -10 }).success, false);
  });

  it('requires at least one field for a script update', () => {
    assert.equal(ScriptUpdateSchema.safeParse({}).success, false);
    assert.equal(ScriptUpdateSchema.safeParse({ body: 'Updated draft' }).success, true);
    assert.equal(ScriptUpdateSchema.safeParse({ status: 'published' }).success, false);
  });
});
