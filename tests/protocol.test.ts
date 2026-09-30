import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProtocol } from '../src/features/protocol/parser.ts';
import { resolveProtocol } from '../src/features/protocol/resolver.ts';
import { initializeProtocol, loadProtocol, workspaceReader } from '../src/features/protocol/loader.ts';
import type { ProtocolSources } from '../src/features/protocol/domain.ts';
import { FakeFileSystemHost } from './helpers/fake-host.ts';
import { CoreService } from '../src/features/core/service.ts';
import { InMemoryCoreRepository } from '../src/features/core/repository.ts';
import { matchAgent } from '../src/features/core/matcher.ts';
import type { Project } from '../src/features/projects/types/project.ts';
import type { Agent } from '../src/features/core/domain.ts';
const json = JSON.stringify;
const base = { version: 1, project: { name: 'sample', type: 'node' } };
const task = { command: 'node', args: ['-e', 'console.log("hello")'] };
function sources(project: unknown = base, tasks: unknown = { hello: task }): ProtocolSources { return { 'project.yml': json(project), 'tasks.yml': json(tasks) }; }
function invalid(s: ProtocolSources, field?: string) { const state = parseProtocol(s); assert.equal(state.status, 'Invalid'); if (field) assert.match(state.issues[0].path, new RegExp(field)); assert.throws(() => resolveProtocol(state, 'task', 'hello')); return state; }
test('Protocol entrypoint absent means Not Configured; invalid orphan aux files do not constrain IDE', () => {
  assert.equal(parseProtocol({ 'tasks.yml': '[' }).status, 'Not Configured');
});
test('minimal project and optional files; parse/resolution are pure', () => {
  const state = parseProtocol({ 'project.yml': 'version: 1\nproject:\n  name: sample\n  type: node\n' });
  assert.equal(state.status, 'Valid'); if (state.status === 'Valid') assert.deepEqual(state.definition.tasks, {});
  const resolved = resolveProtocol(parseProtocol(sources()), 'task', 'hello');
  assert.equal(resolved.payload.steps[0].timeoutMs, 60000); assert.equal(resolved.payload.steps[0].cwd, '.');
  assert.equal(resolved.name, 'task: hello');
});
for (const [label, project, field] of [
  ['unsupported version', { ...base, version: 2 }, 'version'], ['missing version', { project: base.project }, 'version'],
  ['string version', { ...base, version: '1' }, 'version'], ['unknown project field', { ...base, extra: true }, 'extra'],
  ['missing name', { ...base, project: { type: 'node' } }, 'name'], ['invalid project type', { ...base, project: { name: 4, type: 'node' } }, 'name'],
  ['missing project', { version: 1 }, 'project'], ['project typo', { ...base, project: { ...base.project, nam: 'bad' } }, 'nam'],
] as const) test(`schema rejects ${label}`, () => void invalid(sources(project), field));
for (const [label, text] of [
  ['malformed', 'version: ['], ['duplicate', 'version: 1\nversion: 1\nproject: {name: a, type: generic}'],
  ['anchor', 'version: 1\nproject: &p {name: a, type: node}'], ['multiple documents', '---\nversion: 1\n---\nversion: 1'],
  ['custom tag', 'version: !unsafe 1'], ['nested', '['.repeat(30) + ']'.repeat(30)], ['large', '#'.repeat(65537)],
] as const) test(`YAML rejects ${label} without crashing or exposing source values`, () => {
  const s = invalid({ 'project.yml': text }); assert.equal(s.issues[0].file, '.tastedev/project.yml'); assert.ok(s.issues[0].message.length < 180);
});
for (const [label, change, field] of [
  ['command missing', { command: undefined }, 'command'], ['command shell expression', { command: 'pnpm build && echo bad' }, 'command'],
  ['command path', { command: 'C:/node.exe' }, 'command'], ['command relative path', { command: './node' }, 'command'], ['batch file', { command: 'pnpm.cmd' }, 'command'],
  ['unknown field', { commnad: 'node' }, 'commnad'], ['args scalar', { args: 'hello' }, 'args'], ['args null', { args: null }, 'args'],
  ['args nonstring', { args: [1] }, 'args'], ['args NUL', { args: ['a\0b'] }, 'args'], ['args too many', { args: Array(101).fill('a') }, 'args'],
  ['environment missing', { environment: 'missing' }, 'environment'], ['environment mapping', { environment: {} }, 'environment'],
  ['env number', { env: { NODE_ENV: 5 } }, 'env'], ['env unsafe name', { env: { 'BAD-NAME': 'x' } }, 'env'], ['env NUL', { env: { SAFE: '\0' } }, 'env'],
  ['negative timeout', { timeout: -1 }, 'timeout'], ['fractional timeout', { timeout: 1.2 }, 'timeout'], ['long timeout', { timeout: 3601 }, 'timeout'],
  ['null timeout', { timeout: null }, 'timeout'], ['task invalid type', null, 'hello'],
] as const) test(`task rejects ${label}`, () => void invalid(sources(base, { hello: change === null ? null : { ...task, ...change } }), field));
for (const cwd of ['../x', 'a/../x', '/root', 'C:/root', '\\server\\path', 'a\\..\\x', 'a/./b', 'a//b', '%2e%2e/x', 'a/.. ', 'a/..', '', 'a/nul', 'a:b', 'a\0b']) {
  test(`cwd rejects ${JSON.stringify(cwd)}`, () => void invalid(sources(base, { hello: { ...task, cwd } }), 'cwd'));
}
test('portable relative cwd remains unchanged', () => assert.equal(resolveProtocol(parseProtocol(sources(base, { hello: { ...task, cwd: 'apps/web' } })), 'task', 'hello').payload.steps[0].cwd, 'apps/web'));
for (const req of [{ os: 'win' }, { architecture: 'amd64' }, { runtimes: { node: '^24' } }, { runtimes: { dotnet: '>=8' } }, { tools: { git: 'true' } }, { browsers: { chromium: true, firefox: true } }, { gpu: { required: 1 } }, { wrong: true }, { tools: { git: true }, runtimes: { git: '>=2' } }]) {
  test(`requirements reject ${json(req)}`, () => void invalid(sources({ ...base, requirements: req }), 'requirements'));
}
test('project/task/test override constraints by field; runtime keys merge and explicit false clears', () => {
  const s = sources({ ...base, requirements: { os: 'linux', architecture: 'x86_64', runtimes: { node: '>=24', java: '>=21', python: '>=3', rust: '>=1' }, tools: { docker: true, git: true }, browsers: { chromium: true }, gpu: { required: true } } }, { hello: { ...task, requirements: { os: 'windows', runtimes: { node: '>=25' }, tools: { docker: false, git: false }, gpu: { required: false }, browsers: { firefox: true } } } });
  s['tests.yml'] = json({ unit: { task: 'hello', type: 'unit', timeout: 9, requirements: { os: 'macos', runtimes: { python: '>=3.13' }, browsers: { firefox: false } } } });
  const r = resolveProtocol(parseProtocol(s), 'test', 'unit');
  assert.equal(r.requirements.platform, 'macos'); assert.equal(r.requirements.architecture, 'x86_64');
  assert.deepEqual(r.requirements.runtimes, { node: '>=25', java: '>=21', python: '>=3.13', rust: '>=1' });
  assert.equal(r.requirements.docker, undefined); assert.equal(r.requirements.browser, undefined); assert.equal(r.requirements.gpu, 'optional');
  assert.equal(r.payload.steps[0].timeoutMs, 9000);
});
test('environment base -> profile -> task and aggregate bounds; no interpolation', () => {
  const s = sources({ ...base, environment: { A: 'base', B: 'base' } }, { hello: { ...task, environment: 'test', env: { A: 'task', C: '${SECRET}' } } });
  s['environments.yml'] = json({ test: { A: 'profile', B: 'profile' } });
  assert.deepEqual(resolveProtocol(parseProtocol(s), 'task', 'hello').payload.steps[0].env, { A: 'task', B: 'profile', C: '${SECRET}' });
  s['environments.yml'] = json({ test: { A: true } }); invalid(s, 'test.A');
  s['environments.yml'] = json({ test: Object.fromEntries(Array.from({ length: 32 }, (_, i) => ['V' + i, 'x'])) }); invalid(s, 'env');
});
for (const type of ['unit', 'integration', 'api', 'browser', 'e2e']) test(`test type ${type} resolves the existing task`, () => {
  const s = sources(); s['tests.yml'] = json({ check: { task: 'hello', type } }); assert.equal(resolveProtocol(parseProtocol(s), 'test', 'check').payload.task, 'hello');
});
for (const x of [{ task: 'missing', type: 'unit' }, { task: 'hello', type: 'unknown' }, { task: 'hello', type: 'unit', timeout: 0 }, { task: 'hello', type: 'unit', typo: true }]) test(`invalid test ${json(x)}`, () => { const s = sources(); s['tests.yml'] = json({ check: x }); invalid(s); });
test('duplicate task and reserved keys rejected', () => {
  invalid({ ...sources(), 'tasks.yml': 'hello: {command: node}\nhello: {command: node}' });
  invalid({ ...sources(), 'tasks.yml': '__proto__: {command: node}' });
  invalid({ ...sources(), 'environments.yml': 'test: {constructor: x}' });
});
test('safe initialize preserves existing file; loader/edit/save revalidation and project isolation', async () => {
  const a = new FakeFileSystemHost(), b = new FakeFileSystemHost(); const ar = workspaceReader(a, a.connection.id), br = workspaceReader(b, b.connection.id);
  assert.equal((await loadProtocol(ar)).status, 'Not Configured');
  await initializeProtocol(a, a.connection.id); const original = a.entries.get('.tastedev/project.yml');
  assert.equal((await loadProtocol(ar)).status, 'Valid'); assert.equal((await loadProtocol(br)).status, 'Not Configured');
  await assert.rejects(initializeProtocol(a, a.connection.id), /already exists/); assert.equal(a.entries.get('.tastedev/project.yml'), original);
  a.entries.set('.tastedev/project.yml', 'version: 22'); assert.equal((await loadProtocol(ar)).status, 'Invalid');
  a.entries.set('.tastedev/project.yml', original!); assert.equal((await loadProtocol(ar)).status, 'Valid');
  a.fail.add('readFile'); assert.equal((await loadProtocol(ar)).status, 'Invalid');
});
test('initialize never overwrites a concurrent writer', async () => {
  const h = new FakeFileSystemHost(); const create = h.createFile.bind(h);
  h.createFile = async (id, path) => { await create(id, path); h.entries.set(path, 'concurrent contents'); };
  await assert.rejects(initializeProtocol(h, h.connection.id), /changed/); assert.equal(h.entries.get('.tastedev/project.yml'), 'concurrent contents');
});
test('missing parent directory is Not Configured even when a host throws for nested exists', async () => {
  const h = new FakeFileSystemHost(); const exists = h.exists.bind(h);
  h.exists = async (id, path) => { if (path.startsWith('.tastedev/') && !h.entries.has('.tastedev')) throw new DOMException('Missing parent', 'NotFoundError'); return exists(id, path); };
  assert.equal((await loadProtocol(workspaceReader(h, h.connection.id))).status, 'Not Configured');
  await initializeProtocol(h, h.connection.id);
  assert.equal((await loadProtocol(workspaceReader(h, h.connection.id))).status, 'Valid');
});
const agent: Agent = { id: 'agent', name: 'Agent', platform: 'linux', architecture: 'x86_64', status: 'idle', lastSeenAt: null, createdAt: '', updatedAt: '', capabilities: { cpuCores: 8, memoryMiB: 8192, docker: false, gpu: false, pty: false, runtimes: { node: '24.11.1', git: '2.50' }, browsers: ['chromium'] } };
test('Protocol -> resolved Job -> existing Core queue/matcher; opening never creates Jobs', async () => {
  const core = new CoreService(new InMemoryCoreRepository(), { async get(id) { return { id, name: id } as Project; } });
  const state = parseProtocol(sources({ ...base, requirements: { os: 'linux', runtimes: { node: '>=24' }, tools: { git: true } } }));
  const input = resolveProtocol(state, 'task', 'hello'); assert.equal(core.snapshot('a').jobs.length, 0);
  const job = await core.createJob('a', input); assert.equal(core.snapshot('b').jobs.length, 0); assert.equal(core.queue('a')[0].id, job.id);
  assert.equal(matchAgent(agent, input.requirements).matches, true);
  assert.deepEqual(matchAgent({ ...agent, platform: 'windows' }, input.requirements).reasons, ['OS mismatch']);
  assert.deepEqual(matchAgent({ ...agent, capabilities: { ...agent.capabilities, runtimes: { node: '22', git: '2.50' } } }, input.requirements).reasons, ['node version insufficient']);
  core.connectAgent(agent.id, agent); assert.ok(core.dispatch('a')); assert.equal(core.snapshot('a').runs.length, 1);
  const bad = parseProtocol({ 'project.yml': 'version: 100' }); assert.throws(() => resolveProtocol(bad, 'task', 'hello')); assert.equal(core.snapshot('a').jobs.length, 1);
});

test('explicit null auxiliary file is invalid while an empty file is allowed', () => {
  invalid({ ...sources(), 'environments.yml': 'null' });
  assert.equal(parseProtocol({ ...sources(), 'environments.yml': '' }).status, 'Valid');
});
