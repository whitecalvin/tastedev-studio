import test from 'node:test';
import assert from 'node:assert/strict';
import {artifactGraphFixture} from './helpers/build-artifact-fixture.ts';
import {GraphExecutionService,type GraphPersistence} from '../transport/graph-execution.ts';
import type {BuildArtifact} from '../src/features/orchestration/build-artifact.ts';
async function active(persistence?:GraphPersistence){
 const f=await artifactGraphFixture(),service=persistence?new GraphExecutionService(f.core,(p,j)=>f.core.dispatch(p,j),(p,j)=>{f.core.cancelJob(p,j);},persistence,undefined,Date.now,async()=>f.snapshot):f.service;
 await service.request(f.projectId,'publish',{graph:f.graph,sources:f.sources,snapshot:f.reference,expectedRevision:0},'user');const d=service.overview(f.projectId).definition!;await service.request(f.projectId,'start',{revision:d.revision,checksum:d.checksum,entryNodeId:'producer',requestId:'receipts'},'user');
 const run=f.core.snapshot(f.projectId).runs[0],source=f.orchestrator.next(run.id)!;f.orchestrator.complete(run.id,source.step.id,'passed',0,undefined,{repository:source.command.source!.repository,branch:'controlled',commit:f.reference.checksum,snapshotId:f.reference.snapshotId,proposalId:f.reference.proposalId,attempt:1});const step=f.orchestrator.next(run.id)!,origin=service.buildArtifactOrigin(step.job.id,step.step.id).origin;
 const artifact:BuildArtifact={...origin,version:1,id:'a'.repeat(64),name:'desktop',path:'out/app.exe',size:1,checksum:'b'.repeat(64)};
 return {...f,service,step,artifact};
}
test('verified receipt is scoped, canonical and distinct from overall step success',async()=>{
 const f=await active();f.service.recordBuildArtifactOutputs(f.step.job.id,f.step.step.id,[{...f.artifact,token:'dummy-not-public'} as BuildArtifact]);const e=f.service.overview(f.projectId).executions[0],a=e.activations.find(a=>a.nodeId==='producer')!;
 assert.deepEqual(a.artifactReceipts![0].outputs,[f.artifact]);assert.equal('token' in a.artifactReceipts![0].outputs[0],false);assert.notEqual(a.status,'passed');
 for(const changed of [{projectId:'other'},{producerRunId:'other'},{snapshotId:'other'},{path:'wrong/app.exe'}])assert.throws(()=>f.service.recordBuildArtifactOutputs(f.step.job.id,f.step.step.id,[{...f.artifact,...changed}]),/scope mismatch/);
 assert.throws(()=>f.service.recordBuildArtifactOutputs(f.step.job.id,f.step.step.id,[]),/scope mismatch/);
});
test('receipt survives durable restore and save failure preserves the previous state',async()=>{
 let saved:unknown,broken=false;const persistence={load:()=>saved,save:(v:unknown)=>{if(broken)throw Error('Controlled persistence failure');saved=structuredClone(v);}};const f=await active(persistence),before=JSON.stringify(f.service.overview(f.projectId));broken=true;
 assert.throws(()=>f.service.recordBuildArtifactOutputs(f.step.job.id,f.step.step.id,[f.artifact]),/persistence failure/);assert.equal(JSON.stringify(f.service.overview(f.projectId)),before);broken=false;f.service.recordBuildArtifactOutputs(f.step.job.id,f.step.step.id,[f.artifact]);
 const restored=new GraphExecutionService(f.core,()=>{},()=>{},persistence);assert.deepEqual(restored.overview(f.projectId).executions[0].activations.find(a=>a.nodeId==='producer')!.artifactReceipts![0].outputs,[f.artifact]);
 const bad=structuredClone(saved) as {executions:{activations:{artifactReceipts?:{outputs:BuildArtifact[]}[]}[]}[]};bad.executions[0].activations.find(a=>a.artifactReceipts)!.artifactReceipts![0].outputs[0].projectId='other';assert.throws(()=>new GraphExecutionService(f.core,()=>{},()=>{},{load:()=>bad,save:()=>{}}),/identity mismatch/);
});
