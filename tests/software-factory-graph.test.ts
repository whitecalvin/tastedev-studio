import test from 'node:test';
import assert from 'node:assert/strict';
import {GraphExecutionService} from '../transport/graph-execution.ts';
import {SoftwareFactory} from '../transport/software-factory.ts';
import {CoreService} from '../src/features/core/service.ts';
import {InMemoryCoreRepository} from '../src/features/core/repository.ts';
import type {Project} from '../src/features/projects/types/project.ts';
import {initialGraph} from '../src/features/orchestration/domain.ts';
import {factoryTemplate} from '../src/features/orchestration/factory-template.ts';
import {emptyAIConfigurations} from '../src/features/orchestration/ai-config.ts';
import {buildProjectSnapshot,projectReference} from '../src/features/ai/project-snapshot.ts';
import type {FactoryContract} from '../src/features/orchestration/factory.ts';
import type {FixAttempt} from '../src/features/ai/fix-service.ts';
import type {AnalysisRecord} from '../src/features/ai/domain.ts';

async function fixture(){
  const project=crypto.randomUUID(),core=new CoreService(new InMemoryCoreRepository(),{get:async id=>({id,name:'Factory'} as Project)});
  const {graph,configurations}=factoryTemplate(project,initialGraph(project),emptyAIConfigurations(project));
  const {snapshot}=await buildProjectSnapshot({list:async()=>[{name:'a.ts',path:'src/a.ts',kind:'file'}],read:async()=>({content:'export const a=1;',size:17,modified:0})},{projectId:project,proposalId:crypto.randomUUID(),attempt:1,baseRevision:'fixture',changedFiles:[]});
  const reference=projectReference(snapshot),records=new Map<string,AnalysisRecord>(),attempts=new Map<string,FixAttempt>();
  const service=new GraphExecutionService(core,()=>{},()=>{},undefined,undefined,Date.now,async source=>{assert.equal(source.checksum,reference.checksum);},{connections:()=>[{id:'default',provider:'openai',connection:'api',adapter:'openai-api',model:'fixture'}],analysis:(_p,id)=>records.get(id),attempt:(_p,id)=>attempts.get(id)});
  await service.request(project,'publish',{graph,aiConfigurations:configurations,sources:{'project.yml':'version: 1\nproject: {name: Factory, type: node}'},snapshot:reference,expectedRevision:0},'operator');
  const d=service.overview(project).definition!,contract:FactoryContract={projectId:project,taskId:'repair',objective:'Repair the function',acceptance:['Real test passes','Independent source inspection'],paths:['src'],resources:['project:'+project],dependencies:[],entryNodeId:'factory-implementation',implementationNodeId:'factory-implementation',reviewNodeId:'factory-review',revision:d.revision,checksum:d.checksum,inputChecksum:d.inputChecksum,sourceChecksum:d.source!.checksum,maxAttempts:3,timeoutMinutes:10};
  const factory=new SoftwareFactory({overview:p=>service.overview(p),request:(p,a,i,actor)=>service.request(p,a,i,actor),analysis:(_p,id)=>records.get(id),attempt:(_p,id)=>attempts.get(id)});
  await factory.request(project,'create',{contract},'operator');await factory.request(project,'queue',{taskId:'repair',version:1},'operator');
  const execution=()=>service.overview(project).executions[0];
  const input=()=>{const e=execution(),a=e.activations.at(-1)!;return {executionId:e.id,activationId:a.id,revision:e.revision,checksum:e.checksum,leaseId:a.leaseId};};
  return {project,core,service,factory,contract,execution,input,records};
}
test('real Graph service captures scoped contract and separates implementation and reviewer prompts',async()=>{
  const f=await fixture(),e=f.execution();assert.equal(e.factory?.taskId,'repair');assert.equal(e.activations[0].status,'ai-review');assert.match(e.aiTasks!['factory-implementation'].question,/Repair the function/);assert.match(e.aiTasks!['factory-review'].question,/Do not modify source/);assert.equal(f.core.snapshot(f.project).jobs.length,0);
  await assert.rejects(f.service.request(f.project,'start',{revision:e.revision,checksum:e.checksum,entryNodeId:'factory-implementation',requestId:e.id,factory:{...e.factory,paths:['other']}},'operator'),/identity conflict/);
  assert.throws(()=>f.service.validateFactoryAttempt(f.project,{graph:{executionId:e.id,nodeId:'factory-implementation'},patches:[{path:'other/a.ts'}]} as FixAttempt),/scope/);
  assert.throws(()=>f.service.validateFactoryAttempt(f.project,{graph:{executionId:e.id,nodeId:'factory-implementation'},patches:[{path:'Src/a.ts'}]} as FixAttempt),/scope/);
  assert.throws(()=>f.service.validateFactoryAttempt(f.project,{graph:{executionId:e.id,nodeId:'factory-review'},patches:[{path:'src/a.ts'}]} as FixAttempt),/scope/);
  f.service.validateFactoryAttempt(f.project,{graph:{executionId:e.id,nodeId:'factory-implementation'},patches:[{path:'src/a.ts'}]} as FixAttempt);
});
test('real AI lease failure and gate retry preserve graph identity and bound attempts',async()=>{
  const f=await fixture(),executionId=f.execution().id;
  for(let attempt=1;attempt<=3;attempt++){
    await f.service.request(f.project,'ai-start',f.input(),'operator');await f.service.request(f.project,'ai-fail',f.input(),'operator');await f.factory.tick();assert.equal(f.factory.overview(f.project).tasks[0].status,'failed');
    if(attempt<3){const task=f.factory.overview(f.project).tasks[0];await f.factory.request(f.project,'retry',{taskId:'repair',version:task.version,notes:'Transient provider failure.'},'operator');assert.equal(f.execution().id,executionId);assert.equal(f.execution().activations.at(-1)!.status,'ai-review');}
  }
  const task=f.factory.overview(f.project).tasks[0];await assert.rejects(f.factory.request(f.project,'retry',{taskId:'repair',version:task.version,notes:'Again'},'operator'),/budget/);assert.equal(f.execution().activations.length,3);assert.equal(f.core.snapshot(f.project).jobs.length,0);
});
test('factory cancellation uses real Graph cancellation and rejects late AI completion',async()=>{
  const f=await fixture();await f.service.request(f.project,'ai-start',f.input(),'operator');const old=f.input(),task=f.factory.overview(f.project).tasks[0];await f.factory.request(f.project,'cancel',{taskId:'repair',version:task.version},'operator');await f.factory.tick();assert.equal(f.factory.overview(f.project).tasks[0].status,'cancelled');assert.equal(f.execution().status,'cancelled');await assert.rejects(f.service.request(f.project,'ai-complete',{...old,analysisId:crypto.randomUUID()},'operator'));
});
