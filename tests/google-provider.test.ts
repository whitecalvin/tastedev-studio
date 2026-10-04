import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {GoogleProvider} from '../transport/google-provider.ts';
import {AIConnectionRegistry} from '../transport/ai-connections.ts';
import {aiGateway} from '../transport/ai-gateway.ts';
import {RemoteAIProvider} from '../src/features/ai/remote-provider.ts';
import {AIError,type Analysis,type AIErrorCode,type AIProvider} from '../src/features/ai/domain.ts';
import {AIService} from '../src/features/ai/service.ts';
import {WorkspaceFileService} from '../src/features/filesystem/file-service.ts';
import {FakeFileSystemHost} from './helpers/fake-host.ts';
import {managedConnections,aiRoute,type ManagedAIConnection} from '../src/features/ai/routing.ts';
import {connectionStatus} from '../src/features/ai/connection-status.ts';
import {configurationRoute,newAIConfiguration} from '../src/features/orchestration/ai-config.ts';
const key='dummy-google-key',model='configured-gemini-model',signature='c2lnbmF0dXJl',signal=()=>new AbortController().signal;
const analysis=():Analysis=>({summary:'Grounded explanation.',observedFailure:'',candidates:[],evidence:[],relatedFiles:[],proposal:[],uncertainty:'Runtime not validated.'});
const call=(name:string,args:unknown,id?:string)=>({functionCall:{name,args,...(id?{id}:{})}});
const message=(parts:unknown[],extra:object={})=>({modelVersion:model,candidates:[{content:{role:'model',parts},finishReason:'STOP'}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:5,thoughtsTokenCount:2},...extra});
const fixture=(parts:unknown[])=>new GoogleProvider(key,model,async()=>Response.json(message(parts)));
const code=(expected:AIErrorCode)=>(error:unknown)=>error instanceof AIError&&error.code===expected;

test('Google metadata is paired and task routing/inspection never executes the model',async()=>{
 let requests=0;const p=new GoogleProvider(key,model,async()=>{requests++;throw Error('Unexpected call');});const status=await p.inspect(signal());assert.deepEqual(connectionStatus(status),status);assert.equal(requests,0);
 const entry:ManagedAIConnection={id:'google-api',provider:'google',adapter:'google-api',connection:'api',model};assert.deepEqual(managedConnections([entry]),[entry]);const route=aiRoute({connectionId:entry.id,adapter:entry.adapter,model});
 const profile={...newAIConfiguration('p'),provider:'google' as const,connectionRef:entry.id};assert.deepEqual(configurationRoute(profile,[entry]),route);assert.equal(configurationRoute({...profile,provider:'openai'},[entry]),undefined);assert.equal(configurationRoute({...profile,model:'wrong'},[entry]),undefined);
 for(const provider of ['openai','anthropic','local']){assert.throws(()=>managedConnections([{...entry,provider}]));assert.throws(()=>connectionStatus({...status,provider}));}
 for(const badModel of ['', '../escape','models/unsafe','bad?key=value'])await assert.rejects(new GoogleProvider(key,badModel).request({messages:[]},signal(),()=>{}),code('unavailable'));
 assert.equal((await new GoogleProvider('',model).inspect(signal())).authentication,'missing');
});

