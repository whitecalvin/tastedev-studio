import test from 'node:test';
import assert from 'node:assert/strict';
import { UpdateService, type UpdateStatus } from '../src/features/update/service.ts';
import { languages } from '../src/i18n/core.ts';
import { updateMessages } from '../src/i18n/update.ts';
const initial: UpdateStatus = { stage: 'idle', currentVersion: '0.1.4', version: null, notes: '', page: null, canInstall: false, autoCheck: true, downloaded: 0, total: 0, error: null, previousResult: null };
test('startup checks once; disabled and Web make no network request', async () => {
  const calls: string[] = []; const enabled = new UpdateService(true, async action => { calls.push(action); return initial; });
  await enabled.start(); await enabled.start(); assert.deepEqual(calls, ['status', 'check']);
  calls.length = 0; await new UpdateService(true, async action => { calls.push(action); return { ...initial, autoCheck: false }; }).start(); assert.deepEqual(calls, ['status']);
  calls.length = 0; const web = new UpdateService(false, async () => { throw Error('Web must not invoke native'); }); await web.start(); await web.action('install'); assert.deepEqual(calls, []);
});
test('availability never installs automatically and Later stays dismissed', async () => {
  const calls: string[] = []; const service = new UpdateService(true, async action => { calls.push(action); return { ...initial, stage: 'available', version: '0.1.5' }; });
  await service.action('status'); assert.equal(service.snapshot().visible, true); service.dismiss(); await service.action('status'); assert.equal(service.snapshot().visible, false); assert.deepEqual(calls, ['status', 'status']);
});
test('dirty or active workspace blocks install before invoking native', async () => {
  let calls = 0; let protectedWorkspace = true;
  const service = new UpdateService(true, async (_, __, protectedValue) => { calls++; assert.equal(protectedValue, false); return initial; }, () => protectedWorkspace);
  await service.action('install'); assert.equal(calls, 0); assert.match(service.snapshot().error, /Save your files/);
  protectedWorkspace = false; await service.action('install'); assert.equal(calls, 1);
});
test('concurrent clicks serialize; command failures are recoverable and sanitized', async () => {
  let finish: ((status: UpdateStatus) => void) | undefined; let calls = 0;
  const service = new UpdateService(true, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const pending = service.action('check'); await service.action('check'); assert.equal(calls, 1); finish!(initial); await pending;
  const failed = new UpdateService(true, async () => { throw 'private diagnostic'; }); await failed.action('check'); assert.equal(failed.snapshot().pending, false); assert.doesNotMatch(failed.snapshot().error, /private/);
});
test('all supported languages have update messages', () => {
  for (const language of languages.filter(l => l !== 'en')) { assert.equal(Object.keys(updateMessages[language]!).length, 22); for (const value of Object.values(updateMessages[language]!)) assert.ok(value.trim()); }
});
