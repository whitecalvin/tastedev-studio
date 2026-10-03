import test from 'node:test';
import type {Project} from '../src/features/projects/types/project.ts';
import assert from 'node:assert/strict';
import {CoreService} from '../src/features/core/service.ts';
import {InMemoryCoreRepository} from '../src/features/core/repository.ts';
import {GraphExecutionService} from '../transport/graph-execution.ts';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import {graphSourcePlan} from '../src/features/orchestration/source-plan.ts';
import {buildProjectSnapshot,projectReference} from '../src/features/ai/project-snapshot.ts';
import {validatePayload} from '../src/features/core/matcher.ts';
import {TestOrchestrator} from '../src/features/core/orchestrator.ts';
import {CoreStore} from '../transport/storage.ts';
import {graphSourceReferences} from '../transport/graph-source-references.ts';
const sources={'project.yml':'version: 1\nproject: {name: Graph, type: node}', 'tasks.yml':'hello: {command: node, args: ["-v"]}'};
async function fixture(){
 const projectId=crypto.randomUUID(),core=new CoreService(new InMemoryCoreRepository(),{get:async id=>({id,name:'Graph'} as Project)});
 core.connectAgent('agent',{name:'Actual assigned identity',platform:'windows',architecture:'x86_64',capabilities:{cpuCores:2,memoryMiB:2048,docker:false,gpu:false,pty:false,runtimes:{node:'24'},browsers:[],sourceSnapshot:2}});
 const graph=initialGraph(projectId);graph.nodes.push({...newNode('agent','agent',0),reference:'agent'},newNode('approval','review',1),{...newNode('task','deploy',2),reference:'hello'});
 graph.nodes.find(n=>n.id==='role-implementation')!.role='deployment';
 graph.edges.push({id:'host',from:'current-pc',to:'agent',relation:'hosts'},{id:'role',from:'role-implementation',to:'deploy',relation:'performs'},{id:'reviewed',from:'review',to:'deploy',relation:'success'});
 const {snapshot}=await buildProjectSnapshot({list:async()=>[{name:'file.cjs',path:'file.cjs',kind:'file'}],read:async()=>({content:'console.log(1)',size:14,modified:0})},{projectId,proposalId:crypto.randomUUID(),attempt:1,baseRevision:'saved-working-tree',changedFiles:[]});
 const reference=projectReference(snapshot);let available=true,checks=0;
 const service=new GraphExecutionService(core,(p,j)=>core.dispatch(p,j),(p,j)=>core.cancelJob(p,j),undefined,undefined,Date.now,async s=>{checks++;if(!available||s.checksum!==reference.checksum)throw Error('Source missing or mismatch');});
 const publish=(revision=0)=>service.request(projectId,'publish',{graph,sources,snapshot:reference,expectedRevision:revision},'user');
 const start=(id='execution')=>{const d=service.overview(projectId).definition!;return service.request(projectId,'start',{revision:d.revision,checksum:d.checksum,entryNodeId:'review',requestId:id},'user');};
 const approve=()=>{const e=service.overview(projectId).executions[0],a=e.activations.findLast(a=>a.status==='approval')!;return service.request(projectId,'approve',{executionId:e.id,activationId:a.id,revision:e.revision,checksum:e.checksum},'user');};
 return {projectId,core,graph,service,reference,publish,start,approve,checks:()=>checks,remove:()=>{available=false;}};
}
test('Task is wrapped by the existing source/test/cleanup pipeline and Source capability is required',async()=>{
 const f=await fixture(),input={name:'task',requirements:{},payload:{task:'hello',steps:[{name:'hello',executable:'node',args:['-v'],cwd:'.'}]}};
 const plan=graphSourcePlan(input,f.projectId,f.reference);validatePayload(plan.payload);assert.equal(plan.requirements.sourceSnapshot,2);assert.deepEqual(plan.payload.steps.map(s=>s.stage),['source','test','cleanup']);assert.equal(plan.payload.steps[1].cwd,'source');assert.equal(input.payload.steps[0].cwd,'.');
 const existing=graphSourcePlan(plan,f.projectId,f.reference);validatePayload(existing.payload);assert.equal(existing.payload.steps[1].cwd,'source');assert.equal(existing.payload.steps.filter(s=>s.stage==='source').length,1);
});
test('Source availability is checked at publish, start and approval; publication cannot run work',async()=>{
 const f=await fixture();await f.publish();assert.equal(f.core.snapshot(f.projectId).jobs.length,0);await f.start();assert.equal(f.core.snapshot(f.projectId).jobs.length,0);f.remove();await assert.rejects(f.approve(),/Source missing/);assert.equal(f.core.snapshot(f.projectId).jobs.length,0);assert.equal(f.checks(),3);
});
test('Deployment cannot be a root or take a direct failure retry; every retry needs a new approval',async()=>{
 const f=await fixture();f.graph.edges=f.graph.edges.filter(e=>e.id!=='reviewed');await assert.rejects(f.publish(),/immediate approval/);f.graph.edges.push({id:'reviewed',from:'review',to:'deploy',relation:'success'},{id:'bypass',from:'deploy',to:'deploy',relation:'failure'});await assert.rejects(f.publish());
 f.graph.edges=f.graph.edges.filter(e=>e.id!=='bypass');f.graph.edges.push({id:'retry',from:'deploy',to:'review',relation:'failure'});await f.publish();await f.start();await f.approve();
 const first=f.service.overview(f.projectId).executions[0];assert(first.activations[1].approvalId);const run=f.core.snapshot(f.projectId).runs[0];const pipeline=new TestOrchestrator(f.core),step=pipeline.next(run.id)!;pipeline.complete(run.id,step.step.id,'failed',1,'controlled Source failure');const cleanup=pipeline.next(run.id)!;pipeline.complete(run.id,cleanup.step.id,'passed',0);pipeline.finish(run.id);await f.service.tick();assert.equal(f.core.snapshot(f.projectId).jobs.length,1);await f.approve();const e=f.service.overview(f.projectId).executions[0];assert.notEqual(e.activations[1].approvalId,e.activations[3].approvalId);assert.equal(f.core.snapshot(f.projectId).jobs.length,2);
});
test('Request identity cannot be reused for unchanged graph with a new Protocol/Source publication',async()=>{
 const f=await fixture();await f.publish();await f.start();await f.publish(1);await assert.rejects(f.start(),/identity conflict/);
});
test('One approval cannot authorize two deployment activations; non-deployment fanout cannot consume approval',async()=>{
 const f=await fixture();f.graph.nodes.push({...newNode('task','second',3),reference:'hello'});f.graph.edges.push({id:'performs2',from:'role-implementation',to:'second',relation:'performs'},{id:'fanout',from:'review',to:'second',relation:'success'});await f.publish();await f.start();await f.approve();assert.equal(f.service.overview(f.projectId).executions[0].status,'failed');assert.equal(f.core.snapshot(f.projectId).jobs.length,0);
});
test('Published and historical graph plans remain Source owners independently of Jobs',async()=>{
 const f=await fixture();await f.publish();const d=f.service.overview(f.projectId).definition!;const input=graphSourcePlan({name:'hello',requirements:{},payload:{task:'hello',steps:[{name:'hello',executable:'node',args:[],cwd:'.'}]}},f.projectId,f.reference),store=new CoreStore(':memory:',new Uint8Array(32).fill(4));
 try{store.put('node-orchestration',{definitions:[{...d,plans:{deploy:input}}],executions:[{definition:{...d,plans:{deploy:input}}}]});const refs=graphSourceReferences(store);assert.equal(refs.length,2);assert.equal(refs[0].payload.steps[0].source?.provider,'snapshot');assert.equal(refs[0].projectId,f.projectId);}finally{store.close();}
});
