import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProtocol} from '../src/features/protocol/parser.ts';
import {resolveProtocol,resolveTestPlan} from '../src/features/protocol/resolver.ts';
import {validatePayload,matchAgent} from '../src/features/core/matcher.ts';
import {CoreService} from '../src/features/core/service.ts';
import {InMemoryCoreRepository} from '../src/features/core/repository.ts';
import type {Project} from '../src/features/projects/types/project.ts';
import {validateBuildArtifactDeclaration} from '../src/features/orchestration/build-artifact.ts';
const tasks={build:{command:'node',args:['build.cjs'],artifacts:{outputs:[{name:'desktop',path:'out/app.exe'}]}},verify:{command:'node',args:['verify.cjs'],artifacts:{inputs:[{fromTask:'build',name:'desktop',path:'received/app.exe'}]}}};
const sources={'project.yml':JSON.stringify({version:1,project:{name:'Artifacts',type:'desktop'}}),'tasks.yml':JSON.stringify(tasks),'tests.yml':JSON.stringify({verify:{task:'verify',type:'unit'}})};
test('Protocol declares exact outputs/inputs and preserves them through task and test plans',()=>{
 const state=parseProtocol(sources);assert.equal(state.status,'Valid');if(state.status!=='Valid')return;
 const job=resolveProtocol(state,'task','build');assert.equal(job.requirements.buildArtifacts,1);assert.deepEqual(job.payload.steps[0].buildArtifacts?.outputs,tasks.build.artifacts.outputs);
 const plan=resolveTestPlan(state,'p','verify');assert.equal(plan.requirements.buildArtifacts,1);assert.deepEqual(plan.steps.find(s=>s.stage==='test')?.buildArtifacts?.inputs,tasks.verify.artifacts.inputs);
 const normalized=validatePayload(job.payload);normalized.steps[0].buildArtifacts!.outputs[0].path='changed.exe';assert.equal(job.payload.steps[0].buildArtifacts!.outputs[0].path,'out/app.exe');
});
test('Protocol rejects missing/self producer output, credential and ambiguous target declarations',()=>{
 for(const artifacts of [{inputs:[{fromTask:'missing',name:'desktop',path:'received.exe'}]},{inputs:[{fromTask:'verify',name:'desktop',path:'received.exe'}]},{inputs:[{fromTask:'build',name:'missing',path:'received.exe'}]},{outputs:[{name:'desktop',path:'.env'}]}])assert.equal(parseProtocol({...sources,'tasks.yml':JSON.stringify({...tasks,verify:{command:'node',artifacts}})}).status,'Invalid');
 for(const declaration of [{outputs:[{name:'desktop',path:'a.exe'},{name:'desktop',path:'b.exe'}]},{outputs:[{name:'a',path:'App.exe'},{name:'b',path:'app.exe'}]},{inputs:[{fromTask:'build',name:'desktop',path:'a.exe'}],outputs:[{name:'copy',path:'a.exe'}]},{outputs:[{name:'desktop',path:'../app.exe'}]},{outputs:[{name:'desktop',path:'app.exe',url:'http://elsewhere'}]}])assert.throws(()=>validateBuildArtifactDeclaration(declaration));
});
test('old Agent cannot match artifact transfer; unsupported Core refuses job without mutation',async()=>{
 const core=new CoreService(new InMemoryCoreRepository(),{get:async id=>({id,name:'A'} as Project)}),agent=core.connectAgent('legacy',{name:'Legacy',platform:'windows',architecture:'x86_64',capabilities:{cpuCores:2,memoryMiB:1024,docker:false,gpu:false,pty:false,runtimes:{node:'24'},browsers:[]}});
 const state=parseProtocol(sources);const job=resolveProtocol(state,'task','build');assert.deepEqual(matchAgent(agent,job.requirements).reasons,['Build artifact transfer v1 unavailable']);assert.equal(core.supportsBuildArtifacts(),false);await assert.rejects(core.createJob('p',job),/enabled Core runtime/);assert.equal(core.snapshot('p').jobs.length,0);
});
