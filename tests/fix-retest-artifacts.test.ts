import {fixRetestContext} from '../src/features/ai/remote-retest.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {FixService,type FixAttempt} from '../src/features/ai/fix-service.ts';
import type {AnalysisRecord} from '../src/features/ai/domain.ts';
import type {Project} from '../src/features/projects/types/project.ts';
import {buildProjectSnapshot,projectReference} from '../src/features/ai/project-snapshot.ts';
import {CoreService,type CreateJob} from '../src/features/core/service.ts';
import {InMemoryCoreRepository} from '../src/features/core/repository.ts';
import {validatePayload} from '../src/features/core/matcher.ts';
import {HistoryStore} from '../transport/history.ts';
import {fixRetestArtifacts} from '../transport/fix-retest-artifacts.ts';

async function fixture(){
 const projectId=crypto.randomUUID(),history=new HistoryStore(),disk=new Map([['a.ts','before']]);
 const files={list:async()=>[...disk.keys()].map(path=>({path,name:path,kind:'file' as const})),read:async(path:string)=>({path,content:disk.get(path)!,modified:0,size:6}),write:async(path:string,value:string,expected:string)=>{assert.equal(disk.get(path),expected);disk.set(path,value);}};
 const fixes=new FixService(projectId,files);fixes.setPersistence({save:async a=>{await history.put(projectId,'attempt',a.id,history.get(projectId,'attempt',a.id)?.version??0,a);}});
 const record:AnalysisRecord={id:crypto.randomUUID(),projectId,conversationId:crypto.randomUUID(),model:'controlled-test',createdAt:new Date().toISOString(),context:[],originals:{'a.ts':'before'},result:{summary:'controlled',observedFailure:'',candidates:[],evidence:[],uncertainty:'',relatedFiles:[],proposal:[{path:'a.ts',proposed:'after',rationale:'fixture',impact:'fixture',tests:['unit']}]}};
 const a=await fixes.propose(record);await fixes.approve(a.id,['a.ts']);await fixes.apply(a.id);
 const {snapshot}=await buildProjectSnapshot(files,{projectId,proposalId:a.proposalId,attempt:1,baseRevision:'working-tree',changedFiles:['a.ts']});await fixes.recordSnapshot(a.id,snapshot);
 const source=projectReference(snapshot),requirements={sourceSnapshot:2 as const,buildArtifacts:1 as const};
 const steps=[{name:'Snapshot',executable:'snapshot',args:[],cwd:'.',stage:'source' as const,source:{provider:'snapshot' as const,repository:'snapshot:'+snapshot.snapshotId,revision:snapshot.baseRevision,snapshot:source}},{name:'verify',taskReference:'verify',executable:'node',args:['verify.cjs'],cwd:'source',stage:'test' as const,env:{TASTEDEV_GRAPH_CONTEXT:fixRetestContext(a,snapshot,'unit')},buildArtifacts:{inputs:[],outputs:[{name:'result',path:'result.json'}]}},{name:'Cleanup',stage:'cleanup' as const,executable:'internal-stop-services',args:[],cwd:'.'}];
 const payload=validatePayload({task:'unit',steps,testPlan:{id:crypto.randomUUID(),projectId,testName:'unit',type:'unit',environment:{},timeout:60000,requirements,steps}});
 const approval=await fixes.approveExecution(a.id,'remote-test','unit',payload.testPlan!);await fixes.beginApprovedRetest(a.id,approval.id,payload.testPlan!);
 const repository=new InMemoryCoreRepository(),core=new CoreService(repository,{get:async()=>({id:projectId} as Project)},{buildArtifactRuntime:true,authorizeFixRetest:(p,i)=>authority.allowed(p,i)});
 let tombstones:string[]=[];const authority=fixRetestArtifacts(core,history,Date.now,{load:()=>tombstones,save:v=>{tombstones=v;}});
 const input:CreateJob={name:'Fix retest',idempotencyKey:'fix:'+a.id,requirements,payload,maxAttempts:1};
 return {projectId,history,fixes,a,core,authority,input,repository,disk,tombstones:()=>tombstones};
}
test('managed retest admission binds persisted scope, canonical plan and Snapshot, never just a key',async()=>{
 const f=await fixture();assert(f.authority.allowed(f.projectId,f.input));const identity=JSON.parse(f.input.payload.steps[1].env!.TASTEDEV_GRAPH_CONTEXT);assert.deepEqual(Object.keys(identity).sort(),['executionId','activationId','nodeId','attempt','revision','snapshotId','sourceChecksum'].sort());assert.equal(identity.activationId,f.a.id);assert.equal(identity.nodeId,'unit');assert.equal(identity.attempt,1);assert.equal(identity.executionId,f.a.id);assert.equal(identity.snapshotId,f.fixes.get(f.a.id).snapshot!.snapshotId);assert.equal(identity.sourceChecksum,f.fixes.get(f.a.id).snapshot!.checksum);
 for(const mutate of [(i:CreateJob)=>{i.payload.steps[1].args=['other.cjs'];},(i:CreateJob)=>{i.idempotencyKey='fix:'+crypto.randomUUID();},(i:CreateJob)=>{i.payload.steps[0].source!.revision='other';}]){const changed=structuredClone(f.input);mutate(changed);assert(!f.authority.allowed(f.projectId,changed));await assert.rejects(f.core.createJob(f.projectId,changed));}
 const job=await f.core.createJob(f.projectId,f.input);assert.equal((await f.core.createJob(f.projectId,f.input)).id,job.id);assert.equal(f.disk.get('a.ts'),'after');
 assert(!f.authority.allowed(crypto.randomUUID(),f.input));
});
test('submission recovery seals a missing job before CAS and cannot enable a delayed enqueue',async()=>{
 const f=await fixture(),result=await f.authority.recover(f.projectId,f.a.id);assert.equal(result.job,null);assert.equal(result.row.value.status,'failed');assert.equal(f.tombstones().length,1);assert(!f.authority.allowed(f.projectId,f.input));await assert.rejects(f.core.createJob(f.projectId,f.input));
 assert.equal((result.row.value as FixAttempt).snapshot?.snapshotId,f.fixes.get(f.a.id).snapshot?.snapshotId);assert.equal(f.disk.get('a.ts'),'after');
 const reopened=fixRetestArtifacts(f.core,f.history,Date.now,{load:f.tombstones,save:()=>{}});assert(!reopened.allowed(f.projectId,f.input));
});
test('unknown network outcome recovers an already queued job instead of failing or duplicating it',async()=>{
 const f=await fixture(),job=await f.core.createJob(f.projectId,f.input),result=await f.authority.recover(f.projectId,f.a.id);assert.equal(result.job?.id,job.id);assert.equal(result.row.value.status,'retesting');assert.equal(f.tombstones().length,0);
});
test('artifact grants require active declared steps and are invalidated by cancellation',async()=>{
 const f=await fixture(),job=await f.core.createJob(f.projectId,f.input);f.core.connectAgent('fixture-agent',{name:'Controlled',platform:'windows',architecture:'x86_64',capabilities:{sourceSnapshot:2,buildArtifacts:1,cpuCores:2,memoryMiB:2048,docker:false,gpu:false,pty:false,runtimes:{node:'24'},browsers:[]}});
 const assignment=f.core.dispatch(f.projectId,job.id)!;f.core.startRun(f.projectId,assignment.run.id);const steps=f.core.snapshot(f.projectId).steps.sort((a,b)=>a.order-b.order);f.core.changeStep(f.projectId,assignment.run.id,steps[0].id,'running');f.core.changeStep(f.projectId,assignment.run.id,steps[0].id,'passed',0);
 assert.throws(()=>f.authority.buildArtifactOrigin(job.id,steps[1].id));f.core.changeStep(f.projectId,assignment.run.id,steps[1].id,'running');const context=f.authority.buildArtifactOrigin(job.id,steps[1].id);assert.equal(context.origin.executionId,f.a.id);assert.equal(context.origin.snapshotId,f.fixes.get(f.a.id).snapshot!.snapshotId);
 assert.throws(()=>f.authority.recordBuildArtifactOutputs(job.id,steps[1].id,[]));f.core.cancelJob(f.projectId,job.id);assert.throws(()=>f.authority.buildArtifactOrigin(job.id,steps[1].id));
});
