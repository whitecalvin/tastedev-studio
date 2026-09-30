import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {LocalArtifactStore,ARTIFACT_LIMIT,type StoredArtifact} from '../transport/artifact-store.ts';
import {browserResult} from '../transport/artifacts.ts';
import {parseProtocol} from '../src/features/protocol/parser.ts';
import {resolveTestPlan} from '../src/features/protocol/resolver.ts';
import {matchAgent,validatePayload} from '../src/features/core/matcher.ts';
import type {Agent} from '../src/features/core/domain.ts';
const bytes=Buffer.from('{"ok":true}');
const meta=():StoredArtifact=>({id:randomUUID(),runId:randomUUID(),runStepId:randomUUID(),projectId:'project',name:'report.json',type:'test-report',mimeType:'application/json',size:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex'),location:'',createdAt:new Date().toISOString()});
async function* stream(data=bytes){yield data.subarray(0,3);yield data.subarray(3);}
test('Artifact disk store: integrity, duplicate names, idempotency, load/delete and missing',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'tastedev-store-'));try{const store=new LocalArtifactStore(root),a=meta();const saved=await store.put(a,stream());assert.equal(saved.location,`/artifacts/${a.runId}/${a.id}`);assert.deepEqual((await store.get(a.runId,a.id)).bytes,bytes);assert.equal((await store.put(a,stream())).id,a.id);await assert.rejects(store.put(a,stream(Buffer.from('bad'))));const b={...a,id:randomUUID()};await store.put(b,stream());await store.delete(a.runId,a.id);await assert.rejects(store.get(a.runId,a.id));assert.deepEqual((await store.get(b.runId,b.id)).bytes,bytes);}finally{await rm(root,{recursive:true});}
});
for(const kind of ['traversal','absolute','filename','checksum','short','oversized','interrupted','collision'])test(`Artifact rejects ${kind}`,async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'tastedev-store-'));try{const store=new LocalArtifactStore(root),a=meta();let source:AsyncIterable<Uint8Array>=stream();
 if(kind==='traversal')a.runId='../escape';if(kind==='absolute')a.id='C:/escape';if(kind==='filename')a.name='../report.json';if(kind==='checksum')a.checksum='0'.repeat(64);if(kind==='short')a.size++;if(kind==='oversized')a.size=ARTIFACT_LIMIT+1;if(kind==='interrupted')source=(async function*(){yield bytes.subarray(0,3);throw Error('disconnect');})();if(kind==='collision'){await store.put(a,stream());a.checksum='0'.repeat(64);}
 await assert.rejects(store.put(a,source));if(kind!=='collision')await assert.rejects(readFile(path.join(root,a.runId,a.id+'.json')));
 }finally{await rm(root,{recursive:true});}
});
test('Browser Protocol is optional and adds only browser capability requirements',()=>{
 const files={'project.yml':'version: 1\nproject: {name: Sample, type: node}', 'tasks.yml':'test: {command: node, args: []}', 'tests.yml':'ui: {type: e2e, task: test, browser: {engine: playwright, baseUrl: "http://127.0.0.1:3000"}}\nunit: {type: unit, task: test}'};
 const state=parseProtocol(files);assert.equal(state.status,'Valid');const plan=resolveTestPlan(state,'project','ui');assert.equal(plan.requirements.browser,'chromium');assert.equal(plan.requirements.runtimes?.playwright,'>=1.62.1');assert(plan.steps.find(s=>s.browser));assert(!resolveTestPlan(state,'project','unit').requirements.browser);
 const a:Agent={id:'agent',name:'Agent',status:'idle',platform:'windows',architecture:'x86_64',capabilities:{cpuCores:4,memoryMiB:4096,docker:false,gpu:false,pty:false,runtimes:{node:'24.11.1'},browsers:[]},createdAt:'',updatedAt:'',lastSeenAt:null};assert.equal(matchAgent(a,plan.requirements).matches,false);a.capabilities.browsers=['chromium'];a.capabilities.runtimes.playwright='1.62.1';assert.equal(matchAgent(a,plan.requirements).matches,true);
 const payload={task:'ui',testPlan:plan,steps:plan.steps};assert.doesNotThrow(()=>validatePayload(payload));plan.requirements.browser=undefined;assert.throws(()=>validatePayload(payload));
 for(const browser of ['{engine: playwright, baseUrl: "https://external.test"}','{engine: playwright, baseUrl: "http://127.0.0.1:3000", config: "../escape.ts"}'])assert.equal(parseProtocol({...files,'tests.yml':`ui: {type: e2e, task: test, browser: ${browser}}`}).status,'Invalid');
});
test('Browser result boundaries preserve failure, mask known secrets, reject malformed counts',()=>{
 const result={total:1,passed:0,failed:1,skipped:0,duration:22,browserVersion:'1',playwrightVersion:'1',classification:'TEST_FAILED',failures:[{name:'login',message:'secret-value token=abc'}],consoleErrors:1,pageErrors:1,networkFailures:1,evidenceWarnings:['trace upload failed']};const safe=browserResult(result,['secret-value']);assert(!JSON.stringify(safe).includes('secret-value'));assert(!JSON.stringify(safe).includes('token=abc'));assert.equal(safe.failures[0].name,'login');assert.deepEqual(safe.evidenceWarnings,result.evidenceWarnings);assert.throws(()=>browserResult({...result,total:2},[]));
});
