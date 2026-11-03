import test from 'node:test';import assert from 'node:assert/strict';
import {strictExecutionIsolation,validateExecutionIsolation,validateIsolationBoundary} from '../src/features/process/isolation.ts';
import {validateCapabilities,validatePayload,validateRequirements,matchAgent} from '../src/features/core/matcher.ts';
import {resolveProtocol,resolveTestPlan} from '../src/features/protocol/resolver.ts';
import {parseProtocol} from '../src/features/protocol/parser.ts';
import type {Agent} from '../src/features/core/domain.ts';
import {CoreService} from '../src/features/core/service.ts';
import {InMemoryCoreRepository} from '../src/features/core/repository.ts';
import type {Project} from '../src/features/projects/types/project.ts';
import {isolationReview} from '../src/features/orchestration/isolation-review.ts';
const source={ 'project.yml':JSON.stringify({version:1,project:{name:'isolated',type:'generic'},requirements:{tools:{executionIsolation:true}}}), 'tasks.yml':JSON.stringify({check:{command:'node',args:['check.cjs']}}), 'tests.yml':JSON.stringify({check:{task:'check',type:'unit'}}) };
const bounded=(maxProcesses=2)=>({version:2 as const,filesystem:'workspace' as const,network:'deny' as const,childProcesses:'bounded' as const,maxProcesses});
test('bounded children require explicit valid scope and compatible Agent capacity',()=>{
 assert.deepEqual(validateExecutionIsolation(bounded()),bounded());
 for(const count of [0,1,5,2.5,'2'])assert.throws(()=>validateExecutionIsolation({...bounded(),maxProcesses:count}));
 assert.throws(()=>validateRequirements({isolatedChildProcesses:2}));
 assert.throws(()=>validateCapabilities({...agent.capabilities,isolatedChildProcesses:2}));
 const requirements={executionIsolation:1 as const,isolatedChildProcesses:2};
 assert.equal(matchAgent({...agent,capabilities:{...agent.capabilities,executionIsolation:1}},requirements).matches,false);
 assert.equal(matchAgent({...agent,capabilities:{...agent.capabilities,executionIsolation:1,isolatedChildProcesses:4}},requirements).matches,true);
 const payload={task:'check',steps:[{name:'check',executable:'node',args:[],cwd:'.',isolation:bounded()}]};
 assert.throws(()=>validateIsolationBoundary({executionIsolation:1},payload));
 assert.throws(()=>validateIsolationBoundary(requirements,{...payload,steps:[{...payload.steps[0],isolation:bounded(4)}]}));
 validateIsolationBoundary(requirements,payload);
});
test('Protocol intersects child permission layers and never loosens inherited denial',()=>{
 const resolve=(project:unknown,task:unknown)=>resolveProtocol(parseProtocol({...source,'project.yml':JSON.stringify({version:1,project:{name:'scope',type:'generic'},requirements:{tools:project}}),'tasks.yml':JSON.stringify({check:{command:'node',args:[],requirements:{tools:task}}})}),'task','check');
 assert.equal(resolve({isolatedChildProcesses:4},{}).payload.steps[0].isolation?.version,2);
 assert.equal(resolve({isolatedChildProcesses:4},{isolatedChildProcesses:2}).requirements.isolatedChildProcesses,2);
 assert.equal(resolve({executionIsolation:true},{isolatedChildProcesses:4}).payload.steps[0].isolation?.version,1);
 assert.equal(resolve({isolatedChildProcesses:4},{executionIsolation:true}).requirements.isolatedChildProcesses,undefined);
 for(const value of [1,5,'2',null])assert.notEqual(parseProtocol({...source,'project.yml':JSON.stringify({version:1,project:{name:'invalid',type:'generic'},requirements:{tools:{isolatedChildProcesses:value}}})}).status,'Valid');
});
test('permission review includes only sealed step policy and excludes args env and credentials',()=>{
 const plan={name:'task',requirements:{executionIsolation:1 as const,isolatedChildProcesses:2},payload:{task:'check',steps:[{name:'step',executable:'engine',args:['dummy-private-argument'],env:{DUMMY:'dummy-private-value'},cwd:'.',isolation:bounded()}]}};
 const review=isolationReview({plans:{node:plan}});assert.deepEqual(review.node,[{step:'step',policy:bounded()}]);
 const encoded=JSON.stringify(review);assert.ok(!encoded.includes('dummy-private'));assert.ok(!encoded.includes('engine'));
 review.node[0].policy.network='deny';assert.notEqual(review.node[0].policy,plan.payload.steps[0].isolation);
});
const agent:Agent={id:'agent',name:'Legacy',status:'idle',platform:'windows',architecture:'x86_64',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastSeenAt:null,capabilities:{cpuCores:2,memoryMiB:1024,docker:false,gpu:false,pty:false,browsers:[],runtimes:{}}};
test('strict isolation rejects unknown versions permissions and malformed fields',()=>{assert.deepEqual(validateExecutionIsolation(strictExecutionIsolation()),strictExecutionIsolation());for(const p of [{...strictExecutionIsolation(),network:'allow'},{...strictExecutionIsolation(),childProcesses:'allow'},{...strictExecutionIsolation(),version:2},{...strictExecutionIsolation(),outsidePath:'/home'},null])assert.throws(()=>validateExecutionIsolation(p));assert.throws(()=>validateCapabilities({...agent.capabilities,executionIsolation:2} as never));assert.throws(()=>validateRequirements({executionIsolation:2} as never));});
test('a legacy Agent cannot match required OS enforcement',()=>{assert.equal(matchAgent(agent,{executionIsolation:1}).matches,false);assert.equal(matchAgent({...agent,capabilities:{...agent.capabilities,executionIsolation:1}},{executionIsolation:1}).matches,true);assert.equal(matchAgent(agent,{}).matches,true);});
test('Protocol requirement seals every project executable while trusted cleanup remains separate',()=>{const state=parseProtocol(source);assert.equal(state.status,'Valid');const job=resolveProtocol(state,'test','check'),plan=resolveTestPlan(state,'project','check');assert.equal(job.requirements.executionIsolation,1);assert.deepEqual(job.payload.steps[0].isolation,strictExecutionIsolation());assert.deepEqual(plan.steps.find(s=>s.stage==='test')?.isolation,strictExecutionIsolation());assert.equal(plan.steps.at(-1)?.isolation,undefined);validateIsolationBoundary(plan.requirements,{task:'test',steps:plan.steps});});
test('policy metadata cannot silently downgrade to an unisolated payload',()=>{const step={name:'test',executable:'node',args:['test.cjs'],cwd:'.'},payload=validatePayload({task:'test',steps:[{...step,isolation:strictExecutionIsolation()}]});assert.throws(()=>validateIsolationBoundary({},payload));assert.throws(()=>validateIsolationBoundary({executionIsolation:1},{task:'test',steps:[step]}));validateIsolationBoundary({executionIsolation:1},payload);assert.throws(()=>validatePayload({task:'test',steps:[{...step,isolation:{...strictExecutionIsolation(),network:'allow'}} as never]}));});
test('execution profile requirements are preserved for both direct jobs and test plans',()=>{const profileSource={...source,'project.yml':JSON.stringify({version:1,project:{name:'profile',type:'generic'},executionProfiles:{strict:{requirements:{tools:{executionIsolation:true}}}}}),'tests.yml':JSON.stringify({check:{task:'check',type:'unit',executionProfile:'strict'}})};const state=parseProtocol(profileSource);assert.equal(state.status,'Valid');const job=resolveProtocol(state,'test','check');assert.equal(job.requirements.executionIsolation,1);assert.deepEqual(job.payload.steps[0].isolation,strictExecutionIsolation());assert.equal(resolveTestPlan(state,'project','check').steps[0].isolation?.version,1);});

