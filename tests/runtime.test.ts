import test from 'node:test';
import assert from 'node:assert/strict';
import { detectRuntime, createHosts, projectHref } from '../src/features/runtime/hosts.ts';
import { TauriFileSystemHost, TauriGitHost, TauriProcessHost, nativeFileError, type NativeBridge } from '../src/features/runtime/native-hosts.ts';
import type { ProcessEvent } from '../src/features/process/contracts.ts';
test('runtime detection is safe in server and Web; native marker selects desktop', () => { assert.equal(detectRuntime(null), 'web'); assert.equal(detectRuntime({}), 'web'); assert.equal(detectRuntime({ __TAURI_INTERNALS__: {} }), 'desktop'); });
test('factory selects all three hosts coherently', () => { const web=createHosts('web'),desktop=createHosts('desktop'); assert.equal(web.process.capabilities.pty,false); assert.equal(web.git.capabilities.git,false); assert.ok(desktop.filesystem instanceof TauriFileSystemHost); assert.ok(desktop.process instanceof TauriProcessHost); assert.ok(desktop.git instanceof TauriGitHost); });
test('Web project links preserve existing routes',()=>assert.equal(projectHref('a b'),'/projects/a%20b'));
test('native file errors omit technical details and keep conflict actionable',()=>{assert.match(nativeFileError({code:'conflict',detail:'private'}).message,/Reload/);assert.doesNotMatch(nativeFileError(new Error('private')).message,/private/);});
test('native filesystem preserves write conflict precondition across IPC',async()=>{const calls:unknown[]=[];const bridge:NativeBridge={async invoke<T>(command:string,args?:Record<string,unknown>){calls.push({command,args});return undefined as T;},async listen(){return()=>{};}};await new TauriFileSystemHost(bridge).writeFile('authorized','src/a.txt','new','old');assert.deepEqual(calls,[{command:'workspace_file',args:{request:{operation:'write',connectionId:'authorized',path:'src/a.txt',content:'new',expected:'old'}}}]);});
test('Git adapter sends literal message and paths as structured arguments',async()=>{const calls:unknown[]=[];const bridge:NativeBridge={async invoke<T>(_command:string,args?:Record<string,unknown>){calls.push(args);return undefined as T;},async listen(){return()=>{};}};const host=new TauriGitHost(bridge),scope={projectId:'p',workspaceId:'w',workspacePath:'C:/test'},repo={id:'w',root:'C:/test',currentBranch:'main',detached:false,hasRemote:false};await host.commit(scope,repo,'literal " & message');await host.stage(scope,repo,['a [1].txt']);assert.equal((calls[0] as {request:{message:string}}).request.message,'literal " & message');assert.deepEqual((calls[1] as {request:{paths:string[]}}).request.paths,['a [1].txt']);});
test('process adapter awaits native event registration before launch',async()=>{const order:string[]=[];let emit:((event:ProcessEvent)=>void)|undefined;const bridge:NativeBridge={async invoke<T>(){order.push('invoke');emit?.({type:'started',sessionId:'s',sequence:1});return undefined as T;},async listen(_name,listener){order.push('listen');emit=listener;return()=>{order.push('unlisten');};}};const host=new TauriProcessHost(bridge);const off=host.subscribe(()=>order.push('event'));await host.start('s',{command:'cmd.exe',args:[],cwd:'',environment:{},terminalMode:'pty',runConfigurationId:'r',projectId:'p',workspaceId:'w'});off();await Promise.resolve();assert.deepEqual(order,['listen','invoke','event','unlisten']);});

test('native Git detection waits for a connected workspace', async () => {
  let calls = 0;
  const bridge: NativeBridge = { async invoke<T>() { calls++; return null as T; }, async listen() { return () => {}; } };
  const host = new TauriGitHost(bridge);
  assert.equal(await host.detect({ projectId: 'p', workspaceId: null, workspacePath: 'C:/test' }), null);
  assert.equal(calls, 0);
  await host.detect({ projectId: 'p', workspaceId: 'connected', workspacePath: 'C:/test' });
  assert.equal(calls, 1);
});