test('fixed GenerateContent payload sends only application read tools and final structured analysis',async()=>{
 let payload:Record<string,unknown>={};const p=new GoogleProvider(key,model,async(url,init)=>{
  assert.equal(url,`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);assert.equal(new Headers(init?.headers).get('x-goog-api-key'),key);payload=JSON.parse(String(init?.body));return Response.json(message([call('tastedev_analysis',analysis())]));
 });
 const deltas:string[]=[];const r=await p.request({messages:[{role:'user',text:`Explain ${key}`} ]},signal(),t=>deltas.push(t));const body=JSON.stringify(payload);assert.ok(!body.includes(key));assert.ok(!body.includes('codeExecution'));assert.ok(!body.includes('googleSearch'));
 const names=(payload.tools as {functionDeclarations:{name:string}[]}[])[0].functionDeclarations.map(d=>d.name);assert.ok(names.includes('search_code'));assert.ok(names.includes('read_file'));assert.ok(names.includes('tastedev_analysis'));assert.ok(!names.some(n=>/shell|patch|write|commit|push/.test(n)));
 assert.deepEqual(r.calls,[]);assert.equal(r.model,model);assert.equal(r.usage?.output,7);assert.deepEqual(deltas,[r.text]);
});

test('parallel calls preserve original signature/part order and correlate function response IDs',async()=>{
 let round=0;const original=[{text:'internal observation',thought:true},{...call('search_code',{query:'add'},'vendor-a'),thoughtSignature:signature},call('read_file',{path:'add.ts'},'vendor-b')];
 const p=new GoogleProvider(key,model,async(_url,init)=>{if(++round===1)return Response.json(message(original));const body=JSON.parse(String(init?.body));assert.deepEqual(body.contents[1],{role:'model',parts:original});assert.deepEqual(body.contents[2].parts,[{functionResponse:{name:'search_code',id:'vendor-a',response:{output:'search'}}},{functionResponse:{name:'read_file',id:'vendor-b',response:{output:'file'}}}]);return Response.json(message([call('tastedev_analysis',analysis())]));});
 const a=await p.request({messages:[{role:'user',text:'question'}]},signal(),()=>{});assert.equal(a.calls.length,2);assert.notEqual(a.calls[0].id,a.calls[1].id);assert.equal(a.calls[1].continuation,undefined);
 await p.request({messages:[{role:'user',text:'question'},{role:'assistant',text:'',calls:a.calls},{role:'tool',callId:a.calls[0].id,text:'search'},{role:'tool',callId:a.calls[1].id,text:'file'}]},signal(),()=>{});
});

test('altered continuation, unmatched results and dangling calls fail before external fetch',async()=>{
 let fetched=0;const p=new GoogleProvider(key,model,async()=>{fetched++;throw Error('Unexpected fetch');});
 for(const messages of [
  [{role:'tool' as const,callId:'unknown',text:'result'}],
  [{role:'assistant' as const,text:'',calls:[{id:'a',name:'read_file',arguments:{path:'add.ts'}}]}],
  [{role:'assistant' as const,text:'',calls:[{id:'a',name:'read_file',arguments:{path:'add.ts'},continuation:{provider:'google' as const,parts:[call('shell',{})]}}]},{role:'tool' as const,callId:'a',text:'result'}]
 ])await assert.rejects(p.request({messages},signal(),()=>{}),code('malformed'));assert.equal(fetched,0);
});

test('credential masking and forbidden provider tools fail closed',async()=>{
 const r=await fixture([call('search_code',{query:key})]).request({messages:[]},signal(),()=>{});assert.ok(!JSON.stringify(r).includes(key));assert.equal(r.text,'');
 for(const name of ['shell','write_file','apply_patch','git_push'])await assert.rejects(fixture([call(name,{})]).request({messages:[]},signal(),()=>{}),code('tool-failure'));
 const final=await fixture([call('tastedev_analysis',{...analysis(),summary:`token=example-value ${key}`})]).request({messages:[]},signal(),()=>{});assert.ok(!final.text.includes('example-value'));assert.ok(!final.text.includes(key));
});

test('malformed, duplicate, mixed, oversized, unsafe and truncated content is rejected',async()=>{
 for(const parts of [[],[null],[{executableCode:{code:'shell'}}],[{text:'x',thoughtSignature:'bad signature'}],[call('read_file',null)],[call('read_file',{},'same'),call('read_file',{},'same')],[call('read_file',{}),call('tastedev_analysis',analysis())],[call('tastedev_analysis',analysis()),call('tastedev_analysis',analysis())],Array.from({length:13},()=>call('read_file',{}))])await assert.rejects(fixture(parts).request({messages:[]},signal(),()=>{}),code('malformed'));
 for(const body of ['broken',' '.repeat(1024*1024+1),JSON.stringify(message([call('read_file',{})],{candidates:[]})),JSON.stringify(message([call('read_file',{})],{candidates:[{finishReason:'MAX_TOKENS'}]})),JSON.stringify(message([call('read_file',{})],{usageMetadata:{promptTokenCount:1,candidatesTokenCount:-1}}))])await assert.rejects(new GoogleProvider(key,model,async()=>new Response(body)).request({messages:[]},signal(),()=>{}),code('malformed'));
});

for(const [status,expected] of [[401,'authentication'],[403,'authentication'],[429,'rate-limit'],[413,'context-too-large'],[400,'malformed'],[503,'unavailable']] as const)test(`Google HTTP ${status} has a safe application error`,async()=>{
 await assert.rejects(new GoogleProvider(key,model,async()=>new Response('private-error',{status})).request({messages:[]},signal(),()=>{}),code(expected));
});

test('cancellation interrupts a stalled response and retains timeout classification',async()=>{
 let cancelled=false;const controller=new AbortController(),p=new GoogleProvider(key,model,async()=>new Response(new ReadableStream({cancel(){cancelled=true;}})));const task=p.request({messages:[]},controller.signal,()=>{});setTimeout(()=>controller.abort(new AIError('timeout')),10);await assert.rejects(task,code('timeout'));assert.ok(cancelled);await assert.rejects(p.request({messages:[]},controller.signal,()=>{}),code('timeout'));
});

test('loopback Core gateway + RemoteAIProvider reuse AIService search/read/grounding with stateless continuation',async()=>{
 const host=new FakeFileSystemHost();host.entries.set('add.ts','export const add=(a:number,b:number)=>a+b;\n');const files=new WorkspaceFileService(host);await files.restore('fixture');const before=JSON.stringify([...host.entries]);const projectId=randomUUID();let requests=0,defaults=0;
 const provider=new GoogleProvider(key,model,async(_url,init)=>{
  const body=JSON.parse(String(init?.body));requests++;
  if(requests===1)return Response.json(message([{...call('search_code',{query:'add'}),thoughtSignature:signature}]));
  const previous=body.contents.at(-2).parts;assert.equal(previous[0].thoughtSignature,signature);
  if(requests===2)return Response.json(message([{...call('read_file',{path:'add.ts'}),thoughtSignature:signature}]));
  const citation=JSON.parse(body.contents.at(-1).parts[0].functionResponse.response.output);
  return Response.json(message([call('tastedev_analysis',{...analysis(),evidence:[citation.id],relatedFiles:[{path:'add.ts',start:1,end:1,evidence:citation.id}]})]));
 });
 const defaultProvider:AIProvider={id:'fixture',capabilities:provider.capabilities,request:async()=>{defaults++;throw Error('Must not fall back');}};
 const metadata:ManagedAIConnection={id:'google-api',provider:'google',adapter:'google-api',connection:'api',model};const registry=new AIConnectionRegistry([{metadata,provider,projects:[projectId]}]);const token='dummy-studio-token',handler=aiGateway(defaultProvider,token,[],id=>id===projectId,[key],1000,undefined,registry),server=createServer((req,res)=>void handler(req,res));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`,headers={Authorization:'Bearer '+token,'X-Project-Id':projectId};
  const remote=new RemoteAIProvider((body,signal)=>fetch(base+'/ai/request',{method:'POST',headers,body:JSON.stringify(body),signal}));remote.setRoute({connectionId:metadata.id,adapter:metadata.adapter,model});
  const service=new AIService(remote,{projectId,name:'Fixture',files,snapshot:()=>({agents:[],jobs:[],runs:[],steps:[],events:[],artifacts:[]}),logs:()=>[],artifact:async()=>new Blob()});
  const record=await service.analyze(service.newConversation().id,'Explain add',{},()=>{});assert.equal(requests,3);assert.equal(defaults,0);assert.equal(record.model,model);assert.equal(record.metrics?.toolCalls,2);assert.equal(record.result.relatedFiles[0].path,'add.ts');assert.equal(JSON.stringify([...host.entries]),before);assert.ok(!JSON.stringify(record).includes(signature));
  const denied=await fetch(base+'/ai/request',{method:'POST',headers,body:JSON.stringify({messages:[],route:{connectionId:metadata.id,adapter:metadata.adapter,model:'wrong'}})});assert.equal(denied.status,400);assert.equal(requests,3);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
