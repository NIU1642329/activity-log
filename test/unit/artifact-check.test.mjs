import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readActionMeta, requiredFiles, checkBundle } from '../../scripts/artifact-check.mjs';

const ACTION = 'name: Demo\ninputs:\n  GITHUB_TOKEN:\n    required: true\nruns:\n  using: node20\n  main: dist/index.js\n';

// Builds a fake bundle in a temporary folder so each test is independent.
function makeBundle({ action = ACTION, main = 'console.log("ok");', extras = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'bundle-'));
  mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'action.yml'), action);
  writeFileSync(join(root, 'package.json'), '{}');
  if (main !== null) writeFileSync(join(root, 'dist/index.js'), main);
  for (const file of extras) writeFileSync(join(root, file), 'x');
  return root;
}

describe('artifact-check (unit)', () => {
  test('readActionMeta returns name, runtime, entry point and inputs', () => {
    assert.deepEqual(readActionMeta(ACTION), {
      name: 'Demo', using: 'node20', main: 'dist/index.js', inputs: ['GITHUB_TOKEN'],
    });
  });

  test('readActionMeta rejects empty, unnamed or incomplete files', () => {
    assert.throws(() => readActionMeta(''), /empty/);
    assert.throws(() => readActionMeta('runs:\n  using: node20\n'), /no name/);
    assert.throws(() => readActionMeta('name: X\nruns:\n  using: node20\n'), /runs.main/);
  });

  test('production requires more files than staging', () => {
    assert.deepEqual(requiredFiles('staging'), ['action.yml']);
    assert.ok(requiredFiles('prod').includes('dist/licenses.txt'));
  });

  test('a complete bundle has no problems', () => {
    assert.deepEqual(checkBundle(makeBundle(), 'staging'), []);
    const prod = makeBundle({ extras: ['README.md', 'LICENSE', 'dist/licenses.txt'] });
    assert.deepEqual(checkBundle(prod, 'prod'), []);
  });

  test('missing production files are reported', () => {
    assert.deepEqual(checkBundle(makeBundle(), 'prod'), [
      'missing README.md', 'missing LICENSE', 'missing dist/licenses.txt',
    ]);
  });

  test('wrong runtime, missing, empty or broken entry points are reported', () => {
    const old = ACTION.replace('node20', 'node12');
    assert.deepEqual(checkBundle(makeBundle({ action: old })), ['unsupported runtime node12']);
    assert.deepEqual(checkBundle(makeBundle({ main: null })), ['entry point dist/index.js not found']);
    assert.deepEqual(checkBundle(makeBundle({ main: '' })), ['entry point dist/index.js is empty']);
    assert.deepEqual(checkBundle(makeBundle({ main: 'function (' })), ['entry point dist/index.js has a syntax error']);
  });

  test('an unknown TEST_ENV is rejected', () => {
    assert.throws(() => checkBundle(makeBundle(), 'qa'), /Unknown TEST_ENV/);
  });
});
