import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyArtifactInstallation,type ArtifactInstallationScope} from '../src/features/orchestration/artifact-installation.ts';
const time='2026-10-05T12:00:00.000Z';
const artifact={version:1 as const,id:'artifact-1',projectId:'project',executionId:'execution',graphRevision:1,producerActivationId:'producer',producerNodeId:'build',producerRunId:'run-build',producerStepId:'step-build',snapshotId:'snapshot',sourceChecksum:'a'.repeat(64),name:'desktop',path:'out/app.bin',size:10,checksum:'b'.repeat(64)};
const scope:ArtifactInstallationScope={projectId:'project',executionId:'execution',graphRevision:1,snapshotId:'snapshot',sourceChecksum:artifact.sourceChecksum,consumerActivationId:'consumer',consumerNodeId:'test',consumerRunId:'run-test',consumerStepId:'step-test',agentId:'agent',inputs:[{artifact,path:'received/app.bin'}]};
const report={id:artifact.id,path:'received/app.bin',size:10,checksum:artifact.checksum};
test('installation receipt binds trusted producer and consumer identities without inferring test success',()=>{
 const r=verifyArtifactInstallation([report],scope,time);assert.equal(r.consumerRunId,'run-test');assert.equal(r.inputs[0].artifact.producerRunId,'run-build');assert.equal('status' in r,false);assert.notEqual(r.inputs[0].artifact,artifact);
});
test('missing, duplicate and foreign installation results fail closed',()=>{
 for(const reports of [[],[report,report],[{...report,id:'foreign'}],[{...report,size:11}],[{...report,checksum:'c'.repeat(64)}],[{...report,path:'other/app.bin'}],[{...report,path:'../app.bin'}]])assert.throws(()=>verifyArtifactInstallation(reports,scope,time));
 for(const field of ['token','producerRunId','agentId','consumerRunId'])assert.throws(()=>verifyArtifactInstallation([{...report,[field]:'spoof'}],scope,time));
});
test('trusted input must belong to captured project, execution, revision and Snapshot',()=>{
 for(const change of [{projectId:'other'},{executionId:'other'},{graphRevision:2},{snapshotId:'other'},{sourceChecksum:'c'.repeat(64)}])assert.throws(()=>verifyArtifactInstallation([report],{...scope,inputs:[{path:report.path,artifact:{...artifact,...change}}]},time),/producer scope mismatch/);
 for(const change of [{agentId:''},{consumerRunId:'../run'},{graphRevision:0}])assert.throws(()=>verifyArtifactInstallation([report],{...scope,...change},time));
 assert.throws(()=>verifyArtifactInstallation([report],scope,'invalid'));
});
test('all installed inputs are matched independent of report order and target collisions are rejected',()=>{
 const second={...artifact,id:'artifact-2',name:'library',path:'out/lib.bin'},s={...scope,inputs:[...scope.inputs,{artifact:second,path:'received/lib.bin'}]};
 const r=verifyArtifactInstallation([{...report,id:second.id,path:'received/lib.bin'},report],s,time);assert.deepEqual(r.inputs.map(i=>i.artifact.id),['artifact-1','artifact-2']);
 assert.throws(()=>verifyArtifactInstallation([report],{...scope,inputs:[...scope.inputs,{artifact:second,path:'RECEIVED/app.bin'}]},time),/Duplicate/);
});
