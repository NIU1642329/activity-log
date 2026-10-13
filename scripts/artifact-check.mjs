// Checks that a built activity-log bundle is a valid, publishable GitHub Action.
// Used by the integration tests (real bundle) and covered by unit tests (fixtures).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

export const SUPPORTED_RUNTIMES = ['node20', 'node24'];
export const TEST_ENVS = ['staging', 'prod'];

// Parses action.yml and returns the fields the pipeline relies on.
export function readActionMeta(text) {
  const meta = parse(text);
  if (!meta || typeof meta !== 'object') throw new Error('action.yml is empty or not a mapping');
  if (!meta.name) throw new Error('action.yml has no name');
  if (!meta.runs?.using || !meta.runs?.main) {
    throw new Error('action.yml must define runs.using and runs.main');
  }
  return {
    name: meta.name,
    using: meta.runs.using,
    main: meta.runs.main,
    inputs: Object.keys(meta.inputs ?? {}),
  };
}

// Production is stricter than staging: licences and docs must ship too.
export function requiredFiles(testEnv) {
  const base = ['action.yml', 'package.json'];
  if (testEnv === 'prod') return [...base, 'README.md', 'LICENSE', 'dist/licenses.txt'];
  return base;
}

// Returns a list of problems; an empty list means the bundle is releasable.
export function checkBundle(root, testEnv = 'staging') {
  if (!TEST_ENVS.includes(testEnv)) throw new Error(`Unknown TEST_ENV: ${testEnv}`);
  const problems = requiredFiles(testEnv)
    .filter((file) => !existsSync(join(root, file)))
    .map((file) => `missing ${file}`);
  if (problems.length) return problems;

  const meta = readActionMeta(readFileSync(join(root, 'action.yml'), 'utf8'));
  if (!SUPPORTED_RUNTIMES.includes(meta.using)) problems.push(`unsupported runtime ${meta.using}`);

  const main = join(root, meta.main);
  if (!existsSync(main)) {
    problems.push(`entry point ${meta.main} not found`);
  } else if (statSync(main).size === 0) {
    problems.push(`entry point ${meta.main} is empty`);
  } else if (spawnSync(process.execPath, ['--check', main]).status !== 0) {
    problems.push(`entry point ${meta.main} has a syntax error`);
  }
  return problems;
}
