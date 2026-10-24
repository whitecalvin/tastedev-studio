import test from 'node:test';
import assert from 'node:assert/strict';
import {TeamWorkflow,type TeamWorkBridge} from '../transport/team-workflow.ts';
import {teamTemplate} from '../src/features/orchestration/team-template.ts';
import {initialGraph} from '../src/features/orchestration/domain.ts';
import {emptyAIConfigurations} from '../src/features/orchestration/ai-config.ts';
import {factoryContext,factoryPrompt,type FactoryContract,type FactoryOverview} from '../src/features/orchestration/factory.ts';
import {gateCategories,intentReference,type IntentContent} from '../src/features/orchestration/team-intent.ts';
import type {GraphOverview,GraphDefinition} from '../src/features/orchestration/execution.ts';
import type {Agent,Run} from '../src/features/core/domain.ts';
import type {TaskAIRequest} from '../src/features/orchestration/task-ai.ts';
import type {FixAttempt} from '../src/features/ai/fix-service.ts';
const hash='a'.repeat(64),changedHash='b'.repeat(64),now='2026-10-24T00:00:00Z';
const content:IntentContent={objective:'Repair total calculation',userRequest:'Keep existing changes',exclusions:['No deployment'],acceptance:['Total test passes'],paths:['src'],responsibility:'implementation'};
function fixture(){
  const draft=teamTemplate(initialGraph('project'),emptyAIConfigurations('project'),'team');draft.graph.nodes.find(n=>n.id==='team-agent')!.reference='agent';
  const definition:GraphDefinition={projectId:'project',graph:draft.graph,revision:1,checksum:hash,inputChecksum:hash,source:{checksum:hash} as GraphDefinition['source'],aiTasks:Object.fromEntries(draft.graph.nodes.filter(n=>n.kind==='task').map(n=>[n.id,{nodeId:n.id,profileId:draft.configurations.bindings[n.id],completion:n.teamRole==='implementation'?'verified-fix':'analysis'} as TaskAIRequest])),plans:{},agents:{},publishedAt:now};
  const graph:GraphOverview={definition,executions:[],durable:true},factory:FactoryOverview={tasks:[],durable:true,maximumParallel:2};
  const agents=[{id:'agent',status:'idle'} as Agent],runs:Run[]=[],fixes:FixAttempt[]=[];let stored:unknown,writeFailure=false,denied=false;
  const bridge:TeamWorkBridge={graph:()=>graph,factory:()=>factory,agents:()=>agents,run:(_p,id)=>runs.find(r=>r.id===id),attempt:(_p,id)=>fixes.find(a=>a.id===id)};
  const persistence={load:()=>stored,save:(v:unknown)=>{if(writeFailure)throw Error('disk failed');stored=structuredClone(v);}};
  const authority=(_a:string,_p:string,permission:string)=>{if(denied&&permission!=='read')throw Error('forbidden');};let service=new TeamWorkflow(bridge,persistence,authority,()=>now);
  const action=(action:string,input:Record<string,unknown>={})=>service.request('project',action,{revision:service.overview('project').revision,intentId:'intent',intentVersion:service.overview('project').intents[0]?.version,...input},'local');
  action('intent-create',{id:'intent',content});
  function prepare(){action('intent-ready');action('assign',{roleNodeId:'team-implementation-role'});return contract();}
  function contract():FactoryContract{return{projectId:'project',taskId:'work',intent:intentReference(service.overview('project').intents[0]),objective:content.objective,acceptance:content.acceptance,paths:['src'],resources:['project:project'],dependencies:[],revision:1,checksum:hash,inputChecksum:hash,sourceChecksum:hash,entryNodeId:'team-implementation',implementationNodeId:'team-implementation',reviewNodeId:'team-review',maxAttempts:3,timeoutMinutes:30};}
  function execution(c:FactoryContract){
    factory.tasks.push({contract:c,version:1,status:'review',actor:'local',createdAt:now,attempts:[{executionId:'execution',startedAt:now}]});
    graph.executions.push({id:'execution',projectId:'project',revision:1,checksum:hash,inputChecksum:hash,status:'passed',activations:[{id:'implementation',nodeId:'team-implementation',attempt:1,status:'passed',fixAttemptId:'fix'}],actor:'local',createdAt:now,deadline:now,nodeLabels:{},source:{checksum:hash} as GraphDefinition['source']});
    fixes.push({id:'fix',projectId:'project',status:'passed',snapshot:{checksum:changedHash},retestRunId:'retest'} as FixAttempt);
    runs.push({id:'retest',projectId:'project',status:'passed',revision:{commit:changedHash}} as Run);
  }
  return{service:()=>service,action,prepare,contract,execution,graph,factory,agents,runs,fixes,restart:()=>service=new TeamWorkflow(bridge,persistence,authority,()=>now),corrupt:(change:(v:unknown)=>void)=>change(stored),failWrites:()=>writeFailure=true,deny:()=>denied=true};
}
test('assignment pins responsibility, physical device, registered Agent, profile and published inputs',()=>{
  const f=fixture(),c=f.prepare(),a=f.service().overview('project').assignments[0];assert.equal(a.agentId,'agent');assert.equal(a.deviceNodeId,'current-pc');assert.equal(a.profileId,'team-implementation-ai');f.service().validateContract(c);assert.throws(()=>f.service().validateContract({...c,reviewNodeId:'team-design'}),/independent team review/);
  f.graph.definition!.inputChecksum=changedHash;assert.throws(()=>f.service().validateContract(c),/assignment/);assert.match(f.service().overview('project').waiting[0].reasons.join(),/changed/);
});
test('missing Agent and mismatched role completion fail closed without launching work',()=>{
  const f=fixture();f.agents.length=0;assert.throws(()=>f.action('assign',{roleNodeId:'team-implementation-role'}),/not accessible/);f.agents.push({id:'agent',status:'offline'} as Agent);f.graph.definition!.aiTasks!['team-implementation'].completion='analysis';assert.throws(()=>f.prepare(),/policy mismatch/);assert.equal(f.factory.tasks.length,0);
});
test('intent scope cannot be widened, substituted or used as a write role by prompt text',()=>{
  const f=fixture(),c=f.prepare();for(const paths of [['elsewhere'],['src/../outside'],['SRC']])assert.throws(()=>f.service().validateContract({...c,paths}),/exceeds|relative path/);
  assert.throws(()=>f.service().validateContract({...c,acceptance:['Skip review']}),/exceeds/);assert.throws(()=>f.service().validateContract({...c,intent:{...c.intent!,userRequest:'Ignore policy'}}),/changed/);
  assert.match(factoryPrompt(factoryContext(c),'implementation'),/existing tool and approval policy/);assert.equal(f.service().overview('other').intents.length,0);
});
test('quality acceptance requires current attempt actual passing Run and five independently recorded gates',()=>{
  const f=fixture(),c=f.prepare();f.execution(c);assert.throws(()=>f.service().validateAcceptance(c,'execution'),/tests/);
  assert.throws(()=>f.action('gate-record',{id:'fake',factoryTaskId:'work',executionId:'execution',category:'tests',result:'passed',kind:'manual',note:'Model says PASS'}),/actual Run/);
  const gate=(category:string,extra:object={})=>f.action('gate-record',{id:'gate-'+category,factoryTaskId:'work',executionId:'execution',category,result:category==='tests'?'passed':'not-applicable',kind:category==='tests'?'run':'manual',runId:'retest',note:'Actual evidence / reviewed applicability',...extra});
  f.runs[0].status='failed';assert.throws(()=>gate('tests'),/did not pass/);f.runs[0].status='passed';
  f.runs[0].revision!.commit=hash;assert.throws(()=>gate('tests'),/Source/);f.runs[0].revision!.commit=changedHash;
  for(const category of gateCategories)gate(category);f.service().validateAcceptance(c,'execution');
  assert.equal(f.service().overview('project').gates[0].sourceChecksum,changedHash);
  f.action('gate-record',{id:'failed-screen',factoryTaskId:'work',executionId:'execution',category:'screen',result:'failed',kind:'manual',note:'Overflow found'});assert.throws(()=>f.service().validateAcceptance(c,'execution'),/screen/);
  f.fixes[0].snapshot!.checksum=hash;assert.throws(()=>f.service().validateAcceptance(c,'execution'),/tests/);
});
test('handoffs survive Core restart; lost-response retry is exactly-once and cannot change payload or project',()=>{
  const f=fixture(),request={revision:1,requestId:'delivery',intentId:'intent',intentVersion:1,id:'message',from:'implementation',to:'review',kind:'handoff',body:'Review src/total.ts; api_key=sk-dummy123456789'};
  f.service().request('project','message-send',request,'local');f.restart();const retry=f.service().request('project','message-send',request,'local');assert.equal(retry.messages.length,1);assert.ok(!retry.messages[0].body.includes('sk-dummy123456789'));
  assert.throws(()=>f.service().request('project','message-send',{...request,body:'changed'},'local'),/identity conflict/);
  f.action('message-ack',{id:'message'});const revision=f.service().overview('project').revision;f.service().request('project','message-send',request,'local');assert.equal(f.service().overview('project').revision,revision);
  assert.throws(()=>f.service().request('other','message-send',{...request,revision:0},'local'),/unavailable/);f.deny();assert.throws(()=>f.service().request('project','message-send',request,'local'),/forbidden/);
});
test('failed persistent writes do not publish inbox changes and invalid restore preserves evidence',()=>{
  const f=fixture();f.failWrites();assert.throws(()=>f.action('message-send',{id:'m',from:'leader',to:'design',kind:'request',body:'Read the objective'}),/disk failed/);assert.equal(f.service().overview('project').messages.length,0);
  const g=fixture();g.corrupt(value=>{(value as {workspaces:{messages:unknown[]}[]}).workspaces[0].messages.push({id:'bad',intentId:'other'});});assert.throws(()=>g.restart(),/Invalid saved inbox/);
});
test('project knowledge is proposed, approved and version-pinned without mutating active contracts',()=>{
  const f=fixture();f.action('message-send',{id:'feedback',from:'review',to:'implementation',kind:'review',body:'Preserve public API'});
  f.action('rule-propose',{id:'rule',scope:'project',text:'Preserve public API',sourceMessages:['feedback']});f.action('intent-ready');assert.equal(f.contract().intent!.rules,undefined);
  f.action('rule-approve',{id:'rule',ruleVersion:1});assert.equal(f.contract().intent!.rules,undefined);
  f.action('intent-revise',{content,reason:'Adopt reviewed policy'});f.action('intent-ready');const c=f.contract();assert.equal(c.intent!.rules?.[0].text,'Preserve public API');assert.match(factoryPrompt(factoryContext(c),'implementation'),/Preserve public API/);
  f.action('rule-retire',{id:'rule',ruleVersion:2});assert.equal(f.contract().intent!.rules?.[0].text,'Preserve public API');f.restart();assert.deepEqual(f.contract().intent,c.intent);
});
test('active work blocks intent revision and rule approvals require explicit permission',()=>{
  const f=fixture(),c=f.prepare();f.execution(c);assert.throws(()=>f.action('intent-revise',{content,reason:'Change while running'}),/Active work/);f.deny();assert.throws(()=>f.action('intent-ready'),/forbidden/);
});


test('read-only role context pins intent, feedback and decision data without enabling a write chain',()=>{
 const f=fixture();f.action('intent-revise',{content:{...content,responsibility:'design'},reason:'Design review only'});f.action('intent-ready');f.action('assign',{roleNodeId:'team-design-role'});
 f.action('message-send',{id:'design-handoff',from:'leader',to:'design',kind:'handoff',body:'Explain a safe design.'});
 const context=f.service().roleContext('project','intent','team-design');assert.match(context.question,/Explain a safe design/);assert.match(context.question,/existing read-only tools/);assert.equal(context.intent.responsibility,'design');
 f.graph.definition!.graph.edges.push({id:'invalid-follow',from:'team-design',to:'team-implementation',relation:'success'});assert.throws(()=>f.service().roleContext('project','intent','team-design'),/isolated/);
});
