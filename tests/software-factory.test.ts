import test from 'node:test';
import assert from 'node:assert/strict';
import {SoftwareFactory,type FactoryBridge} from '../transport/software-factory.ts';
import {factoryTemplate} from '../src/features/orchestration/factory-template.ts';
import {parseFactoryPlan,factoryPlanningQuestion} from '../src/features/orchestration/factory-plan.ts';
import {factoryDependencyProgress,factorySourceChanged,factoryConflicts,factoryContext,validateFactoryContract,validateFactoryDefinition,type FactoryContract,type FactoryTask} from '../src/features/orchestration/factory.ts';
import {initialGraph} from '../src/features/orchestration/domain.ts';
import {emptyAIConfigurations} from '../src/features/orchestration/ai-config.ts';
import type {GraphDefinition,GraphOverview} from '../src/features/orchestration/execution.ts';
import type {AnalysisRecord} from '../src/features/ai/domain.ts';
import type {FixAttempt} from '../src/features/ai/fix-service.ts';
import type {TaskAIRequest} from '../src/features/orchestration/task-ai.ts';
const hash='a'.repeat(64),time=Date.parse('2026-10-17T00:00:00Z');
function definition(projectId:string):GraphDefinition{
  const {graph}=factoryTemplate(projectId,initialGraph(projectId),emptyAIConfigurations(projectId));
  const aiTasks=Object.fromEntries(['factory-implementation','factory-review'].map((id,i)=>[id,{projectId,nodeId:id,label:id,profileId:'profile-'+i,question:'Inspect source.',completion:i===0?'verified-fix':'analysis',route:{connectionId:'default',adapter:'openai-api',model:'test'},maximum:3,budget:{timeoutMs:1000,maxProviderRequests:2,maxInputTokens:1000,maxOutputTokens:1000}} as TaskAIRequest]));
  return {projectId,graph,revision:1,checksum:hash,inputChecksum:hash,source:{checksum:hash} as GraphDefinition['source'],aiTasks,plans:{},agents:{},publishedAt:new Date(time).toISOString()};
}
function contract(projectId='p',taskId='work'):FactoryContract{return {taskId,projectId,objective:'Repair the failing function',acceptance:['Regression passes','Independent review reads the tested source'],paths:['src'],resources:['repo:'+projectId],dependencies:[],revision:1,checksum:hash,inputChecksum:hash,sourceChecksum:hash,entryNodeId:'factory-implementation',implementationNodeId:'factory-implementation',reviewNodeId:'factory-review',maxAttempts:3,timeoutMinutes:30};}
function fixture(){
  const overviews=new Map<string,GraphOverview>(),calls:{project:string;action:string;input:unknown;actor:string}[]=[];let now=time,revoked=false,writeFailure=false,state:unknown;
  const analyses=new Map<string,AnalysisRecord>(),attempts=new Map<string,FixAttempt>();
  const overview=(project:string)=>{if(!overviews.has(project))overviews.set(project,{definition:definition(project),executions:[],durable:true});return overviews.get(project)!;};
  const bridge:FactoryBridge={overview,analysis:(_p,id)=>analyses.get(id),attempt:(_p,id)=>attempts.get(id),request:async(project,action,input,actor)=>{calls.push({project,action,input,actor});const i=input as {requestId:string;executionId:string;factory:ReturnType<typeof factoryContext>};const o=overview(project);if(action==='start'&&!o.executions.some(e=>e.id===i.requestId))o.executions.push({id:i.requestId,projectId:project,revision:1,checksum:hash,inputChecksum:hash,status:'running',activations:[],actor,createdAt:new Date(now).toISOString(),deadline:new Date(now+600000).toISOString(),nodeLabels:{},aiTasks:o.definition!.aiTasks,factory:i.factory});if(action==='cancel')o.executions.find(e=>e.id===i.executionId)!.status='cancelling';if(action==='resume')o.executions.find(e=>e.id===i.executionId)!.status='running';if(action==='retry-failed')o.executions.find(e=>e.id===i.executionId)!.status='running';return o;}};
  const persistence={load:()=>state,save:(v:unknown)=>{if(writeFailure)throw Error('disk unavailable');state=structuredClone(v);}};
  const authority=()=>{if(revoked)throw Error('revoked');};
  const make=()=>new SoftwareFactory(bridge,persistence,authority,()=>now);let factory=make();
  const get=(p='p',id='work')=>factory.overview(p).tasks.find(t=>t.contract.taskId===id)!;
  const action=(name:string,extra:object={},p='p',id='work')=>factory.request(p,name,{taskId:id,version:get(p,id)?.version,...extra},'operator');
  const create=async(c=contract())=>{await factory.request(c.projectId,'create',{contract:c},'operator');return get(c.projectId,c.taskId);};
  const queue=async(c=contract())=>{await create(c);await action('queue',{},c.projectId,c.taskId);return get(c.projectId,c.taskId);};
  function complete(project='p'){
    const e=overview(project).executions[0],createdAt=new Date(now+1000).toISOString();e.status='passed';
    e.activations=[{id:'implement',nodeId:'factory-implementation',attempt:1,status:'passed',fixAttemptId:'patch'},{id:'inspect',nodeId:'factory-review',attempt:1,status:'passed',analysisId:'inspection'}];
    attempts.set('patch',{id:'patch',projectId:project,status:'passed',patches:[{path:'src/a.ts',result:'tested'}]} as FixAttempt);
    analyses.set('inspection',{id:'inspection',conversationId:'conversation',model:'fixture',context:[],projectId:project,createdAt,task:{nodeId:'factory-review',profileId:'profile-1',label:'Review',graph:{executionId:e.id,activationId:'inspect',leaseId:'lease'}},result:{summary:'Reviewed',observedFailure:'',candidates:[],relatedFiles:[],proposal:[],uncertainty:'',evidence:['ctx-1']},originals:{'src/a.ts':'tested'}});
  }
  return {get,action,create,queue,calls,overview,analyses,attempts,complete,bridge,persistence,setFailure:(v:boolean)=>writeFailure=v,revoke:()=>revoked=true,advance:(ms:number)=>now+=ms,factory:()=>factory,restart:()=>{factory=make();return factory;}};
}

