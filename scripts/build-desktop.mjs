import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
const record = resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/step-6-20260929/desktop-export.json');
function files(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]).sort(); }
function digest(paths) { const hash = createHash('sha256'); for (const path of paths) hash.update(path).update(readFileSync(path)); return hash.digest('hex'); }
const input = digest([...files('src'), ...files('public'), 'next.config.ts', 'package.json', 'pnpm-lock.yaml', 'scripts/build-desktop.mjs', 'scripts/prepare-monaco.mjs']);
if (existsSync(record) && existsSync('.next-desktop/index.html')) {
  try { const prior = JSON.parse(readFileSync(record, 'utf8')); if (prior.input === input && prior.output === digest(files('.next-desktop'))) { console.log('Desktop export reused: input and output SHA-256 verified.'); process.exit(0); } } catch { /* Invalid evidence triggers a new export. */ }
}
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit', env: { ...process.env, STUDIO_DESKTOP_EXPORT: '1' } });
if (result.status !== 0) process.exit(result.status ?? 1);
mkdirSync(resolve(record, '..'), { recursive: true });
writeFileSync(record, JSON.stringify({ input, output: digest(files('.next-desktop')), node: process.version, completedAt: new Date().toISOString() }, null, 2));

