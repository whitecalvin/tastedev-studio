import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('native startup diagnostics observe warnings, errors and rejections without forwarding private arguments', async () => {
  const calls: Array<{ command: string; args: { event: string } }> = [];
  const handlers: Record<string, (event: { message?: string }) => void> = {};
  const originalCalls: unknown[][] = [];
  const console = { error: (...args: unknown[]) => originalCalls.push(args), warn: (...args: unknown[]) => originalCalls.push(args) };
  const window = { __TAURI_INTERNALS__: { async invoke(command: string, args: { event: string }) { calls.push({ command, args }); } }, addEventListener(name: string, handler: (event: { message?: string }) => void) { handlers[name] = handler; } };
  // Tauri appends this to an IIFE without an ending semicolon.
  runInNewContext('(() => {})()\n' + readFileSync('src-tauri/src/diagnostics-init.js', 'utf8'), { window, console });
  console.error('private source text', { credential: 'do-not-forward' });
  console.warn('private path');
  handlers.error({}); handlers.unhandledrejection({});
  handlers.error({ message: 'ResizeObserver loop completed with undelivered notifications.' });
  await Promise.resolve();
  assert.deepEqual(calls.map(c => c.args.event), ['ready', 'console-error', 'console-warn', 'error', 'unhandled-rejection', 'resize-observer-error']);
  assert.ok(calls.every(c => c.command === 'runtime_diagnostic' && Object.keys(c.args).length === 1));
  assert.doesNotMatch(JSON.stringify(calls), /private|credential|do-not-forward/);
  assert.equal(originalCalls.length, 2);
});
