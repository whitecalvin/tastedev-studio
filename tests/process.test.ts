import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserConfigurationRepository, RunConfigurationService, validateConfiguration, type RunConfiguration } from '../src/features/process/configurations.ts';
import { WebUnavailableProcessHost, desktopRequired, type ProcessEvent } from '../src/features/process/contracts.ts';
import { RunService, prepareRun } from '../src/features/process/run-service.ts';
import { OUTPUT_LIMIT, TerminalStore } from '../src/features/process/terminal-store.ts';
import { FakeProcessHost } from './helpers/fake-process-host.ts';
const config: RunConfiguration = { id: 'config', name: 'Development', command: 'pnpm', args: ['dev', 'space argument', '; literal'], cwd: '', env: { TOKEN: 'private-value' }, type: 'terminal' };
const start = async (host = new FakeProcessHost(), value = config) => { const run = new RunService(host); await run.start(value, 'project', 'workspace'); return { run, host }; };
test('configuration validation preserves separate args and environment, rejects unsafe cwd and invalid shapes', () => {
  assert.deepEqual(validateConfiguration(config).args, config.args);
  for (const cwd of ['../escape','C:/outside','/absolute']) assert.throws(() => validateConfiguration({ ...config, cwd }));
  for (const patch of [{ command: '' }, { name: '' }, { args: 'dev' }, { args: ['a\0'] }, { env: { key: 1 } }, { env: [] }, { type: 'shell' }]) assert.throws(() => validateConfiguration({ ...config, ...patch }));
  assert.equal(validateConfiguration({ ...config, cwd: '.' }).cwd, '');
});
test('configuration CRUD persists per project and retains corruption/quota failures', () => {
  const map = new Map<string,string>(); const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string,v: string) => { map.set(k,v); } };
  const repo = new BrowserConfigurationRepository(() => storage), service = new RunConfigurationService(repo);
  const c = service.save('one', config); assert.equal(service.list('two').length, 0); assert.equal(new RunConfigurationService(repo).list('one')[0].id, c.id);
  service.save('one', { ...config, name: 'Changed' }, c.id); assert.equal(service.list('one')[0].name, 'Changed');
  service.delete('one', c.id); assert.deepEqual(service.list('one'), []);
  map.set('tastedev.studio.run.v1:one', '{bad'); assert.throws(() => service.save('one', config), /invalid/); assert.equal(map.get('tastedev.studio.run.v1:one'), '{bad');
  const denied = new RunConfigurationService(new BrowserConfigurationRepository(() => ({ getItem: () => null, setItem: () => { throw new Error('quota'); } }))); assert.throws(() => denied.save('x', config), /could not be saved/);
});
test('Web host and RunService honestly report unsupported without creating a process', async () => {
  const host = new WebUnavailableProcessHost(), run = new RunService(host); assert.equal(await run.start(config,'p',null), false); assert.equal(run.snapshot().session, null); assert.equal(run.snapshot().message, desktopRequired);
  await assert.rejects(host.start(), /desktop runtime/); await assert.rejects(host.stop()); await assert.rejects(host.write()); await assert.rejects(host.resize()); assert.deepEqual(host.capabilities,{process:false,pty:false});
});
test('run transitions starting → running → exit 0 and streams before exit', async () => {
  const host = new FakeProcessHost(), run = new RunService(host), statuses: string[] = []; run.subscribe(() => { statuses.push(run.snapshot().session?.status ?? 'idle'); });
  await run.start(config,'p','w'); host.emit({type:'stdout',data:'first\r\n'}); host.emit({type:'stderr',data:'warning\r\n'});
  assert.equal(run.snapshot().session?.status,'running'); assert.equal(run.terminal.snapshot().chunks.length,2); assert.equal(run.output.snapshot().chunks.length,0);
  host.emit({type:'exited',exitCode:0}); assert.deepEqual(statuses,['starting','running','exited']); assert.equal(run.snapshot().session?.exitCode,0); assert.ok(run.snapshot().session?.finishedAt); assert.equal(host.listeners.size,0);
  assert.deepEqual(host.requests[0].args,config.args); assert.equal(host.requests[0].environment.TOKEN,'private-value'); assert.ok(!JSON.stringify(run.snapshot()).includes('private-value'));
});
test('delayed output streams while running and task output remains separate from Terminal', async () => {
  const {run,host}=await start(new FakeProcessHost(),{...config,type:'task'}); host.delayed('delayed line'); await new Promise(resolve=>setTimeout(resolve,20)); assert.equal(run.output.snapshot().chunks[0].data,'delayed line'); assert.equal(run.terminal.snapshot().chunks.length,0); host.emit({type:'exited',exitCode:7}); assert.equal(run.snapshot().session?.exitCode,7); assert.match(run.snapshot().message,/code 7/);
});
test('start, stream and unexpected-exit failures are visible and sanitized', async () => {
  const host=new FakeProcessHost(); host.failStart=true; const {run}=await start(host); assert.equal(run.snapshot().session?.status,'failed'); assert.ok(!run.snapshot().message.includes('sensitive')); assert.equal(host.listeners.size,0);
  for(const reason of ['stream','unexpected-exit'] as const){ const value=await start(); value.host.emit({type:'failed',reason}); assert.equal(value.run.snapshot().session?.status,'failed'); assert.equal(value.host.listeners.size,0); }
});
test('invalid cwd runtime check blocks host start and reports failure', async () => {
  const host=new FakeProcessHost(),run=new RunService(host); await run.start(config,'p','w',async()=>{throw new Error('missing cwd');}); assert.equal(host.requests.length,0); assert.equal(run.snapshot().session?.status,'failed'); assert.match(run.snapshot().message,/working directory/);
});
test('duplicate Run and Stop are gated, stop detaches output listeners', async () => {
  const {run,host}=await start(); assert.equal(await run.start(config,'p','w'),false); await run.stop(); await run.stop(); assert.equal(host.requests.length,1); assert.equal(host.stops.length,1); assert.equal(host.listeners.size,0); assert.match(run.snapshot().message,/stopped/);
});
test('stop failure preserves active status and permits retry', async () => {
  const {run,host}=await start(); host.failStop=true; await run.stop(); assert.equal(run.snapshot().session?.status,'running'); assert.match(run.snapshot().message,/Stop failed/); host.failStop=false; await run.stop(); assert.equal(run.snapshot().session?.status,'exited');
});
test('input and resize are forwarded only for live PTY and failures are visible', async () => {
  const {run,host}=await start(); await run.input('hello\r'); await run.resize(90,30); await run.resize(-1,0); assert.deepEqual(host.inputs,['hello\r']); assert.deepEqual(host.sizes,[{columns:90,rows:30}]); host.failInput=true; await run.input('x'); assert.match(run.snapshot().message,/input failed/); host.failResize=true; await run.resize(80,24); assert.match(run.snapshot().message,/resize failed/); await run.stop(); await run.input('ignored'); assert.equal(host.inputs.length,1);
});
test('foreign, duplicate and late events never duplicate output', async () => {
  const {run,host}=await start(); const event: ProcessEvent={sessionId:host.sessionId,sequence:2,type:'stdout',data:'one'}; for(const listener of host.listeners){listener({...event,sessionId:'foreign'});listener(event);listener(event);} assert.equal(run.terminal.snapshot().chunks.length,1); host.sequence=2; host.emit({type:'exited',exitCode:0}); host.emit({type:'stdout',data:'late'}); assert.equal(run.terminal.snapshot().chunks.length,1);
});
test('TerminalSession associates, bounds output, clears and closes subscribers', () => {
  const store=new TerminalStore(); let events=0; store.subscribe(()=>events++); store.associate('p','Run'); store.append('stdout','x'.repeat(OUTPUT_LIMIT+10)); assert.equal(store.snapshot().chunks[0].data.length,OUTPUT_LIMIT); assert.equal(store.snapshot().truncated,true); for(let i=0;i<1200;i++)store.append('stderr','line'); assert.ok(store.snapshot().chunks.length<=1000); store.clear(); assert.equal(store.snapshot().chunks.length,0); assert.equal(store.snapshot().session.processSessionId,'p'); store.close(); const count=events; store.append('stdout','ignored'); assert.equal(events,count); assert.equal(store.snapshot().session.status,'closed');
});
test('closing terminal stops its process and dispose cleans listener/timers', async () => {
  const {run,host}=await start(); host.delayed('late',30); await run.closeTerminal(); assert.equal(run.terminal.snapshot().session.status,'closed'); assert.equal(host.listeners.size,0);
  const other=await start(); await other.run.dispose(); assert.equal(other.host.listeners.size,0); assert.equal(other.host.stops.length,1); await assert.rejects(other.run.start(config,'p','w'),/closed/);
});
test('dirty + Run clean, save, without-saving and cancel decisions preserve edits', async () => {
  let dirty=false,saves=0,asked=0; const editor={dirty:()=>dirty,saveAll:async()=>{saves++;dirty=false;}};
  assert.equal(await prepareRun(editor,async()=>{asked++;return 'cancel';}),true); assert.equal(asked,0);
  dirty=true; assert.equal(await prepareRun(editor,async()=>'cancel'),false); assert.equal(dirty,true);
  assert.equal(await prepareRun(editor,async()=>'without'),true); assert.equal(dirty,true); assert.equal(saves,0);
  assert.equal(await prepareRun(editor,async()=>'save'),true); assert.equal(saves,1); assert.equal(dirty,false);
  await assert.rejects(prepareRun({dirty:()=>true,saveAll:async()=>{}},async()=>'save'),/changed while saving/);
  await assert.rejects(prepareRun({dirty:()=>true,saveAll:async()=>{throw new Error('save failed');}},async()=>'save'),/save failed/);
});
test('integration configuration → Run → stream → Terminal → Stop and cleanup', async () => {
  const map=new Map<string,string>(),service=new RunConfigurationService(new BrowserConfigurationRepository(()=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v);}})));
  const c=service.save('project',config),host=new FakeProcessHost(),run=new RunService(host); await run.start(c,'project','workspace'); host.emit({type:'stdout',data:'\x1b[32mready\x1b[0m\r\n'}); assert.equal(run.terminal.snapshot().session.processSessionId,run.snapshot().session?.id); assert.match(run.terminal.snapshot().chunks[0].data,/ready/); await run.stop(); assert.equal(run.terminal.snapshot().session.status,'ended'); await run.dispose(); assert.equal(host.listeners.size,0);
});

