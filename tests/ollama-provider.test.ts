import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {OllamaProvider,ollamaEndpoint} from '../transport/ollama-provider.ts';
import {AIError,type Analysis} from '../src/features/ai/domain.ts';
import {AIService} from '../src/features/ai/service.ts';
import {WorkspaceFileService} from '../src/features/filesystem/file-service.ts';
import {FakeFileSystemHost} from './helpers/fake-host.ts';
import {managedConnections,aiRoute} from '../src/features/ai/routing.ts';
import {connectionStatus} from '../src/features/ai/connection-status.ts';
import {configurationRoute,newAIConfiguration} from '../src/features/orchestration/ai-config.ts';
const model='fixture-model:local',signal=()=>new AbortController().signal;
const analysis=():Analysis=>({summary:'Grounded explanation.',observedFailure:'',candidates:[],evidence:[],relatedFiles:[],proposal:[],uncertainty:'Runtime not validated.'});
const call=(name:string,args:unknown)=>({function:{name,arguments:args}});
const reply=(calls:unknown[]=[],content='')=>({model,done:true,done_reason:'stop',message:{role:'assistant',content,tool_calls:calls},prompt_eval_count:10,eval_count:5});
const fixture=(body:unknown)=>new OllamaProvider(model,undefined,async()=>Response.json(body));
test('loopback endpoints only; credentials, paths, redirects and cloud model selections are blocked',async()=>{
 assert.equal(ollamaEndpoint('http://localhost:11434'),'http://127.0.0.1:11434/api/chat');assert.equal(ollamaEndpoint('http://[::1]:11434'),'http://[::1]:11434/api/chat');
 for(const url of ['https://external.test','http://192.168.0.102:11434','file:///tmp','http://user:password@127.0.0.1:11434','http://127.0.0.1:11434/api','http://127.0.0.1:11434/?key=x','http://127.0.0.1:11434/#x'])assert.throws(()=>ollamaEndpoint(url),AIError);
 for(const value of ['', 'model:cloud','model-cloud'])await assert.rejects(new OllamaProvider(value).request({messages:[]},signal(),()=>{}),AIError);
});
test('local metadata, profile route and inspection are configuration-only',async()=>{
 let calls=0;const p=new OllamaProvider(model,undefined,async()=>{calls++;throw Error();}),status=await p.inspect(signal());assert.deepEqual(connectionStatus(status),status);assert.equal(calls,0);
 const entry={id:'ollama-local',provider:'local',adapter:'ollama-local',connection:'local',model},rows=managedConnections([entry]);const route=aiRoute({connectionId:entry.id,adapter:entry.adapter,model});assert.deepEqual(configurationRoute({...newAIConfiguration('p'),provider:'local',connection:'local',connectionRef:entry.id},rows),route);
 assert.throws(()=>managedConnections([{...entry,connection:'api'}]));assert.throws(()=>connectionStatus({...status,provider:'openai'}));
});
test('payload uses native read tools, disables streaming/thinking and rejects redirects',async()=>{
 const p=new OllamaProvider(model,undefined,async(url,init)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');assert.equal(init?.redirect,'error');const body=JSON.parse(String(init?.body));assert.equal(body.stream,false);assert.equal(body.think,false);assert.ok(!JSON.stringify(body).includes('dummy-secret-value'));assert.ok(!body.tools.some((t:{function:{name:string}})=>/shell|write|patch|push/.test(t.function.name)));return Response.json(reply([call('tastedev_analysis',analysis())]));});
 const r=await p.request({messages:[{role:'user',text:'token=dummy-secret-value'}]},signal(),()=>{});assert.equal(r.usage?.output,5);assert.deepEqual(r.calls,[]);
});
test('malformed, truncated and mixed replies are refused',async()=>{
 for(const body of [null,{...reply(),done:false},{...reply(),done_reason:'length'},reply([call('read_file',null)]),reply([call('read_file',{}),call('tastedev_analysis',analysis())]),reply([call('tastedev_analysis',analysis()),call('tastedev_analysis',analysis())]),reply([], 'unstructured prose'),{...reply(),eval_count:-1}])await assert.rejects(fixture(body).request({messages:[]},signal(),()=>{}),AIError);
 await assert.rejects(new OllamaProvider(model,undefined,async()=>new Response(' '.repeat(1024*1024+1))).request({messages:[]},signal(),()=>{}),AIError);
});
test('forbidden tools are unavailable and JSON content remains grounded by the existing service',async()=>{
 for(const name of ['shell','write_file','apply_patch','git_push'])await assert.rejects(fixture(reply([call(name,{})])).request({messages:[]},signal(),()=>{}),AIError);
 const r=await fixture(reply([],JSON.stringify(analysis()))).request({messages:[]},signal(),()=>{});assert.deepEqual(JSON.parse(r.text),analysis());
 await assert.rejects(fixture(reply()).request({messages:[{role:'tool',text:'unknown',callId:'unknown'}]},signal(),()=>{}),AIError);
});
for(const [status,expected] of [[401,'authentication'],[429,'rate-limit'],[413,'context-too-large'],[400,'malformed'],[404,'unavailable'],[503,'unavailable']] as const)test(`Ollama HTTP ${status} safe error`,async()=>{await assert.rejects(new OllamaProvider(model,undefined,async()=>new Response('private-error',{status})).request({messages:[]},signal(),()=>{}),e=>e instanceof AIError&&e.code===expected);});
test('cancelled reader closes and preserves timeout',async()=>{
 let cancelled=false;const c=new AbortController(),p=new OllamaProvider(model,undefined,async()=>new Response(new ReadableStream({cancel(){cancelled=true;}})));const promise=p.request({messages:[]},c.signal,()=>{});setTimeout(()=>c.abort(new AIError('timeout')),10);await assert.rejects(promise,e=>e instanceof AIError&&e.code==='timeout');assert.ok(cancelled);
});
test('real loopback HTTP adapter integrates search/read/grounding without source writes',async()=>{
 let requests=0;const server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);requests++;let response;
 if(requests===1)response=reply([call('search_code',{query:'add'})]);else if(requests===2){assert.equal(body.messages.at(-1).tool_name,'search_code');response=reply([call('read_file',{path:'add.ts'})]);}else{assert.equal(body.messages.at(-1).tool_name,'read_file');const c=JSON.parse(body.messages.at(-1).content);response=reply([call('tastedev_analysis',{...analysis(),evidence:[c.id],relatedFiles:[{path:'add.ts',start:1,end:1,evidence:c.id}]})]);}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response));});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 try{const host=new FakeFileSystemHost();host.entries.set('add.ts','export const add=(a:number,b:number)=>a+b;');const before=JSON.stringify([...host.entries]),files=new WorkspaceFileService(host);await files.restore('fixture');const p=new OllamaProvider(model,`http://127.0.0.1:${(server.address() as {port:number}).port}`),s=new AIService(p,{projectId:randomUUID(),name:'Fixture',files,snapshot:()=>({agents:[],jobs:[],runs:[],steps:[],artifacts:[],events:[]}),logs:()=>[],artifact:async()=>new Blob()});const record=await s.analyze(s.newConversation().id,'Explain add',{},()=>{});assert.equal(requests,3);assert.equal(record.metrics?.toolCalls,2);assert.equal(record.result.relatedFiles[0].path,'add.ts');assert.equal(JSON.stringify([...host.entries]),before);}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