test('factory template preserves configured work and assigns distinct implementation/review profiles',()=>{
  const p='p',base=initialGraph(p),result=factoryTemplate(p,base,emptyAIConfigurations(p));assert.equal(base.nodes.length,2);assert.equal(result.configurations.profiles.length,2);assert.equal(result.configurations.profiles[0].completion,'verified-fix');assert.equal(result.configurations.profiles[1].role,'review');assert.notEqual(result.configurations.bindings['factory-implementation'],result.configurations.bindings['factory-review']);
  assert.throws(()=>factoryTemplate(p,result.graph,result.configurations),/existing workflow/);
});
test('contracts reject traversal, unbounded attempts and contradictory review paths',()=>{
  for(const path of ['../other','/root','src/../out','src\\a','C:/work','src/*','src//x'])assert.throws(()=>validateFactoryContract({...contract(),paths:[path]},'p'));
  assert.throws(()=>validateFactoryContract({...contract(),maxAttempts:4},'p'));
  const d=definition('p');d.graph.edges.push({id:'bypass',from:'factory-implementation',to:'current-pc',relation:'success'});assert.throws(()=>validateFactoryDefinition(contract(),d),/mandatory/);
  const same=definition('p');same.aiTasks!['factory-review'].profileId='profile-0';assert.throws(()=>validateFactoryDefinition(contract(),same),/separate/);
});
test('drafts do not execute; approval pins contract and repeated ticks create exactly one graph',async()=>{
  const f=fixture();await f.create();assert.equal(f.calls.length,0);await f.action('queue');await Promise.all([f.factory().tick(),f.factory().tick()]);assert.equal(f.calls.filter(c=>c.action==='start').length,1);assert.equal(f.get().status,'running');assert.deepEqual((f.calls[0].input as {factory:unknown}).factory,factoryContext(contract()));
  await assert.rejects(f.action('queue'),/draft/);await assert.rejects(f.factory().request('p','cancel',{taskId:'work',version:1},'operator'),/changed/);
});
test('two different products can run while global and exclusive-resource limits hold',async()=>{
  const f=fixture();await f.queue(contract('p'));await f.queue(contract('q'));await f.queue(contract('r'));assert.equal(f.get('r').status,'queued');assert.equal(f.calls.length,2);
  const a=contract('a'),b={...contract('b'),resources:a.resources};assert.equal(factoryConflicts(a,b),true);
  const g=fixture();await g.queue(a);await g.queue(b);assert.equal(g.get('b').status,'queued');
});
test('dependency release requires accepted work; same-project queued work cannot overlap',async()=>{
  const f=fixture();await f.queue();await f.queue({...contract('q'),dependencies:[{projectId:'p',taskId:'work'}]});assert.equal(f.get('q').status,'queued');f.complete();await f.factory().tick();assert.equal(f.get().status,'review');assert.equal(f.get('q').status,'queued');await f.action('review',{accepted:true,notes:'Reviewed source and actual Run.'});assert.equal(f.get().status,'completed');assert.equal(f.get('q').status,'running');
});
test('review cannot pass on model prose, stale source or out-of-contract patches',async()=>{
  for(const kind of ['missing','stale','outside']){const f=fixture();await f.queue();f.complete();if(kind==='missing')f.analyses.clear();if(kind==='stale')f.analyses.get('inspection')!.originals['src/a.ts']='different';if(kind==='outside')f.attempts.get('patch')!.patches[0].path='other/a.ts';await f.factory().tick();assert.equal(f.get().status,'failed');assert.equal(f.calls.length,1);}
});
test('restart pauses intent, reconciles existing graph and retains all successful evidence',async()=>{
  const f=fixture();await f.queue();const id=f.get().attempts[0].executionId;f.overview('p').executions[0].status='paused';f.restart();assert.equal(f.get().status,'paused');await f.factory().tick();assert.equal(f.calls.length,1);await f.action('resume');assert.equal(f.get().attempts[0].executionId,id);assert.equal(f.calls.filter(c=>c.action==='start').length,1);assert.equal(f.get().status,'running');
});
test('persistence failure prevents queue and launch; changed graph is rejected before execution',async()=>{
  const f=fixture();await f.create();f.setFailure(true);await assert.rejects(f.action('queue'),/disk/);assert.equal(f.get().status,'draft');assert.equal(f.calls.length,0);
  f.setFailure(false);f.overview('p').definition!.inputChecksum='b'.repeat(64);await assert.rejects(f.action('queue'),/changed/);assert.equal(f.calls.length,0);
});
test('revocation pauses new progression and budget cancellation retains locks until graph terminates',async()=>{
  const f=fixture();await f.queue();f.revoke();await f.factory().tick();assert.equal(f.get().status,'paused');
  const g=fixture();await g.queue();g.advance(31*60000);await g.factory().tick();assert.equal(g.get().status,'cancelling');assert.equal(g.calls.at(-1)?.action,'cancel');g.overview('p').executions[0].status='cancelled';await g.factory().tick();assert.equal(g.get().status,'cancelled');
});
test('failed gate retry reuses the exact existing graph instead of rerunning successful implementation',async()=>{
  const f=fixture();await f.queue();const e=f.overview('p').executions[0];e.status='failed';e.activations=[{id:'impl',nodeId:'factory-implementation',attempt:1,status:'passed'},{id:'review-failure',nodeId:'factory-review',attempt:1,status:'failed'}];await f.factory().tick();await f.action('retry',{notes:'Transient reviewer connection failure.'});assert.equal(f.calls.filter(c=>c.action==='start').length,1);assert.equal(f.calls.at(-1)?.action,'retry-failed');assert.equal((f.calls.at(-1)?.input as {activationId:string}).activationId,'review-failure');assert.equal(f.get().attempts.length,2);assert.equal(e.activations[0].status,'passed');
});
test('project boundaries, immutable task identity and missing dependencies fail closed',async()=>{
  const f=fixture();await f.create();await assert.rejects(f.factory().request('other','queue',{taskId:'work',version:1},'operator'),/not found/);await assert.rejects(f.factory().request('p','create',{contract:{...contract(),objective:'different'}},'operator'),/identity/);await assert.rejects(f.create({...contract('q'),dependencies:[{projectId:'p',taskId:'absent'}]}),/not found/);
});
test('stored state validation preserves corrupted contracts and does not replay launch',()=>{
  const task={contract:contract(),status:'running',version:1,actor:'operator',createdAt:new Date(time).toISOString(),attempts:[]} satisfies FactoryTask;
  assert.throws(()=>new SoftwareFactory(fixture().bridge,{load:()=>({version:1,tasks:[{...task,contract:{...task.contract,paths:['../out']}}]}),save:()=>{throw Error('must not write');}}),/path/);
});

