import test from 'node:test';
import assert from 'node:assert/strict';
import { templateFiles } from '../src/features/projects/services/bootstrap.ts';
import { parseProtocol } from '../src/features/protocol/parser.ts';
import { resolveTestPlan } from '../src/features/protocol/resolver.ts';
import { withWorkspaceSnapshot } from '../src/features/protocol/workspace-test.ts';
import { buildSnapshot, verifySnapshot } from '../src/features/ai/snapshot.ts';
import { WorkspaceFileService } from '../src/features/filesystem/file-service.ts';
import { FakeFileSystemHost } from './helpers/fake-host.ts';
import { contentHash } from '../src/features/ai/fix-service.ts';
import { projectSetupMessages } from '../src/i18n/project-setup.ts';
const projectId = crypto.randomUUID();
test('Node starter produces a valid Protocol and executable test without dependencies', () => {
  const files = templateFiles('A project', 'node-smoke');
  const state = parseProtocol(Object.fromEntries(files.filter(f => f.path.startsWith('.tastedev/')).map(f => [f.path.slice(10), f.content])));
  assert.equal(state.status, 'Valid'); const plan = resolveTestPlan(state, projectId, 'smoke');
  assert.equal(plan.steps.find(s => s.stage === 'test')?.executable, 'node'); assert.deepEqual(plan.steps.find(s => s.stage === 'test')?.args, ['--test', 'tests/smoke.test.cjs']);
  assert.deepEqual(templateFiles('Empty', 'empty'), []); assert.throws(() => templateFiles('', 'node-smoke'));
});
test('template project names cannot inject executable Protocol configuration', () => {
  const name = 'name\nsource: injected'; const files = templateFiles(name, 'node-smoke'); const project = JSON.parse(files.find(f => f.path === '.tastedev/project.yml')!.content); assert.equal(project.project.name, name); assert.equal(project.source, undefined);
});
test('saved workspace snapshot excludes dummy credentials and keeps source identity', async () => {
  const host = new FakeFileSystemHost(); const files = new WorkspaceFileService(host); const connection = await host.selectDirectory(); files.connection = connection;
  for (const entry of templateFiles('Starter', 'node-smoke')) { const parts = entry.path.split('/'); let parent = ''; for (const part of parts.slice(0,-1)) { parent = [parent, part].filter(Boolean).join('/'); if (!await host.exists(connection.id, parent)) await host.createDirectory(connection.id, parent); } await host.createFile(connection.id, entry.path); await host.writeFile(connection.id, entry.path, entry.content, ''); }
  await host.createFile(connection.id, '.env'); await host.writeFile(connection.id, '.env', 'API_KEY=dummy_secret_value_12345', '');
  const state = parseProtocol(Object.fromEntries(templateFiles('Starter','node-smoke').filter(f => f.path.startsWith('.tastedev/')).map(f => [f.path.slice(10), f.content]))); const plan = resolveTestPlan(state, projectId, 'smoke');
  const { snapshot, excluded } = await buildSnapshot(files, {projectId, proposalId: plan.id, attempt:1, baseRevision:'working-tree', changedFiles:[]}); await verifySnapshot(snapshot); assert.ok(excluded.includes('.env'));
  const prepared = withWorkspaceSnapshot(plan, snapshot); assert.equal(prepared.steps[0].stage, 'source'); assert.equal(prepared.steps.find(s => s.stage === 'test')?.cwd, 'source'); assert.equal(prepared.steps.at(-1)?.cwd, '.'); assert.equal(plan.steps[0].cwd, '.');
  assert.throws(() => withWorkspaceSnapshot({...plan, projectId:crypto.randomUUID()}, snapshot));
  const sourceFile = snapshot.files.find(f => f.path === 'src/calculator.cjs')!; assert.equal(sourceFile.checksum, await contentHash(sourceFile.content));
});
test('project setup guidance covers nine translated languages', () => { assert.equal(Object.keys(projectSetupMessages).length, 9); for (const messages of Object.values(projectSetupMessages)) assert.ok(messages['Choose parent folder']); });

test('TypeScript, Python and Rust templates resolve structured dependency-free smoke tasks',()=>{for(const [template,command,runtime] of [['typescript-smoke','node','node'],['python-smoke','python','python'],['rust-smoke','cargo','rust']] as const){const files=templateFiles('Language project',template),definition=parseProtocol(Object.fromEntries(files.filter(f=>f.path.startsWith('.tastedev/')).map(f=>[f.path.slice(10),f.content])));assert.equal(definition.status,'Valid');const plan=resolveTestPlan(definition,projectId,'smoke');assert.equal(plan.steps.find(s=>s.stage==='test')?.executable,command);assert.ok(plan.requirements.runtimes?.[runtime]);assert.ok(files.every(f=>!f.path.startsWith('.env')));}assert.throws(()=>templateFiles('Unknown','invalid' as never));});
