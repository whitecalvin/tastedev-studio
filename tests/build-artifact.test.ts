import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {buildArtifactPath,consumeBuildArtifact,validateBuildArtifact,type BuildArtifact} from '../src/features/orchestration/build-artifact.ts';
import {BuildArtifactStore} from '../transport/build-artifact-store.ts';
const evidence=path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/build-artifact-foundation-20261005/fixtures');
const bytes=Buffer.from('actual-build-bytes'),checksum=createHash('sha256').update(bytes).digest('hex');
const artifact:BuildArtifact={version:1,id:'artifact-1',projectId:'project-1',executionId:'execution-1',graphRevision:3,producerActivationId:'activation-1',producerNodeId:'build',producerRunId:'run-1',producerStepId:'step-1',snapshotId:'snapshot-1',sourceChecksum:'a'.repeat(64),name:'desktop',path:'out/app.exe',size:bytes.length,checksum};
async function* chunks(value=bytes){yield value.subarray(0,4);yield value.subarray(4);}
async function fixture(action:(store:BuildArtifactStore,root:string)=>Promise<void>){await fs.mkdir(evidence,{recursive:true});const root=await fs.mkdtemp(path.join(evidence,'store-'));try{await action(new BuildArtifactStore(root),root);}finally{await fs.rm(root,{recursive:true,force:true});}}
test('build identity separates project/execution/attempt producer and snapshot; consumer target is relative',()=>{
 const scope={...artifact,path:'received/app.exe'};const result=consumeBuildArtifact({...artifact,token:'not-preserved'},scope);assert.equal(result.path,'received/app.exe');assert.equal('token' in result.artifact,false);
 for(const key of ['projectId','executionId','producerActivationId','producerNodeId','snapshotId','sourceChecksum','name'] as const)assert.throws(()=>consumeBuildArtifact(artifact,{...scope,[key]:'other'}),/scope mismatch/);
 assert.throws(()=>consumeBuildArtifact(artifact,{...scope,graphRevision:4}),/scope mismatch/);assert.throws(()=>validateBuildArtifact({...artifact,size:0}));
});
test('output and consumption paths reject escape, links syntax, credentials and Windows reserved names',()=>{
 for(const name of ['../app.exe','/tmp/app','C:/app.exe','out\\app.exe','out//app','./app','out/con.exe','out/file.','.env','.env.local','a/credentials.json','a/id_ed25519','a/token.key','a/app:p'])assert.throws(()=>buildArtifactPath(name),name);
 assert.equal(buildArtifactPath('target/release/app.exe'),'target/release/app.exe');
});
test('actual byte upload/reopen/read and idempotency preserve immutable producer identity',async()=>fixture(async(store,root)=>{
 await store.put(artifact,chunks());const received=await new BuildArtifactStore(root).get(artifact.projectId,artifact.id);assert.deepEqual(received.bytes,bytes);assert.deepEqual(received.artifact,artifact);await store.put(artifact,chunks());
 await assert.rejects(store.put({...artifact,producerActivationId:'attempt-2'},chunks()),/collision/);await assert.rejects(store.get('other',artifact.id));
}));
test('checksum/size failure and cross-chunk configured secret reject upload without leaving output',async()=>fixture(async(store,root)=>{
 await assert.rejects(store.put({...artifact,checksum:'b'.repeat(64)},chunks()),/checksum/);assert.deepEqual(await fs.readdir(path.join(root,artifact.projectId)),[]);
 await assert.rejects(store.put({...artifact,size:bytes.length-1},chunks()),/size/);
 await assert.rejects(store.put(artifact,chunks(),['actual-build']),/configured secret/);assert.deepEqual(await fs.readdir(path.join(root,artifact.projectId)),[]);
 await store.put(artifact,chunks());await assert.rejects(store.put(artifact,chunks(Buffer.from('tampered-build-byte'))),/size|checksum/);
}));
test('stored tamper and orphan collision never overwrite existing bytes',async()=>fixture(async(store,root)=>{
 await store.put(artifact,chunks());const file=path.join(root,artifact.projectId,artifact.id);await fs.writeFile(file,Buffer.alloc(bytes.length));await assert.rejects(store.get(artifact.projectId,artifact.id),/checksum/);
 await fs.unlink(file+'.json');await assert.rejects(store.put(artifact,chunks()),/already exists/);assert.deepEqual(await fs.readFile(file),Buffer.alloc(bytes.length));
}));
test('store ancestor symlink/junction cannot write outside configured root',async()=>fixture(async(_store,root)=>{
 const outside=path.join(root,'outside'),link=path.join(root,'linked');await fs.mkdir(outside);await fs.symlink(outside,link,process.platform==='win32'?'junction':'dir');await assert.rejects(new BuildArtifactStore(link).put(artifact,chunks()),/links forbidden/);assert.deepEqual(await fs.readdir(outside),[]);
}));
test('concurrent writers of the same identity cannot overwrite the winning producer',async()=>fixture(async(store,root)=>{
 let arrivals=0;let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});
 async function* concurrent(){if(++arrivals===2)release();await barrier;yield bytes;}
 const alternate={...artifact,producerActivationId:'activation-2'};
 const results=await Promise.allSettled([store.put(artifact,concurrent()),new BuildArtifactStore(root).put(alternate,concurrent())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const saved=await store.get(artifact.projectId,artifact.id);const winner=results.find(r=>r.status==='fulfilled');assert(winner?.status==='fulfilled');assert.deepEqual(saved.artifact,winner.value);assert.deepEqual(saved.bytes,bytes);
}));
test('authority revoked between streamed chunks removes partial bytes and preserves prior artifacts',async()=>fixture(async(store,root)=>{
 let allowed=true;const verify=()=>{if(!allowed)throw Error('revoked');};
 async function* revoked(){yield bytes.subarray(0,4);allowed=false;yield bytes.subarray(4);}
 await assert.rejects(store.put(artifact,revoked(),[],verify),/revoked/);assert.deepEqual(await fs.readdir(path.join(root,artifact.projectId)),[]);
 allowed=true;await store.put(artifact,chunks(),[],verify);
 await assert.rejects(store.put(artifact,revoked(),[],verify),/revoked/);assert.deepEqual((await store.get(artifact.projectId,artifact.id)).bytes,bytes);
}));
