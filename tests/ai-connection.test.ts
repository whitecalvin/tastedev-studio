import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {connectionStatus,type AIConnectionStatus} from '../src/features/ai/connection-status.ts';
import {aiGateway} from '../transport/ai-gateway.ts';
import {OpenAIProvider} from '../transport/ai-provider.ts';
import type {AIProvider} from '../src/features/ai/domain.ts';
import {TeamAccessError} from '../transport/team-access.ts';
import {startCoreServer} from '../transport/server.ts';
import {RemoteCoreClient} from '../src/features/core/remote-client.ts';
import type {Project} from '../src/features/projects/types/project.ts';

const status:AIConnectionStatus={provider:'openai',adapter:'openai-api',model:'configured-model',authentication:'configured',modelVerified:false};
test('AI connection reports are bounded, masked and never imply model execution',()=>{
 assert.deepEqual(connectionStatus({...status,key:'dummy-private',account:{email:'private@example.test'}}),status);
 assert.ok(!JSON.stringify(connectionStatus({...status,model:'sk-dummy1234567890123456'})).includes('dummy123'));
 for(const patch of [{provider:'fake'},{adapter:'fake'},{model:'x'.repeat(121)},{model:'bad\nmodel'},{authentication:'ready'},{modelVerified:true}])assert.throws(()=>connectionStatus({...status,...patch}));
});
test('API key inspection never calls external transport or claims authenticated',async()=>{
 let calls=0;const p=new OpenAIProvider('dummy-private','configured-model',async()=>{calls++;throw Error('Must not call');});
 assert.deepEqual(await p.inspect(AbortSignal.timeout(1000)),status);assert.equal(calls,0);
 assert.equal((await new OpenAIProvider('').inspect(AbortSignal.timeout(1000))).authentication,'missing');
 const c=new AbortController();c.abort();await assert.rejects(p.inspect(c.signal));
});
test('connection HTTP inspection enforces origin, token, project and permission before touching provider',async()=>{
 const projectId=randomUUID(),token='dummy-token-long-enough';let inspections=0,requests=0,denied=false;
 const p:AIProvider={id:'diagnostic-fixture',capabilities:{streaming:true,tools:true,structured:true,images:false},inspect:async()=>{inspections++;return status;},request:async()=>{requests++;throw Error('Must not call');}};
 const handler=aiGateway(p,token,['http://localhost:4318'],id=>id===projectId,[],1000,(_req,_id,write)=>{assert.equal(write,false);if(denied)throw new TeamAccessError();});
 const server=createServer((req,res)=>void handler(req,res));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/ai/connection`,headers={Authorization:'Bearer '+token,'X-Project-Id':projectId};
 try{
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{...headers,Origin:'https://evil.invalid'}})).status,403);
  assert.equal((await fetch(url,{headers:{...headers,'X-Project-Id':randomUUID()}})).status,400);
  denied=true;assert.equal((await fetch(url,{headers})).status,403);assert.equal(inspections,0);denied=false;
  const response=await fetch(url,{headers});assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual(await response.json(),status);assert.equal(inspections,1);assert.equal(requests,0);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
test('stalled inspection times out without model execution and releases the concurrency slot',async()=>{
 let stopped=0;const projectId=randomUUID();let stall=true;
 const p:AIProvider={id:'fixture',capabilities:{streaming:false,tools:true,structured:true,images:false},inspect:signal=>stall?new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{stopped++;reject(signal.reason);},{once:true})):Promise.resolve(status),request:async()=>{throw Error('Must not call');}};
 const handler=aiGateway(p,'dummy-token-long-enough',[],id=>id===projectId,[],1000),server=createServer((req,res)=>void handler(req,res));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/ai/connection`,headers={Authorization:'Bearer dummy-token-long-enough','X-Project-Id':projectId};
 try{const a=fetch(url,{headers}),b=fetch(url,{headers});await new Promise(r=>setTimeout(r,50));assert.equal((await fetch(url,{headers})).status,429);assert.match(await(await a).text(),/timeout/);assert.match(await(await b).text(),/timeout/);assert.equal(stopped,2);stall=false;assert.equal((await fetch(url,{headers})).status,200);}
 finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
test('real Core and Studio client inspect without a model request; disconnect and foreign project reject results',async()=>{
 const prior={provider:process.env.TASTEDEV_AI_PROVIDER,key:process.env.OPENAI_API_KEY,model:process.env.TASTEDEV_AI_MODEL,anthropicKey:process.env.ANTHROPIC_API_KEY,anthropicModel:process.env.TASTEDEV_ANTHROPIC_MODEL,googleKey:process.env.GEMINI_API_KEY,googleModel:process.env.TASTEDEV_GOOGLE_MODEL,localModel:process.env.TASTEDEV_LOCAL_MODEL,localURL:process.env.TASTEDEV_OLLAMA_URL};
 process.env.TASTEDEV_LOCAL_MODEL='fixture-local-model';process.env.TASTEDEV_OLLAMA_URL='http://127.0.0.1:11434';
 process.env.GEMINI_API_KEY='dummy-google-verification';process.env.TASTEDEV_GOOGLE_MODEL='configured-gemini-model';
 process.env.ANTHROPIC_API_KEY='dummy-anthropic-verification';process.env.TASTEDEV_ANTHROPIC_MODEL='configured-claude-model';
 process.env.TASTEDEV_AI_PROVIDER='openai';process.env.OPENAI_API_KEY='dummy-only-verification';process.env.TASTEDEV_AI_MODEL='configured-model';
 const token='dummy-token-long-enough',server=await startCoreServer({port:0,studioToken:token,agentToken:token}),client=new RemoteCoreClient(),fetcher=globalThis.fetch;
 const project={id:randomUUID(),name:'Connection verification',description:'',workspacePath:null,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:null,gitEnabled:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastOpenedAt:null} satisfies Project;
 const connect=async()=>{client.connect(`ws://127.0.0.1:${server.port}/studio`,token,project);const end=Date.now()+5000;while(!client.connected){if(Date.now()>end)throw Error('Connection timeout');await new Promise(r=>setTimeout(r,10));}};
 try{
  await connect();assert.deepEqual(await client.inspectAI(project.id,AbortSignal.timeout(2000)),status);
  const connections=await client.listAIConnections(project.id,AbortSignal.timeout(2000));
  assert.deepEqual(connections.map(c=>c.id),['default','chatgpt-account','openai-api','anthropic-api','google-api','ollama-local']);assert.ok(!JSON.stringify(connections).includes('dummy-only-verification'));assert.ok(!JSON.stringify(connections).includes('dummy-anthropic-verification'));assert.ok(!JSON.stringify(connections).includes('dummy-google-verification'));
  assert.deepEqual(await client.inspectAI(project.id,AbortSignal.timeout(2000),{connectionId:'ollama-local',adapter:'ollama-local',model:'fixture-local-model'}),{provider:'local',adapter:'ollama-local',model:'fixture-local-model',authentication:'configured',modelVerified:false});
  assert.deepEqual(await client.inspectAI(project.id,AbortSignal.timeout(2000),{connectionId:'google-api',adapter:'google-api',model:'configured-gemini-model'}),{provider:'google',adapter:'google-api',model:'configured-gemini-model',authentication:'configured',modelVerified:false});
  assert.deepEqual(await client.inspectAI(project.id,AbortSignal.timeout(2000),{connectionId:'anthropic-api',adapter:'anthropic-api',model:'configured-claude-model'}),{provider:'anthropic',adapter:'anthropic-api',model:'configured-claude-model',authentication:'configured',modelVerified:false});
  assert.deepEqual(await client.inspectAI(project.id,AbortSignal.timeout(2000),{connectionId:'openai-api',adapter:'openai-api',model:'configured-model'}),status);
  await assert.rejects(client.inspectAI(randomUUID(),AbortSignal.timeout(2000)),/Core connection required/);
  globalThis.fetch=async(...args)=>{const response=await fetcher(...args);client.disconnect();return response;};
  await assert.rejects(client.inspectAI(project.id,AbortSignal.timeout(2000)),/Core connection changed/);
  globalThis.fetch=fetcher;await connect();
  globalThis.fetch=async()=>{client.disconnect();return new Response('fixture reply');};
  await assert.rejects(client.aiRequest({messages:[]},project.id,AbortSignal.timeout(2000)),/Core connection changed/);
  globalThis.fetch=fetcher;await connect();
  let cancelled=false;globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(4097));},cancel(){cancelled=true;}}));
  await assert.rejects(client.inspectAI(project.id,AbortSignal.timeout(2000)),/inspection failed/);assert.ok(cancelled);
 }finally{
  globalThis.fetch=fetcher;client.disconnect();await server.stop();
  for(const [key,value]of [['TASTEDEV_AI_PROVIDER',prior.provider],['OPENAI_API_KEY',prior.key],['TASTEDEV_AI_MODEL',prior.model],['ANTHROPIC_API_KEY',prior.anthropicKey],['TASTEDEV_ANTHROPIC_MODEL',prior.anthropicModel],['GEMINI_API_KEY',prior.googleKey],['TASTEDEV_GOOGLE_MODEL',prior.googleModel],['TASTEDEV_LOCAL_MODEL',prior.localModel],['TASTEDEV_OLLAMA_URL',prior.localURL]] as const){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
