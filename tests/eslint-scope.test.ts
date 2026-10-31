import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../', import.meta.url));
const eslint = new ESLint({ cwd: root });

test('bundled Python JavaScript is excluded from product lint', async () => {
  // Release archives contain actual runtime files but no Git metadata. Inspect
  // those files directly; an absent/empty runtime must still fail this contract.
  const paths = readdirSync(join(root, 'Python'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:[cm]?js|tsx?)$/.test(entry.name))
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
  assert.ok(paths.length > 0, 'exercise the actual bundled external runtime');
  for (const path of paths) assert.equal(await eslint.isPathIgnored(path), true, path);
});

test('product source, transport, tests and scripts retain lint rules', async () => {
  assert.equal(await eslint.isPathIgnored('artifacts/checkpoints/source/src/app.ts'),true);
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
