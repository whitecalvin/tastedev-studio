import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {GraphExecutionService} from '../transport/graph-execution.ts';
import {HistoryStore} from '../transport/history.ts';
import {CoreService} from '../src/features/core/service.ts';
import {InMemoryCoreRepository} from '../src/features/core/repository.ts';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import {emptyAIConfigurations,newAIConfiguration,type AIConfigurationStore} from '../src/features/orchestration/ai-config.ts';
import type {FixAttempt} from '../src/features/ai/fix-service.ts';
import type {AnalysisRecord} from '../src/features/ai/domain.ts';
import type {Project} from '../src/features/projects/types/project.ts';
const sources={'project.yml':JSON.stringify({version:1,project:{name:'AI graph',type:'node'}})};
function fixture(){
 const project=randomUUID(),core=new CoreService(new InMemoryCoreRepository(),{get:async id=>({id,name:'AI graph'} as Project)}),history=new HistoryStore();
 const graph=initialGraph(project);graph.nodes.push({...newNode('task','analysis',2),label:'Inspect source'},newNode('approval','review',3));graph.edges.push({id:'performs',from:'role-implementation',to:'analysis',relation:'performs'},{id:'next',from:'analysis',to:'review',relation:'success'});
 const config:AIConfigurationStore={...emptyAIConfigurations(project),profiles:[{...newAIConfiguration('local'),provider:'local' as const,connection:'local' as const,connectionRef:'local'}],bindings:{analysis:'local'}};
 let saved:unknown,clock=Date.now(),permit=true,available=true;const actions:string[]=[];
 const make=()=>new GraphExecutionService(core,()=>{},()=>{}, {load:()=>saved,save:v=>{saved=structuredClone(v);}},(_actor,_p,action)=>{actions.push(action);if(!permit)throw Error('Forbidden');},()=>clock,undefined,{attempt:(p,id)=>history.get(p,'attempt',id)?.value as FixAttempt|undefined,connections:()=>available?[{id:'local',provider:'local',connection:'local',adapter:'ollama-local',model:'fixture'}]:[],analysis:(p,id)=>history.get(p,'analysis',id)?.value as AnalysisRecord|undefined});
 const service=make(),overview=()=>service.overview(project),input=()=>{const e=overview().executions[0],a=e.activations[0];return {executionId:e.id,activationId:a.id,revision:e.revision,checksum:e.checksum,leaseId:a.leaseId};};
 const publish=()=>service.request(project,'publish',{graph,sources,aiConfigurations:config,expectedRevision:overview().definition?.revision??0},'user');
 const start=()=>service.request(project,'start',{revision:overview().definition!.revision,checksum:overview().definition!.checksum,entryNodeId:'analysis',requestId:'ai-execution'},'user');
 const record=():AnalysisRecord=>({id:randomUUID(),projectId:project,conversationId:randomUUID(),model:'fixture',createdAt:new Date(clock).toISOString(),task:{nodeId:'analysis',profileId:'local',label:'Inspect source',graph:{executionId:'ai-execution',activationId:input().activationId,leaseId:input().leaseId!}},context:[],originals:{},result:{summary:'Grounded proposal',observedFailure:'',candidates:[],evidence:[],relatedFiles:[],proposal:[],uncertainty:'Not test verified'}});
 return{project,core,history,graph,config,service,overview,input,publish,start,record,make,actions,deny:()=>{permit=false;},unavailable:()=>{available=false;},expire:()=>{clock+=136000;}};
}
test('bound AI is an immutable reviewed plan; publish/start send no provider request or Agent job',async()=>{
 const f=fixture();await f.publish();f.config.profiles[0].prompt='changed after publish';await f.start();assert.equal(f.overview().executions[0].activations[0].status,'ai-review');assert.equal(f.core.snapshot(f.project).jobs.length,0);assert.notEqual(f.overview().executions[0].aiTasks!.analysis.question,'changed after publish');
});
test('AI claim requires approval and run permission; duplicate claim never replays',async()=>{
 const f=fixture();await f.publish();await f.start();await f.service.request(f.project,'ai-start',f.input(),'user');assert(f.actions.includes('approve'));assert(f.actions.includes('run'));assert.equal(f.overview().executions[0].activations[0].status,'ai-running');await assert.rejects(f.service.request(f.project,'ai-start',f.input(),'user'),/already claimed/);
});
test('durable exact analysis follows success once and retains result link',async()=>{
 const f=fixture();await f.publish();await f.start();await f.service.request(f.project,'ai-start',f.input(),'user');const r=f.record();await f.history.put(f.project,'analysis',r.id,0,r);await f.service.request(f.project,'ai-complete',{...f.input(),analysisId:r.id},'user');const e=f.overview().executions[0];assert.equal(e.activations[0].analysisId,r.id);assert.equal(e.activations[1].status,'approval');await assert.rejects(f.service.request(f.project,'ai-complete',{...f.input(),analysisId:r.id},'user'));assert.equal(f.overview().executions[0].activations.length,2);
});
test('missing/mismatched analysis, forged lease, another actor and other project cannot complete',async()=>{
 const f=fixture();await f.publish();await f.start();await f.service.request(f.project,'ai-start',f.input(),'user');await assert.rejects(f.service.request(f.project,'ai-complete',{...f.input(),analysisId:randomUUID()},'user'),/Durable/);const r=f.record();r.task!.graph!.activationId=randomUUID();await f.history.put(f.project,'analysis',r.id,0,r);await assert.rejects(f.service.request(f.project,'ai-complete',{...f.input(),analysisId:r.id},'user'),/Durable/);await assert.rejects(f.service.request(f.project,'ai-fail',{...f.input(),leaseId:randomUUID()},'user'),/lease/);await assert.rejects(f.service.request(f.project,'ai-fail',f.input(),'another'),/lease/);await assert.rejects(f.service.request(randomUUID(),'ai-fail',f.input(),'user'),/not found/);assert.equal(f.overview().executions[0].activations[0].status,'ai-running');
});
test('failure path has independent attempts and each needs fresh explicit approval',async()=>{
 const f=fixture();f.graph.edges=f.graph.edges.filter(e=>e.id!=='next');f.graph.edges.push({id:'retry',from:'analysis',to:'review',relation:'failure'},{id:'retry-approved',from:'review',to:'analysis',relation:'success'});f.config.profiles[0].maxAttempts=2;await f.publish();const d=f.overview().definition!;await f.service.request(f.project,'start',{revision:d.revision,checksum:d.checksum,entryNodeId:'review',requestId:'ai-execution'},'user');
 for(let i=0;i<2;i++){let e=f.overview().executions[0],a=e.activations.at(-1)!;await f.service.request(f.project,'approve',{executionId:e.id,activationId:a.id,revision:e.revision,checksum:e.checksum},'user');e=f.overview().executions[0];a=e.activations.at(-1)!;assert.equal(a.status,'ai-review');const input={executionId:e.id,activationId:a.id,revision:e.revision,checksum:e.checksum};await f.service.request(f.project,'ai-start',input,'user');const claimed=f.overview().executions[0].activations.at(-1)!;await f.service.request(f.project,'ai-fail',{...input,leaseId:claimed.leaseId},'user');}
 const e=f.overview().executions[0],a=e.activations.at(-1)!;await f.service.request(f.project,'approve',{executionId:e.id,activationId:a.id,revision:e.revision,checksum:e.checksum},'user');assert.equal(f.overview().executions[0].status,'failed');assert.equal(f.overview().executions[0].activations.filter(a=>a.nodeId==='analysis').length,2);
});
test('cancel rejects late AI result, cancels activation and creates no job',async()=>{
 const f=fixture();await f.publish();await f.start();await f.service.request(f.project,'ai-start',f.input(),'user');await f.service.request(f.project,'cancel',{executionId:'ai-execution'},'user');await assert.rejects(f.service.request(f.project,'ai-fail',f.input(),'user'));assert.equal(f.overview().executions[0].status,'cancelled');assert.equal(f.core.snapshot(f.project).jobs.length,0);
});
test('restart pauses and preserves interrupted AI failure; resume never repeats claim',async()=>{
 const f=fixture();await f.publish();await f.start();await f.service.request(f.project,'ai-start',f.input(),'user');const restarted=f.make();assert.equal(restarted.overview(f.project).executions[0].status,'paused');assert.equal(restarted.overview(f.project).executions[0].activations[0].status,'failed');await restarted.request(f.project,'resume',{executionId:'ai-execution'},'user');assert.equal(restarted.overview(f.project).executions[0].status,'failed');assert.equal(restarted.overview(f.project).executions[0].activations.length,1);
});
test('AI timeout follows failure; revoked authority pauses and unavailable route cannot claim',async()=>{
 const f=fixture();await f.publish();await f.start();f.unavailable();await assert.rejects(f.service.request(f.project,'ai-start',f.input(),'user'),/unavailable/);const g=fixture();await g.publish();await g.start();await g.service.request(g.project,'ai-start',g.input(),'user');g.expire();await g.service.tick();assert.equal(g.overview().executions[0].status,'failed');const h=fixture();await h.publish();await h.start();h.deny();await h.service.tick();assert.equal(h.overview().executions[0].status,'paused');
});
test('wrong project AI configurations and dangling non-task bindings reject publication',async()=>{
 const f=fixture();f.config.projectId=randomUUID();await assert.rejects(f.publish(),/Invalid AI/);f.config.projectId=f.project;f.config.bindings={analysis:'local','current-pc':'local'};await assert.rejects(f.publish(),/existing task/);
});
test('durable task identity validates bounded fields without allowing extra authority data',async()=>{
 const f=fixture();await f.publish();await f.start();await f.service.request(f.project,'ai-start',f.input(),'user');const r=f.record();r.task!.graph!.leaseId='../escape';await assert.rejects(f.history.put(f.project,'analysis',r.id,0,r));
});