test('AI coordinator output preserves user criteria, grounded scope and ordered dependencies',()=>{
  const base=contract(),input={tasks:[{key:'implement',objective:'Fix parser',criteria:[0],paths:['src/parser.ts'],dependsOn:[]},{key:'inspect',objective:'Review parser regression',criteria:[1],paths:['src'],dependsOn:['implement']}]};let counter=0;
  const plan=parseFactoryPlan(JSON.stringify(input),base,['src/parser.ts'],()=>`planned-${++counter}`);assert.equal(plan.length,2);assert.deepEqual(plan[0].acceptance,[base.acceptance[0]]);assert.deepEqual(plan[1].dependencies,[{projectId:'p',taskId:'planned-1'}]);assert.match(factoryPlanningQuestion(base),/Do not implement/);
  for(const change of [()=>{input.tasks[0].paths=['other/a.ts'];},()=>{input.tasks[0].paths=['src/unread.ts'];},()=>{input.tasks[1].criteria=[];},()=>{input.tasks[0].dependsOn=['inspect'];}]){const original=structuredClone(input);change();assert.throws(()=>parseFactoryPlan(JSON.stringify(input),base,['src/parser.ts']));Object.assign(input,original);}
  assert.throws(()=>parseFactoryPlan(JSON.stringify({tasks:[input.tasks[0]]}),base,['src/parser.ts']),/omitted/);
});
test('reviewed AI batch saves drafts atomically, remains idempotent and never launches',async()=>{
  const f=fixture(),first=contract('p','first'),second={...contract('p','second'),dependencies:[{projectId:'p',taskId:'first'}]};
  const submit=(contracts:FactoryContract[])=>f.factory().request('p','create-plan',{contracts},'operator');
  await assert.rejects(submit([first,{...second,paths:['../out']}]),/path/);assert.equal(f.factory().overview('p').tasks.length,0);
  f.setFailure(true);await assert.rejects(submit([first,second]),/disk/);assert.equal(f.factory().overview('p').tasks.length,0);
  f.setFailure(false);await submit([first,second]);await submit([first,second]);assert.equal(f.factory().overview('p').tasks.length,2);assert.equal(f.calls.length,0);assert(f.factory().overview('p').tasks.every(t=>t.status==='draft'));
});


