import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkBundle, readActionMeta } from '../../scripts/artifact-check.mjs';

// The pipeline downloads the real build artifact into ./bundle before running this.
const ROOT = process.env.BUNDLE_DIR || 'bundle';
const TEST_ENV = process.env.TEST_ENV || 'staging';

describe('built bundle (integration)', () => {
  test(`the built bundle is releasable for TEST_ENV=${TEST_ENV}`, () => {
    assert.deepEqual(checkBundle(ROOT, TEST_ENV), []);
  });

  test('action.yml still declares the GITHUB_TOKEN input users rely on', () => {
    const meta = readActionMeta(readFileSync(join(ROOT, 'action.yml'), 'utf8'));
    const inputs = meta.inputs.map((name) => name.toUpperCase());
    assert.ok(inputs.includes('GITHUB_TOKEN'), `inputs found: ${meta.inputs.join(', ')}`);
  });
});
