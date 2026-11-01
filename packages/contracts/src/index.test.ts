import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectCreateSchema } from './index.js';

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
