import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBuildArtifactDeclaration,artifactProtocolVersion,validateBuildArtifact} from '../src/features/orchestration/build-artifact.ts';
import {artifactGraphFixture} from './helpers/build-artifact-fixture.ts';
import {matchAgent} from '../src/features/core/matcher.ts';
test('executable policy is explicit boolean on every v2 entry and v1 stays unchanged',()=>{
 const v1=validateBuildArtifactDeclaration({outputs:[{name:'app',path:'out/app'}]});assert.equal(artifactProtocolVersion(v1),1);
 assert.equal(artifactProtocolVersion(validateBuildArtifactDeclaration({outputs:[{name:'app',path:'out/app',executable:true}]})),2);
 for(const executable of [null,'true',0,0o777])assert.throws(()=>validateBuildArtifactDeclaration({outputs:[{name:'app',path:'out/app',executable}]}));
 assert.throws(()=>validateBuildArtifactDeclaration({outputs:[{name:'app',path:'out/app',executable:true},{name:'lib',path:'out/lib'}]}));
});
test('v2 graph requires capable Agents and matching producer/consumer policies',async()=>{
 const f=await artifactGraphFixture(true,true);await f.publish();await f.start();const job=f.core.snapshot(f.projectId).jobs[0],agent={...f.core.snapshot(f.projectId).agents[0],status:'idle' as const};assert.equal(job.requirements.buildArtifacts,2);await assert.rejects(f.core.createJob(f.projectId,{...job,requirements:{...job.requirements,buildArtifacts:1}}),/compatible Agent/);assert.equal(matchAgent({...agent,capabilities:{...agent.capabilities,buildArtifacts:1}},job.requirements).matches,false);assert.equal(matchAgent(agent,job.requirements).matches,true);assert.equal(matchAgent(agent,{buildArtifacts:1}).matches,true);
 const bad=await artifactGraphFixture(true,true),tasks=JSON.parse(bad.sources['tasks.yml']);tasks.verify.artifacts.inputs[0].executable=false;bad.sources['tasks.yml']=JSON.stringify(tasks);await assert.rejects(bad.publish(),/policy must match/);
});
test('metadata v1 cannot carry executable flag and v2 cannot omit or spoof it',()=>{
 const a={version:1,id:'artifact',projectId:'project',executionId:'execution',graphRevision:1,producerActivationId:'producer',producerNodeId:'build',producerRunId:'run',producerStepId:'step',snapshotId:'snapshot',sourceChecksum:'a'.repeat(64),name:'app',path:'out/app',size:1,checksum:'b'.repeat(64)};
 assert.throws(()=>validateBuildArtifact({...a,executable:true}));assert.throws(()=>validateBuildArtifact({...a,version:2}));assert.throws(()=>validateBuildArtifact({...a,version:2,executable:'true'}));assert.equal(validateBuildArtifact({...a,version:2,executable:false}).executable,false);
});
