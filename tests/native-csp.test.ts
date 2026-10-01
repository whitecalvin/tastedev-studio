import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Native Core permits paired loopback HTTP/WS and secure remote transport without opening arbitrary insecure origins', () => {
  const config = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  const directives = new Map<string, string[]>(config.app.security.csp.split(';').map((entry: string) => {
    const [name, ...sources] = entry.trim().split(/\s+/);
    return [name, sources];
  }));
  const connect = directives.get('connect-src')!;
  for (const host of ['127.0.0.1', 'localhost']) {
    assert.ok(connect.includes(`http://${host}:*`), 'History, AI and Evidence requests need the HTTP counterpart of Core WS');
    assert.ok(connect.includes(`ws://${host}:*`), 'Configured loopback Core ports must remain usable');
  }
  assert.ok(connect.includes('https:'));
  assert.ok(connect.includes('wss:'));
  assert.ok(connect.includes('ipc:'));
  assert.ok(!connect.some(source => ['*', 'http:', 'ws:'].includes(source)));
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
  assert.deepEqual(directives.get('frame-src'), ["'none'"]);
  assert.ok(!directives.get('script-src')!.includes('https:'));
});
