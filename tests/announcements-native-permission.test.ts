import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('announcement commands have explicit native permissions for the local main window', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const build = read('../src-tauri/build.rs');
  const runtime = read('../src-tauri/src/lib.rs');
  const capability = JSON.parse(read('../src-tauri/capabilities/main.json'));
  assert.deepEqual(capability.windows, ['main']);
  assert.equal(capability.remote, undefined);
  assert.notEqual(capability.local, false);
  for (const command of ['announcements_get', 'announcements_open']) {
    assert.ok(build.includes(`"${command}"`), `${command} missing from generated app permissions`);
    assert.match(runtime, new RegExp(`\\b${command}\\b`));
    assert.ok(capability.permissions.includes(`allow-${command.replaceAll('_', '-')}`), `${command} missing from main window capability`);
  }
});
