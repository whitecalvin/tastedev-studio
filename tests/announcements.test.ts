import test from 'node:test';
import assert from 'node:assert/strict';
import { Announcements, parseNotices, safeLink } from '../src/features/announcements/service.ts';
import * as shared from '../src/features/announcements/shared/announcements.ts';
import { announcementCases } from '../src/features/announcements/shared/announcements.cases.ts';
import { announcementMessages } from '../src/i18n/announcements.ts';
import { translate } from '../src/i18n/messages.ts';
for (const entry of announcementCases(shared)) test(entry.name, entry.run);
const payload = JSON.stringify({ announcements: [
  { id: 'info', level: 'info', title: 'Notice', body: 'Text', style: 'bottom', imageUrl: '/api/announcements/info/image' },
  { id: 'urgent', level: 'urgent', title: 'Urgent', body: 'Important' },
] });
function storage() { let value: string | null = null; return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } }; }
test('Studio notices prioritize urgent; reject unsafe images, links and expired notices', () => {
  const items = parseNotices(payload); assert.equal(items[0].id, 'urgent'); assert.equal(items[1].style, 'bottom'); assert.equal(items[1].imageUrl, 'https://tastedev.net/api/announcements/info/image');
  for (const imageUrl of ['https://other.example/image', 'javascript:bad', 'https://tastedev.net/unapproved/image', 'https://[invalid']) {
    assert.equal(parseNotices(JSON.stringify({ announcements: [{ id: 'i', level: 'info', title: 't', body: '', imageUrl }] }))[0].imageUrl, null);
  }
  assert.deepEqual(parseNotices(JSON.stringify({ announcements: [{ id: 'expired', level: 'info', title: 't', endsAt: '2000-01-01' }] })), []);
  assert.deepEqual(parseNotices('{broken'), []);
  for (const url of ['javascript:alert(1)', 'http://host', 'https://user:password@host']) assert.equal(safeLink(url), null);
});
test('read, dismissal and daily snooze persist; urgent cannot be hidden', async () => {
  const store = storage(); const service = new Announcements(store, async () => payload); await service.refresh('en');
  service.markRead('info'); assert.equal(service.unread(), 1);
  service.snooze('info', '2026-10-01'); assert.deepEqual(service.visible('2026-10-01').map(i => i.id), ['urgent']); assert.equal(service.visible('2026-10-02').length, 2);
  service.dismiss('urgent'); service.snooze('urgent', '2026-10-01'); service.dismiss('info');
  const restored = new Announcements(store, async () => payload); await restored.refresh('en'); assert.equal(restored.unread(), 1); assert.deepEqual(restored.visible().map(i => i.id), ['urgent']);
});
test('disabled preference prevents requests and invalidates pending responses', async () => {
  let resolve!: (value: string) => void; let calls = 0;
  const service = new Announcements(storage(), () => { calls++; return new Promise(r => { resolve = r; }); });
  const pending = service.refresh('en'); service.enable(false); resolve(payload); await pending; await service.refresh('ko', true);
  assert.equal(calls, 1); assert.equal(service.snapshot().items.length, 0); assert.equal(service.snapshot().loading, false);
});
test('language refresh ignores stale response; cache avoids duplicate requests', async () => {
  const resolvers: ((value: string) => void)[] = [];
  const service = new Announcements(storage(), () => new Promise(r => resolvers.push(r)));
  const en = service.refresh('en'); const ko = service.refresh('ko'); resolvers[1](payload); await ko; resolvers[0]('{"announcements":[]}'); await en;
  assert.equal(service.snapshot().items.length, 2); await service.refresh('ko'); assert.equal(resolvers.length, 2);
});
test('network and storage errors are recoverable', async () => {
  const service = new Announcements({ getItem: () => '{bad', setItem: () => { throw Error('quota'); } }, async () => { throw Error('offline'); });
  await service.refresh('en'); assert.equal(service.snapshot().loading, false); assert.match(service.snapshot().error, /could not be loaded/);
  service.enable(false); assert.equal(service.snapshot().preferences.enabled, false); assert.match(service.snapshot().error, /could not be saved/);
});
test('invalid responses are errors; a valid empty feed is successful', async () => {
  for (const response of ['{broken', 'null', '[]', '{"error":"unavailable"}', '{"announcements":{}}']) {
    const service = new Announcements(storage(), async () => response);
    await service.refresh('en');
    assert.match(service.snapshot().error, /could not be loaded/);
    assert.equal(service.snapshot().loading, false);
  }
  const service = new Announcements(storage(), async () => '{"announcements":[]}');
  await service.refresh('en');
  assert.equal(service.snapshot().error, '');
  assert.deepEqual(service.snapshot().items, []);
});
test('failed language change cannot reuse the old successful cache or display its notices', async () => {
  let calls = 0;
  const service = new Announcements(storage(), async language => {
    calls++; if (language === 'ko' && calls === 2) throw Error('offline'); return payload;
  });
  await service.refresh('en', false, 1_000);
  await service.refresh('ko', false, 2_000);
  assert.equal(service.snapshot().items.length, 0);
  assert.match(service.snapshot().error, /could not be loaded/);
  await service.refresh('ko', false, 3_000);
  assert.equal(calls, 3);
  assert.equal(service.snapshot().items.length, 2);
  assert.equal(service.snapshot().error, '');
});
test('refresh failure preserves the current language feed and permits immediate retry', async () => {
  let calls = 0;
  const service = new Announcements(storage(), async () => { if (++calls === 2) throw Error('offline'); return payload; });
  await service.refresh('en', false, 1_000);
  await service.refresh('en', true, 2_000);
  assert.equal(service.snapshot().items.length, 2);
  assert.match(service.snapshot().error, /could not be loaded/);
  await service.refresh('en', false, 3_000);
  assert.equal(calls, 3);
  assert.equal(service.snapshot().error, '');
});
test('simultaneous refreshes reuse one request, including a forced refresh', async () => {
  let calls = 0; let resolve!: (value: string) => void;
  const service = new Announcements(storage(), () => { calls++; return new Promise(r => { resolve = r; }); });
  const first = service.refresh('en');
  const second = service.refresh('en', true);
  assert.equal(first, second);
  assert.equal(calls, 1);
  resolve(payload); await first;
  assert.equal(service.snapshot().loading, false);
  assert.equal(service.snapshot().items.length, 2);
});
test('synchronous loader failure does not leave a stuck pending request', async () => {
  let calls = 0;
  const service = new Announcements(storage(), () => { if (++calls === 1) throw Error('offline'); return Promise.resolve(payload); });
  await service.refresh('en'); await service.refresh('en');
  assert.equal(calls, 2);
  assert.equal(service.snapshot().items.length, 2);
});
test('switching back to a cached language invalidates the intervening pending language', async () => {
  const resolvers: ((value: string) => void)[] = [];
  const service = new Announcements(storage(), () => new Promise(r => resolvers.push(r)));
  const initial = service.refresh('en', false, 1_000); resolvers[0](payload); await initial;
  const ko = service.refresh('ko', false, 2_000);
  const en = service.refresh('en', false, 3_000);
  assert.equal(resolvers.length, 3);
  resolvers[2](payload); await en;
  resolvers[1]('{"announcements":[]}'); await ko;
  assert.equal(service.snapshot().items.length, 2);
  assert.equal(service.snapshot().loading, false);
});
test('announcement messages cover all nine translated languages plus English fallback', () => {
  for (const [language, entries] of Object.entries(announcementMessages)) { assert.equal(Object.keys(entries).length, 14); assert.equal(translate(language as Parameters<typeof translate>[0], 'Announcements'), entries.Announcements); }
  assert.equal(translate('en', 'Announcements'), 'Announcements'); assert.equal(translate('ko', '{count} unread announcements', { count: 2 }), '읽지 않은 공지 2개');
});
