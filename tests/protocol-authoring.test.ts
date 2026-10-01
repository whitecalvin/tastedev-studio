import test from 'node:test';
import assert from 'node:assert/strict';
import { definitionMap, previewDraft, readProtocolSources, saveDraft } from '../src/features/protocol/authoring.ts';
import { resolveTestPlan } from '../src/features/protocol/resolver.ts';
import { FakeFileSystemHost } from './helpers/fake-host.ts';
const sources = {
  'project.yml': 'version: 1\nproject: {name: Example, type: node}\n',
  'tasks.yml': 'old:\n  command: node\n  args: [old.cjs]\n  requirements: {tools: {git: true}}\n',
  'tests.yml': 'existing: {type: unit, task: old}\n',
};
async function fixture() {
  const host = new FakeFileSystemHost(), id = host.connection.id;
  await host.createDirectory(id, '.tastedev');
  for (const [file, content] of Object.entries(sources)) { await host.createFile(id, `.tastedev/${file}`); await host.writeFile(id, `.tastedev/${file}`, content, ''); }
  return { host, id };
}
test('authoring preserves raw neighboring requirements and previews the existing pipeline resolver', () => {
  const added = previewDraft({ sources, file: 'tasks.yml', name: 'smoke', value: { command: 'node', args: ['--test', 'test.cjs'] } });
  assert.deepEqual(definitionMap(added.sources, 'tasks.yml').old, {command:'node', args:['old.cjs'], requirements:{tools:{git:true}}});
  const edited = previewDraft({ sources: added.sources, file: 'tests.yml', name: 'smokeTest', value: { type: 'integration', task: 'smoke', pipeline: { build: 'old' } } });
  const plan = resolveTestPlan(edited.state, crypto.randomUUID(), 'smokeTest');
  assert.deepEqual(plan.steps.filter(step => step.executable === 'node').map(step => step.stage), ['build', 'test']);
  assert.equal(edited.state.definition.tests.existing.task, 'old');
});
test('invalid shell, traversal, duplicate name and dangling rename are rejected without writing', () => {
  const make = (name: string, value: Record<string, unknown>, originalName?: string) => () => previewDraft({ sources, file: 'tasks.yml', name, value, originalName });
  assert.throws(make('escape', {command:'node', cwd:'../outside'}));
  assert.throws(make('shell', {command:'node && rm'}));
  assert.throws(make('old', {command:'node'}), /already exists/);
  assert.throws(make('renamed', {command:'node'}, 'old'), /referenced task/);
  assert.throws(make('__proto__', {command:'node'}));
});
test('save protects all Protocol base files and dirty editors and writes only the selected definition file', async () => {
  const {host,id} = await fixture();
  const draft = {sources:await readProtocolSources(host,id),file:'tasks.yml' as const,name:'smoke',value:{command:'node'}};
  const before = new Map(host.entries);
  await assert.rejects(saveDraft(host,id,draft,()=>{throw Error('dirty');}), /dirty/);
  assert.deepEqual(host.entries,before);
  await host.writeFile(id,'.tastedev/tests.yml',sources['tests.yml']+'other: {type: unit, task: old}\n',sources['tests.yml']);
  await assert.rejects(saveDraft(host,id,draft,()=>{}), /changed on disk/);
  assert.equal(host.entries.get('.tastedev/tasks.yml'),sources['tasks.yml']);
  const fresh={...draft,sources:await readProtocolSources(host,id)};
  await saveDraft(host,id,fresh,()=>{});
  assert.equal(host.entries.get('.tastedev/project.yml'),sources['project.yml']);
  assert.match(host.entries.get('.tastedev/tests.yml') as string,/other:/);
  assert.ok(definitionMap(await readProtocolSources(host,id),'tasks.yml').smoke);
});
test('host expected-content validation catches a concurrent edit after preflight', async () => {
  const {host,id}=await fixture(); const original=host.writeFile.bind(host);
  host.writeFile=async(connection,path,content,expected)=>{host.entries.set(path,'user edit');await original(connection,path,content,expected);};
  await assert.rejects(saveDraft(host,id,{sources,file:'tasks.yml',name:'smoke',value:{command:'node'}},()=>{}), /Disk content changed/);
  assert.equal(host.entries.get('.tastedev/tasks.yml'),'user edit');
});
