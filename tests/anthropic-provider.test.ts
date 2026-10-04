import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AnthropicProvider} from '../transport/anthropic-provider.ts';
import {AIError,type Analysis,type AIErrorCode} from '../src/features/ai/domain.ts';
import {AIService} from '../src/features/ai/service.ts';
import {WorkspaceFileService} from '../src/features/filesystem/file-service.ts';
import {FakeFileSystemHost} from './helpers/fake-host.ts';
import {managedConnections,aiRoute} from '../src/features/ai/routing.ts';
import {connectionStatus} from '../src/features/ai/connection-status.ts';
import {configurationRoute,newAIConfiguration} from '../src/features/orchestration/ai-config.ts';
const key='dummy-anthropic-key',model='configured-claude-model',signal=()=>new AbortController().signal;
const analysis=():Analysis=>({summary:'Grounded explanation.',observedFailure:'',candidates:[],evidence:[],relatedFiles:[],proposal:[],uncertainty:'Runtime not validated.'});
const use=(name:string,input:unknown,id='tool-1')=>({type:'tool_use',id,name,input});
const message=(content:unknown[],extra:object={})=>({type:'message',model,stop_reason:'tool_use',content,usage:{input_tokens:10,output_tokens:5},...extra});
const fixture=(content:unknown[])=>new AnthropicProvider(key,model,async()=>Response.json(message(content)));
const code=(expected:AIErrorCode)=>(error:unknown)=>error instanceof AIError&&error.code===expected;

test('Anthropic metadata is paired, routed exactly and inspected without an external request',async()=>{
 let calls=0;const p=new AnthropicProvider(key,model,async()=>{calls++;throw Error('Unexpected request');});
 const status=await p.inspect(signal());assert.deepEqual(connectionStatus(status),status);assert.equal(status.modelVerified,false);assert.equal(calls,0);
 const entry={id:'anthropic-api',provider:'anthropic',adapter:'anthropic-api',connection:'api',model};assert.deepEqual(managedConnections([entry]),[entry]);
 const route=aiRoute({connectionId:entry.id,adapter:entry.adapter,model});
 const profile={...newAIConfiguration('p'),provider:'anthropic' as const,connectionRef:entry.id};assert.deepEqual(configurationRoute(profile,managedConnections([entry])),route);
 assert.equal(configurationRoute({...profile,provider:'openai'},managedConnections([entry])),undefined);
 for(const provider of ['openai','google']){assert.throws(()=>managedConnections([{...entry,provider}]));assert.throws(()=>connectionStatus({...status,provider}));}
 assert.equal((await new AnthropicProvider('',model).inspect(signal())).authentication,'missing');
 await assert.rejects(new AnthropicProvider(key,'').request({messages:[]},signal(),()=>{}),code('unavailable'));
});

test('Messages payload uses only application read tools and groups parallel tool results',async()=>{
 let payload:Record<string,unknown>={};const p=new AnthropicProvider(key,model,async(url,init)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');const headers=new Headers(init?.headers);assert.equal(headers.get('anthropic-version'),'2023-06-01');assert.equal(headers.get('x-api-key'),key);payload=JSON.parse(String(init?.body));
  return Response.json(message([use('tastedev_analysis',analysis())]));
 });
 const deltas:string[]=[];const reply=await p.request({messages:[{role:'user',text:`Explain ${key}`},{role:'assistant',text:'',calls:[{id:'a',name:'search_code',arguments:{query:'add'}},{id:'b',name:'read_file',arguments:{path:'add.ts'}}]},{role:'tool',callId:'a',text:'search result'},{role:'tool',callId:'b',text:'file result'}]},signal(),t=>deltas.push(t));
 const messages=payload.messages as {content:unknown[]}[];assert.equal(messages.length,3);assert.equal(messages[2].content.length,2);assert.ok(!JSON.stringify(messages).includes(key));
 const names=(payload.tools as {name:string}[]).map(t=>t.name);assert.ok(names.includes('read_file'));assert.ok(names.includes('tastedev_analysis'));assert.ok(!names.some(n=>/shell|write|patch|commit|push|dispatch/.test(n)));
 assert.deepEqual(reply.calls,[]);assert.equal(reply.model,model);assert.equal(reply.usage?.output,5);assert.deepEqual(deltas,[reply.text]);
});