test('a task cannot weaken required project isolation',()=>{const state=parseProtocol({...source,'tasks.yml':JSON.stringify({check:{command:'node',args:['check.cjs'],requirements:{tools:{executionIsolation:false}}}})});assert.equal(resolveProtocol(state,'test','check').requirements.executionIsolation,1);assert.equal(resolveTestPlan(state,'project','check').requirements.executionIsolation,1);});

test('Core rejects downgraded and missing isolation before persisting a Job or dispatching',async()=>{
 const repository=new InMemoryCoreRepository(),core=new CoreService(repository,{get:async id=>({id} as Project)});
 const step={name:'check',executable:'node',args:['check.cjs'],cwd:'.'};
 await assert.rejects(core.createJob('project',{name:'Missing policy',requirements:{executionIsolation:1},payload:{task:'check',steps:[step]}}),/Every executable/);
 await assert.rejects(core.createJob('project',{name:'Missing capability',requirements:{},payload:{task:'check',steps:[{...step,isolation:strictExecutionIsolation()}]}}),/capability/);
 assert.equal(repository.read().jobs.length,0);
 const legacy=core.registerAgent({name:'Legacy',platform:agent.platform,architecture:agent.architecture,capabilities:agent.capabilities});core.updateAgentStatus(legacy.id,'idle');
 await core.createJob('project',{name:'Isolated',requirements:{executionIsolation:1},payload:{task:'check',steps:[{...step,isolation:strictExecutionIsolation()}]}});
 assert.equal(core.dispatch('project'),null);assert.equal(repository.read().runs.length,0);
 core.updateCapabilities(legacy.id,{...agent.capabilities,executionIsolation:1});
 assert.equal(core.dispatch('project')?.agent.id,legacy.id);
});

test('a serialized execution profile cannot lose its isolation requirement',()=>{
 const state=parseProtocol(source),plan=resolveTestPlan(state,'project','check');
 plan.executionProfile={name:'strict',requirements:{executionIsolation:1}};
 const payload={task:'check',steps:plan.steps,testPlan:plan};
 assert.doesNotThrow(()=>validatePayload(payload));
 assert.throws(()=>validatePayload({...payload,testPlan:{...plan,requirements:{}}}),/constraints cannot be weakened/);
 for(const isolation of [null,false,0,''])assert.throws(()=>validatePayload({task:'check',steps:[{name:'check',executable:'node',args:[],cwd:'.',isolation} as never]}),/isolation policy/);
});