test('team quality policy blocks final acceptance without losing the independent review or releasing resources',async()=>{
  const f=fixture();let accepted=false;f.bridge.validateAcceptance=()=>{if(!accepted)throw Error('Quality gates are incomplete');};
  await f.queue();f.complete();await f.factory().tick();assert.equal(f.get().status,'review');
  await assert.rejects(f.action('review',{accepted:true,notes:'Ready'}),/Quality gates/);assert.equal(f.get().status,'review');
  accepted=true;await f.action('review',{accepted:true,notes:'Actual evidence reviewed'});assert.equal(f.get().status,'completed');
});


test('retry rechecks revised team policy before changing attempts or invoking Graph',async()=>{
 const f=fixture();await f.queue();const e=f.overview('p').executions[0];e.status='failed';e.activations=[{id:'impl',nodeId:'factory-implementation',attempt:1,status:'passed'},{id:'review-failure',nodeId:'factory-review',attempt:1,status:'failed'}];await f.factory().tick();
 f.bridge.validateContract=()=>{throw Error('Work intent changed');};const calls=f.calls.length;await assert.rejects(f.action('retry',{notes:'Retry stale intent'}),/Work intent changed/);assert.equal(f.calls.length,calls);assert.equal(f.get().attempts.length,1);assert.equal(e.activations[0].status,'passed');
});


test('reviewed batch queue validates all draft versions before any launch or state change',async()=>{
  const f=fixture();await f.create(contract('p','first'));await f.create({...contract('p','second'),dependencies:[{projectId:'p',taskId:'first'}]});
  await assert.rejects(f.action('queue-plan',{tasks:[{taskId:'first',version:1},{taskId:'second',version:99}]}),/Plan changed/);
  assert.equal(f.get('p','first').status,'draft');assert.equal(f.calls.length,0);
  await f.action('queue-plan',{tasks:[{taskId:'first',version:1},{taskId:'second',version:1}]});
  assert.equal(f.get('p','first').status,'running');assert.equal(f.get('p','second').status,'queued');assert.match(f.get('p','second').reason!,/dependencies/);assert.equal(f.calls.length,1);
});

test('integrated completion requires an authoritative proof and keeps stale dependent Source queued',async()=>{const f=fixture();await f.create();const proof={kind:'workspace-integration' as const,requestId:crypto.randomUUID(),attemptId:crypto.randomUUID(),proposalId:crypto.randomUUID(),runId:crypto.randomUUID(),checksum:'b'.repeat(64),contentChecksum:'c'.repeat(64),reviewAnalysisId:crypto.randomUUID(),graphRevision:1,graphChecksum:hash,acceptedAt:new Date(time).toISOString()};assert.throws(()=>f.factory().completeIntegration('p','work',proof,'operator'),/idle isolated/);f.bridge.validateIntegration=(contract,receipt)=>{assert.equal(contract.taskId,'work');assert.equal(receipt.requestId,proof.requestId);};f.factory().completeIntegration('p','work',proof,'operator');assert.equal(f.get().status,'completed');assert.equal(f.get().attempts.length,0);f.restart();assert.equal(f.get().integrationCompletion?.requestId,proof.requestId);await f.queue({...contract('p','dependent'),dependencies:[{projectId:'p',taskId:'work'}]});f.bridge.sourceContent=()=>'d'.repeat(64);await f.factory().tick();assert.equal(f.get('p','dependent').status,'queued');assert.match(f.get('p','dependent').reason!,/integrated Source/);assert.equal(f.calls.length,0);f.bridge.sourceContent=()=>proof.contentChecksum;await f.factory().tick();assert.equal(f.calls.filter(c=>c.action==='start').length,1);});