test('provider returns read calls, masks credential text and rejects forbidden tools',async()=>{
 const reply=await fixture([use('search_code',{query:key})]).request({messages:[]},signal(),()=>{});assert.deepEqual(reply.calls[0].arguments,{query:'[redacted]'});assert.equal(reply.text,'');
 for(const name of ['shell','write_file','apply_patch','git_push'])await assert.rejects(fixture([use(name,{})]).request({messages:[]},signal(),()=>{}),code('tool-failure'));
 const final=await fixture([use('tastedev_analysis',{...analysis(),summary:`token=example-value ${key}`})]).request({messages:[]},signal(),()=>{});assert.ok(!final.text.includes(key));assert.ok(!final.text.includes('example-value'));
});

test('malformed, mixed, duplicated, truncated and oversized responses fail closed',async()=>{
 for(const content of [[],[null],[use('read_file',null)],[use('read_file',{},'same'),use('read_file',{},'same')],[use('read_file',{}),use('tastedev_analysis',analysis(),'final')],[use('tastedev_analysis',analysis(),'a'),use('tastedev_analysis',analysis(),'b')],[{type:'server_tool_use',name:'bash'}],Array.from({length:13},(_,i)=>use('read_file',{},String(i)))])await assert.rejects(fixture(content).request({messages:[]},signal(),()=>{}),code('malformed'));
 for(const body of ['broken',JSON.stringify(message([use('read_file',{})],{stop_reason:'max_tokens'})),JSON.stringify(message([use('read_file',{})],{usage:{input_tokens:-1,output_tokens:2}})),' '.repeat(1024*1024+1)])await assert.rejects(new AnthropicProvider(key,model,async()=>new Response(body)).request({messages:[]},signal(),()=>{}),code('malformed'));
});

for(const [status,expected] of [[401,'authentication'],[403,'authentication'],[429,'rate-limit'],[413,'context-too-large'],[400,'malformed'],[503,'unavailable']] as const)test(`Anthropic HTTP ${status} is classified without raw diagnostics`,async()=>{
 await assert.rejects(new AnthropicProvider(key,model,async()=>new Response('private-error',{status})).request({messages:[]},signal(),()=>{}),code(expected));
});

test('cancellation interrupts a stalled body, cancels its reader and preserves timeout classification',async()=>{
 let cancelled=false;const controller=new AbortController();const p=new AnthropicProvider(key,model,async()=>new Response(new ReadableStream({cancel(){cancelled=true;}})));
 const task=p.request({messages:[]},controller.signal,()=>{});setTimeout(()=>controller.abort(new AIError('timeout')),10);await assert.rejects(task,code('timeout'));assert.ok(cancelled);
 await assert.rejects(p.request({messages:[]},controller.signal,()=>{}),code('timeout'));
});

test('adapter reuses AIService search/read/grounding/history and never changes workspace source',async()=>{
 const host=new FakeFileSystemHost();host.entries.set('add.ts','export const add=(a:number,b:number)=>a+b;\n');const files=new WorkspaceFileService(host);await files.restore('fixture');const before=JSON.stringify([...host.entries]);let requests=0;
 const p=new AnthropicProvider(key,model,async(_url,init)=>{
  const body=JSON.parse(String(init?.body));requests++;
  if(requests===1)return Response.json(message([use('search_code',{query:'add'})]));
  if(requests===2)return Response.json(message([use('read_file',{path:'add.ts'},'read')]));
  const last=body.messages.at(-1).content.at(-1),citation=JSON.parse(last.content);assert.equal(last.tool_use_id,'read');
  return Response.json(message([use('tastedev_analysis',{...analysis(),evidence:[citation.id],relatedFiles:[{path:'add.ts',start:1,end:1,evidence:citation.id}]})]));
 });
 const service=new AIService(p,{projectId:randomUUID(),name:'Fixture',files,snapshot:()=>({agents:[],jobs:[],runs:[],steps:[],events:[],artifacts:[]}),logs:()=>[],artifact:async()=>new Blob()});
 const record=await service.analyze(service.newConversation().id,'Explain add',{},()=>{});
 assert.equal(requests,3);assert.equal(record.model,model);assert.equal(record.metrics?.toolCalls,2);assert.equal(record.result.relatedFiles[0].path,'add.ts');assert.equal(service.history.length,1);assert.equal(JSON.stringify([...host.entries]),before);
});
