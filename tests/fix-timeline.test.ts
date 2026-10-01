import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {FixService,type FixAttempt} from '../src/features/ai/fix-service.ts';
import {CoreStore} from '../transport/storage.ts';
import {HistoryStore} from '../transport/history.ts';
import {fixTimeline} from '../src/features/ai/fix-timeline.ts';
import {buildSnapshot} from '../src/features/ai/snapshot.ts';
import type {AnalysisRecord} from '../src/features/ai/domain.ts';
import type {CoreSnapshot} from '../src/features/core/domain.ts';
const empty:CoreSnapshot={agents:[],jobs:[],runs:[],steps:[],artifacts:[],events:[]};
function fixture(){const projectId=crypto.randomUUID(),disk=new Map([['a.ts','before']]);const files={list:async()=>[{path:'a.ts',name:'a.ts',kind:'file' as const}],read:async(p:string)=>({path:p,content:disk.get(p)!,modified:0,size:disk.get(p)!.length}),write:async(p:string,value:string,expected:string)=>{assert.equal(disk.get(p),expected);disk.set(p,value);}};const record:AnalysisRecord={id:crypto.randomUUID(),projectId,conversationId:crypto.randomUUID(),runId:crypto.randomUUID(),model:'controlled timeline test',createdAt:new Date().toISOString(),context:[],originals:{'a.ts':'before'},result:{summary:'controlled',observedFailure:'',candidates:[],evidence:[],uncertainty:'',relatedFiles:[],proposal:[{path:'a.ts',proposed:'after',rationale:'controlled',impact:'controlled',tests:[]}]}};return{projectId,disk,files,record,fix:new FixService(projectId,files)};}
test('timeline records real state changes and survives durable reopen without rewriting events',async()=>{
 const f=fixture(),root=path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-5/timeline-'+crypto.randomUUID());fs.mkdirSync(root,{recursive:true});let store=new CoreStore(path.join(root,'core.sqlite'),Buffer.alloc(32,8)),history=new HistoryStore(store);
 try{
 f.fix.setPersistence({save:async a=>{await history.put(f.projectId,'attempt',a.id,history.get(f.projectId,'attempt',a.id)?.version??0,a);}});
 const a=await f.fix.propose(f.record);assert.deepEqual(a.events?.map(e=>e.status),['proposed']);assert.equal(f.disk.get('a.ts'),'before');await f.fix.approve(a.id,['a.ts']);await f.fix.apply(a.id);
 const task={name:'known-task'};const approval=await f.fix.approveExecution(a.id,'local-task','known-task',task);await f.fix.beginApprovedValidation(a.id,approval.id,task);f.fix.validationResult(a.id,'known-task','passed',5);await f.fix.flush();
 const {snapshot}=await buildSnapshot(f.files,{projectId:f.projectId,proposalId:a.proposalId,attempt:a.attempt,changedFiles:['a.ts'],baseRevision:'controlled'});await f.fix.recordSnapshot(a.id,snapshot);const retest={name:'known-test'};const remote=await f.fix.approveExecution(a.id,'remote-test','known-test',retest);await f.fix.beginApprovedRetest(a.id,remote.id,retest);f.fix.retestResult(a.id,'passed');await f.fix.revert(a.id);await f.fix.flush();
 const saved=f.fix.get(a.id);assert.deepEqual(saved.events?.map(e=>e.status),['proposed','approved','recovery-required','applied','validating','applied','retesting','passed','recovery-required','reverted']);assert.equal(f.disk.get('a.ts'),'before');
 const forged=structuredClone(saved);forged.events![0].timestamp='2000-01-01T00:00:00Z';await assert.rejects(history.put(f.projectId,'attempt',a.id,history.get(f.projectId,'attempt',a.id)!.version,forged),/immutable/);
 store.close();store=new CoreStore(path.join(root,'core.sqlite'),Buffer.alloc(32,8));history=new HistoryStore(store);const restored=history.get(f.projectId,'attempt',a.id)!.value as FixAttempt;assert.deepEqual(restored.events,saved.events);const timeline=fixTimeline(restored,f.record,empty);assert.equal(timeline.complete,true);assert.equal(timeline.entries[0].label,'Failure analysis');assert.equal(timeline.entries.at(-1)?.status,'reverted');
 }finally{store.close();}
});
test('legacy timeline never fabricates missing patch, validation or retest timestamps',async()=>{const f=fixture(),a=await f.fix.propose(f.record);delete a.events;const timeline=fixTimeline(a,f.record,empty);assert.equal(timeline.complete,false);assert.deepEqual(timeline.entries.map(e=>e.label),['Failure analysis','Fix proposal']);const partial={...a,events:[{id:crypto.randomUUID(),status:'reverted' as const,phase:'patch' as const,timestamp:new Date().toISOString()}]};assert.equal(fixTimeline(partial,f.record,empty).complete,false);});
test('foreign analysis and Run cannot become project timeline evidence',async()=>{const f=fixture(),a=await f.fix.propose(f.record);const foreign={...f.record,projectId:crypto.randomUUID()};const timeline=fixTimeline(a,foreign,empty);assert.equal(timeline.entries.some(e=>e.label==='Failure analysis'),false);});