test('dependent work Source review preserves contract history and requires fresh queue approval',async()=>{
 const f=fixture(),c=contract();await f.factory().request('p','create',{contract:c},'owner');
 const d=f.bridge.overview('p').definition!;d.revision=2;d.checksum='b'.repeat(64);d.inputChecksum='c'.repeat(64);d.source!.checksum='d'.repeat(64);
 const before=f.factory().overview('p').tasks[0];
 await assert.rejects(f.factory().request('p','review-source',{taskId:c.taskId,version:before.version,sourceChecksum:'f'.repeat(64),revision:2},'owner'),/changed/);
 await f.factory().request('p','review-source',{taskId:c.taskId,version:before.version,sourceChecksum:d.source!.checksum,revision:2},'owner');
 const after=f.factory().overview('p').tasks[0];assert.equal(after.status,'draft');assert.equal(after.contract.sourceChecksum,d.source!.checksum);assert.equal(after.sourceReviews?.[0].previous.checksum,c.checksum);assert.equal(f.calls.length,0);
 await assert.rejects(f.factory().request('p','queue',{taskId:c.taskId,version:before.version},'owner'),/changed/);
});

test('Source re-review accepts new bytes with the same graph and preserves the previous contract',async()=>{const f=fixture(),c=contract();await f.factory().request('p','create',{contract:c},'owner');const initial=f.get();await assert.rejects(f.factory().request('p','review-source',{taskId:c.taskId,version:initial.version,sourceChecksum:c.sourceChecksum,revision:1},'owner'),/already uses/);const d=f.bridge.overview('p').definition!;d.revision=2;d.source!.checksum='d'.repeat(64);assert.equal(d.checksum,c.checksum);await f.factory().request('p','review-source',{taskId:c.taskId,version:initial.version,sourceChecksum:d.source!.checksum,revision:2},'owner');const after=f.get();assert.equal(after.status,'draft');assert.equal(after.contract.sourceChecksum,d.source!.checksum);assert.equal(after.sourceReviews?.[0].previous.sourceChecksum,c.sourceChecksum);assert.equal(after.attempts.length,0);assert.equal(f.calls.length,0);});

test('GUI Source review identity includes revision, input and Source even without layout change',()=>{const c=contract(),d=definition('p');assert.equal(factorySourceChanged(c,d),false);for(const changed of [{...d,revision:2},{...d,inputChecksum:'b'.repeat(64)},{...d,source:{...d.source!,checksum:'b'.repeat(64)}}])assert.equal(factorySourceChanged(c,changed),true);assert.equal(factorySourceChanged(c,null),false);});
test('dependency progress resolves exact project identities without inventing unavailable completion',()=>{const c=contract(),task={contract:{...c,dependencies:[{projectId:'p',taskId:'parent'},{projectId:'foreign',taskId:'parent'}]}} as FactoryTask;const parent={contract:{...c,taskId:'parent'},status:'completed',attempts:[{executionId:'actual'}]} as FactoryTask;const rows=factoryDependencyProgress(task,[parent]);assert.equal(rows[0].status,'completed');assert.equal(rows[0].executionId,'actual');assert.equal(rows[1].status,'Not reported');assert.equal(rows[1].executionId,undefined);});

test('dependency navigation targets its own implementation node',async()=>{
 const {factoryDependencyProgress}=await import('../src/features/orchestration/factory.ts');const f=fixture();await f.queue();const parent=structuredClone(f.get()),child=structuredClone(parent);parent.contract.implementationNodeId='parent-node';child.contract.taskId=crypto.randomUUID();child.contract.implementationNodeId='child-node';child.contract.dependencies=[{projectId:parent.contract.projectId,taskId:parent.contract.taskId}];
 assert.equal(factoryDependencyProgress(child,[parent,child])[0].nodeId,'parent-node');
});
