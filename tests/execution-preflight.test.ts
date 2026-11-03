import test from 'node:test';
import assert from 'node:assert/strict';
import {executionPreflight,type ExecutionPreflightInput} from '../src/features/orchestration/execution-preflight.ts';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';
import type {Agent} from '../src/features/core/domain.ts';

function fixture():ExecutionPreflightInput {
 const graph=initialGraph('p');graph.nodes.push({...newNode('task','test',1),reference:'unit',taskType:'test'});
 const agent:Agent={id:'a',name:'Windows runner',status:'idle',platform:'windows',architecture:'x86_64',createdAt:'2026-11-03',updatedAt:'2026-11-03',lastSeenAt:null,capabilities:{cpuCores:4,memoryMiB:4096,docker:false,gpu:false,pty:false,runtimes:{node:'24.22.2'},browsers:[],sourceSnapshot:2}};
 const overview:GraphOverview={definition:{projectId:'p',graph:structuredClone(graph),revision:1,checksum:'graph',inputChecksum:'protocol',publishedAt:'2026-11-03',agents:{test:['a']},requirements:{test:{platform:'windows',runtimes:{node:'>=24'},sourceSnapshot:2}}},executions:[],durable:true};
 return {graph,overview,agents:[agent],connected:true,dirty:false,dirtyEditors:0};
}
test('published requirements use only assigned Agents and never grant authority',()=>{
 const f=fixture(),before=JSON.stringify(f),report=executionPreflight(f);
 assert.equal(report.executionAuthorized,false);assert.equal(report.checks.find(c=>c.category==='runtime')?.state,'ready');
 assert.equal(report.checks.find(c=>c.category==='source')?.state,'unverified');
 assert.equal(report.checks.find(c=>c.category==='permission')?.state,'review');assert.equal(JSON.stringify(f),before);
 f.agents[0].capabilities.runtimes={};f.agents.push({...structuredClone(f.agents[0]),id:'unrelated',capabilities:{...f.agents[0].capabilities,runtimes:{node:'24'}}});
 const failed=executionPreflight(f).checks.find(c=>c.category==='runtime')!;assert.equal(failed.state,'blocked');assert.deepEqual(failed.agents?.[0].reasons,['node version insufficient']);assert.equal(failed.agents?.length,1);
});
test('offline and legacy Core capabilities remain blocked or unverified',()=>{
 const f=fixture();f.agents[0].status='offline';assert.equal(executionPreflight(f).checks.find(c=>c.category==='agent')?.state,'blocked');
 delete f.overview!.definition!.requirements;assert.equal(executionPreflight(f).checks.find(c=>c.category==='runtime')?.state,'unverified');
});
test('cross-project, draft edits and disconnect do not reuse published green diagnostics',()=>{
 const f=fixture();for(const input of [{...f,connected:false},{...f,dirty:true},{...f,overview:{...f.overview!,definition:{...f.overview!.definition!,projectId:'other'}}}]){
 const r=executionPreflight(input);assert.equal(r.ready,false);assert.equal(r.checks.length,1);assert.equal(r.checks[0].state,'blocked');}
 f.dirtyEditors=1;assert.equal(executionPreflight(f).checks[0].state,'blocked');
});
test('AI status is evidence-scoped and native runtime never implies authenticated account',()=>{
 const f=fixture();f.overview!.definition!.aiTasks={test:{projectId:'p',nodeId:'test',route:{connectionId:'ai',adapter:'openai-codex',model:'model'}} as never};
 assert.equal(executionPreflight(f).checks.find(c=>c.category==='authentication')?.state,'unverified');
 assert.equal(executionPreflight({...f,authentication:{test:'missing'}}).checks.find(c=>c.category==='authentication')?.state,'blocked');
 assert.equal(executionPreflight({...f,authentication:{test:'authenticated'}}).checks.find(c=>c.category==='authentication')?.state,'ready');
 delete f.overview!.definition!.aiTasks;f.graph.nodes.find(n=>n.id==='test')!.frameworkTask={mode:'claude-code',skillId:'skill:start',arguments:'',roleId:'workflow'};f.overview!.definition!.graph=structuredClone(f.graph);
 assert.equal(executionPreflight(f).checks.find(c=>c.category==='authentication')?.state,'unverified');
});
