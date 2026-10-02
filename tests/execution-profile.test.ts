import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProtocol} from '../src/features/protocol/parser.ts';
import {resolveTestPlan} from '../src/features/protocol/resolver.ts';
import {validatePayload,matchAgent} from '../src/features/core/matcher.ts';
import {planPayload} from '../src/features/core/test-plan.ts';
import type {Agent} from '../src/features/core/domain.ts';
const sources=(profiles:unknown={node24:{requirements:{os:'windows',runtimes:{node:'>=24'}},installTask:'install'}},testEntry:unknown={task:'unit',type:'unit',executionProfile:'node24'})=>({'project.yml':JSON.stringify({version:1,project:{name:'controlled',type:'node'},executionProfiles:profiles}),'tasks.yml':JSON.stringify({unit:{command:'node',args:['test.cjs'],requirements:{runtimes:{node:'>=20'}}},install:{command:'node',args:['install.cjs']}}),'tests.yml':JSON.stringify({unit:testEntry})});
test('profile runtime constraints survive task overrides and the Core payload boundary',()=>{
 const state=parseProtocol(sources());const plan=resolveTestPlan(state,'project','unit','plan');
 assert.equal(plan.requirements.runtimes?.node,'>=24');assert.equal(plan.steps[0].stage,'install');assert.equal(plan.steps[0].taskReference,'install');
 const normalized=validatePayload(planPayload(plan)).testPlan!;assert.deepEqual(normalized.executionProfile,plan.executionProfile);
 assert.equal(normalized.executionProfile?.name,'node24');
 const agent:Agent={id:'agent',name:'Controlled agent',lastSeenAt:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'idle',platform:'windows',architecture:'x86_64',capabilities:{cpuCores:8,memoryMiB:8192,docker:false,gpu:false,pty:true,browsers:[],runtimes:{node:'22.0.0'}}};
 assert.equal(matchAgent(agent,normalized.requirements).matches,false);
 assert.equal(matchAgent({...agent,capabilities:{...agent.capabilities,runtimes:{node:'24.11.1'}}},normalized.requirements).matches,true);
 const stale=structuredClone(plan);stale.requirements.runtimes!.node='>=20';assert.throws(()=>validatePayload(planPayload(stale)),/cannot be weakened/);
});
test('profile dependency installation uses Protocol tasks and explicit test pipeline overrides are retained',()=>{
 const plan=resolveTestPlan(parseProtocol(sources(undefined,{task:'unit',type:'unit',executionProfile:'node24',pipeline:{install:'unit'}})),'project','unit');
 assert.equal(plan.steps[0].taskReference,'unit');
 for(const definition of [sources({node24:{requirements:{},installTask:'missing'}}),sources({}, {task:'unit',type:'unit',executionProfile:'missing'}),sources({node24:{requirements:{},shell:'rm'}})])assert.equal(parseProtocol(definition).status,'Invalid');
});
test('incompatible profile OS and pipeline requirements fail before queuing',()=>{
 assert.throws(()=>resolveTestPlan(parseProtocol(sources({node24:{requirements:{os:'linux'}}},{task:'unit',type:'unit',executionProfile:'node24',requirements:{os:'windows'}})),'project','unit'),/conflicting platform/);
 const plan=resolveTestPlan(parseProtocol(sources()),'project','unit');const forged=structuredClone(plan);forged.requirements.platform='linux';assert.throws(()=>validatePayload(planPayload(forged)),/cannot be weakened/);
});