test('Starting is locked before cwd validation resolves and Stop prevents later launch', async () => {
  const host=new FakeProcessHost(),run=new RunService(host); let release=()=>{};
  const pending=run.start(config,'p','w',()=>new Promise<void>(resolve=>{release=resolve;}));
  assert.equal(run.snapshot().session?.status,'starting'); assert.equal(await run.start(config,'p','w'),false);
  await run.stop(); release(); await pending; assert.equal(host.requests.length,0); assert.equal(run.snapshot().session?.status,'exited');
});
test('dispose during cwd validation prevents launch and removes subscriptions', async () => {
  const host=new FakeProcessHost(),run=new RunService(host); let release=()=>{};
  const pending=run.start(config,'p','w',()=>new Promise<void>(resolve=>{release=resolve;})); await run.dispose(); release(); await pending; assert.equal(host.requests.length,0); assert.equal(host.listeners.size,0);
});
test('stopping remains gated while host stop is pending', async () => {
  const host=new FakeProcessHost(); let release=()=>{}; host.stop=async()=>{await new Promise<void>(resolve=>{release=resolve;});};
  const {run}=await start(host); const stopping=run.stop(); assert.equal(run.snapshot().session?.status,'stopping'); assert.equal(await run.start(config,'p','w'),false); await run.stop(); release(); await stopping; assert.equal(run.snapshot().session?.status,'exited');
});
test('saved configurations reject duplicate IDs and unsupported versions without rewriting', () => {
  for(const raw of [JSON.stringify({version:2,configurations:[]}),JSON.stringify({version:1,configurations:[config,config]})]){let writes=0;const repo=new BrowserConfigurationRepository(()=>({getItem:()=>raw,setItem:()=>{writes++;}}));assert.throws(()=>repo.read('p'),/invalid/);assert.equal(writes,0);}
});