test('verified-fix policy holds success path until matching remote proof; rejection follows failure',async()=>{
 const f=fixture();f.config.profiles[0].completion='verified-fix';await f.publish();await f.start();await f.service.request(f.project,'ai-start',f.input(),'user');const r=f.record();await f.history.put(f.project,'analysis',r.id,0,r);await f.service.request(f.project,'ai-complete',{...f.input(),analysisId:r.id},'user');assert.equal(f.overview().executions[0].activations[0].status,'ai-fix-review');assert.equal(f.overview().executions[0].activations.length,1);await assert.rejects(f.service.request(f.project,'ai-fix-complete',{...f.input(),attemptId:randomUUID()},'user'));await f.service.request(f.project,'ai-fix-reject',f.input(),'user');assert.equal(f.overview().executions[0].status,'failed');
});
test('restart retains fix gate without replay; cancellation prevents completing it',async()=>{
 const f=fixture();f.config.profiles[0].completion='verified-fix';await f.publish();await f.start();await f.service.request(f.project,'ai-start',f.input(),'user');const r=f.record();await f.history.put(f.project,'analysis',r.id,0,r);await f.service.request(f.project,'ai-complete',{...f.input(),analysisId:r.id},'user');const restored=f.make();assert.equal(restored.overview(f.project).executions[0].activations[0].status,'ai-fix-review');await restored.request(f.project,'resume',{executionId:'ai-execution'},'user');assert.equal(restored.overview(f.project).executions[0].activations.length,1);await restored.request(f.project,'cancel',{executionId:'ai-execution'},'user');await assert.rejects(restored.request(f.project,'ai-fix-complete',f.input(),'user'));assert.equal(restored.overview(f.project).executions[0].status,'cancelled');
});
test('invalid completion policy cannot be published',async()=>{const f=fixture();Object.assign(f.config.profiles[0],{completion:'automatic-write'});await assert.rejects(f.publish(),/completion policy/);});
