import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnostics, DIAGNOSTIC_KEY } from '../src/features/runtime/frontend-diagnostics.ts';

function fixture(native = false, unavailable = false) {
  const events = new EventTarget();
  const storage = new Map<string, string>();
  const target = {
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    location: { pathname: '/projects/private-project?token=secret' }, navigator: { platform: 'Win32' },
    console: { error() {} }, localStorage: { setItem(key: string, value: string) { if (unavailable) throw new Error('quota'); storage.set(key, value); } },
    ...(native ? { __TAURI_INTERNALS__: {} } : {}),
  } as unknown as Parameters<typeof createDiagnostics>[0];
  return { target, events, storage, diagnostics: createDiagnostics(target, '0.1.0', 'TEST/CONTROLLED') };
}
test('controlled window error and rejection preserve message/stack/source/time and safe runtime context', () => {
  for (const native of [false, true]) {
    const { events, diagnostics, storage } = fixture(native);
    for (const type of ['error', 'unhandledrejection']) {
      const error = new Error(`Controlled ${type} failure`);
      const event = new Event(type);
      Object.defineProperty(event, type === 'error' ? 'error' : 'reason', { value: error });
      events.dispatchEvent(event);
    }
    const records = diagnostics.snapshot();
    assert.deepEqual(records.map(r => r.source), ['window.error', 'unhandledrejection']);
    for (const record of records) {
      assert.match(record.message, /^Controlled/); assert.match(record.stack, /at /);
      assert.ok(Number.isFinite(Date.parse(record.timestamp))); assert.equal(record.runtime, native ? 'tauri' : 'web');
      assert.equal(record.applicationVersion, '0.1.0'); assert.equal(record.platform, 'Windows');
      assert.equal(record.route, '/projects/[id]'); assert.equal(record.category, 'TEST/CONTROLLED');
    }
    assert.equal(storage.has(DIAGNOSTIC_KEY), false);
    assert.deepEqual(JSON.parse(storage.get(`${DIAGNOSTIC_KEY}.controlled`)! ), records);
    diagnostics.dispose();
  }
});
test('diagnostics exclude console/IPC payloads, redact error values and bound persistence', () => {
  const { target, diagnostics, storage } = fixture();
  target.console.error('FILE CONTENT', { password: 'SECRET_VALUE' });
  diagnostics.report('tauri.invoke', { code: 'not-found', content: 'FILE CONTENT', environment: 'SECRET_VALUE' });
  const error = new Error('Failed "FILE CONTENT" token=SECRET_VALUE C:\\private\\source.txt https://user:pass@example.test/?secret=value\nFILE CONTENT');
  error.stack = 'Error: FILE CONTENT\n    at handler (https://example.test/app.js?token=SECRET_VALUE:1:2)';
  diagnostics.report('react.boundary', error);
  const output = JSON.stringify(diagnostics.snapshot());
  assert.doesNotMatch(output, /FILE CONTENT|SECRET_VALUE|private|user:pass/);
  assert.match(output, /Native command rejected: not-found/);
  for (let i = 0; i < 60; i++) diagnostics.report('window.error', new Error(`Controlled failure ${i}`));
  assert.equal(diagnostics.snapshot().length, 50);
  assert.ok(storage.get(`${DIAGNOSTIC_KEY}.controlled`)!.length < 256000);
  diagnostics.dispose();
});
test('denied storage and hostile error objects cannot break error recovery or recurse', () => {
  const { target, diagnostics } = fixture(false, true);
  const original = target.console.error;
  assert.doesNotThrow(() => diagnostics.report('tauri.invoke', { get code() { throw new Error('getter'); } }));
  assert.equal(diagnostics.storageAvailable(), false); assert.equal(diagnostics.snapshot().length, 1);
  diagnostics.dispose(); assert.notEqual(target.console.error, original);
});
