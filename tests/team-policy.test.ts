import test from 'node:test';
import assert from 'node:assert/strict';
import {TeamPolicy} from '../transport/team-policy.ts';
import {defaultTeamPolicy,validateTeamPolicy} from '../src/features/orchestration/team-policy.ts';
import type {GraphExecution,GraphOverview} from '../src/features/orchestration/execution.ts';
import type {TaskAIRequest} from '../src/features/orchestration/task-ai.ts';
function fixture(){
  const graph={definition:null,executions:[],durable:true} as GraphOverview;let saved:unknown,denied=false,failed=false;
  const persistence={load:()=>saved,save:(s:unknown)=>{if(failed)throw Error('disk failed');saved=structuredClone(s);}};
  const authority=()=>{if(denied)throw Error('denied');};let policy=new TeamPolicy(()=>graph,persistence,authority);
  const execution={id:'execution',projectId:'project',team:{id:'intent'},activations:[]} as unknown as GraphExecution;
  const plan={projectId:'project',budget:{maxProviderRequests:6,timeoutMs:120000},route:{connectionId:'account',model:'model'}} as TaskAIRequest;
  return{graph,execution,plan,policy:()=>policy,restart:()=>policy=new TeamPolicy(()=>graph,persistence,authority),deny:()=>denied=true,fail:()=>failed=true,save:(extra:object)=>policy.request('project','save',{revision:policy.overview('project').revision,policy:{...defaultTeamPolicy,...extra}},'local')};
}
test('team policy enforces configured model, connection, request and timeout bounds without fallback',()=>{const f=fixture();f.save({allowedModels:['model'],allowedConnections:['account']});f.policy().authorize('project',f.plan,f.execution,'activation','lease');for(const changed of [{...f.plan,route:{...f.plan.route,model:'other'}},{...f.plan,budget:{...f.plan.budget,maxProviderRequests:7}},{...f.plan,budget:{...f.plan.budget,timeoutMs:121000}}])assert.throws(()=>f.policy().authorize('project',changed,f.execution,'activation','blocked'),/exceeds/);assert.equal(f.policy().overview('project').grants.length,1);});
test('conservative execution reservations survive restart and deny exceeding aggregate budget',()=>{const f=fixture();f.save({executionRequestBudget:6});f.policy().authorize('project',f.plan,f.execution,'activation','lease');f.restart();assert.throws(()=>f.policy().authorize('project',f.plan,f.execution,'activation','lease2'),/budget exhausted/);assert.equal(f.policy().overview('project').grants[0].reservedRequests,6);});
test('concurrency and active policy changes are blocked while preserving prior grants',()=>{const f=fixture();f.save({maximumConcurrent:1});f.graph.executions.push({activations:[{status:'ai-running'}]} as unknown as GraphOverview['executions'][number]);assert.throws(()=>f.policy().authorize('project',f.plan,f.execution,'activation','lease'),/concurrency/);assert.throws(()=>f.save({maximumConcurrent:2}),/Wait for active/);assert.equal(f.policy().overview('project').grants.length,0);});
test('policy permission, stale revision, invalid bounds and durable failure never grant extra requests',()=>{const f=fixture();assert.throws(()=>validateTeamPolicy({...defaultTeamPolicy,maximumConcurrent:999}),/Invalid/);assert.throws(()=>f.policy().request('project','save',{revision:99,policy:defaultTeamPolicy},'local'),/changed/);f.fail();assert.throws(()=>f.policy().authorize('project',f.plan,f.execution,'activation','lease'),/disk failed/);assert.equal(f.policy().overview('project').grants.length,0);f.deny();assert.throws(()=>f.save({}),/denied/);});
test('non-team Graphs remain governed by existing configuration and policy metadata exposes no prompt',()=>{const f=fixture();delete f.execution.team;f.policy().authorize('project',f.plan,f.execution,'activation','lease');assert.equal(f.policy().overview('project').grants.length,0);assert.equal(f.policy().overview('other').grants.length,0);});
