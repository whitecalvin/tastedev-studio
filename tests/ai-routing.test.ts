import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {AIConnectionRegistry} from '../transport/ai-connections.ts';
import {aiGateway} from '../transport/ai-gateway.ts';
import {managedConnections,aiRoute,type ManagedAIConnection} from '../src/features/ai/routing.ts';
import {newAIConfiguration,configurationRoute,canPrepareConfiguration} from '../src/features/orchestration/ai-config.ts';
import {RemoteAIProvider} from '../src/features/ai/remote-provider.ts';
import type {AIProvider} from '../src/features/ai/domain.ts';
const metadata:ManagedAIConnection={id:'account',provider:'openai',adapter:'codex-chatgpt',connection:'account',model:'configured-model'};
test('managed metadata strips private fields and rejects malformed or duplicate connections',()=>{
 assert.deepEqual(managedConnections([{...metadata,key:'dummy-private',account:{email:'private@example.test'}}]),[metadata]);
 for(const change of [{id:'https://external.invalid'},{provider:'anthropic'},{adapter:'unrestricted-shell'},{connection:'api'},{model:'sk-dummy1234567890123456'},{model:'bad\nmodel'}])assert.throws(()=>managedConnections([{...metadata,...change}]));
 assert.throws(()=>managedConnections([metadata,metadata]));assert.throws(()=>aiRoute({connectionId:'account',adapter:'codex-chatgpt',model:'configured-model',key:'dummy'}));
});
test('registry matches exact connection, adapter, model and project without a default fallback',()=>{
 const p:AIProvider={id:'test',capabilities:{streaming:false,tools:true,structured:true,images:false},request:async()=>{throw Error('Not invoked');}},registry=new AIConnectionRegistry([{metadata,provider:p,projects:['one']}]);
 const route={connectionId:'account',adapter:'codex-chatgpt',model:'configured-model'};
 assert.equal(registry.resolve(route,'one'),p);assert.deepEqual(registry.list('two'),[]);
 for(const change of [{connectionId:'missing'},{model:'another-model'},{adapter:'openai-api'}])assert.throws(()=>registry.resolve({...route,...change},'one'));
 assert.throws(()=>registry.resolve(route,'two'));
});
test('task routing uses server configuration and rejects unsupported connection methods/models/tools',()=>{
 const profile={...newAIConfiguration('p'),connection:'account' as const,connectionRef:'account',model:'configured-model'},route=configurationRoute(profile,[metadata]);
 assert.deepEqual(route,{connectionId:'account',adapter:'codex-chatgpt',model:'configured-model'});assert.equal(canPrepareConfiguration(profile,[metadata]),true);
 for(const change of [{connection:'api'},{model:'other'},{provider:'anthropic'},{tool:'codex'},{location:'device'},{connectionRef:''}])assert.equal(configurationRoute({...profile,...change} as typeof profile,[metadata]),undefined);
 assert.equal(configurationRoute(profile,[]),undefined);
});
test('selected HTTP inspection and model request use one exact adapter; unknown routes make zero default calls',async()=>{
 let defaultCalls=0,selectedCalls=0,inspections=0,captured='';
 const defaults:AIProvider={id:'default-fixture',capabilities:{streaming:false,tools:true,structured:true,images:false},request:async()=>{defaultCalls++;return {text:'default',calls:[],model:'default-model'};}};
 const chosen:AIProvider={id:'selected-fixture',capabilities:defaults.capabilities,inspect:async()=>{inspections++;return {provider:'openai',adapter:'codex-chatgpt',model:'configured-model',authentication:'authenticated',modelVerified:false};},request:async input=>{selectedCalls++;captured=JSON.stringify(input);return {text:'selected',calls:[],model:'configured-model'};}};
 const projectId=randomUUID(),registry=new AIConnectionRegistry([{metadata,provider:chosen,projects:[projectId]}]),handler=aiGateway(defaults,'dummy-token-long-enough',[],id=>id===projectId,['dummy-private'],1000,undefined,registry),server=createServer((req,res)=>void handler(req,res));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`,headers={Authorization:'Bearer dummy-token-long-enough','X-Project-Id':projectId},route={connectionId:'account',adapter:'codex-chatgpt',model:'configured-model'};
 try{
  assert.equal((await fetch(base+'/ai/connections')).status,401);assert.deepEqual(await(await fetch(base+'/ai/connections',{headers})).json(),[metadata]);assert.equal(inspections,0);
  const info=await(await fetch(base+'/ai/connection',{headers:{...headers,'X-AI-Route':JSON.stringify(route)}})).json();assert.equal(info.adapter,'codex-chatgpt');assert.equal(inspections,1);
  for(const patch of [{connectionId:'missing'},{model:'wrong'},{adapter:'openai-api'}]){const response=await fetch(base+'/ai/request',{method:'POST',headers,body:JSON.stringify({messages:[],route:{...route,...patch}})});assert.equal(response.status,400);assert.match(await response.text(),/unavailable/);}
  assert.equal(defaultCalls,0);assert.equal(selectedCalls,0);
  const response=await fetch(base+'/ai/request',{method:'POST',headers,body:JSON.stringify({messages:[{role:'user',text:'dummy-private'}],route})});assert.match(await response.text(),/selected/);assert.equal(selectedCalls,1);assert.ok(!captured.includes('dummy-private'));assert.ok(!captured.includes('connectionId'));assert.equal(defaultCalls,0);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
test('remote provider sends pinned metadata only and clears the selection for a new default conversation',async()=>{
 const bodies:unknown[]=[],p=new RemoteAIProvider(async body=>{bodies.push(body);return new Response(JSON.stringify({type:'done',reply:{text:'ok',calls:[],model:'fixture'}})+'\n');});
 const route={connectionId:'account',adapter:'codex-chatgpt' as const,model:'configured-model'};p.setRoute(route);route.model='mutated';
 await p.request({messages:[]},AbortSignal.timeout(1000),()=>{});assert.equal((bodies[0] as {route:{model:string}}).route.model,'configured-model');
 p.setRoute(undefined);await p.request({messages:[]},AbortSignal.timeout(1000),()=>{});assert.ok(!('route' in (bodies[1] as object)));
});
