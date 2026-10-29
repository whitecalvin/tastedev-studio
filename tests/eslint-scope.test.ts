import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();

test('bundled Python JavaScript is excluded from product lint', async () => {
  const paths = execFileSync('git', ['ls-files', '-z', '--', 'Python'], { encoding: 'utf8' })
    .split('\0').filter((path) => /\.(?:[cm]?js|tsx?)$/.test(path));
  assert.ok(paths.length > 0, 'exercise the actual tracked external runtime');
  for (const path of paths) assert.equal(await eslint.isPathIgnored(path), true, path);
});

test('product source, transport, tests and scripts retain lint rules', async () => {
  for (const path of ['src/features/orchestration/views.tsx', 'transport/server.ts',
    'tests/eslint-scope.test.ts', 'scripts/prepare-monaco.mjs', 'browser-runner/index.cjs']) {
    assert.equal(await eslint.isPathIgnored(path), false, path);
    const config = await eslint.calculateConfigForFile(path);
    assert.ok(config.rules['@typescript-eslint/no-unused-vars'][0] > 0, path);
  }
});

test('the release lint command keeps its zero-warning policy', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.scripts.lint, 'eslint . --max-warnings=0');
});
